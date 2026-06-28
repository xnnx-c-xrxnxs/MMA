'use client';
import { Suspense } from 'react';
import { useMonitoringApi } from '../../../lib/use-monitoring-api';
import { useEffect, useState, useMemo } from 'react';
import { use } from 'react';
import Link from 'next/link';
import type { CorrelatedLogEntry } from '@old-st/monitoring-sdk';
import { CorrelatedLogPanel } from '../../../components/traces/correlated-log-panel';

interface ChainDetailResponse {
  logs: CorrelatedLogEntry[];
  scannedLogGroups: string[];
}

function shortName(name: string): string {
  return name.replace(/^.*?-(dev|staging|prod|preview)-/, '');
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

function LoadingSkeleton() {
  return (
    <div className="journey-page">
      <div className="journey-section">
        <div className="skeleton" style={{ height: 80 }} />
      </div>
      <div className="journey-section">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    </div>
  );
}

interface ServiceSummary {
  name: string;
  shortName: string;
  role: 'api' | 'event-handler';
  firstSeen: number;
  lastSeen: number;
  logCount: number;
  hasErrors: boolean;
  eventTypes: string[];
}

function ChainDetailContent({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId: correlationId } = use(params);
  const { get } = useMonitoringApi();
  const [data, setData] = useState<ChainDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<ChainDetailResponse>(`/traces/${correlationId}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [get, correlationId]);

  // Build service summaries from logs
  const serviceSummaries = useMemo((): ServiceSummary[] => {
    if (!data?.logs.length) return [];

    const map = new Map<string, ServiceSummary>();
    for (const log of data.logs) {
      let svc = map.get(log.service);
      if (!svc) {
        svc = {
          name: log.service,
          shortName: shortName(log.service),
          role: log.service.includes('event-handler') ? 'event-handler' : 'api',
          firstSeen: log.timestamp,
          lastSeen: log.timestamp,
          logCount: 0,
          hasErrors: false,
          eventTypes: [],
        };
        map.set(log.service, svc);
      }
      svc.logCount++;
      svc.firstSeen = Math.min(svc.firstSeen, log.timestamp);
      svc.lastSeen = Math.max(svc.lastSeen, log.timestamp);
      if (log.level === 'ERROR') svc.hasErrors = true;
      if (log.extras['eventType'] && !svc.eventTypes.includes(log.extras['eventType'])) {
        svc.eventTypes.push(log.extras['eventType']);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.firstSeen - b.firstSeen);
  }, [data]);

  const totalDuration = useMemo(() => {
    if (!data?.logs.length) return 0;
    const times = data.logs.map((l) => l.timestamp);
    return Math.max(...times) - Math.min(...times);
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  if (!data || data.logs.length === 0) {
    return (
      <div>
        <Link href="/traces" style={{ color: '#58a6ff', fontSize: '0.85rem' }}>← Back to event chains</Link>
        <h1 style={{ marginTop: '1rem' }}>No logs found</h1>
        <p style={{ color: '#8b949e' }}>
          No logs found for correlation ID <code style={{ color: '#e2e8f0' }}>{correlationId}</code>.
          <br />The logs may have expired, or the services have not yet processed this request.
        </p>
      </div>
    );
  }

  return (
    <div className="journey-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <Link href="/traces" style={{ color: '#58a6ff', fontSize: '0.85rem', textDecoration: 'none' }}>← Back to event chains</Link>
          <h1 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.3rem' }}>Event Chain Detail</h1>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: 0 }}>
            Correlation ID: <code style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{correlationId}</code>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
            Duration: <strong style={{ color: '#e2e8f0' }}>{formatDuration(totalDuration)}</strong>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
            Services: <strong style={{ color: '#e2e8f0' }}>{serviceSummaries.length}</strong>
            &nbsp;·&nbsp; Logs: <strong style={{ color: '#e2e8f0' }}>{data.logs.length}</strong>
          </div>
        </div>
      </div>

      {/* Service Flow */}
      <div className="journey-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Service Flow</h2>
        <div className="service-flow">
          {serviceSummaries.map((svc, idx) => (
            <div key={svc.name} style={{ display: 'flex', alignItems: 'center' }}>
              {idx > 0 && (
                <div className="flow-connector">
                  <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>
                    {svc.role === 'event-handler' ? 'SQS' : 'HTTP'}
                  </span>
                </div>
              )}
              <div className={`flow-node ${svc.hasErrors ? 'status-error-node' : 'status-ok-node'}`}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{svc.shortName}</div>
                <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>
                  {svc.role === 'event-handler' ? 'Event Handler' : 'API'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>
                  {formatDuration(svc.lastSeen - svc.firstSeen)}
                  &nbsp;· {svc.logCount} logs
                </div>
                {svc.eventTypes.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {svc.eventTypes.map((e) => (
                      <span key={e} className="log-extra-tag" style={{ fontSize: '0.6rem' }}>{e}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline — simplified per-service bars */}
      <div className="journey-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Timeline</h2>
        <ServiceTimeline services={serviceSummaries} logs={data.logs} />
      </div>

      {/* Correlated Logs */}
      <div className="journey-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Logs</h2>
        <CorrelatedLogPanel logs={data.logs} highlightedService={null} />
      </div>
    </div>
  );
}

function ServiceTimeline({ services, logs }: { services: ServiceSummary[]; logs: CorrelatedLogEntry[] }) {
  if (services.length === 0) return null;

  const allTimes = logs.map((l) => l.timestamp);
  const globalStart = Math.min(...allTimes);
  const globalEnd = Math.max(...allTimes);
  const totalSpan = globalEnd - globalStart || 1;

  return (
    <div className="waterfall-container">
      {services.map((svc) => {
        const leftPct = ((svc.firstSeen - globalStart) / totalSpan) * 100;
        const widthPct = Math.max(((svc.lastSeen - svc.firstSeen) / totalSpan) * 100, 0.5);

        return (
          <div key={svc.name} className="waterfall-row">
            <div className="waterfall-label" title={svc.name}>
              {svc.shortName}
            </div>
            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
              <div
                className={`waterfall-bar ${svc.hasErrors ? 'bar-error' : 'bar-ok'}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${formatTimestamp(svc.firstSeen)} → ${formatTimestamp(svc.lastSeen)} (${formatDuration(svc.lastSeen - svc.firstSeen)})`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChainDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ChainDetailContent params={params} />
    </Suspense>
  );
}
