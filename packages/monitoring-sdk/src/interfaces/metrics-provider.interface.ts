// ─── IMetricsProvider ───────────────────────────────────────────────────────
// Fetch time-series metric data for dashboards.

export type MetricStat = 'Sum' | 'Average' | 'Maximum' | 'Minimum' | 'p50' | 'p95' | 'p99';

export interface MetricQuery {
  namespace: string;
  metricName: string;
  dimensionName: string;
  dimensionValue: string;
  stat: MetricStat;
  periodSeconds?: number;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

export interface MetricResult {
  label: string;
  dataPoints: MetricDataPoint[];
}

export interface MetricQueryOptions {
  queries: MetricQuery[];
  startTime: Date;
  endTime: Date;
}

export interface AlarmSummary {
  alarmName: string;
  state: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  reason: string;
  updatedAt: Date;
  metricName: string;
  namespace: string;
}

export interface IMetricsProvider {
  getMetricData(options: MetricQueryOptions): Promise<MetricResult[]>;
  listAlarms(namePrefix: string): Promise<AlarmSummary[]>;
}
