import {
  XRayClient,
  GetTraceSummariesCommand,
  BatchGetTracesCommand,
  GetServiceGraphCommand,
  TimeRangeType,
  TraceSummary as XRaySummary,
  Segment,
} from '@aws-sdk/client-xray';
import {
  ITracesProvider,
  TraceQueryOptions,
  TraceSummaryResult,
  TraceSummary,
  TraceDetail,
  TraceSegment,
  ServiceGraph,
  ServiceGraphNode,
  ServiceGraphEdge,
  TraceJourney,
  JourneySegment,
  ServiceParticipant,
} from '../interfaces/traces-provider.interface';

function toTraceSummary(summary: XRaySummary): TraceSummary {
  return {
    traceId: summary.Id ?? '',
    duration: summary.Duration ?? 0,
    responseTime: summary.ResponseTime ?? 0,
    fault: summary.HasFault ?? false,
    error: summary.HasError ?? false,
    throttle: summary.HasThrottle ?? false,
    httpMethod: summary.Http?.HttpMethod ?? undefined,
    httpUrl: summary.Http?.HttpURL ?? undefined,
    httpStatus: summary.Http?.HttpStatus ?? undefined,
    rootServiceName: summary.EntryPoint?.Name ?? undefined,
    startTime: summary.StartTime?.getTime() ?? 0,
    hasError: summary.HasError ?? false,
  };
}

function parseSegmentDocument(segment: Segment): TraceSegment | null {
  if (!segment.Document) return null;

  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(segment.Document) as Record<string, unknown>;
  } catch {
    return null;
  }

  const subsegmentsRaw = doc.subsegments as Array<Record<string, unknown>> | undefined;

  return {
    id: (doc.id as string) ?? segment.Id ?? '',
    name: (doc.name as string) ?? '',
    startTime: ((doc.start_time as number) ?? 0) * 1000,
    endTime: ((doc.end_time as number) ?? 0) * 1000,
    duration: (((doc.end_time as number) ?? 0) - ((doc.start_time as number) ?? 0)) * 1000,
    fault: (doc.fault as boolean) ?? false,
    error: (doc.error as boolean) ?? false,
    throttle: (doc.throttle as boolean) ?? false,
    origin: doc.origin as string | undefined,
    subsegments: subsegmentsRaw?.map((sub) =>
      parseSubsegment(sub),
    ).filter((s): s is TraceSegment => s !== null),
  };
}

function parseSubsegment(sub: Record<string, unknown>): TraceSegment | null {
  const subsegmentsRaw = sub.subsegments as Array<Record<string, unknown>> | undefined;

  return {
    id: (sub.id as string) ?? '',
    name: (sub.name as string) ?? '',
    startTime: ((sub.start_time as number) ?? 0) * 1000,
    endTime: ((sub.end_time as number) ?? 0) * 1000,
    duration: (((sub.end_time as number) ?? 0) - ((sub.start_time as number) ?? 0)) * 1000,
    fault: (sub.fault as boolean) ?? false,
    error: (sub.error as boolean) ?? false,
    throttle: (sub.throttle as boolean) ?? false,
    origin: sub.namespace as string | undefined,
    subsegments: subsegmentsRaw?.map((s) => parseSubsegment(s)).filter((s): s is TraceSegment => s !== null),
  };
}

export class XRayTracesProvider implements ITracesProvider {
  private readonly client: XRayClient;

  constructor(region: string) {
    this.client = new XRayClient({ region });
  }

  async getTraceSummaries(options: TraceQueryOptions): Promise<TraceSummaryResult> {
    let filterExpression: string | undefined = options.filterExpression;

    if (options.serviceName && !filterExpression) {
      filterExpression = `service("${options.serviceName}")`;
    }

    const response = await this.client.send(
      new GetTraceSummariesCommand({
        StartTime: options.startTime,
        EndTime: options.endTime,
        TimeRangeType: TimeRangeType.TraceId,
        Sampling: false,
        FilterExpression: filterExpression,
      }),
    );

    return {
      traces: (response.TraceSummaries ?? []).map(toTraceSummary),
      nextToken: response.NextToken,
    };
  }

  async getTraceDetail(traceId: string): Promise<TraceDetail | null> {
    const response = await this.client.send(
      new BatchGetTracesCommand({
        TraceIds: [traceId],
      }),
    );

    const trace = response.Traces?.[0];
    if (!trace) return null;

    const segments: TraceSegment[] = (trace.Segments ?? [])
      .map(parseSegmentDocument)
      .filter((s): s is TraceSegment => s !== null);

    const duration =
      segments.length > 0
        ? Math.max(...segments.map((s) => s.endTime)) -
          Math.min(...segments.map((s) => s.startTime))
        : 0;

    return {
      traceId,
      duration,
      segments,
    };
  }

