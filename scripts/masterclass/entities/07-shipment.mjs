// Level 7 — entity that records its own audit/event history.
export default {
  id: '07-shipment',
  level: 6,
  complexityLabel: 'L7 · Audit Log',
  domain: 'Logistics',
  title: 'Shipment',
  introShort: 'Each transition records actor + timestamp inside the entity.',
  intro: 'A Shipment moves through a real-world physical workflow. Operators need to know not just the current state but who moved it there, when, and from which location. The entity owns an internal append-only event log; outside code can read it but cannot tamper with it.',
  specTitle: 'Logistics · Shipment',
  specBodyHtml: `
    <p>A <strong>Shipment</strong> tracks delivery of an order.</p>
    <ul>
      <li>States: <code>PREPARING</code> → <code>DISPATCHED</code> → <code>IN_TRANSIT</code> → <code>DELIVERED</code> | <code>FAILED</code>.</li>
      <li><em>dispatch()</em> requires a <em>tracking number</em> and the operator's userId.</li>
      <li><em>recordTransitLocation()</em> can be called many times while <code>IN_TRANSIT</code>, each adding a new location event.</li>
      <li><em>deliver()</em> and <em>fail()</em> are terminal — no further transitions allowed.</li>
      <li>Every transition records: <em>action, actorId, timestamp, optional note</em>.</li>
      <li>The audit log is append-only and exposed as <em>readonly</em>.</li>
    </ul>
  `,
  entityFilename: 'shipment.entity.ts',
  entityCode: `import { ShipmentStatus, ShipmentStatusEnum } from '../constants';
import {
  TrackingNumberRequiredError, InvalidShipmentTransitionError,
  ShipmentAlreadyTerminalError,
} from '../exceptions';

export interface ShipmentEvent {
  readonly action: 'CREATED' | 'DISPATCHED' | 'TRANSIT_UPDATE' | 'DELIVERED' | 'FAILED';
  readonly actorId: string;
  readonly at: string;
  readonly note?: string;
  readonly location?: string;
}

export class Shipment {
  private constructor(
    private readonly shipmentId: string | null,
    private readonly orderId: string,
    private shipmentStatus: ShipmentStatus,
    private trackingNumber: string | null,
    private events: ShipmentEvent[],
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { orderId: string; createdBy: string }): Shipment {
    const now = new Date().toISOString();
    const initial: ShipmentEvent = { action: 'CREATED', actorId: props.createdBy, at: now };
    return new Shipment(
      null, props.orderId, ShipmentStatusEnum.PREPARING,
      null, [initial], now, now
    );
  }

  // ── Transitions ─────────────────────────────────────────────────────────

  dispatch(props: { trackingNumber: string; actorId: string; note?: string }): void {
    if (this.shipmentStatus !== ShipmentStatusEnum.PREPARING) {
      throw new InvalidShipmentTransitionError('dispatch', this.shipmentStatus);
    }
    if (props.trackingNumber.trim().length === 0) throw new TrackingNumberRequiredError();

    this.trackingNumber  = props.trackingNumber.trim();
    this.shipmentStatus  = ShipmentStatusEnum.DISPATCHED;
    this.appendEvent({ action: 'DISPATCHED', actorId: props.actorId, at: this.now(), note: props.note });
  }

  recordTransitLocation(props: { location: string; actorId: string }): void {
    if (this.shipmentStatus === ShipmentStatusEnum.DISPATCHED) {
      this.shipmentStatus = ShipmentStatusEnum.IN_TRANSIT;          // first scan promotes status
    } else if (this.shipmentStatus !== ShipmentStatusEnum.IN_TRANSIT) {
      throw new InvalidShipmentTransitionError('transit-update', this.shipmentStatus);
    }
    this.appendEvent({
      action: 'TRANSIT_UPDATE', actorId: props.actorId, at: this.now(), location: props.location,
    });
  }

  deliver(props: { actorId: string; note?: string }): void {
    if (this.isTerminal()) throw new ShipmentAlreadyTerminalError();
    if (this.shipmentStatus !== ShipmentStatusEnum.IN_TRANSIT) {
      throw new InvalidShipmentTransitionError('deliver', this.shipmentStatus);
    }
    this.shipmentStatus = ShipmentStatusEnum.DELIVERED;
    this.appendEvent({ action: 'DELIVERED', actorId: props.actorId, at: this.now(), note: props.note });
  }

  fail(props: { actorId: string; note: string }): void {
    if (this.isTerminal()) throw new ShipmentAlreadyTerminalError();
    this.shipmentStatus = ShipmentStatusEnum.FAILED;
    this.appendEvent({ action: 'FAILED', actorId: props.actorId, at: this.now(), note: props.note });
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private appendEvent(e: ShipmentEvent): void {
    this.events.push(e);
    this.updatedAt = e.at;
  }
  private isTerminal(): boolean {
    return this.shipmentStatus === ShipmentStatusEnum.DELIVERED
        || this.shipmentStatus === ShipmentStatusEnum.FAILED;
  }
  private now(): string { return new Date().toISOString(); }

  // Audit log is exposed as readonly — outside code cannot tamper with it.
  getEvents(): readonly ShipmentEvent[] { return [...this.events]; }
  getShipmentStatus(): ShipmentStatus { return this.shipmentStatus; }
  getTrackingNumber(): string | null { return this.trackingNumber; }
  getOrderId(): string { return this.orderId; }
}`,
  concepts: [
    'Append-only event log lives inside the entity',
    'Every transition is one method = one audit record',
    'Terminal-state guard reused across transitions',
    'Implicit promotion (DISPATCHED → IN_TRANSIT on first scan)',
    'Read-only exposure of the events array',
  ],
  exceptionsFilename: 'shipment-exceptions.ts (excerpt)',
  exceptionsCode: `export class TrackingNumberRequiredError extends Error {
  constructor() { super('Tracking number is required to dispatch'); this.name = 'TrackingNumberRequiredError'; }
}
export class InvalidShipmentTransitionError extends Error {
  constructor(action: string, currentStatus: string) {
    super(\`Cannot \${action}: shipment is \${currentStatus}\`);
    this.name = 'InvalidShipmentTransitionError';
  }
}
export class ShipmentAlreadyTerminalError extends Error {
  constructor() {
    super('Shipment is already in a terminal state (DELIVERED or FAILED)');
    this.name = 'ShipmentAlreadyTerminalError';
  }
}`,
  pitfalls: [
    'Don\'t let the application service write to the events array — every event is born inside a transition method.',
    'Don\'t rely on database <code>created_at</code> columns for audit — the entity owns the timeline.',
    'Don\'t forget to bump <code>updatedAt</code> when an event is appended — the persistence layer uses it as the optimistic-locking key.',
  ],
};
