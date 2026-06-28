// ─── ITracesProvider ────────────────────────────────────────────────────────
// Fetch distributed trace summaries and full trace details from X-Ray.

export interface TraceSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  fault: boolean;
  error: boolean;
  throttle: boolean;
  origin?: string;
  subsegments?: TraceSegment[];
}

export interface TraceSummary {
  traceId: string;
  duration: number;
  responseTime: number;
  fault: boolean;
  error: boolean;
  throttle: boolean;
  httpMethod?: string;
  httpUrl?: string;
  httpStatus?: number;
  rootServiceName?: string;
  startTime: number;
  hasError: boolean;
}

export interface TraceDetail {
  traceId: string;
  duration: number;
  segments: TraceSegment[];
}

export interface TraceQueryOptions {
  startTime: Date;
  endTime: Date;
  filterExpression?: string;
  serviceName?: string;
}

export interface TraceSummaryResult {
  traces: TraceSummary[];
  nextToken?: string;
}

export interface ServiceGraphNode {
  name: string;
  type: string;
  isRoot: boolean;
  averageResponseTime: number;
  faultRate: number;
  errorRate: number;
  totalRequests: number;
}

export interface ServiceGraphEdge {
  source: string;
  target: string;
  averageResponseTime: number;
  faultRate: number;
  totalRequests: number;
}

export interface ServiceGraph {
  nodes: ServiceGraphNode[];
  edges: ServiceGraphEdge[];
  startTime: Date;
  endTime: Date;
}

// ─── Trace Journey (cross-service event chain) ──────────────────────────────

export interface ServiceParticipant {
  name: string;
  role: 'api' | 'event-handler' | 'external';
  traceId: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'ok' | 'error' | 'fault' | 'throttle';
}

export interface JourneySegment {
  traceId: string;
  segmentId: string;
  serviceName: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'ok' | 'error' | 'fault' | 'throttle';
  origin?: string;
  communicationType?: string; // 'HTTP GET', 'SQS: ORDER_CREATED', etc.
  children?: JourneySegment[];
}

export interface TraceJourney {
  rootTraceId: string;
  linkedTraceIds: string[];
  totalDuration: number;
  services: ServiceParticipant[];
  segments: JourneySegment[];
}

export interface ITracesProvider {
  getTraceSummaries(options: TraceQueryOptions): Promise<TraceSummaryResult>;
  getTraceDetail(traceId: string): Promise<TraceDetail | null>;
  getServiceGraph(startTime: Date, endTime: Date): Promise<ServiceGraph>;
  getTraceJourney(traceId: string): Promise<TraceJourney | null>;
  enrichSummariesWithHttp(summaries: TraceSummary[]): Promise<TraceSummary[]>;
}
