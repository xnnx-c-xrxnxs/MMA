'use client';
import type { JourneySegment } from '@old-st/monitoring-sdk';

interface TimelineWaterfallProps {
  segments: JourneySegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
}

interface FlatRow {
  segmentId: string;
  label: string;
  serviceName: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: string;
  depth: number;
}

function flattenSegments(
  segments: JourneySegment[],
  depth = 0,
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const seg of segments) {
    rows.push({
      segmentId: seg.segmentId,
      label: depth === 0 ? shortName(seg.serviceName) : seg.name,
      serviceName: seg.serviceName,
      startTime: seg.startTime,
      endTime: seg.endTime,
      duration: seg.duration,
      status: seg.status,
      depth,
    });
    if (seg.children) {
      rows.push(...flattenSegments(seg.children, depth + 1));
    }
  }
  return rows;
}

function shortName(name: string): string {
  // Strip environment prefix: {project}-{env}- (e.g. old-st-dev-)
  return name.replace(/^.*?-(dev|staging|prod|preview)-/, '');
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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

function generateTicks(totalDuration: number, barWidth: number): Array<{ position: number; label: string }> {
  const ticks: Array<{ position: number; label: string }> = [];
  const targetTickCount = Math.min(6, Math.max(2, Math.floor(barWidth / 100)));
  const interval = totalDuration / targetTickCount;

  for (let i = 0; i <= targetTickCount; i++) {
    const time = interval * i;
    const pct = totalDuration > 0 ? (time / totalDuration) * 100 : 0;
    ticks.push({
      position: pct,
      label: formatDuration(time),
    });
  }
  return ticks;
}

export function TimelineWaterfall({
  segments,
  selectedSegmentId,
  onSelectSegment,
}: TimelineWaterfallProps) {
  const rows = flattenSegments(segments);
  if (rows.length === 0) return null;

  const globalStart = Math.min(...rows.map((r) => r.startTime));
  const globalEnd = Math.max(...rows.map((r) => r.endTime));
  const totalDuration = globalEnd - globalStart;

  const ticks = generateTicks(totalDuration, 800);

  return (
    <div className="waterfall-container">
      {/* Header with time ticks */}
      <div className="waterfall-header">
        <div className="wh-label">Segment</div>
        <div className="wh-ticks">
          {ticks.map((tick) => (
            <span
              key={tick.position}
              className="wh-tick"
              style={{ left: `${tick.position}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const leftPct = totalDuration > 0 ? ((row.startTime - globalStart) / totalDuration) * 100 : 0;
        const widthPct = totalDuration > 0 ? (row.duration / totalDuration) * 100 : 0;
        const barClass = row.status === 'fault' ? 'bar-fault' : row.status === 'error' ? 'bar-error' : 'bar-ok';
        const isSelected = selectedSegmentId === row.segmentId;

        return (
          <div
            key={row.segmentId}
            className={`waterfall-row ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectSegment(isSelected ? null : row.segmentId)}
          >
            <div
              className="waterfall-label"
              style={{ paddingLeft: `${row.depth * 16 + 8}px` }}
              title={`${row.serviceName} → ${row.label}`}
            >
              <span style={{ color: getServiceColor(row.serviceName), marginRight: '0.35rem' }}>●</span>
              {row.label}
            </div>
            <div className="waterfall-bar-area">
              <div
                className={`waterfall-bar ${barClass}`}
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 0.3)}%`,
                }}
              >
                <span className="bar-duration">{formatDuration(row.duration)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