  async getServiceGraph(startTime: Date, endTime: Date): Promise<ServiceGraph> {
    const response = await this.client.send(
      new GetServiceGraphCommand({ StartTime: startTime, EndTime: endTime }),
    );

    const nodes: ServiceGraphNode[] = [];
    const edges: ServiceGraphEdge[] = [];

    for (const service of response.Services ?? []) {
      const summary = service.SummaryStatistics;
      const totalRequests = summary?.TotalCount ?? 0;

      nodes.push({
        name: service.Name ?? '',
        type: service.Type ?? 'unknown',
        isRoot: service.Root ?? false,
        averageResponseTime: summary?.TotalResponseTime
          ? (summary.TotalResponseTime / Math.max(totalRequests, 1)) * 1000
          : 0,
        faultRate: totalRequests > 0 ? ((summary?.FaultStatistics?.TotalCount ?? 0) / totalRequests) * 100 : 0,
        errorRate: totalRequests > 0 ? ((summary?.ErrorStatistics?.TotalCount ?? 0) / totalRequests) * 100 : 0,
        totalRequests,
      });

      for (const edge of service.Edges ?? []) {
        const edgeSummary = edge.SummaryStatistics;
        const edgeRequests = edgeSummary?.TotalCount ?? 0;
        edges.push({
          source: service.Name ?? '',
          target: edge.ReferenceId !== undefined
            ? (response.Services ?? []).find((s) => s.ReferenceId === edge.ReferenceId)?.Name ?? `ref-${edge.ReferenceId}`
            : 'unknown',
          averageResponseTime: edgeSummary?.TotalResponseTime
            ? (edgeSummary.TotalResponseTime / Math.max(edgeRequests, 1)) * 1000
            : 0,
          faultRate: edgeRequests > 0 ? ((edgeSummary?.FaultStatistics?.TotalCount ?? 0) / edgeRequests) * 100 : 0,
          totalRequests: edgeRequests,
        });
      }
    }

    return { nodes, edges, startTime, endTime };
  }

  async getTraceJourney(traceId: string): Promise<TraceJourney | null> {
    // Fetch all linked traces (up to depth 5)
    const allTraceIds = new Set<string>([traceId]);
    const allSegments: Array<{ traceId: string; segment: TraceSegment }> = [];

    const queue = [traceId];
    let depth = 0;
    const maxDepth = 5;

    while (queue.length > 0 && depth < maxDepth) {
      const batch = [...queue];
      queue.length = 0;
      depth++;

      const response = await this.client.send(
        new BatchGetTracesCommand({ TraceIds: batch }),
      );

      for (const trace of response.Traces ?? []) {
        const currentTraceId = trace.Id ?? batch[0];

        for (const rawSegment of trace.Segments ?? []) {
          if (!rawSegment.Document) continue;

          let doc: Record<string, unknown>;
          try {
            doc = JSON.parse(rawSegment.Document) as Record<string, unknown>;
          } catch {
            continue;
          }

          const parsed = parseSegmentDocument(rawSegment);
          if (parsed) {
            allSegments.push({ traceId: currentTraceId, segment: parsed });
          }

          // Find linked trace IDs from segment metadata
          const linkedTraceIds = this.extractLinkedTraceIds(doc);
          for (const linked of linkedTraceIds) {
            if (!allTraceIds.has(linked)) {
              allTraceIds.add(linked);
              queue.push(linked);
            }
          }
        }
      }
    }

    if (allSegments.length === 0) return null;

    // Build journey segments
    const journeySegments: JourneySegment[] = allSegments.map(({ traceId: tid, segment }) =>
      this.toJourneySegment(tid, segment),
    );

    // Sort by start time
    journeySegments.sort((a, b) => a.startTime - b.startTime);

    // Build service participant list
    const serviceMap = new Map<string, ServiceParticipant>();
    for (const seg of journeySegments) {
      const existing = serviceMap.get(seg.serviceName);
      if (!existing) {
        serviceMap.set(seg.serviceName, {
          name: seg.serviceName,
          role: seg.serviceName.includes('event-handler')
            ? 'event-handler'
            : seg.origin === 'AWS::Lambda' || seg.origin === 'AWS::Lambda::Function'
              ? 'api'
              : 'external',
          traceId: seg.traceId,
          startTime: seg.startTime,
          endTime: seg.endTime,
          duration: seg.duration,
          status: seg.status,
        });
      } else {
        existing.startTime = Math.min(existing.startTime, seg.startTime);
        existing.endTime = Math.max(existing.endTime, seg.endTime);
        existing.duration = existing.endTime - existing.startTime;
        if (seg.status === 'fault') existing.status = 'fault';
        else if (seg.status === 'error' && existing.status !== 'fault') existing.status = 'error';
      }
    }

    const services = Array.from(serviceMap.values()).sort(
      (a, b) => a.startTime - b.startTime,
    );

    const globalStart = Math.min(...journeySegments.map((s) => s.startTime));
    const globalEnd = Math.max(...journeySegments.map((s) => s.endTime));

    return {
      rootTraceId: traceId,
      linkedTraceIds: Array.from(allTraceIds).filter((id) => id !== traceId),
      totalDuration: globalEnd - globalStart,
      services,
      segments: journeySegments,
    };
  }

