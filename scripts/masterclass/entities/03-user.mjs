// Level 3 — simple status with conditional transitions (verify → activate → suspend).
export default {
  id: '03-user',
  level: 3,
  complexityLabel: 'L3 · Simple Status',
  domain: 'Identity',
  title: 'User',
  introShort: 'Adds a status field, role enum, and conditional state transitions.',
  intro: 'A User introduces a status field and the first conditional transitions: a user must verify their email before they can become ACTIVE; an ADMIN can suspend an active user. Status comparisons go through an enum constant — never a hardcoded string (Golden Rule #8).',
  specTitle: 'Identity · User',
  specBodyHtml: `
    <p>A <strong>User</strong> can sign in to the system once activated.</p>
    <ul>
      <li>Required fields: <em>email</em> (must match an email regex), <em>firstName</em>, <em>lastName</em>.</li>
      <li>A user has a <em>role</em>: <code>USER</code> or <code>ADMIN</code> (defaults to <code>USER</code>).</li>
      <li>A user has a <em>status</em>: <code>PENDING</code> → <code>ACTIVE</code> → <code>INACTIVE</code> / <code>DELETED</code>.</li>
      <li>New users start <code>PENDING</code> with <em>emailVerified = false</em>.</li>
      <li>Verifying the email is a one-time action; verifying twice is an error.</li>
      <li>A user can only be <em>activated</em> if they are <code>PENDING</code> <strong>and</strong> their email is verified.</li>
      <li>A deleted user cannot be modified — every mutating method must reject it.</li>
      <li>An admin can change a user's role; setting it to the same role is rejected.</li>
    </ul>
  `,
  entityFilename: 'user.entity.ts',
  entityCode: `import { UserRole, UserRoleEnum, UserStatus, UserStatusEnum } from '../constants';
import {
  InvalidEmailFormatError, InvalidNameError, EmailAlreadyVerifiedError,
  CannotActivateNonPendingUserError, CannotActivateUnverifiedEmailError,
  CannotDeactivateDeletedUserError, UserAlreadyInactiveError,
  UserAlreadyDeletedError, CannotUpdateDeletedUserError,
  CannotChangeRoleOfDeletedUserError, UserAlreadyHasRoleError,
} from '../exceptions';

export class User {
  private constructor(
    private readonly userId: string | null,
    private readonly email: string,
    private firstName: string,
    private lastName: string,
    private emailVerified: boolean,
    private userRole: UserRole,
    private userStatus: UserStatus,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: {
    email: string; firstName: string; lastName: string; userRole?: UserRole;
  }): User {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(props.email)) throw new InvalidEmailFormatError();
    if (props.firstName.trim().length === 0) throw new InvalidNameError('First name');
    if (props.lastName.trim().length === 0)  throw new InvalidNameError('Last name');

    const now = new Date().toISOString();
    return new User(
      null,
      props.email.toLowerCase().trim(),
      props.firstName.trim(),
      props.lastName.trim(),
      false,                                    // unverified
      props.userRole ?? UserRoleEnum.USER,
      UserStatusEnum.PENDING,                   // new users start pending
      now, now
    );
  }

  // ── Lifecycle transitions ────────────────────────────────────────────────

  verifyEmail(): void {
    if (this.emailVerified) throw new EmailAlreadyVerifiedError();
    this.emailVerified = true;
    this.touch();
  }

  /** Rules: can only activate PENDING users whose email is verified. */
  activate(): void {
    if (this.userStatus !== UserStatusEnum.PENDING) throw new CannotActivateNonPendingUserError();
    if (!this.emailVerified) throw new CannotActivateUnverifiedEmailError();
    this.userStatus = UserStatusEnum.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    if (this.userStatus === UserStatusEnum.DELETED)  throw new CannotDeactivateDeletedUserError();
    if (this.userStatus === UserStatusEnum.INACTIVE) throw new UserAlreadyInactiveError();
    this.userStatus = UserStatusEnum.INACTIVE;
    this.touch();
  }

  markAsDeleted(): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new UserAlreadyDeletedError();
    this.userStatus = UserStatusEnum.DELETED;
    this.touch();
  }

  // ── Profile / role ───────────────────────────────────────────────────────

  updateProfile(firstName: string, lastName: string): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new CannotUpdateDeletedUserError('profile');
    if (firstName.trim().length === 0) throw new InvalidNameError('First name');
    if (lastName.trim().length === 0)  throw new InvalidNameError('Last name');
    this.firstName = firstName.trim();
    this.lastName  = lastName.trim();
    this.touch();
  }

  changeRole(newRole: UserRole): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new CannotChangeRoleOfDeletedUserError();
    if (this.userRole === newRole) throw new UserAlreadyHasRoleError();
    this.userRole = newRole;
    this.touch();
  }

  private touch(): void { this.updatedAt = new Date().toISOString(); }

  // Predicates + getters
  isActive():  boolean { return this.userStatus === UserStatusEnum.ACTIVE; }
  isPending(): boolean { return this.userStatus === UserStatusEnum.PENDING; }
  isDeleted(): boolean { return this.userStatus === UserStatusEnum.DELETED; }
  isAdmin():   boolean { return this.userRole === UserRoleEnum.ADMIN; }

  getEmail(): string { return this.email; }
  getFullName(): string { return \`\${this.firstName} \${this.lastName}\`; }
  getUserStatus(): UserStatus { return this.userStatus; }
  getUserRole():   UserRole   { return this.userRole; }
}`,
  concepts: [
    'Status field with enum constants (no string literals)',
    'Conditional transitions (verify-then-activate)',
    '"Deleted is a wall" — every mutator rejects DELETED',
    'Predicate getters: isActive(), isAdmin()',
    'touch() helper centralises updatedAt',
  ],
  exceptionsFilename: 'user-exceptions.ts (excerpt)',
  exceptionsCode: `export class CannotActivateNonPendingUserError extends Error {
  constructor() { super('Can only activate pending users'); this.name = 'CannotActivateNonPendingUserError'; }
}
export class CannotActivateUnverifiedEmailError extends Error {
  constructor() { super('Email must be verified before activation'); this.name = 'CannotActivateUnverifiedEmailError'; }
}
export class EmailAlreadyVerifiedError extends Error {
  constructor() { super('Email is already verified'); this.name = 'EmailAlreadyVerifiedError'; }
}
export class UserAlreadyHasRoleError extends Error {
  constructor() { super('User already has this role'); this.name = 'UserAlreadyHasRoleError'; }
}
// + InvalidEmailFormatError, InvalidNameError,
//   CannotDeactivateDeletedUserError, UserAlreadyInactiveError,
//   UserAlreadyDeletedError, CannotUpdateDeletedUserError,
//   CannotChangeRoleOfDeletedUserError ...`,
  pitfalls: [
    'Never compare status with a string literal (<code>=== "ACTIVE"</code>) — use <code>UserStatusEnum.ACTIVE</code> (Golden Rule #8).',
    'Don\'t let the controller decide who can suspend — the entity owns the rule.',
    'Don\'t collapse <code>verifyEmail()</code> + <code>activate()</code> into one method — they are two distinct business events with different side effects.',
  ],
};
