// ─── ILogsProvider ───────────────────────────────────────────────────────────
// Fetch structured log lines from a Lambda function's log group.
// CloudWatch Logs implementation uses FilterLogEvents + StartQuery (Insights).

export interface LogLine {
  timestamp: number;
  message: string;
  logStreamName: string;
}

export interface LogQueryOptions {
  functionName: string;
  startTime: Date;
  endTime: Date;
  filterPattern?: string;
  limit?: number;
  nextToken?: string;
}

export interface LogQueryResult {
  lines: LogLine[];
  nextToken?: string;
}

// ─── Correlated Logs (cross-service log correlation by traceId) ─────────────

export interface CorrelatedLogEntry {
  timestamp: number;
  service: string;
  level: string;
  message: string;
  traceId: string;
  logTraceId?: string; // actual traceId from structured log (may differ from query traceId)
  spanId?: string;
  correlationId?: string;
  extras: Record<string, string>;
}

export interface CorrelatedLogResult {
  logs: CorrelatedLogEntry[];
  scannedLogGroups: string[];
}

// ─── Event Chain (correlationId-based cross-service grouping) ───────────────

export interface EventChainSummary {
  correlationId: string;
  description: string;
  startTime: number;
  endTime: number;
  duration: number;
  services: string[];
  eventTypes: string[];
  hasErrors: boolean;
  logCount: number;
}

export interface EventChainListResult {
  chains: EventChainSummary[];
  scannedLogGroups: string[];
}

export interface ILogsProvider {
  queryLogs(options: LogQueryOptions): Promise<LogQueryResult>;
  queryLogsByTraceId(traceId: string, logGroupNames: string[], windowMinutes?: number): Promise<CorrelatedLogResult>;
  queryLogsByCorrelation(correlationIds: string[], logGroupNames: string[], windowMinutes?: number): Promise<CorrelatedLogResult>;
  queryLogsByCorrelationId(correlationId: string, logGroupNames: string[], windowMinutes?: number): Promise<CorrelatedLogResult>;
  queryRecentEventChains(logGroupNames: string[], windowMinutes?: number): Promise<EventChainListResult>;
}
