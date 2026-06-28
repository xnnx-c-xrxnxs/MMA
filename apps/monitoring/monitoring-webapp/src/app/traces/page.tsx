'use client';
import { Suspense } from 'react';
import { useMonitoringApi } from '../../lib/use-monitoring-api';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { EventChainSummary } from '@old-st/monitoring-sdk';

const TIME_RANGES = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '3 hours', value: 180 },
  { label: '6 hours', value: 360 },
];

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(epoch: number): string {
  const d = new Date(epoch);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortName(name: string): string {
  return name.replace(/^.*?-(dev|staging|prod|preview)-/, '');
}

function EventChainsContent() {
  const { get } = useMonitoringApi();
  const [chains, setChains] = useState<EventChainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [minutes, setMinutes] = useState(60);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchChains = useCallback(() => {
    setLoading(true);
    get<{ chains: EventChainSummary[] }>(`/traces?minutes=${minutes}`)
      .then((data) => setChains(data.chains))
      .finally(() => setLoading(false));
  }, [get, minutes]);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  // All unique service names across all chains
  const allServices = useMemo(() => {
    const serviceSet = new Set<string>();
    chains.forEach((c) => c.services.forEach((s) => serviceSet.add(s)));
    return Array.from(serviceSet).sort();
  }, [chains]);

  // Filtered chains
  const filteredChains = useMemo(() => {
    return chains.filter((chain) => {
      if (statusFilter === 'ok' && chain.hasErrors) return false;
      if (statusFilter === 'error' && !chain.hasErrors) return false;

      if (serviceFilter !== 'all' && !chain.services.includes(serviceFilter)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesId = chain.correlationId.toLowerCase().includes(q);
        const matchesDesc = chain.description.toLowerCase().includes(q);
        const matchesService = chain.services.some((s) => shortName(s).toLowerCase().includes(q));
        const matchesEvent = chain.eventTypes.some((e) => e.toLowerCase().includes(q));
        if (!matchesId && !matchesDesc && !matchesService && !matchesEvent) return false;
      }

      return true;
    });
  }, [chains, statusFilter, serviceFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = chains.length;
    const errors = chains.filter((c) => c.hasErrors).length;
    const ok = total - errors;
    return { total, errors, ok };
  }, [chains]);

  return (
    <div>
      {/* Header */}
      <div className="traces-header">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Event Chains</h1>
          {!loading && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#8b949e' }}>
              {stats.total} chains &nbsp;·&nbsp;
              <span className="status-ok">{stats.ok} OK</span> &nbsp;·&nbsp;
              <span className="status-error">{stats.errors} with errors</span>
            </p>
          )}
        </div>
        <button
          onClick={fetchChains}
          style={{
            padding: '0.35rem 0.75rem', border: '1px solid #30363d', borderRadius: '6px',
            background: '#21262d', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="traces-filters">
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="error">Has errors</option>
        </select>
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="all">All services</option>
          {allServices.map((s) => (
            <option key={s} value={s}>{shortName(s)}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search correlation ID, service, or event…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ minWidth: '200px' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ marginTop: '1rem' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : filteredChains.length === 0 ? (
        <p style={{ color: '#8b949e', marginTop: '2rem', textAlign: 'center' }}>
          {chains.length === 0
            ? 'No event chains found. Make some API calls to generate correlated logs.'
            : 'No event chains match your filters.'}
        </p>
      ) : (
        <table className="traces-table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Description</th>
              <th>Correlation ID</th>
              <th>Services</th>
              <th>Logs</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredChains.map((chain) => (
              <tr key={chain.correlationId}>
                <td style={{ whiteSpace: 'nowrap', color: '#8b949e', fontSize: '0.8rem' }}>
                  {formatTimestamp(chain.startTime)}
                </td>
                <td style={{ maxWidth: '350px' }}>
                  <Link href={`/traces/${chain.correlationId}`} style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '0.85rem' }}>
                    {chain.description}
                  </Link>
                  {chain.eventTypes.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      {chain.eventTypes.map((e) => (
                        <span key={e} className="log-extra-tag" style={{ fontSize: '0.65rem' }}>{e}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <Link href={`/traces/${chain.correlationId}`} style={{ fontSize: '0.75rem' }}>
                    {chain.correlationId.slice(0, 8)}…
                  </Link>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {chain.services.map((s) => (
                      <span key={s} className="service-chip">{shortName(s)}</span>
                    ))}
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'center' }}>
                  {chain.logCount}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {formatDuration(chain.duration)}
                </td>
                <td>
                  <span
                    className={chain.hasErrors ? 'status-error' : 'status-ok'}
                    style={{ fontWeight: 600 }}
                  >
                    {chain.hasErrors ? 'ERROR' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function TracesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EventChainsContent />
    </Suspense>
  );
}