  private extractLinkedTraceIds(doc: Record<string, unknown>): string[] {
    const ids: string[] = [];

    // X-Ray linked traces via trace_ids in metadata/annotations
    const annotations = doc.annotations as Record<string, unknown> | undefined;
    if (annotations) {
      for (const value of Object.values(annotations)) {
        if (typeof value === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{24}$/.test(value)) {
          ids.push(value);
        }
      }
    }

    // Check for trace header in SQS subsegments
    const subsegments = doc.subsegments as Array<Record<string, unknown>> | undefined;
    if (subsegments) {
      for (const sub of subsegments) {
        const linkedIds = this.extractLinkedTraceIds(sub);
        ids.push(...linkedIds);

        // Check metadata for trace links
        const metadata = sub.metadata as Record<string, Record<string, unknown>> | undefined;
        if (metadata) {
          for (const ns of Object.values(metadata)) {
            for (const value of Object.values(ns)) {
              if (typeof value === 'string' && /^1-[0-9a-f]{8}-[0-9a-f]{24}$/.test(value)) {
                ids.push(value);
              }
            }
          }
        }
      }
    }

    return ids;
  }

  private toJourneySegment(traceId: string, segment: TraceSegment): JourneySegment {
    // Determine communication type from subsegment names/namespaces
    let communicationType: string | undefined;
    if (segment.name === 'SQS' || segment.origin === 'AWS::SQS::Queue') {
      communicationType = 'SQS';
    } else if (segment.origin === 'AWS::DynamoDB::Table') {
      communicationType = 'DynamoDB';
    } else if (segment.name?.includes('amazonaws.com') || segment.origin === 'AWS::Lambda') {
      communicationType = segment.origin ?? 'AWS';
    }

    return {
      traceId,
      segmentId: segment.id,
      serviceName: segment.name,
      name: segment.name,
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
      status: segment.fault ? 'fault' : segment.error ? 'error' : segment.throttle ? 'throttle' : 'ok',
      origin: segment.origin,
      communicationType,
      children: segment.subsegments?.map((sub) => this.toJourneySegment(traceId, sub)),
    };
  }

  async enrichSummariesWithHttp(summaries: TraceSummary[]): Promise<TraceSummary[]> {
    // Find summaries missing HTTP data (API GW HTTP API v2 doesn't populate Http on summaries)
    const needsEnrichment = summaries.filter((s) => !s.httpUrl && !s.httpMethod);
    if (needsEnrichment.length === 0) return summaries;

    // Batch fetch trace details in groups of 5 (X-Ray BatchGetTraces limit)
    const BATCH_SIZE = 5;
    const enrichedMap = new Map<string, { method?: string; url?: string }>();

    for (let i = 0; i < needsEnrichment.length; i += BATCH_SIZE) {
      const batch = needsEnrichment.slice(i, i + BATCH_SIZE);
      try {
        const response = await this.client.send(
          new BatchGetTracesCommand({
            TraceIds: batch.map((s) => s.traceId),
          }),
        );

        for (const trace of response.Traces ?? []) {
          const traceId = trace.Id ?? '';
          for (const rawSeg of trace.Segments ?? []) {
            if (!rawSeg.Document) continue;
            try {
              const doc = JSON.parse(rawSeg.Document) as Record<string, unknown>;
              const http = doc.http as Record<string, Record<string, unknown>> | undefined;
              if (http?.request) {
                const method = http.request.method as string | undefined;
                const url = http.request.url as string | undefined;
                if (method || url) {
                  enrichedMap.set(traceId, { method, url });
                  break; // Found HTTP info for this trace, move to next
                }
              }
            } catch {
              // Skip unparseable segment docs
            }
          }
        }
      } catch {
        // Non-fatal — enrichment is best-effort
      }
    }

    // Merge enriched data back into summaries
    return summaries.map((s) => {
      const enriched = enrichedMap.get(s.traceId);
      if (enriched) {
        return {
          ...s,
          httpMethod: s.httpMethod ?? enriched.method,
          httpUrl: s.httpUrl ?? enriched.url,
        };
      }
      return s;
    });
  }
}
