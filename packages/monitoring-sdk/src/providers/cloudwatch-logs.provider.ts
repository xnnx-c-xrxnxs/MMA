import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  FilterLogEventsCommandInput,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  ILogsProvider,
  LogQueryOptions,
  LogQueryResult,
  LogLine,
  CorrelatedLogEntry,
  CorrelatedLogResult,
  EventChainSummary,
  EventChainListResult,
} from '../interfaces/logs-provider.interface';

// Lambda log group name convention: /aws/lambda/{functionName}
function toLogGroupName(functionName: string): string {
  return `/aws/lambda/${functionName}`;
}

/**
 * Convert X-Ray trace ID to OTel hex trace ID.
 * X-Ray format:  1-{hex8}-{hex24}  (e.g. 1-69e63b5c-71c374b52eed33bc01b4ff8c)
 * OTel format:   {hex8}{hex24}      (e.g. 69e63b5c71c374b52eed33bc01b4ff8c)
 * Structured logs from createLogger() use the OTel hex format.
 */
function xrayToOtelTraceId(xrayTraceId: string): string {
  const parts = xrayTraceId.split('-');
  if (parts.length === 3 && parts[0] === '1') {
    return parts[1] + parts[2];
  }
  return xrayTraceId; // Already in hex format or unknown
}

export class CloudWatchLogsProvider implements ILogsProvider {
  private readonly client: CloudWatchLogsClient;

