'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMonitoringApi } from '../../lib/use-monitoring-api';
import { useEnvInfo } from '../../lib/use-env-info';
import type {
  LambdaFunctionSummary,
  HealthCheckResult,
  LogLine,
  AlarmSummary,
  LambdaVersionInfo,
  QueueAttributes,
  ServiceGraph,
} from '@mma/monitoring-sdk';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface EnrichedFunction extends LambdaFunctionSummary {
  alarms: AlarmSummary[];
}

interface ServicesResponse {
  apiServices: EnrichedFunction[];
  workerServices: EnrichedFunction[];
}

interface FunctionMetricsOverview {
  totalErrors: number;
  totalInvocations: number;
  errorRate: number;
  errorSparkline: { timestamp: string; value: number }[];
  invocationSparkline: { timestamp: string; value: number }[];
  maxConcurrency: number;
}

interface ColdStartInfo {
  coldStartCount: number;
  avgInitDurationMs: number;
  maxInitDurationMs: number;
  windowMinutes: number;
}

interface CostEstimate {
  windowHours: number;
  memoryMb: number;
  totalInvocations: number;
  avgDurationMs: number;
  totalCost: number;
  estimatedMonthlyCost: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inline Styles
   ═══════════════════════════════════════════════════════════════════════════ */

const s = {
  // Layout
  refreshBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' } as const,
  sectionTitle: { margin: '2rem 0 1rem', borderBottom: '1px solid #30363d', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' } as const,
  // Card
  card: { background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1rem' } as const,
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' } as const,
  // Meta
  meta: { fontSize: '0.82rem', color: '#8b949e' } as const,
  metaRow: { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' as const, marginBottom: '0.5rem', fontSize: '0.82rem', color: '#8b949e' },
  // Badges
  badge: (bg: string) => ({ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: bg, color: '#fff' }) as const,
  alarmChip: (st: string) => {
    const bg = st === 'ALARM' ? '#3d1c1e' : st === 'OK' ? '#0d2818' : '#2d2000';
    const fg = st === 'ALARM' ? '#f85149' : st === 'OK' ? '#3fb950' : '#d29922';
    const bd = st === 'ALARM' ? '#da3633' : st === 'OK' ? '#238636' : '#9e6a03';
    return { display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem', marginRight: '0.35rem', background: bg, color: fg, border: `1px solid ${bd}` } as const;
  },
  // Buttons
  btn: { padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid #30363d', background: '#21262d', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem' } as const,
  btnPrimary: { padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid #388bfd', background: '#1f6feb', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' } as const,
  btnSmall: { padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #30363d', background: '#21262d', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.7rem' } as const,
  // Logs
  logContainer: { marginTop: '0.75rem', background: '#0d1117', borderRadius: '6px', border: '1px solid #21262d', padding: '0.5rem 0.75rem', maxHeight: '220px', overflowY: 'auto' as const, fontSize: '0.78rem', fontFamily: 'monospace', lineHeight: '1.6' },
  logLine: { borderBottom: '1px solid #161b22', padding: '0.25rem 0', wordBreak: 'break-all' as const },
  logTimestamp: { color: '#58a6ff', marginRight: '0.75rem' },
  // Health
  healthResult: (ok: boolean) => ({ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.82rem', background: ok ? '#0d2818' : '#3d1c1e', border: `1px solid ${ok ? '#238636' : '#da3633'}` }),
  // Progress bar
  progressOuter: { width: '100%', height: '6px', background: '#21262d', borderRadius: '3px', overflow: 'hidden' as const },
  progressInner: (pct: number, color: string) => ({ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }),
  // Expandable section
  expandBtn: { background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0' } as const,
  // Service map
  mapCard: { background: '#0d1117', border: '1px solid #21262d', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.5rem' } as const,
  mapNode: (isRoot: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem',
    background: isRoot ? '#0d419d' : '#21262d', border: `1px solid ${isRoot ? '#388bfd' : '#30363d'}`, color: '#e2e8f0',
  }),
  // DLQ
  dlqBadge: (count: number) => ({
    display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 600,
    background: count > 0 ? '#3d1c1e' : '#0d2818', color: count > 0 ? '#f85149' : '#3fb950',
    border: `1px solid ${count > 0 ? '#da3633' : '#238636'}`,
  }),
  // Toggle
  toggle: (active: boolean) => ({
    width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    background: active ? '#238636' : '#30363d', position: 'relative' as const, transition: 'background 0.2s',
  }),
  toggleDot: (active: boolean) => ({
    width: '14px', height: '14px', borderRadius: '50%', background: '#e2e8f0', position: 'absolute' as const,
    top: '3px', left: active ? '19px' : '3px', transition: 'left 0.2s',
  }),
  // Tabs
  tabBar: { display: 'flex', gap: 0, borderBottom: '1px solid #30363d', marginBottom: '1.5rem' } as const,
  tab: (active: boolean) => ({
    padding: '0.6rem 1.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: active ? 600 : 400,
    color: active ? '#e2e8f0' : '#8b949e', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #58a6ff' : '2px solid transparent', transition: 'all 0.15s',
  }),
  tabBadge: (count: number, variant: 'error' | 'info') => {
    const bg = variant === 'error' && count > 0 ? '#3d1c1e' : '#21262d';
    const fg = variant === 'error' && count > 0 ? '#f85149' : '#8b949e';
    return { display: 'inline-block', marginLeft: '0.4rem', padding: '0.05rem 0.4rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, background: bg, color: fg } as const;
  },
  // Alarm description card
  alarmRow: { background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '0.85rem 1rem', marginBottom: '0.5rem' } as const,
  alarmGroupHeader: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.25rem', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid #21262d' } as const,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Alarm Descriptions — human-readable explanations per alarm metric
   ═══════════════════════════════════════════════════════════════════════════ */

interface AlarmDescription {
  title: string;
  description: string;
  impact: string;
  action: string;
}

function getAlarmDescription(alarm: AlarmSummary): AlarmDescription {
  const metric = alarm.metricName;
  const ns = alarm.namespace;

  if (ns === 'AWS/Lambda' && metric === 'Errors') {
    return {
      title: 'Lambda Errors',
      description: 'Counts unhandled exceptions and explicit error responses from this Lambda function. Triggers when errors exceed the threshold (default: 5) within two consecutive 5-minute periods.',
      impact: 'Users may receive 500 errors. Downstream services or event processing may be disrupted.',
      action: 'Check the function\'s CloudWatch logs for stack traces. Common causes: unhandled exceptions, missing environment variables, timeout, or out-of-memory.',
    };
  }
  if (ns === 'AWS/Lambda' && metric === 'Throttles') {
    return {
      title: 'Lambda Throttles',
      description: 'Counts requests that were rejected because the function hit its concurrency limit. Triggers when throttles exceed the threshold (default: 10) within two consecutive 5-minute periods.',
      impact: 'Incoming requests or SQS messages are rejected and may be retried (SQS) or return 429/502 (API Gateway).',
      action: 'Increase the function\'s reserved concurrency, or request a service quota increase for your account\'s concurrent execution limit.',
    };
  }
  if (ns === 'AWS/SQS' && metric === 'ApproximateNumberOfMessagesVisible') {
    return {
      title: 'Dead Letter Queue (DLQ) Messages',
      description: 'Monitors the number of messages sitting in a Dead Letter Queue. Triggers when any message appears (threshold: 0). Messages land here after the source queue exhausts its retry attempts.',
      impact: 'Events are not being processed — data may become stale or inconsistent across services.',
      action: 'Inspect the DLQ messages to identify the failing event. Check the consumer Lambda\'s logs for the root cause (parse error, missing data, downstream failure). After fixing, redrive the messages.',
    };
  }
  if (ns === 'AWS/DynamoDB' && metric === 'ThrottledRequests') {
    return {
      title: 'DynamoDB Throttled Requests',
      description: 'Counts read/write requests rejected because the table\'s provisioned throughput was exceeded. Triggers when throttles exceed the threshold (default: 5) within two consecutive 5-minute periods.',
      impact: 'API responses slow down or fail with 500 errors. Write operations may be lost if not retried.',
      action: 'Switch the table to on-demand capacity mode, or increase provisioned RCU/WCU. Review access patterns for hot partitions.',
    };
  }
  if (ns === 'AWS/RDS' && metric === 'DatabaseConnections') {
    return {
      title: 'RDS Connection Count',
      description: 'Monitors the number of active database connections to the PostgreSQL instance. Triggers when connections exceed the threshold (default: 80) within two consecutive 5-minute periods.',
      impact: 'New Lambda invocations may fail to connect to the database, causing 500 errors for all Prisma-based services.',
      action: 'Check for connection leaks (Prisma clients not being reused). Consider adding RDS Proxy to pool connections. Review Lambda concurrency — each cold start opens a new connection.',
    };
  }
  if (ns === 'AWS/ApiGateway' && metric === '5xx') {
    return {
      title: 'API Gateway 5xx Errors',
      description: 'Counts server-side errors (500, 502, 503, 504) returned by the shared API Gateway. Triggers when 5xx errors exceed the threshold (default: 5) within two consecutive 5-minute periods.',
      impact: 'Multiple API endpoints across all domains may be returning errors to clients.',
      action: 'Check individual Lambda function logs to find the root cause. Common causes: Lambda timeout (504), Lambda crash (502), or application-level 500 errors.',
    };
  }

  // Fallback for unknown alarm types
  return {
    title: metric,
    description: `Monitors the ${metric} metric in the ${ns} namespace.`,
    impact: 'Impact depends on the specific metric and threshold configuration.',
    action: 'Check CloudWatch metrics and logs for this resource.',
  };
}

/** Extract a likely service name from the alarm name. */
function getServiceFromAlarm(alarmName: string, namePrefix: string): string {
  const stripped = alarmName.replace(`${namePrefix}-`, '');
  // Lambda alarms: "{functionName}-errors" or "{functionName}-throttles"
  if (stripped.endsWith('-errors')) return stripped.replace(/-errors$/, '');
  if (stripped.endsWith('-throttles')) return stripped.replace(/-throttles$/, '');
  // DLQ alarms: "{key}-dlq-messages"
  if (stripped.endsWith('-dlq-messages')) return stripped.replace(/-dlq-messages$/, '') + ' (DLQ)';
  // DynamoDB: "{key}-dynamodb-throttles"
  if (stripped.endsWith('-dynamodb-throttles')) return stripped.replace(/-dynamodb-throttles$/, '') + ' (DynamoDB)';
  // RDS: "{key}-rds-connections"
  if (stripped.endsWith('-rds-connections')) return stripped.replace(/-rds-connections$/, '') + ' (RDS)';
  // API Gateway: "api-gateway-5xx"
  if (stripped.includes('api-gateway')) return 'API Gateway';
  return stripped;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Alarms Tab Component
   ═══════════════════════════════════════════════════════════════════════════ */

function AlarmsTab({ namePrefix }: { namePrefix: string }) {
  const { get } = useMonitoringApi();
  const [alarms, setAlarms] = useState<AlarmSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>('');
  const [expandedAlarm, setExpandedAlarm] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const query = stateFilter ? `?state=${stateFilter}` : '';
    get<{ alarms: AlarmSummary[] }>(`/alarms${query}`)
      .then((data) => setAlarms(data.alarms))
      .finally(() => setLoading(false));
  }, [get, stateFilter]);

  // Group alarms by service
  const grouped = useMemo(() => {
    const map = new Map<string, AlarmSummary[]>();
    for (const alarm of alarms) {
      const service = getServiceFromAlarm(alarm.alarmName, namePrefix);
      const arr = map.get(service) ?? [];
      arr.push(alarm);
      map.set(service, arr);
    }
    // Sort groups: those with ALARM state first
    return [...map.entries()].sort((a, b) => {
      const aHasAlarm = a[1].some((al) => al.state === 'ALARM');
      const bHasAlarm = b[1].some((al) => al.state === 'ALARM');
      if (aHasAlarm && !bHasAlarm) return -1;
      if (!aHasAlarm && bHasAlarm) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [alarms, namePrefix]);

  const alarmCount = alarms.filter((a) => a.state === 'ALARM').length;

  if (loading) return <p>Loading alarms…</p>;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          style={{ ...s.btn, padding: '0.35rem 0.6rem' }}
        >
          <option value="">All states</option>
          <option value="ALARM">🔴 ALARM</option>
          <option value="OK">🟢 OK</option>
          <option value="INSUFFICIENT_DATA">🟡 INSUFFICIENT_DATA</option>
        </select>
        <span style={s.meta}>
          {alarms.length} alarm{alarms.length !== 1 ? 's' : ''}
          {alarmCount > 0 && <span style={{ color: '#f85149', fontWeight: 600 }}> · {alarmCount} firing</span>}
        </span>
      </div>

      {/* Info box for new developers */}
      <div style={{ background: '#0d1d3a', border: '1px solid #1f6feb', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#8b949e' }}>
        <strong style={{ color: '#58a6ff' }}>ℹ️ What are alarms?</strong>
        <p style={{ margin: '0.3rem 0 0' }}>
          CloudWatch alarms monitor AWS resource metrics and fire when a threshold is breached.
          Each service has alarms for its key failure indicators (errors, throttles, DLQ depth).
          Click any alarm row to see a detailed description, impact, and suggested action.
        </p>
      </div>

      {alarms.length === 0 && <p style={s.meta}>No alarms found for this environment.</p>}

      {/* Grouped alarms */}
      {grouped.map(([service, serviceAlarms]) => {
        const hasActiveAlarm = serviceAlarms.some((a) => a.state === 'ALARM');
        return (
          <div key={service}>
            <div style={s.alarmGroupHeader}>
              <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0' }}>{service}</span>
              <span style={s.badge(hasActiveAlarm ? '#da3633' : '#238636')}>
                {serviceAlarms.filter((a) => a.state === 'ALARM').length > 0
                  ? `${serviceAlarms.filter((a) => a.state === 'ALARM').length} firing`
                  : 'all OK'}
              </span>
              <span style={{ ...s.meta, fontSize: '0.75rem' }}>{serviceAlarms.length} alarm{serviceAlarms.length !== 1 ? 's' : ''}</span>
            </div>
            {serviceAlarms.map((alarm) => {
              const desc = getAlarmDescription(alarm);
              const isExpanded = expandedAlarm === alarm.alarmName;
              const stateColor = alarm.state === 'ALARM' ? '#f85149' : alarm.state === 'OK' ? '#3fb950' : '#d29922';

              return (
                <div
                  key={alarm.alarmName}
                  style={{
                    ...s.alarmRow,
                    borderLeftColor: alarm.state === 'ALARM' ? '#da3633' : alarm.state === 'OK' ? '#238636' : '#9e6a03',
                    borderLeftWidth: '3px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedAlarm(isExpanded ? null : alarm.alarmName)}
                >
                  {/* Alarm header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.88rem' }}>{desc.title}</span>
                      <span style={s.alarmChip(alarm.state)}>{alarm.state}</span>
                      <span style={{ ...s.meta, fontSize: '0.75rem' }}>{alarm.namespace} / {alarm.metricName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ ...s.meta, fontSize: '0.75rem' }}>{new Date(alarm.updatedAt).toLocaleString()}</span>
                      <span style={{ color: '#58a6ff', fontSize: '0.78rem' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Reason line (always visible) */}
                  {alarm.state === 'ALARM' && alarm.reason && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#f85149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' as const }}>
                      {alarm.reason}
                    </div>
                  )}

                  {/* Expanded description */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #21262d', fontSize: '0.82rem', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#8b949e' }}>What it monitors:</strong>
                        <p style={{ margin: '0.15rem 0 0', color: '#e2e8f0' }}>{desc.description}</p>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#d29922' }}>Impact when firing:</strong>
                        <p style={{ margin: '0.15rem 0 0', color: '#e2e8f0' }}>{desc.impact}</p>
                      </div>
                      <div>
                        <strong style={{ color: '#3fb950' }}>Suggested action:</strong>
                        <p style={{ margin: '0.15rem 0 0', color: '#e2e8f0' }}>{desc.action}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sparkline SVG
   ═══════════════════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, width = 80, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <span style={s.meta}>—</span>;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ verticalAlign: 'middle' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Service Card Component
   ═══════════════════════════════════════════════════════════════════════════ */

function ServiceCard({
  fn,
  namePrefix,
  metrics,
  dlqDepth,
}: {
  fn: EnrichedFunction;
  namePrefix: string;
  metrics: FunctionMetricsOverview | null;
  dlqDepth: number | null;
}) {
  const { get, post } = useMonitoringApi();
  const displayName = fn.functionName.replace(`${namePrefix}-`, '');
  const domain = displayName.split('-')[0];

  // State
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logsOpen, setLogsOpen] = useState(false);
  const [logNextToken, setLogNextToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [versions, setVersions] = useState<LambdaVersionInfo[] | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [coldStart, setColdStart] = useState<ColdStartInfo | null>(null);
  const [costData, setCostData] = useState<CostEstimate | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fetch logs (initial load or refresh)
  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    const filterParam = logFilter || logSearch || '';
    const filterQs = filterParam ? `&filter=${encodeURIComponent(filterParam)}` : '';
    get<{ lines: LogLine[]; nextToken?: string }>(`/services/logs?functionName=${fn.functionName}&limit=100&minutes=60${filterQs}`)
      .then((data) => {
        setLogs([...data.lines].sort((a, b) => b.timestamp - a.timestamp));
        setLogNextToken(data.nextToken);
        setLogsOpen(true);
      })
      .catch(() => { setLogs([]); setLogsOpen(true); })
      .finally(() => setLogsLoading(false));
  }, [fn.functionName, logFilter, logSearch, get]);

  // Load more logs (pagination)
  const loadMoreLogs = useCallback(() => {
    if (!logNextToken) return;
    setLoadingMore(true);
    const filterParam = logFilter || logSearch || '';
    const filterQs = filterParam ? `&filter=${encodeURIComponent(filterParam)}` : '';
    get<{ lines: LogLine[]; nextToken?: string }>(`/services/logs?functionName=${fn.functionName}&limit=100&minutes=60${filterQs}&nextToken=${encodeURIComponent(logNextToken)}`)
      .then((data) => {
        const newLines = [...data.lines].sort((a, b) => b.timestamp - a.timestamp);
        setLogs((prev) => [...prev, ...newLines]);
        setLogNextToken(data.nextToken);
      })
      .catch(() => { /* swallow — toast or retry not needed for log pagination */ })
      .finally(() => setLoadingMore(false));
  }, [fn.functionName, logFilter, logSearch, logNextToken, get]);

  // Health check
  const runHealthCheck = useCallback(() => {
    setHealthLoading(true);
    setHealthResult(null);
    post<HealthCheckResult>(`/services/${fn.functionName}/health-check?domain=${domain}`)
      .then(setHealthResult)
      .catch((err) => setHealthResult({ functionName: fn.functionName, healthy: false, statusCode: 0, body: null, latencyMs: 0, error: err instanceof Error ? err.message : 'Failed' }))
      .finally(() => setHealthLoading(false));
  }, [fn.functionName, domain, post]);

  // Deployment versions
  const fetchVersions = useCallback(() => {
    if (versions) { setVersionsOpen(!versionsOpen); return; }
    get<LambdaVersionInfo[]>(`/services/${fn.functionName}/versions`)
      .then((data) => { setVersions(data); setVersionsOpen(true); })
      .catch(() => setVersions([]));
  }, [fn.functionName, versions, versionsOpen, get]);

  // Cold starts
  const fetchColdStarts = useCallback(() => {
    if (coldStart) return;
    get<ColdStartInfo>(`/services/${fn.functionName}/cold-starts`)
      .then(setColdStart)
      .catch(() => setColdStart({ coldStartCount: 0, avgInitDurationMs: 0, maxInitDurationMs: 0, windowMinutes: 60 }));
  }, [fn.functionName, coldStart, get]);

  // Cost estimate
  const fetchCost = useCallback(() => {
    setCostLoading(true);
    get<CostEstimate>(`/services/${fn.functionName}/cost?hours=24`)
      .then(setCostData)
      .catch(() => setCostData(null))
      .finally(() => setCostLoading(false));
  }, [fn.functionName, get]);

  // Load cold starts on expand
  useEffect(() => {
    if (expanded) fetchColdStarts();
  }, [expanded, fetchColdStarts]);

  const stateColor = fn.state === 'Active' ? '#3fb950' : '#d29922';
  const lastModified = fn.lastModified ? new Date(fn.lastModified).toLocaleString() : '—';

  // Memory utilization: use concurrency as a proxy indicator for now
  const errorSparkData = metrics?.errorSparkline.map((d) => d.value) ?? [];
  const invocSparkData = metrics?.invocationSparkline.map((d) => d.value) ?? [];

  return (
    <div style={s.card}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1rem' }}>{displayName}</strong>
          <span style={s.badge(fn.serviceType === 'api' ? '#1f6feb' : '#8957e5')}>{fn.serviceType.toUpperCase()}</span>
          <span style={s.badge(stateColor)}>{fn.state}</span>
          {/* Invocation count */}
          {metrics && (
            <span style={{ ...s.meta, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{metrics.totalInvocations.toLocaleString()}</span> invocations (1h)
            </span>
          )}
          {/* Error rate with sparkline */}
          {metrics && metrics.totalInvocations > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkline data={errorSparkData} color={metrics.totalErrors > 0 ? '#f85149' : '#3fb950'} />
              <span style={{ fontSize: '0.75rem', color: metrics.totalErrors > 0 ? '#f85149' : '#3fb950', fontWeight: 600 }}>
                {metrics.errorRate.toFixed(1)}% err
              </span>
            </span>
          )}
          {/* DLQ depth for workers */}
          {fn.serviceType === 'worker' && dlqDepth !== null && (
            <span style={s.dlqBadge(dlqDepth)}>DLQ: {dlqDepth}</span>
          )}
          {/* Cold starts */}
          {coldStart && coldStart.coldStartCount > 0 && (
            <span style={{ ...s.badge('#9e6a03'), fontSize: '0.7rem' }}>🥶 {coldStart.coldStartCount} cold starts ({coldStart.avgInitDurationMs.toFixed(0)}ms avg)</span>
          )}
        </div>
        <button style={s.expandBtn} onClick={() => setExpanded(!expanded)}>
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>

      {/* ── Metadata row ──────────────────────────────────── */}
      <div style={s.metaRow}>
        <span>🕐 Last deployed: <strong style={{ color: '#e2e8f0' }}>{lastModified}</strong></span>
        <span>💾 {fn.memorySize} MB</span>
        <span>⏱ {fn.timeout}s timeout</span>
        <span>⚙️ {fn.runtime}</span>
        <span>📦 {(fn.codeSize / 1024 / 1024).toFixed(1)} MB</span>
        {metrics && <span>🔄 Max concurrency: {metrics.maxConcurrency}</span>}
      </div>

      {/* ── Invocation sparkline bar ──────────────────────── */}
      {metrics && metrics.totalInvocations > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ ...s.meta, width: '60px' }}>Traffic:</span>
          <Sparkline data={invocSparkData} color="#58a6ff" width={200} height={16} />
        </div>
      )}

      {/* ── Alarms row ────────────────────────────────────── */}
      {fn.alarms.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ ...s.meta, marginRight: '0.5rem' }}>Alarms:</span>
          {fn.alarms.map((a) => (
            <span key={a.alarmName} style={s.alarmChip(a.state)} title={a.reason}>{a.metricName} — {a.state}</span>
          ))}
        </div>
      )}

      {/* ── Actions row ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {fn.serviceType === 'api' && (
          <button style={s.btnPrimary} onClick={runHealthCheck} disabled={healthLoading}>
            {healthLoading ? 'Checking…' : '🏥 Health Check'}
          </button>
        )}
        <button style={s.btn} onClick={() => { if (logsOpen) { setLogsOpen(false); } else { fetchLogs(); } }} disabled={logsLoading}>
          {logsLoading ? 'Loading…' : logsOpen ? '📋 Hide Logs' : '📋 Recent Logs'}
        </button>
        <button style={s.btn} onClick={fetchVersions}>
          {versionsOpen ? '📋 Hide Versions' : '📋 Deploy History'}
        </button>
        {!costData && (
          <button style={s.btn} onClick={fetchCost} disabled={costLoading}>
            {costLoading ? 'Calculating…' : '💰 Est. Cost'}
          </button>
        )}
      </div>

      {/* ── Health check result ────────────────────────────── */}
      {healthResult && (
        <div style={s.healthResult(healthResult.healthy)}>
          <strong>{healthResult.healthy ? '✅ Healthy' : '❌ Unhealthy'}</strong>
          <span style={s.meta}> — {healthResult.statusCode} in {healthResult.latencyMs}ms</span>
          {healthResult.body && <pre style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#8b949e' }}>{JSON.stringify(healthResult.body, null, 2)}</pre>}
          {healthResult.error && <div style={{ color: '#f85149', marginTop: '0.25rem' }}>{healthResult.error}</div>}
        </div>
      )}

      {/* ── Cost estimate ─────────────────────────────────── */}
      {costData && (
        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '4px', background: '#0d1117', border: '1px solid #21262d', fontSize: '0.82rem' }}>
          <strong>💰 Cost Estimate</strong> <span style={s.meta}>(last {costData.windowHours}h)</span>
          <div style={{ ...s.metaRow, marginTop: '0.3rem', marginBottom: 0 }}>
            <span>{costData.totalInvocations.toLocaleString()} invocations</span>
            <span>{costData.avgDurationMs.toFixed(1)}ms avg</span>
            <span>${costData.totalCost.toFixed(6)} actual</span>
            <span style={{ color: '#58a6ff', fontWeight: 600 }}>~${costData.estimatedMonthlyCost.toFixed(2)}/mo projected</span>
          </div>
        </div>
      )}

      {/* ── Deployment history ────────────────────────────── */}
      {versionsOpen && versions && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ ...s.meta, marginBottom: '0.3rem' }}>Deployment History (last {versions.length} versions)</div>
          {versions.length === 0 && <span style={s.meta}>No published versions found</span>}
          {versions.map((v) => (
            <div key={v.version} style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: '1px solid #21262d' }}>
              <span style={{ color: '#58a6ff', minWidth: '40px' }}>v{v.version}</span>
              <span>{new Date(v.lastModified).toLocaleString()}</span>
              <span style={s.meta}>{v.runtime}</span>
              <span style={s.meta}>{(v.codeSize / 1024 / 1024).toFixed(1)} MB</span>
              {v.description && <span style={s.meta}>{v.description}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Log viewer panel ─────────────────────────────── */}
      {logsOpen && (
        <div style={{ marginTop: '0.75rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #21262d', overflow: 'hidden' }}>
          {/* Log toolbar */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderBottom: '1px solid #21262d', background: '#161b22' }}>
            <span style={{ ...s.meta, fontWeight: 600, color: '#e2e8f0' }}>📋 Logs</span>
            <span style={s.badge(logs.length > 0 ? '#1f6feb' : '#30363d')}>{logs.length} lines</span>
            <div style={{ flex: 1 }} />
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              style={{ ...s.btn, padding: '0.2rem 0.4rem' }}
            >
              <option value="">All levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
            </select>
            <input
              type="text"
              placeholder="Search pattern…"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchLogs(); }}
              style={{ ...s.btn, width: '160px', padding: '0.2rem 0.5rem' }}
            />
            <button style={s.btnSmall} onClick={fetchLogs} disabled={logsLoading}>
              {logsLoading ? '…' : '🔍'}
            </button>
            <button style={s.btnSmall} onClick={fetchLogs} disabled={logsLoading}>↻ Refresh</button>
          </div>

          {/* Log content */}
          <div style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '0.78rem', fontFamily: 'monospace', lineHeight: '1.5' }}>
            {logs.length === 0 && !logsLoading && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
                No logs found in the last 60 minutes{logFilter ? ` matching [${logFilter}]` : ''}
              </div>
            )}
            {/* Log table */}
            {logs.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#161b22', zIndex: 1, borderBottom: '1px solid #30363d' }}>
                    <th style={{ textAlign: 'left', padding: '0.35rem 0.75rem', width: '90px', color: '#8b949e', fontWeight: 500, fontSize: '0.72rem' }}>TIME</th>
                    <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', width: '50px', color: '#8b949e', fontWeight: 500, fontSize: '0.72rem' }}>LEVEL</th>
                    <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: '#8b949e', fontWeight: 500, fontSize: '0.72rem' }}>MESSAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((line, idx) => {
                    const isError = /ERROR|error|Exception|FATAL/.test(line.message);
                    const isWarn = /WARN|warn/.test(line.message);
                    const level = isError ? 'ERR' : isWarn ? 'WRN' : 'INF';
                    const levelColor = isError ? '#f85149' : isWarn ? '#d29922' : '#3fb950';
                    const bgColor = isError ? 'rgba(248, 81, 73, 0.06)' : 'transparent';

                    return (
                      <tr key={`${line.timestamp}-${idx}`} style={{ borderBottom: '1px solid #161b22', background: bgColor }}>
                        <td style={{ padding: '0.3rem 0.75rem', color: '#58a6ff', whiteSpace: 'nowrap', verticalAlign: 'top', fontSize: '0.75rem' }}>
                          {new Date(line.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem', verticalAlign: 'top' }}>
                          <span style={{ color: levelColor, fontWeight: 600, fontSize: '0.72rem' }}>{level}</span>
                        </td>
                        <td style={{ padding: '0.3rem 0.5rem', color: '#e2e8f0', wordBreak: 'break-all' }}>
                          {line.message.length > 800 ? `${line.message.slice(0, 800)}…` : line.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Load more */}
            {logNextToken && (
              <div style={{ padding: '0.5rem', textAlign: 'center', borderTop: '1px solid #21262d' }}>
                <button style={s.btn} onClick={loadMoreLogs} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : `Load more logs (${logs.length} loaded)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Service Map Component
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Architecture map types ─────────────────────────────────────────────────

interface ArchNode { name: string; type: string; domain: string }
interface ArchEdge { source: string; target: string; type: 'publishes' | 'consumes' | 'http' | 'reads/writes' }
interface ArchitectureMap { nodes: ArchNode[]; edges: ArchEdge[] }

type MapMode = 'live' | 'architecture';

function ServiceMapSection() {
  const { get } = useMonitoringApi();
  const [graph, setGraph] = useState<ServiceGraph | null>(null);
  const [archMap, setArchMap] = useState<ArchitectureMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<MapMode>('architecture');
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const { namePrefix } = useEnvInfo();
  const namePrefixDash = `${namePrefix}-`;

  const fetchMap = useCallback(() => {
    if (mode === 'live' && graph) { setOpen(!open); return; }
    if (mode === 'architecture' && archMap) { setOpen(!open); return; }
    setLoading(true);
    if (mode === 'live') {
      get<ServiceGraph>('/services/service-map?hours=6')
        .then((data) => { setGraph(data); setOpen(true); })
        .catch(() => setGraph({ nodes: [], edges: [], startTime: new Date(), endTime: new Date() }))
        .finally(() => setLoading(false));
    } else {
      get<ArchitectureMap>('/services/architecture-map')
        .then((data) => { setArchMap(data); setOpen(true); })
        .catch(() => setArchMap({ nodes: [], edges: [] }))
        .finally(() => setLoading(false));
    }
  }, [mode, graph, archMap, open, get]);

  // When mode changes, force reload
  const switchMode = (newMode: MapMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setOpen(false);
    setHoveredEdge(null);
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
    // Auto-fetch when switching
    setLoading(true);
    if (newMode === 'live') {
      get<ServiceGraph>('/services/service-map?hours=6')
        .then((data) => { setGraph(data); setOpen(true); })
        .catch(() => setGraph({ nodes: [], edges: [], startTime: new Date(), endTime: new Date() }))
        .finally(() => setLoading(false));
    } else {
      get<ArchitectureMap>('/services/architecture-map')
        .then((data) => { setArchMap(data); setOpen(true); })
        .catch(() => setArchMap({ nodes: [], edges: [] }))
        .finally(() => setLoading(false));
    }
  };

  // ── Process live graph data ──────────────────────────────────────────────

  type Tier = 'infra' | 'api' | 'worker' | 'data' | 'webapp';
  type ProcessedNode = { name: string; type: string; tier: Tier; requests: number; faultRate: number; edgeType?: string };
  type ProcessedEdge = { source: string; target: string; requests: number; avgResponse: number; faultRate: number; edgeType?: string };
  type ProcessedGraph = { nodes: ProcessedNode[]; edges: ProcessedEdge[]; tiers: Record<Tier, ProcessedNode[]> };

  const processed: ProcessedGraph | null = (() => {
    // ── Architecture mode ──────────────────────────────────────────────
    if (mode === 'architecture') {
      if (!archMap || archMap.nodes.length === 0) return null;

      const archTierOf = (nodeType: string): Tier => {
        switch (nodeType) {
          case 'api': return 'api';
          case 'worker': return 'worker';
          case 'webapp': return 'webapp';
          case 'cognito': return 'infra';
          default: return 'data'; // queue, dynamodb, rds, s3
        }
      };

      const nodes: ProcessedNode[] = archMap.nodes.map((n) => ({
        name: n.name,
        type: n.type,
        tier: archTierOf(n.type),
        requests: 0,
        faultRate: 0,
      }));

      const edges: ProcessedEdge[] = archMap.edges.map((e) => ({
        source: e.source,
        target: e.target,
        requests: 0,
        avgResponse: 0,
        faultRate: 0,
        edgeType: e.type,
      }));

      const tiers: Record<Tier, ProcessedNode[]> = { infra: [], webapp: [], api: [], worker: [], data: [] };
      for (const n of nodes) tiers[n.tier].push(n);

      return { nodes, edges, tiers };
    }

    // ── Live mode (X-Ray) ──────────────────────────────────────────────
    if (!graph || graph.nodes.length === 0) return null;

    // Clean names (strip env prefix and common AWS URL noise)
    const clean = (name: string) => {
      let n = name.replace(namePrefixDash, '');
      // SQS queue URL → just queue name
      const sqsMatch = n.match(/\/([^/]+)$/);
      if (n.startsWith('http') && sqsMatch) n = `SQS: ${sqsMatch[1].replace(namePrefixDash, '')}`;
      // Cognito URLs
      if (n.startsWith('cognito-idp')) n = 'Cognito';
      return n;
    };

    // Categorize a node
    const tierOf = (name: string, type: string): Tier => {
      if (['CognitoIdentityProvider', 'SecretsManager', 'Cognito'].includes(name)) return 'infra';
      if (name.startsWith('SQS') || type === 'AWS::SQS::Queue') return 'data';
      if (name.includes('-event-handler')) return 'worker';
      if (name.includes('-api-service')) return 'api';
      if (type.startsWith('AWS::')) return 'data';
      // Short names like "user", "product" are DynamoDB tables
      if (!name.includes('-') && name.length < 20) return 'data';
      return 'api';
    };

    // Build node map (merge duplicates)
    const nodeMap = new Map<string, ProcessedNode>();
    for (const n of graph.nodes) {
      const name = clean(n.name);
      const existing = nodeMap.get(name);
      if (existing) {
        existing.requests += n.totalRequests;
        existing.faultRate = Math.max(existing.faultRate, n.faultRate);
      } else {
        nodeMap.set(name, { name, type: n.type, tier: tierOf(name, n.type), requests: n.totalRequests, faultRate: n.faultRate });
      }
    }

    // Build edge list — filter self-edges and merge duplicates
    const edgeMap = new Map<string, ProcessedEdge>();
    for (const e of graph.edges) {
      const src = clean(e.source);
      const tgt = clean(e.target);
      if (src === tgt) continue; // skip self-references
      const key = `${src}→${tgt}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.requests += e.totalRequests;
        existing.avgResponse = (existing.avgResponse + e.averageResponseTime) / 2;
        existing.faultRate = Math.max(existing.faultRate, e.faultRate);
      } else {
        edgeMap.set(key, { source: src, target: tgt, requests: e.totalRequests, avgResponse: e.averageResponseTime, faultRate: e.faultRate });
      }
    }

    // Only keep nodes that appear in at least one edge (source or target)
    const connectedNames = new Set<string>();
    for (const e of edgeMap.values()) {
      connectedNames.add(e.source);
      connectedNames.add(e.target);
    }

    const nodes = [...nodeMap.values()].filter((n) => connectedNames.has(n.name));
    const edges = [...edgeMap.values()].filter((e) => e.requests > 0);

    if (nodes.length === 0) return null;

    // Group by tier
    const tiers: Record<Tier, ProcessedNode[]> = { infra: [], webapp: [], api: [], worker: [], data: [] };
    for (const n of nodes) tiers[n.tier].push(n);

    return { nodes, edges, tiers };
  })();

  // ── SVG Layout Constants ─────────────────────────────────────────────────

  const NODE_W = 170;
  const NODE_H = 44;
  const TIER_GAP = 130;
  const NODE_GAP = 20;
  const PAD_X = 40;
  const PAD_Y = 50;

  const tierOrder: Array<{ key: Tier; label: string; color: string; icon: string }> = [
    { key: 'infra', label: 'AWS Infrastructure', color: '#d29922', icon: '☁️' },
    { key: 'webapp', label: 'Frontend', color: '#58a6ff', icon: '🖥' },
    { key: 'api', label: 'API Services', color: '#1f6feb', icon: '🌐' },
    { key: 'worker', label: 'Event Handlers', color: '#8957e5', icon: '⚙️' },
    { key: 'data', label: 'Data Stores & Queues', color: '#3fb950', icon: '💾' },
  ];

  // Position each node
  const positions = new Map<string, { x: number; y: number }>();
  let svgWidth = 600;
  let svgHeight = 400;

  if (processed) {
    const nonEmptyTiers = tierOrder.filter((t) => processed.tiers[t.key].length > 0);
    let tierY = PAD_Y;

    for (const tier of nonEmptyTiers) {
      const tierNodes = processed.tiers[tier.key];
      const tierWidth = tierNodes.length * NODE_W + (tierNodes.length - 1) * NODE_GAP;
      const maxWidth = Math.max(svgWidth, tierWidth + PAD_X * 2);
      if (maxWidth > svgWidth) svgWidth = maxWidth;

      const startX = PAD_X;
      tierNodes.forEach((n, i) => {
        positions.set(n.name, { x: startX + i * (NODE_W + NODE_GAP), y: tierY });
      });
      tierY += TIER_GAP;
    }
    svgHeight = tierY + PAD_Y;

    // Center each tier horizontally
    for (const tier of nonEmptyTiers) {
      const tierNodes = processed.tiers[tier.key];
      const tierWidth = tierNodes.length * NODE_W + (tierNodes.length - 1) * NODE_GAP;
      const offset = (svgWidth - tierWidth) / 2 - PAD_X;
      if (offset > 0) {
        for (const n of tierNodes) {
          const pos = positions.get(n.name);
          if (pos) pos.x += offset;
        }
      }
    }
  }

  // ── Arrow path builder ─────────────────────────────────────────────────

  function arrowPath(srcName: string, tgtName: string): string {
    const src = positions.get(srcName);
    const tgt = positions.get(tgtName);
    if (!src || !tgt) return '';

    const sx = src.x + NODE_W / 2;
    const sy = src.y + NODE_H;
    const tx = tgt.x + NODE_W / 2;
    const ty = tgt.y;

    // If same tier (horizontal), arc over
    if (Math.abs(sy - tgt.y - NODE_H) < 10) {
      const midY = sy - 50;
      return `M ${sx} ${sy - NODE_H} Q ${(sx + tx) / 2} ${midY}, ${tx} ${ty + NODE_H}`;
    }

    // Normal top-to-bottom bezier
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
  }

  // ── Node color by tier ─────────────────────────────────────────────────

  const nodeColor = (tier: string): { bg: string; border: string } => {
    switch (tier) {
      case 'infra': return { bg: '#2d2000', border: '#9e6a03' };
      case 'webapp': return { bg: '#0d1d3a', border: '#58a6ff' };
      case 'api': return { bg: '#0d2240', border: '#1f6feb' };
      case 'worker': return { bg: '#1c0d3a', border: '#8957e5' };
      case 'data': return { bg: '#0d2818', border: '#238636' };
      default: return { bg: '#21262d', border: '#30363d' };
    }
  };

  // ── Edge color by type (architecture mode) ────────────────────────────

  const edgeColor = (edgeType?: string): string => {
    switch (edgeType) {
      case 'http': return '#58a6ff';
      case 'publishes': return '#d29922';
      case 'consumes': return '#8957e5';
      case 'reads/writes': return '#3fb950';
      default: return '#484f58';
    }
  };

  // ── Edge label for architecture mode ──────────────────────────────────

  const edgeLabel = (edge: ProcessedEdge): string => {
    if (mode === 'live') {
      return `${edge.requests} req · ${edge.avgResponse.toFixed(0)}ms`;
    }
    return edge.edgeType ?? '';
  };

  // ── Mode toggle style ─────────────────────────────────────────────────

  const modeBtn = (m: MapMode) => ({
    padding: '0.25rem 0.7rem',
    borderRadius: m === 'architecture' ? '4px 0 0 4px' : '0 4px 4px 0',
    border: '1px solid #30363d',
    background: mode === m ? '#1f6feb' : '#21262d',
    color: mode === m ? '#fff' : '#8b949e',
    cursor: 'pointer' as const,
    fontSize: '0.78rem',
    fontWeight: mode === m ? 600 : 400,
    borderRight: m === 'architecture' ? 'none' : undefined,
  });

  // ── Zoom & Pan handlers ────────────────────────────────────────────────

  const handleWheelZoom = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => {
      const newZoom = Math.min(Math.max(prev * scaleFactor, 0.3), 5);
      const svg = svgRef.current;
      if (!svg) return newZoom;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setViewOffset((prevOff) => {
        const svgMouseX = prevOff.x + (mouseX / rect.width) * (svgWidth / prev);
        const svgMouseY = prevOff.y + (mouseY / rect.height) * (svgHeight / prev);
        return {
          x: svgMouseX - (mouseX / rect.width) * (svgWidth / newZoom),
          y: svgMouseY - (mouseY / rect.height) * (svgHeight / newZoom),
        };
      });
      return newZoom;
    });
  }, [svgWidth, svgHeight]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !open || !processed) return;
    svg.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheelZoom);
  }, [handleWheelZoom, open, processed]);

  const handlePanStart = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, offsetX: viewOffset.x, offsetY: viewOffset.y };
  }, [viewOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setViewOffset({
      x: panStart.current.offsetX - (dx / rect.width) * (svgWidth / zoom),
      y: panStart.current.offsetY - (dy / rect.height) * (svgHeight / zoom),
    });
  }, [isPanning, zoom, svgWidth, svgHeight]);

  const handlePanEnd = useCallback(() => { setIsPanning(false); }, []);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.3, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev * 0.7, 0.3));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
  }, []);

  const isOpen = open && ((mode === 'live' && graph) || (mode === 'architecture' && archMap));

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button style={s.btn} onClick={fetchMap} disabled={loading}>
          {loading ? 'Loading…' : isOpen ? '🗺 Hide Service Map' : '🗺 Show Service Map'}
        </button>
        <div>
          <button style={modeBtn('architecture')} onClick={() => switchMode('architecture')}>Architecture</button>
          <button style={modeBtn('live')} onClick={() => switchMode('live')}>Live</button>
        </div>
        <span style={{ ...s.meta, fontSize: '0.72rem' }}>
          {mode === 'architecture' ? 'All services from registry' : 'Active services (last 6h)'}
        </span>
      </div>
      {isOpen && (
        <div style={{ marginTop: '0.75rem' }}>
          {!processed && (
            <p style={s.meta}>
              {mode === 'live'
                ? 'No cross-service connections found in the last 6 hours.'
                : 'No services found in the registry.'}
            </p>
          )}
          {processed && (
            <div style={{ background: '#0d1117', borderRadius: '8px', border: '1px solid #21262d', padding: '1rem', overflow: 'auto' }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {tierOrder.filter((t) => processed.tiers[t.key].length > 0).map((t) => (
                  <span key={t.key} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.color, display: 'inline-block' }} />
                    <span style={{ color: '#8b949e' }}>{t.icon} {t.label}</span>
                  </span>
                ))}
              </div>

              {/* Edge type legend (architecture mode only) */}
              {mode === 'architecture' && (
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {[
                    { type: 'http', label: 'HTTP call', color: '#58a6ff' },
                    { type: 'publishes', label: 'Publishes to queue', color: '#d29922' },
                    { type: 'consumes', label: 'Consumes from queue', color: '#8957e5' },
                    { type: 'reads/writes', label: 'Reads/writes data', color: '#3fb950' },
                  ].map((e) => (
                    <span key={e.type} style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke={e.color} strokeWidth="2" /></svg>
                      <span style={{ color: '#8b949e' }}>{e.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Zoom Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button style={s.btnSmall} onClick={zoomIn} title="Zoom in">＋</button>
                <button style={s.btnSmall} onClick={zoomOut} title="Zoom out">－</button>
                <button style={s.btnSmall} onClick={resetView} title="Reset zoom">⟲</button>
                <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>{Math.round(zoom * 100)}%</span>
                <span style={{ fontSize: '0.65rem', color: '#484f58', marginLeft: '0.5rem' }}>Scroll to zoom · Drag to pan</span>
              </div>

              {/* SVG Graph */}
              <svg
                ref={svgRef}
                viewBox={`${viewOffset.x} ${viewOffset.y} ${svgWidth / zoom} ${svgHeight / zoom}`}
                width="100%"
                style={{ maxHeight: '600px', cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#484f58" />
                  </marker>
                  <marker id="arrowhead-hl" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#58a6ff" />
                  </marker>
                  <marker id="arrowhead-http" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#58a6ff" />
                  </marker>
                  <marker id="arrowhead-pub" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#d29922" />
                  </marker>
                  <marker id="arrowhead-consume" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#8957e5" />
                  </marker>
                  <marker id="arrowhead-data" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#3fb950" />
                  </marker>
                </defs>

                {/* Tier labels */}
                {tierOrder.map((t) => {
                  const tierNodes = processed.tiers[t.key];
                  if (tierNodes.length === 0) return null;
                  const firstPos = positions.get(tierNodes[0].name);
                  if (!firstPos) return null;
                  return (
                    <text key={t.key} x={12} y={firstPos.y + NODE_H / 2 + 4} fill={t.color} fontSize="11" fontWeight="600" opacity={0.6}>
                      {t.label.toUpperCase()}
                    </text>
                  );
                })}

                {/* Edges (arrows) */}
                {processed.edges.map((edge) => {
                  const key = `${edge.source}→${edge.target}`;
                  const isHovered = hoveredEdge === key;
                  const path = arrowPath(edge.source, edge.target);
                  if (!path) return null;

                  const srcPos = positions.get(edge.source);
                  const tgtPos = positions.get(edge.target);
                  if (!srcPos || !tgtPos) return null;
                  const labelX = (srcPos.x + NODE_W / 2 + tgtPos.x + NODE_W / 2) / 2;
                  const labelY = (srcPos.y + NODE_H + tgtPos.y) / 2;

                  const baseColor = mode === 'architecture' ? edgeColor(edge.edgeType) : (edge.faultRate > 0 ? '#f85149' : '#484f58');
                  const markerSuffix = mode === 'architecture'
                    ? (edge.edgeType === 'http' ? 'http' : edge.edgeType === 'publishes' ? 'pub' : edge.edgeType === 'consumes' ? 'consume' : 'data')
                    : '';

                  return (
                    <g key={key}
                       onMouseEnter={() => setHoveredEdge(key)}
                       onMouseLeave={() => setHoveredEdge(null)}
                       style={{ cursor: 'default' }}
                    >
                      {/* Invisible wider path for easier hover */}
                      <path d={path} fill="none" stroke="transparent" strokeWidth="16" />
                      {/* Visible arrow */}
                      <path
                        d={path}
                        fill="none"
                        stroke={isHovered ? '#58a6ff' : baseColor}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        strokeDasharray={mode === 'live' && edge.requests === 0 ? '4,3' : 'none'}
                        markerEnd={isHovered ? 'url(#arrowhead-hl)' : (mode === 'architecture' ? `url(#arrowhead-${markerSuffix})` : 'url(#arrowhead)')}
                        opacity={isHovered ? 1 : 0.7}
                      />
                      {/* Label on hover */}
                      {isHovered && (
                        <g>
                          <rect x={labelX - 55} y={labelY - 12} width={110} height={22} rx={4} fill="#161b22" stroke="#30363d" />
                          <text x={labelX} y={labelY + 3} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">
                            {edgeLabel(edge)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {processed.nodes.map((node) => {
                  const pos = positions.get(node.name);
                  if (!pos) return null;
                  const colors = nodeColor(node.tier);
                  const shortName = node.name
                    .replace('-api-service', '')
                    .replace('-event-handler-service', '-eh')
                    .replace('SQS: ', '📨 ');

                  const subtitle = mode === 'live'
                    ? `${node.requests} requests${node.faultRate > 0 ? ` · ${node.faultRate.toFixed(1)}% fault` : ''}`
                    : node.type;

                  return (
                    <g key={node.name}>
                      <rect
                        x={pos.x}
                        y={pos.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={6}
                        fill={colors.bg}
                        stroke={colors.border}
                        strokeWidth={1.5}
                      />
                      <text x={pos.x + NODE_W / 2} y={pos.y + 18} textAnchor="middle" fill="#e2e8f0" fontSize="11.5" fontWeight="600">
                        {shortName}
                      </text>
                      <text x={pos.x + NODE_W / 2} y={pos.y + 34} textAnchor="middle" fill="#8b949e" fontSize="9.5">
                        {subtitle}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Summary below SVG */}
              <div style={{ ...s.meta, marginTop: '0.75rem', textAlign: 'center' }}>
                {processed.nodes.length} services · {processed.edges.length} connections
                {mode === 'live' ? ' · Last 6 hours' : ' · From service registry'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════ */

function ServicesContent() {
  const { get } = useMonitoringApi();
  const { environment, namePrefix } = useEnvInfo();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'alarms' ? 'alarms' : 'overview';
  const [data, setData] = useState<ServicesResponse | null>(null);
  const [metricsOverview, setMetricsOverview] = useState<Record<string, FunctionMetricsOverview>>({});
  const [dlqs, setDlqs] = useState<QueueAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'alarms'>(initialTab);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      get<ServicesResponse>('/services'),
      get<{ overview: Record<string, FunctionMetricsOverview> }>('/services/metrics-overview'),
      get<{ dlqs: QueueAttributes[] }>('/services/dlq'),
    ])
      .then(([services, metrics, dlqData]) => {
        setData(services);
        setMetricsOverview(metrics.overview);
        setDlqs(dlqData.dlqs);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [get]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, 30_000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchAll]);

  if (loading && !data) return <p>Loading services…</p>;
  if (error) return <p style={{ color: '#f85149' }}>Error: {error}</p>;
  if (!data) return <p>No data</p>;

  const totalServices = data.apiServices.length + data.workerServices.length;

  // Build DLQ depth map: queue name -> message count
  const dlqMap = new Map<string, number>();
  for (const dlq of dlqs) {
    // Map DLQ to its source queue's function (e.g. "mma-dev-user-events-dlq" -> "user-event-handler")
    dlqMap.set(dlq.queueName, dlq.approximateNumberOfMessages);
  }

  // Match DLQ to worker function
  const getDlqDepth = (fn: EnrichedFunction): number | null => {
    for (const [queueName, count] of dlqMap) {
      const fnShort = fn.functionName.replace(`${namePrefix}-`, '');
      const domain = fnShort.split('-')[0];
      if (queueName.includes(domain)) return count;
    }
    return null;
  };

  // Summary stats
  const totalErrors = Object.values(metricsOverview).reduce((sum, m) => sum + m.totalErrors, 0);
  const totalInvocations = Object.values(metricsOverview).reduce((sum, m) => sum + m.totalInvocations, 0);
  const totalDlqMessages = dlqs.reduce((sum, d) => sum + d.approximateNumberOfMessages, 0);

  // Count alarms in ALARM state across all services for the tab badge
  const totalAlarmsInAlarmState = data
    ? [...data.apiServices, ...data.workerServices].reduce((sum, fn) => sum + fn.alarms.filter((a) => a.state === 'ALARM').length, 0)
    : 0;

  return (
    <div>
      {/* ── Header bar ────────────────────────────────────── */}
      <div style={s.refreshBar}>
        <div>
          <h1 style={{ margin: 0 }}>Services</h1>
          <div style={{ ...s.meta, marginTop: '0.25rem' }}>
            {totalServices} functions in <strong style={{ color: '#58a6ff' }}>{environment}</strong>
            {' · '}
            <span style={{ color: totalErrors > 0 ? '#f85149' : '#3fb950' }}>{totalErrors} errors</span>
            {' · '}
            {totalInvocations.toLocaleString()} invocations (1h)
            {totalDlqMessages > 0 && (
              <span> · <span style={{ color: '#f85149' }}>{totalDlqMessages} DLQ messages</span></span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ ...s.meta, fontSize: '0.75rem' }}>Auto-refresh</span>
            <button style={s.toggle(autoRefresh)} onClick={() => setAutoRefresh(!autoRefresh)}>
              <div style={s.toggleDot(autoRefresh)} />
            </button>
          </div>
          <button style={s.btnPrimary} onClick={fetchAll} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh All'}
          </button>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <div style={s.tabBar}>
        <button style={s.tab(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button style={s.tab(activeTab === 'alarms')} onClick={() => setActiveTab('alarms')}>
          Alarms
          <span style={s.tabBadge(totalAlarmsInAlarmState, 'error')}>{totalAlarmsInAlarmState}</span>
        </button>
      </div>

      {/* ── Overview tab ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* ── Service Map ───────────────────────────────── */}
          <ServiceMapSection />

          {/* ── API Services ──────────────────────────────── */}
          <h2 style={s.sectionTitle}>
            <span>🌐 API Services</span>
            <span style={{ ...s.meta, fontWeight: 400 }}>({data.apiServices.length})</span>
          </h2>
          {data.apiServices.length === 0 && <p style={s.meta}>No API services found</p>}
          {data.apiServices.map((fn) => (
            <ServiceCard
              key={fn.functionName}
              fn={fn}
              namePrefix={namePrefix}
              metrics={metricsOverview[fn.functionName] ?? null}
              dlqDepth={null}
            />
          ))}

          {/* ── Worker Services ───────────────────────────── */}
          <h2 style={s.sectionTitle}>
            <span>⚙️ Worker Services</span>
            <span style={{ ...s.meta, fontWeight: 400 }}>({data.workerServices.length})</span>
          </h2>
          {data.workerServices.length === 0 && <p style={s.meta}>No worker services found</p>}
          {data.workerServices.map((fn) => (
            <ServiceCard
              key={fn.functionName}
              fn={fn}
              namePrefix={namePrefix}
              metrics={metricsOverview[fn.functionName] ?? null}
              dlqDepth={getDlqDepth(fn)}
            />
          ))}
        </>
      )}

      {/* ── Alarms tab ────────────────────────────────────── */}
      {activeTab === 'alarms' && <AlarmsTab namePrefix={namePrefix} />}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ServicesContent />
    </Suspense>
  );
}
