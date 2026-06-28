'use client';
import { useMemo, useState } from 'react';
import type { CorrelatedLogEntry } from '@old-st/monitoring-sdk';

interface CorrelatedLogPanelProps {
  logs: CorrelatedLogEntry[];
  highlightedService: string | null;
}

const SERVICE_COLORS: Record<string, string> = {};
const PALETTE = ['#58a6ff', '#bc8cff', '#3fb950', '#d29922', '#f778ba', '#79c0ff', '#ffa657', '#7ee787'];
let colorIndex = 0;

function getServiceColor(serviceName: string): string {
  if (!SERVICE_COLORS[serviceName]) {
    SERVICE_COLORS[serviceName] = PALETTE[colorIndex % PALETTE.length];
    colorIndex++;
  }
  return SERVICE_COLORS[serviceName];
}

function shortName(name: string): string {
  // Strip environment prefix: {project}-{env}- (e.g. old-st-dev-)
  return name.replace(/^.*?-(dev|staging|prod|preview)-/, '');
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function levelClass(level: string): string {
  switch (level.toUpperCase()) {
    case 'ERROR': return 'level-error';
    case 'WARN': return 'level-warn';
    default: return 'level-info';
  }
}

export function CorrelatedLogPanel({ logs, highlightedService }: CorrelatedLogPanelProps) {
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const services = useMemo(
    () => Array.from(new Set(logs.map((l) => l.service))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (serviceFilter !== 'all' && log.service !== serviceFilter) return false;
      if (levelFilter !== 'all' && log.level.toUpperCase() !== levelFilter) return false;
      return true;
    });
  }, [logs, serviceFilter, levelFilter]);

  if (logs.length === 0) {
    return <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>No correlated logs found for this trace.</p>;
  }

  return (
    <div>
      <div className="log-panel-filters">
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {shortName(s)}
            </option>
          ))}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="all">All levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#484f58' }}>
          {filteredLogs.length} / {logs.length} entries
        </span>
      </div>

      <div className="log-panel">
        {filteredLogs.map((log, idx) => {
          const isHighlighted = highlightedService !== null && log.service.includes(highlightedService);
          return (
            <div
              key={`${log.timestamp}-${idx}`}
              className={`log-entry ${isHighlighted ? 'log-highlighted' : ''}`}
            >
              <span className="log-ts">{formatTime(log.timestamp)}</span>
              <span className="log-service" style={{ color: getServiceColor(log.service) }}>
                {shortName(log.service)}
              </span>
              <span className={`log-level ${levelClass(log.level)}`}>
                {log.level}
              </span>
              <span className="log-msg">
                {log.message}
                {Object.keys(log.extras).length > 0 && (
                  <span className="log-extras">
                    {Object.entries(log.extras).map(([key, value]) => (
                      <span key={key} className="log-extra-tag">
                        {key}={value}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
