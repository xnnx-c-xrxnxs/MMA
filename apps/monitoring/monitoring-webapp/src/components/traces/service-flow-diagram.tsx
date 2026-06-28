'use client';
import type { ServiceParticipant, JourneySegment } from '@mma/monitoring-sdk';

interface ServiceFlowDiagramProps {
  services: ServiceParticipant[];
  segments: JourneySegment[];
}

/** Derive the communication label between two consecutive services from segments. */
function getConnectionLabel(
  segments: JourneySegment[],
  fromService: string,
  toService: string,
): string {
  // Look for SQS subsegments in the source service that connect to the target
  for (const seg of segments) {
    if (seg.serviceName !== fromService) continue;
    const sqsChild = findSqsChild(seg);
    if (sqsChild) return sqsChild;
  }

  // Check if it's an HTTP call (ACL pattern)
  for (const seg of segments) {
    if (seg.serviceName !== fromService) continue;
    const httpChild = findHttpChild(seg, toService);
    if (httpChild) return httpChild;
  }

  return '';
}

function findSqsChild(seg: JourneySegment): string | undefined {
  if (seg.communicationType === 'SQS' || seg.name === 'SQS') {
    return 'SQS';
  }
  for (const child of seg.children ?? []) {
    const result = findSqsChild(child);
    if (result) return result;
  }
  return undefined;
}

function findHttpChild(seg: JourneySegment, targetService: string): string | undefined {
  if (seg.name.includes(targetService) || (seg.communicationType && seg.communicationType.startsWith('HTTP'))) {
    return 'HTTP';
  }
  for (const child of seg.children ?? []) {
    const result = findHttpChild(child, targetService);
    if (result) return result;
  }
  return undefined;
}

function statusClass(status: string): string {
  switch (status) {
    case 'fault': return 'status-fault-node';
    case 'error': return 'status-error-node';
    default: return 'status-ok-node';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function shortServiceName(name: string): string {
  // Strip environment prefix: {project}-{env}- (e.g. mma-dev-)
  return name.replace(/^.*?-(dev|staging|prod|preview)-/, '');
}

export function ServiceFlowDiagram({ services, segments }: ServiceFlowDiagramProps) {
  if (services.length === 0) return null;

  return (
    <div className="service-flow">
      {services.map((service, index) => (
        <div key={service.name} style={{ display: 'contents' }}>
          <div className={`flow-node ${statusClass(service.status)}`}>
            <span className="node-role">{service.role}</span>
            <span className="node-name">{shortServiceName(service.name)}</span>
            <span className="node-duration">{formatDuration(service.duration)}</span>
          </div>
          {index < services.length - 1 && (
            <div className="flow-connector">
              <span className="connector-label">
                {getConnectionLabel(segments, service.name, services[index + 1].name)}
              </span>
              <div className="connector-line" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
