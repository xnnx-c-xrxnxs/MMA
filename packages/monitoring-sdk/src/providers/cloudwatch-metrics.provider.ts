import {
  CloudWatchClient,
  GetMetricDataCommand,
  DescribeAlarmsCommand,
  Metric,
  MetricDataQuery,
  StateValue,
} from '@aws-sdk/client-cloudwatch';
import {
  IMetricsProvider,
  MetricQueryOptions,
  MetricResult,
  AlarmSummary,
  MetricStat,
} from '../interfaces/metrics-provider.interface';

// X-Ray percentile stats use the form "p(50)" in CloudWatch API.
// Standard stats (Sum, Average, etc.) map directly.
function toCloudWatchStat(stat: MetricStat): string {
  if (stat === 'p50') return 'p50';
  if (stat === 'p95') return 'p95';
  if (stat === 'p99') return 'p99';
  return stat;
}

function toAlarmState(state: StateValue | string | undefined): AlarmSummary['state'] {
  if (state === StateValue.ALARM) return 'ALARM';
  if (state === StateValue.OK) return 'OK';
  return 'INSUFFICIENT_DATA';
}

export class CloudWatchMetricsProvider implements IMetricsProvider {
  private readonly client: CloudWatchClient;

  constructor(region: string) {
    this.client = new CloudWatchClient({ region });
  }

  async getMetricData(options: MetricQueryOptions): Promise<MetricResult[]> {
    const metricDataQueries: MetricDataQuery[] = options.queries.map((q, idx) => {
      const metric: Metric = {
        Namespace: q.namespace,
        MetricName: q.metricName,
        Dimensions: [{ Name: q.dimensionName, Value: q.dimensionValue }],
      };

      return {
        Id: `m${idx}`,
        Label: `${q.metricName}/${q.dimensionValue}`,
        MetricStat: {
          Metric: metric,
          Period: q.periodSeconds ?? 300,
          Stat: toCloudWatchStat(q.stat),
        },
      };
    });

    const response = await this.client.send(
      new GetMetricDataCommand({
        MetricDataQueries: metricDataQueries,
        StartTime: options.startTime,
        EndTime: options.endTime,
        ScanBy: 'TimestampDescending',
      }),
    );

    return (response.MetricDataResults ?? []).map((result) => ({
      label: result.Label ?? '',
      dataPoints: (result.Timestamps ?? []).map((ts, i) => ({
        timestamp: ts,
        value: result.Values?.[i] ?? 0,
      })),
    }));
  }

  async listAlarms(namePrefix: string): Promise<AlarmSummary[]> {
    const response = await this.client.send(
      new DescribeAlarmsCommand({
        AlarmNamePrefix: namePrefix,
        MaxRecords: 100,
      }),
    );

    return (response.MetricAlarms ?? []).map((alarm) => ({
      alarmName: alarm.AlarmName ?? '',
      state: toAlarmState(alarm.StateValue),
      reason: alarm.StateReason ?? '',
      updatedAt: alarm.StateUpdatedTimestamp ?? new Date(0),
      metricName: alarm.MetricName ?? '',
      namespace: alarm.Namespace ?? '',
    }));
  }
}
