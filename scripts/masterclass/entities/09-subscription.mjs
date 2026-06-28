// Level 9 — date-driven invariants & period logic.
export default {
  id: '09-subscription',
  level: 6,
  complexityLabel: 'L9 · Time-Driven',
  domain: 'Billing',
  title: 'Subscription',
  introShort: 'Date-driven invariants: trial windows, period boundaries, downgrades.',
  intro: 'A Subscription weaves business time into its invariants. A trial expires after a fixed window, downgrades only land at period end, and pause/resume must respect billing boundaries. The entity owns all date math so the application layer stays a thin coordinator.',
  specTitle: 'Billing · Subscription',
  specBodyHtml: `
    <p>A <strong>Subscription</strong> ties a user to a plan with monthly billing.</p>
    <ul>
      <li>Plans: <code>BASIC</code> &lt; <code>PRO</code> &lt; <code>ENTERPRISE</code> (ordered).</li>
      <li>Statuses: <code>TRIAL</code> → <code>ACTIVE</code> → <code>PAUSED</code> | <code>CANCELLED</code> | <code>EXPIRED</code>.</li>
      <li>Trial lasts <em>14 days</em>. After 14 days an unconverted trial is <code>EXPIRED</code> (terminal).</li>
      <li><em>activate()</em>: <code>TRIAL → ACTIVE</code>. Sets a <em>currentPeriodEnd</em> = now + 30 days.</li>
      <li><em>pause()</em>: <code>ACTIVE → PAUSED</code>. Billing freezes; current period preserved.</li>
      <li><em>resume()</em>: <code>PAUSED → ACTIVE</code>.</li>
      <li><em>cancel()</em>: from <code>ACTIVE</code> or <code>PAUSED</code>. Once cancelled, cannot be reinstated <em>in the same billing cycle</em>.</li>
      <li><em>changePlan()</em>: upgrades take effect immediately; <em>downgrades</em> are deferred to <em>currentPeriodEnd</em>.</li>
      <li><em>renewPeriod()</em>: rolls <code>currentPeriodEnd</code> forward by 30 days. If a deferred downgrade was queued, it is applied here.</li>
    </ul>
  `,
  entityFilename: 'subscription.entity.ts',
  entityCode: `import { Plan, PlanRank, SubStatus, SubStatusEnum } from '../constants';
import {
  CannotActivateNonTrialError, TrialAlreadyExpiredError,
  InvalidSubscriptionTransitionError, CannotReinstateInSameCycleError,
  SamePlanError,
} from '../exceptions';

const TRIAL_DAYS = 14;
const PERIOD_DAYS = 30;

export class Subscription {
  private constructor(
    private readonly subId: string | null,
    private readonly userId: string,
    private plan: Plan,
    private pendingDowngrade: Plan | null,
    private subStatus: SubStatus,
    private readonly trialEndsAt: string,
    private currentPeriodEnd: string | null,
    private cancelledInCycle: boolean,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static startTrial(props: { userId: string; plan: Plan }): Subscription {
    const now = new Date();
    return new Subscription(
      null, props.userId, props.plan, null,
      SubStatusEnum.TRIAL,
      addDays(now, TRIAL_DAYS).toISOString(),
      null, false,
      now.toISOString(), now.toISOString()
    );
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  activate(): void {
    if (this.subStatus !== SubStatusEnum.TRIAL) throw new CannotActivateNonTrialError();
    if (this.isTrialExpired()) {
      this.subStatus = SubStatusEnum.EXPIRED;
      this.touch();
      throw new TrialAlreadyExpiredError();
    }
    this.subStatus = SubStatusEnum.ACTIVE;
    this.currentPeriodEnd = addDays(new Date(), PERIOD_DAYS).toISOString();
    this.touch();
  }

  pause(): void {
    if (this.subStatus !== SubStatusEnum.ACTIVE) {
      throw new InvalidSubscriptionTransitionError('pause', this.subStatus);
    }
    this.subStatus = SubStatusEnum.PAUSED;
    this.touch();
  }

  resume(): void {
    if (this.subStatus !== SubStatusEnum.PAUSED) {
      throw new InvalidSubscriptionTransitionError('resume', this.subStatus);
    }
    if (this.cancelledInCycle) throw new CannotReinstateInSameCycleError();
    this.subStatus = SubStatusEnum.ACTIVE;
    this.touch();
  }

  cancel(): void {
    if (this.subStatus !== SubStatusEnum.ACTIVE && this.subStatus !== SubStatusEnum.PAUSED) {
      throw new InvalidSubscriptionTransitionError('cancel', this.subStatus);
    }
    this.subStatus = SubStatusEnum.CANCELLED;
    this.cancelledInCycle = true;
    this.touch();
  }

  // ── Plan changes (with deferred-downgrade rule) ─────────────────────────

  changePlan(newPlan: Plan): void {
    if (this.subStatus !== SubStatusEnum.ACTIVE && this.subStatus !== SubStatusEnum.TRIAL) {
      throw new InvalidSubscriptionTransitionError('changePlan', this.subStatus);
    }
    if (newPlan === this.plan && !this.pendingDowngrade) throw new SamePlanError();

    const isUpgrade = PlanRank[newPlan] > PlanRank[this.plan];

    if (isUpgrade) {
      this.plan = newPlan;
      this.pendingDowngrade = null;     // any pending downgrade is voided by an upgrade
    } else {
      this.pendingDowngrade = newPlan;  // applied at next renewal
    }
    this.touch();
  }

  /** Called by the billing scheduler. Rolls the period and applies pending downgrades. */
  renewPeriod(): void {
    if (this.subStatus !== SubStatusEnum.ACTIVE) {
      throw new InvalidSubscriptionTransitionError('renew', this.subStatus);
    }
    if (this.pendingDowngrade) {
      this.plan = this.pendingDowngrade;
      this.pendingDowngrade = null;
    }
    this.currentPeriodEnd = addDays(new Date(), PERIOD_DAYS).toISOString();
    this.cancelledInCycle = false;       // new cycle resets the reinstate guard
    this.touch();
  }

  // ── Predicates ──────────────────────────────────────────────────────────
  isTrialExpired(): boolean { return new Date(this.trialEndsAt).getTime() < Date.now(); }
  isActive(): boolean { return this.subStatus === SubStatusEnum.ACTIVE; }
  hasPendingDowngrade(): boolean { return this.pendingDowngrade !== null; }

  private touch(): void { this.updatedAt = new Date().toISOString(); }

  // Getters
  getPlan(): Plan { return this.plan; }
  getStatus(): SubStatus { return this.subStatus; }
  getCurrentPeriodEnd(): string | null { return this.currentPeriodEnd; }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}`,
  concepts: [
    'Time-driven invariants (trial expiry, period boundary)',
    'Deferred state changes (downgrade applied at renewal)',
    'Per-cycle flags (cancelledInCycle resets on renewPeriod)',
    'Plan ordering via a constant rank map',
    'Pure date math kept inside the entity',
  ],
  exceptionsFilename: 'subscription-exceptions.ts (excerpt)',
  exceptionsCode: `export class CannotActivateNonTrialError extends Error {
  constructor() { super('Can only activate a trial subscription'); this.name = 'CannotActivateNonTrialError'; }
}
export class TrialAlreadyExpiredError extends Error {
  constructor() { super('Trial period has already expired'); this.name = 'TrialAlreadyExpiredError'; }
}
export class InvalidSubscriptionTransitionError extends Error {
  constructor(action: string, currentStatus: string) {
    super(\`Cannot \${action} subscription in \${currentStatus} state\`);
    this.name = 'InvalidSubscriptionTransitionError';
  }
}
export class CannotReinstateInSameCycleError extends Error {
  constructor() {
    super('Cancelled subscriptions cannot be reinstated in the same billing cycle');
    this.name = 'CannotReinstateInSameCycleError';
  }
}
export class SamePlanError extends Error {
  constructor() { super('Subscription is already on this plan'); this.name = 'SamePlanError'; }
}`,
  pitfalls: [
    'Don\'t pass <code>now</code> in from the outside — keep it deterministic for tests by injecting a Clock if needed, but never let the controller decide.',
    'Don\'t apply downgrades immediately to "just keep things simple" — billing will be wrong and customers will notice.',
    'Don\'t forget to reset <code>cancelledInCycle</code> on renewal — without it, legitimate resumes get blocked forever.',
    'Don\'t store derived predicates (<code>isTrialExpired</code>) — recompute from <code>trialEndsAt</code> so the entity is always honest about <em>now</em>.',
  ],
};