  constructor(region: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  async queryLogs(options: LogQueryOptions): Promise<LogQueryResult> {
    const input: FilterLogEventsCommandInput = {
      logGroupName: toLogGroupName(options.functionName),
      startTime: options.startTime.getTime(),
      endTime: options.endTime.getTime(),
      limit: options.limit ?? 100,
      nextToken: options.nextToken,
    };

    if (options.filterPattern) {
      input.filterPattern = options.filterPattern;
    }

    const response = await this.client.send(new FilterLogEventsCommand(input));

    const lines: LogLine[] = (response.events ?? []).map((event) => ({
      timestamp: event.timestamp ?? 0,
      message: event.message ?? '',
      logStreamName: event.logStreamName ?? '',
    }));

    return {
      lines,
      nextToken: response.nextToken,
    };
  }

  async queryLogsByTraceId(
    traceId: string,
    logGroupNames: string[],
    windowMinutes = 60,
  ): Promise<CorrelatedLogResult> {
    if (logGroupNames.length === 0) {
      return { logs: [], scannedLogGroups: [] };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    // X-Ray trace ID format: 1-{hex8}-{hex24} → OTel hex traceId: {hex8}{hex24}
    // We need to search for BOTH formats since logs use the OTel hex format
    const otelTraceId = xrayToOtelTraceId(traceId);

    // CloudWatch Logs Insights query — search for both X-Ray and OTel trace ID formats
    const filterClause = otelTraceId !== traceId
      ? `filter traceId = "${otelTraceId}" or traceId = "${traceId}"`
      : `filter traceId = "${traceId}"`;

    const queryString = [
      'fields @timestamp, @message, @logGroup',
      filterClause,
      'sort @timestamp asc',
      'limit 500',
    ].join(' | ');

    const startResponse = await this.client.send(
      new StartQueryCommand({
        logGroupNames,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString,
      }),
    );

    const queryId = startResponse.queryId;
    if (!queryId) {
      return { logs: [], scannedLogGroups: logGroupNames };
    }

    // Poll for results (max 15 seconds)
    const logs: CorrelatedLogEntry[] = [];
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.client.send(
        new GetQueryResultsCommand({ queryId }),
      );

      if (
        result.status === QueryStatus.Complete ||
        result.status === QueryStatus.Failed ||
        result.status === QueryStatus.Cancelled
      ) {
        if (result.status === QueryStatus.Complete && result.results) {
          for (const row of result.results) {
            const entry = this.parseInsightsRow(row, traceId);
            if (entry) {
              logs.push(entry);
            }
          }
        }
        break;
      }

      // Wait 500ms before next poll
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { logs, scannedLogGroups: logGroupNames };
  }

  private parseInsightsRow(
    row: Array<{ field?: string; value?: string }>,
    traceId: string,
  ): CorrelatedLogEntry | null {
    const fieldMap: Record<string, string> = {};
    for (const field of row) {
      if (field.field && field.value) {
        fieldMap[field.field] = field.value;
      }
    }

    const message = fieldMap['@message'] ?? '';
    const timestamp = fieldMap['@timestamp']
      ? new Date(fieldMap['@timestamp']).getTime()
      : 0;

    // Derive service name from @logGroup as fallback: /aws/lambda/{fn-name}
    const logGroup = fieldMap['@logGroup'] ?? '';
    const serviceFromLogGroup = logGroup.startsWith('/aws/lambda/')
      ? logGroup.replace('/aws/lambda/', '')
      : '';

    // Try to parse structured JSON log
    try {
      const parsed = JSON.parse(message) as Record<string, unknown>;
      const { service, level, message: msg, spanId, ...rest } = parsed as Record<string, string>;

      // Extract the actual traceId from the structured log (may differ from query traceId)
      const logTraceId = (parsed.traceId as string) ?? undefined;
      const correlationIdVal = (parsed.correlationId as string) ?? undefined;

      // Collect extra fields (orderId, eventType, messageId, etc.)
      const extras: Record<string, string> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (
          key !== 'timestamp' &&
          key !== 'traceId' &&
          key !== 'correlationId' &&
          typeof value === 'string'
        ) {
          extras[key] = value;
        }
      }

      return {
        timestamp: parsed.timestamp
          ? new Date(parsed.timestamp as string).getTime()
          : timestamp,
        service: service || serviceFromLogGroup || 'unknown',
        level: level ?? 'INFO',
        message: msg ?? message,
        traceId,
        logTraceId,
        correlationId: correlationIdVal,
        spanId: spanId ?? undefined,
        extras,
      };
    } catch {
      // Non-JSON log line (START, END, REPORT) — include as-is
      if (message.startsWith('START') || message.startsWith('END') || message.startsWith('REPORT')) {
        return null; // Skip Lambda runtime lines
      }
      return {
        timestamp,
        service: serviceFromLogGroup || 'unknown',
        level: 'INFO',
        message,
        traceId,
        extras: {},
      };
    }
  }

  async queryLogsByCorrelation(
    correlationIds: string[],
    logGroupNames: string[],
    windowMinutes = 120,
  ): Promise<CorrelatedLogResult> {
    if (correlationIds.length === 0 || logGroupNames.length === 0) {
      return { logs: [], scannedLogGroups: [] };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    // Build filter: search for any of the correlation IDs in the raw message
    const filterParts = correlationIds.map((id) => `@message like "${id}"`);
    const filterClause = `filter ${filterParts.join(' or ')}`;

    const queryString = [
      'fields @timestamp, @message, @logGroup',
      filterClause,
      'sort @timestamp asc',
      'limit 200',
    ].join(' | ');

    const startResponse = await this.client.send(
      new StartQueryCommand({
        logGroupNames,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString,
      }),
    );

    const queryId = startResponse.queryId;
    if (!queryId) {
      return { logs: [], scannedLogGroups: logGroupNames };
    }

    const logs: CorrelatedLogEntry[] = [];
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.client.send(
        new GetQueryResultsCommand({ queryId }),
      );

      if (
        result.status === QueryStatus.Complete ||
        result.status === QueryStatus.Failed ||
        result.status === QueryStatus.Cancelled
      ) {
        if (result.status === QueryStatus.Complete && result.results) {
          for (const row of result.results) {
            const entry = this.parseInsightsRow(row, '');
            if (entry) {
              logs.push(entry);
            }
          }
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { logs, scannedLogGroups: logGroupNames };
  }

  async queryLogsByCorrelationId(
    correlationId: string,
    logGroupNames: string[],
    windowMinutes = 120,
  ): Promise<CorrelatedLogResult> {
    if (!correlationId || logGroupNames.length === 0) {
      return { logs: [], scannedLogGroups: [] };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    // Use CloudWatch Insights JSON field filter — more precise than @message text search
    const queryString = [
      'fields @timestamp, @message, @logGroup',
      `filter correlationId = "${correlationId}"`,
      'sort @timestamp asc',
      'limit 500',
    ].join(' | ');

    const startResponse = await this.client.send(
      new StartQueryCommand({
        logGroupNames,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString,
      }),
    );

    const queryId = startResponse.queryId;
    if (!queryId) {
      return { logs: [], scannedLogGroups: logGroupNames };
    }

    const logs: CorrelatedLogEntry[] = [];
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.client.send(
        new GetQueryResultsCommand({ queryId }),
      );

      if (
        result.status === QueryStatus.Complete ||
        result.status === QueryStatus.Failed ||
        result.status === QueryStatus.Cancelled
      ) {
        if (result.status === QueryStatus.Complete && result.results) {
          for (const row of result.results) {
            const entry = this.parseInsightsRow(row, '');
            if (entry) {
              logs.push(entry);
            }
          }
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { logs, scannedLogGroups: logGroupNames };
  }

  async queryRecentEventChains(
    logGroupNames: string[],
    windowMinutes = 60,
  ): Promise<EventChainListResult> {
    if (logGroupNames.length === 0) {
      return { chains: [], scannedLogGroups: [] };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    // Fetch recent logs that have a correlationId field — CloudWatch auto-discovers JSON fields
    const queryString = [
      'fields @timestamp, @message, @logGroup',
      'filter ispresent(correlationId) and correlationId != ""',
      'sort @timestamp desc',
      'limit 2000',
    ].join(' | ');

    const startResponse = await this.client.send(
      new StartQueryCommand({
        logGroupNames,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString,
      }),
    );

    const queryId = startResponse.queryId;
    if (!queryId) {
      return { chains: [], scannedLogGroups: logGroupNames };
    }

    // Poll for results
    const rawLogs: CorrelatedLogEntry[] = [];
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.client.send(
        new GetQueryResultsCommand({ queryId }),
      );

      if (
        result.status === QueryStatus.Complete ||
        result.status === QueryStatus.Failed ||
        result.status === QueryStatus.Cancelled
      ) {
        if (result.status === QueryStatus.Complete && result.results) {
          for (const row of result.results) {
            const entry = this.parseInsightsRow(row, '');
            if (entry) {
              rawLogs.push(entry);
            }
          }
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Group by correlationId and build summaries
    const chainMap = new Map<string, {
      logs: CorrelatedLogEntry[];
      services: Set<string>;
      eventTypes: Set<string>;
      hasErrors: boolean;
      minTime: number;
      maxTime: number;
    }>();

    for (const log of rawLogs) {
      const cid = log.correlationId;
      if (!cid) continue;

      let chain = chainMap.get(cid);
      if (!chain) {
        chain = {
          logs: [],
          services: new Set(),
          eventTypes: new Set(),
          hasErrors: false,
          minTime: log.timestamp,
          maxTime: log.timestamp,
        };
        chainMap.set(cid, chain);
      }

      chain.logs.push(log);
      chain.services.add(log.service);
      if (log.extras['eventType']) {
        chain.eventTypes.add(log.extras['eventType']);
      }
      if (log.level === 'ERROR') {
        chain.hasErrors = true;
      }
      chain.minTime = Math.min(chain.minTime, log.timestamp);
      chain.maxTime = Math.max(chain.maxTime, log.timestamp);
    }

    // Convert to sorted array (most recent first)
    const chains: EventChainSummary[] = Array.from(chainMap.entries())
      .map(([correlationId, chain]) => {
        // Derive description from the earliest log message in the chain
        const sorted = chain.logs.sort((a, b) => a.timestamp - b.timestamp);
        const firstMsg = sorted[0]?.message ?? '';
        const description = this.deriveChainDescription(firstMsg, Array.from(chain.eventTypes));

        return {
          correlationId,
          description,
          startTime: chain.minTime,
          endTime: chain.maxTime,
          duration: chain.maxTime - chain.minTime,
          services: Array.from(chain.services),
          eventTypes: Array.from(chain.eventTypes),
          hasErrors: chain.hasErrors,
          logCount: chain.logs.length,
        };
      })
      .sort((a, b) => b.startTime - a.startTime);

    return { chains, scannedLogGroups: logGroupNames };
  }

  /**
   * Derive a human-readable description for an event chain from its first log message
   * and event types. Uses the earliest log message as the primary description.
   */
  private deriveChainDescription(firstMessage: string, eventTypes: string[]): string {
    if (!firstMessage) {
      // Fallback to event types if no message
      if (eventTypes.length > 0) {
        return eventTypes
          .map((t) => t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
          .join(' → ');
      }
      return 'Unknown operation';
    }

    // Strip trailing context like " — publishing EVENT_TYPE event"
    const cleaned = firstMessage.replace(/\s*—\s*publishing.*$/i, '').trim();

    // If we have event types that indicate a saga / cross-service chain,
    // append a summary of the downstream effects
    if (eventTypes.length > 0 && cleaned) {
      const downstream = eventTypes
        .map((t) => t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
        .join(', ');
      return `${cleaned} → ${downstream}`;
    }

    return cleaned || 'Unknown operation';
  }
}
