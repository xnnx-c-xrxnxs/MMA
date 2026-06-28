#!/usr/bin/env node
/**
 * generate-application-masterclass.mjs
 * Generates docs/tutorial/application-layer-masterclass.html
 *
 * Run: node scripts/generate-application-masterclass.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../docs/tutorial/application-layer-masterclass.html');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(code) {
  let out = escapeHtml(code);
  // Placeholder approach: protect already-highlighted tokens from further regex passes.
  // Uses \x01PH{i}\x01 format — the "PH" prefix prevents \b from matching the digit index.
  const placeholders = [];
  function ph(html) {
    const i = placeholders.length;
    placeholders.push(html);
    return `\x01PH${i}\x01`;
  }

  // 1. Comments → placeholders (so keywords inside comments are not highlighted)
  out = out.replace(/(\/\/[^\n]*)/g, (m) => ph(`<span class="com">${m}</span>`));
  out = out.replace(/(\/\*\*[\s\S]*?\*\/)/g, (m) => ph(`<span class="com">${m}</span>`));
  // 2. Strings → placeholders
  out = out.replace(/('[^']*')/g, (m) => ph(`<span class="str">${m}</span>`));
  out = out.replace(/(`[^`]*`)/g, (m) => ph(`<span class="str">${m}</span>`));

  // 3. Keywords (single-pass alternation — avoids "class" matching inside inserted HTML attrs)
  const kws = ['import','from','export','class','interface','type','const','let','function','return','if','throw','new','this','extends','implements','async','await','private','readonly','abstract','void','null','undefined','for','of','continue'];
  const kwRe = new RegExp(`\\b(${kws.join('|')})\\b`, 'g');
  out = out.replace(kwRe, (m) => ph(`<span class="kw">${m}</span>`));

  // 4. Types (single-pass alternation)
  const types = ['string','number','boolean','Promise','User','Order','Product','ProductCategory','OrderItem','OrderPayment','IPaginatedResponse','IOffsetPaginatedResponse','IUseCase','IEventPublisher','IUserRepository','IOrderRepository','IProductRepository','ICategoryRepository','ICustomerValidator','UserRole','UserStatus','ProductStatus','OrderStatus','PaymentMethod','ValidatedCustomer'];
  const tyRe = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
  out = out.replace(tyRe, (m) => ph(`<span class="ty">${m}</span>`));

  // 5. Numbers
  out = out.replace(/\b(\d+)\b/g, (m) => ph(`<span class="num">${m}</span>`));

  // 6. Restore all placeholders
  out = out.replace(/\x01PH(\d+)\x01/g, (_, idx) => placeholders[parseInt(idx)]);
  return out;
}

function panel(icon, title, subtitle, bodyHtml, isCode = false) {
  const bodyClass = isCode ? 'code-body' : '';
  const inner = isCode
    ? `<pre><code>${bodyHtml}</code></pre>`
    : bodyHtml;
  return `<div class="panel">
  <div class="panel-header">
    <span class="icon">${icon}</span>
    <span class="title">${title}</span>
    ${subtitle ? `<span class="subtitle">${subtitle}</span>` : ''}
  </div>
  <div class="panel-body ${bodyClass}">${inner}</div>
</div>`;
}

function specPanel(title, bodyHtml) {
  return panel('\u{1F4D0}', 'Specification', '', `<div class="spec-title">${title}</div><div class="spec-body">${bodyHtml}</div>`);
}

function codePanel(subtitle, code) {
  return panel('\u{1F4BB}', 'Implementation', subtitle, highlight(code), true);
}

function conceptPills(concepts) {
  return `<div class="concepts fade-in">${concepts.map(c => `<span class="concept-pill">\u2726 ${c}</span>`).join('')}</div>`;
}

function pitfalls(items) {
  return `<div class="pitfalls">
  <div class="pitfalls-title">\u26A0\uFE0F Common Pitfalls</div>
  <ul>${items.map(i => `<li>${i}</li>`).join('\n    ')}</ul>
</div>`;
}

// ─── Module Content ──────────────────────────────────────────────────────────

const modules = [
  // 01 — IUseCase Interface & Directory Structure
  {
    id: '01-iusecase-contract',
    label: 'Foundation',
    title: 'The IUseCase Contract & Directory Layout',
    desc: 'Every use case implements IUseCase<Input, Output> — a single async execute() method with one input, one output.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'IUseCase<TInput, TOutput> Contract',
      body: `
        <p>The <code>IUseCase</code> interface enforces a uniform shape for all application operations:</p>
        <ul>
          <li><strong>Single Responsibility:</strong> One use case = one business operation</li>
          <li><strong>Typed I/O:</strong> Input and output are explicit generics (no <code>any</code>)</li>
          <li><strong>Async by design:</strong> All repository calls are async, so <code>execute()</code> returns <code>Promise</code></li>
          <li><strong>Constructor injection:</strong> Repository + optional collaborators injected via constructor</li>
        </ul>
        <p><strong>Directory convention:</strong></p>
        <ul>
          <li><code>packages/{domain}-domain/src/application/use-cases/{verb}-{entity}/{verb}-{entity}.use-case.ts</code></li>
          <li><code>packages/{domain}-domain/src/application/interfaces/{entity}-repository.interface.ts</code></li>
          <li><code>packages/{domain}-domain/src/application/exceptions/{error-name}.error.ts</code></li>
        </ul>
      `,
    },
    code: {
      subtitle: '@mma/common + directory layout',
      content: `// packages/common/src/interfaces/use-case.interface.ts
export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

// packages/common/src/interfaces/pagination.interface.ts
export interface IPaginatedResponse<T> {
  items: T[];
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export interface IOffsetPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Directory structure:
// packages/user-domain/src/application/
//   use-cases/
//     create-user/create-user.use-case.ts
//     get-user-by-id/get-user-by-id.use-case.ts
//     activate-user/activate-user.use-case.ts
//     list-users-by-status/list-users-by-status.use-case.ts
//   interfaces/
//     user-repository.interface.ts
//   exceptions/
//     invalid-input.error.ts
//     user-not-found.error.ts
//     email-already-exists.error.ts`,
    },
    concepts: ['IUseCase<TInput, TOutput> contract', 'One folder per use case', 'Constructor injection for dependencies', 'Promise-based async execute()', 'Barrel export from use-cases/index.ts'],
    pitfalls: [
      'Never put HTTP concerns (request, response, status codes) inside a use case.',
      'Never import from <code>@nestjs/*</code> inside the application layer.',
      'The use case returns a domain entity — not a DTO. The Application Service transforms it later.',
      'Do not add multiple <code>execute()</code> methods — split into separate use cases instead.',
    ],
  },

  // 02 — Repository Interface (Port)
  {
    id: '02-repository-interface',
    label: 'Ports',
    title: 'Repository Interface (Port Definition)',
    desc: 'Abstract class defining the data-access contract. Lives in application/interfaces — inner layer never knows the database.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'Repository Interface as an Abstract Class',
      body: `
        <p>The repository interface is the <strong>port</strong> in hexagonal architecture. It defines <em>what</em> data operations the domain needs without specifying <em>how</em>.</p>
        <ul>
          <li><strong>Abstract class</strong> (not TS <code>interface</code>) — enables NestJS DI token usage</li>
          <li><strong>Domain types only:</strong> Parameters and return types are domain entities/primitives</li>
          <li><strong>No database types:</strong> Never mention Table, PrismaClient, OneTable, etc.</li>
          <li><strong>Pagination:</strong> DynamoDB domains use <code>IPaginatedResponse</code>; Prisma domains use <code>IOffsetPaginatedResponse</code></li>
        </ul>
        <p><strong>Methods follow naming conventions:</strong></p>
        <ul>
          <li><code>save(entity)</code> — create or update (entity state determines which)</li>
          <li><code>findById(id)</code> — returns <code>Entity | null</code> (never throws)</li>
          <li><code>findByEmail(email)</code> — uniqueness lookup</li>
          <li><code>listByStatus(...)</code> — filtered paginated query</li>
          <li><code>delete(id)</code> — hard delete (rare; soft-delete uses <code>save()</code>)</li>
        </ul>
      `,
    },
    code: {
      subtitle: 'user-repository.interface.ts',
      content: `import { IPaginatedResponse } from '@mma/common';
import { UserRole, UserStatus } from '../../domain/constants';
import { User } from '../../domain/entities';

export abstract class IUserRepository {
  // Create or update (entity state determines insert vs upsert)
  abstract save(user: User): Promise<User>;

  // Primary key lookup — returns null if not found
  abstract findById(userId: string): Promise<User | null>;

  // Uniqueness lookup for email
  abstract findByEmail(email: string): Promise<User | null>;

  // Cursor-based paginated list
  abstract listByStatus(
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>>;

  // Compound filter
  abstract listByRoleAndStatus(
    userRole: UserRole,
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>>;
}`,
    },
    concepts: ['Abstract class for DI compatibility', 'Domain types only in signatures', 'save() handles both create and update', 'findById returns null (not throws)', 'Pagination type matches persistence strategy'],
    pitfalls: [
      'Using a TypeScript <code>interface</code> instead of <code>abstract class</code> prevents NestJS from using it as a DI token.',
      'Returning database-specific types (e.g. <code>AnyEntity</code> from OneTable) leaks infrastructure into the domain.',
      'Adding <code>getTable()</code> or <code>getClient()</code> methods violates the hexagonal port contract.',
      'Mixing cursor and offset pagination in the same interface — choose one per domain.',
    ],
  },

  // 03 — Application Exceptions
  {
    id: '03-app-exceptions',
    label: 'Exceptions',
    title: 'Application Exceptions',
    desc: 'Typed error classes for input validation and "not found" scenarios. Mapped to HTTP status codes by DomainExceptionFilter.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'Application-Level Exception Classes',
      body: `
        <p>Application exceptions are thrown by use cases when:</p>
        <ul>
          <li><strong>Input validation fails:</strong> <code>InvalidInputError</code> (missing required field, invalid format)</li>
          <li><strong>Entity not found:</strong> <code>{Entity}NotFoundError</code> (ID lookup returned null)</li>
          <li><strong>Uniqueness violated:</strong> <code>EmailAlreadyExistsError</code> (pre-save check failed)</li>
          <li><strong>External validation failed:</strong> <code>InvalidUserRoleError</code>, <code>InvalidUserStatusError</code></li>
        </ul>
        <p><strong>Rules:</strong></p>
        <ul>
          <li>Each error class extends <code>Error</code> and sets <code>this.name</code> explicitly</li>
          <li>Constructor accepts the relevant identifier for debugging</li>
          <li><code>DomainExceptionFilter</code> maps class names to HTTP status codes</li>
          <li>Application exceptions map to <strong>400</strong> (input) or <strong>404</strong> (not found) or <strong>409</strong> (conflict)</li>
        </ul>
      `,
    },
    code: {
      subtitle: 'application/exceptions/',
      content: `// invalid-input.error.ts
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

// user-not-found.error.ts
export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(\`User not found: \${identifier}\`);
    this.name = 'UserNotFoundError';
  }
}

// email-already-exists.error.ts
export class EmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(\`Email already exists: \${email}\`);
    this.name = 'EmailAlreadyExistsError';
  }
}

// invalid-user-role.error.ts
export class InvalidUserRoleError extends Error {
  constructor(role: string) {
    super(\`Invalid user role: \${role}\`);
    this.name = 'InvalidUserRoleError';
  }
}

// Barrel: application/exceptions/index.ts
export * from './invalid-input.error';
export * from './user-not-found.error';
export * from './email-already-exists.error';
export * from './invalid-user-role.error';
export * from './invalid-user-status.error';`,
    },
    concepts: ['One class per failure mode', 'Extends Error with explicit name', 'Constructor accepts debug identifier', 'Mapped to HTTP by DomainExceptionFilter', 'Barrel export from exceptions/index.ts'],
    pitfalls: [
      'Forgetting <code>this.name = ...</code> makes the filter map fail (it uses <code>constructor.name</code>).',
      'Throwing generic <code>new Error("not found")</code> bypasses the exception filter mapping.',
      'Application exceptions should NOT contain HTTP status codes — that is the filter responsibility.',
      'Do not throw <code>HttpException</code> from <code>@nestjs/common</code> inside the application layer.',
    ],
  },

  // 04 — Create Use Case
  {
    id: '04-create-use-case',
    label: 'Create',
    title: 'Create Use Case (with Uniqueness Check)',
    desc: 'The most common starting point: validate input, check uniqueness, create entity via factory, persist.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Create Pattern: Validate \u2192 Check Uniqueness \u2192 Entity.create() \u2192 save()',
      body: `
        <p>The create use case follows a strict sequence:</p>
        <ol>
          <li><strong>Define Input interface:</strong> Only primitive types (never DTOs or request objects)</li>
          <li><strong>Check uniqueness:</strong> Query repository for existing entity by unique field</li>
          <li><strong>Call Entity.create():</strong> Domain factory enforces invariants (throws domain exceptions)</li>
          <li><strong>Persist via repository.save():</strong> Returns the entity with generated ID</li>
        </ol>
        <p><strong>Key principle:</strong> The use case orchestrates; the entity validates. If <code>User.create()</code> throws <code>InvalidEmailFormatError</code>, the use case does not catch it — it bubbles up to the filter.</p>
      `,
    },
    code: {
      subtitle: 'create-user.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserRole, UserRoleEnum } from '../../../domain/constants';
import { EmailAlreadyExistsError } from '../../exceptions';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  userRole?: UserRole;
}

export class CreateUserUseCase implements IUseCase<CreateUserInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: CreateUserInput): Promise<User> {
    // 1. Uniqueness check
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new EmailAlreadyExistsError(input.email);
    }

    // 2. Create via domain factory (validates invariants)
    const user = User.create({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      userRole: input.userRole || UserRoleEnum.USER,
    });

    // 3. Persist and return entity with generated ID
    return await this.userRepository.save(user);
  }
}`,
    },
    concepts: ['Input interface with primitives only', 'Uniqueness check before creation', 'Delegates validation to Entity.create()', 'Default values for optional fields', 'Returns persisted entity (has ID)'],
    pitfalls: [
      'Never validate email format in the use case — that is the entity responsibility.',
      'Never generate the ID in the use case — the repository or schema handles auto-generation.',
      'The Input interface must not include <code>userId</code> — it does not exist yet.',
      'Do not catch domain exceptions (e.g. <code>InvalidEmailFormatError</code>) — let them bubble up.',
    ],
  },

  // 05 — Get By ID Use Case
  {
    id: '05-get-by-id',
    label: 'Get',
    title: 'Get By ID Use Case',
    desc: 'The simplest retrieval pattern: validate input, query repository, throw if null.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'Get Pattern: Validate ID \u2192 findById() \u2192 throw if null',
      body: `
        <p>The get-by-id use case is the simplest pattern. It has no side effects and returns the entity as-is.</p>
        <ul>
          <li><strong>Input:</strong> A single <code>string</code> (the entity ID) — no Input interface needed</li>
          <li><strong>Guard:</strong> Throw <code>InvalidInputError</code> if the ID is empty/falsy</li>
          <li><strong>Query:</strong> <code>repository.findById()</code> returns <code>Entity | null</code></li>
          <li><strong>Not found:</strong> Throw <code>{Entity}NotFoundError</code> — the controller maps this to 404</li>
        </ul>
        <p>This pattern is reused as a <em>load step</em> in every mutation use case (update, delete, action).</p>
      `,
    },
    code: {
      subtitle: 'get-user-by-id.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class GetUserByIdUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }
}`,
    },
    concepts: ['Simple string input (no interface needed)', 'Guard clause for empty input', 'Repository returns null (not throws)', 'Use case throws NotFoundError', 'Reusable "load" pattern for mutations'],
    pitfalls: [
      'Never let the repository throw NotFound — that decision belongs to the use case.',
      'Do not add caching logic here — that belongs in infrastructure.',
      'The <code>!userId</code> guard catches empty string, null, and undefined in one check.',
      'This use case has no side effects — safe to call multiple times.',
    ],
  },

  // 06 — Update Use Case
  {
    id: '06-update-use-case',
    label: 'Update',
    title: 'Update Use Case (Partial Patch)',
    desc: 'Load entity, invoke domain methods for changed fields, persist. Entity enforces invariants on each change.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Update Pattern: Load \u2192 Domain Methods \u2192 save()',
      body: `
        <p>The update use case follows the <strong>load-modify-save</strong> pattern:</p>
        <ol>
          <li><strong>Define Input:</strong> Contains the entity ID + optional fields (partial patch)</li>
          <li><strong>Load entity:</strong> <code>findById()</code> + throw if not found</li>
          <li><strong>Invoke domain methods:</strong> Only call methods for fields that changed</li>
          <li><strong>Persist:</strong> <code>save()</code> the modified entity</li>
        </ol>
        <p><strong>Key principle:</strong> Never set entity properties directly. Always call a domain method (<code>updateProfile()</code>, <code>changeRole()</code>) that enforces business rules internally.</p>
      `,
    },
    code: {
      subtitle: 'update-user-profile.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export interface UpdateUserProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
}

export class UpdateUserProfileUseCase implements IUseCase<UpdateUserProfileInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<User> {
    if (!input.userId) {
      throw new InvalidInputError('User ID is required');
    }

    // Load existing entity
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // Apply changes through domain methods (entity enforces rules)
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const firstName = input.firstName ?? user.getFirstName();
      const lastName = input.lastName ?? user.getLastName();
      user.updateProfile(firstName, lastName);
    }

    // Persist modified entity
    return await this.userRepository.save(user);
  }
}`,
    },
    concepts: ['Input has entity ID + optional patch fields', 'Load-modify-save pattern', 'Domain methods enforce invariants', 'Null coalescing for unchanged fields', 'Entity manages its own updatedAt'],
    pitfalls: [
      'Never set fields directly: <code>user.firstName = x</code> bypasses validation.',
      'Use <code>!== undefined</code> to distinguish "not provided" from "set to empty string".',
      'The entity method (<code>updateProfile</code>) calls <code>touch()</code> internally — do not set <code>updatedAt</code> in the use case.',
      'If a field depends on another (e.g. role + status), call a single domain method that handles both atomically.',
    ],
  },

  // 07 — Delete Use Case (Soft Delete)
  {
    id: '07-delete-use-case',
    label: 'Delete',
    title: 'Delete Use Case (Soft & Hard)',
    desc: 'Soft delete uses a domain method (markAsDeleted); hard delete calls repository.delete() with a status guard.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Delete Patterns: Soft (entity method) vs Hard (repo.delete)',
      body: `
        <p>Two deletion strategies exist:</p>
        <ul>
          <li><strong>Soft delete:</strong> Call <code>entity.markAsDeleted()</code> + <code>save()</code>. The entity transitions to DELETED status. Domain method throws if already deleted.</li>
          <li><strong>Hard delete:</strong> Call <code>repository.delete(id)</code>. Use case enforces a guard: only DRAFT or CANCELLED entities can be hard-deleted.</li>
        </ul>
        <p><strong>When to use which:</strong></p>
        <ul>
          <li>Soft delete: User, Product — you need audit trail and can "undelete"</li>
          <li>Hard delete: Order (only drafts/cancelled) — no recovery needed for incomplete orders</li>
        </ul>
      `,
    },
    code: {
      subtitle: 'delete-user.use-case.ts + delete-order.use-case.ts',
      content: `// ── Soft Delete (User) ────────────────────────────────────────────────────
import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class DeleteUserUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Domain method enforces: cannot delete an already-deleted user
    user.markAsDeleted();

    return await this.userRepository.save(user);
  }
}

// ── Hard Delete (Order — only DRAFT/CANCELLED) ───────────────────────────
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class DeleteOrderUseCase implements IUseCase<string, void> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string): Promise<void> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Guard: only drafts and cancelled orders can be hard-deleted
    const status = order.getOrderStatus();
    if (status !== OrderStatusEnum.DRAFT && status !== OrderStatusEnum.CANCELLED) {
      throw new InvalidInputError(
        'Only draft or cancelled orders can be deleted',
      );
    }

    await this.orderRepository.delete(orderId);
  }
}`,
    },
    concepts: ['Soft delete via domain method + save()', 'Hard delete via repository.delete()', 'Domain method guards (already deleted)', 'Use case guards (status-based)', 'Returns entity for event publishing'],
    pitfalls: [
      'Soft delete MUST call <code>save()</code> — the status change is not persisted otherwise.',
      'Hard delete should NOT call <code>markAsDeleted()</code> first — it is a permanent removal.',
      'Always check the entity exists before deleting — even for hard delete (to return proper 404).',
      'Hard delete use cases return <code>void</code> — there is nothing meaningful to return.',
    ],
  },

  // 08 — Action Use Case (State Transition)
  {
    id: '08-action-use-case',
    label: 'Action',
    title: 'Action Use Case (State Transitions)',
    desc: 'Load entity, call a single domain method that enforces the state machine, persist. One use case per action.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Action Pattern: Load \u2192 entity.action() \u2192 save()',
      body: `
        <p>Action use cases trigger domain state transitions. Each transition is a separate use case.</p>
        <ul>
          <li><strong>Input:</strong> Entity ID only (simple string) — the action has no parameters</li>
          <li><strong>Load:</strong> <code>findById()</code> + throw if not found</li>
          <li><strong>Act:</strong> Call entity method (e.g. <code>activate()</code>, <code>deactivate()</code>, <code>ship()</code>)</li>
          <li><strong>Persist:</strong> <code>save()</code> the entity with new status</li>
        </ul>
        <p><strong>Key principle:</strong> The use case does NOT check the current status — that is the entity domain method responsibility. The entity throws a typed domain exception if the transition is invalid.</p>
      `,
    },
    code: {
      subtitle: 'activate-user.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { InvalidInputError, UserNotFoundError } from '../../exceptions';

export class ActivateUserUseCase implements IUseCase<string, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<User> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Domain method enforces business rules:
    // - Must be PENDING status
    // - Email must be verified
    // Throws CannotActivateNonPendingUserError or CannotActivateUnverifiedEmailError
    user.activate();

    return await this.userRepository.save(user);
  }
}`,
    },
    concepts: ['One use case per state transition', 'Entity ID as sole input', 'Domain method owns the state machine', 'Domain exceptions bubble up naturally', 'No status check in the use case'],
    pitfalls: [
      'Never add <code>if (user.getStatus() !== PENDING)</code> in the use case — let the entity enforce.',
      'Do not combine multiple actions in one use case (e.g. "activate and verify") — separate concerns.',
      'The use case does not know which exceptions the entity might throw — and that is fine.',
      'If an action needs extra input (e.g. a reason for cancellation), use an Input interface instead of a bare string.',
    ],
  },

  // 09 — List Use Case (Cursor Pagination)
  {
    id: '09-list-use-case',
    label: 'List',
    title: 'List Use Case (Filtered + Paginated)',
    desc: 'Validates the filter value, delegates to repository with pagination params, returns typed paginated response.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'List Pattern: Validate Filter \u2192 repository.listBy{Field}()',
      body: `
        <p>List use cases return paginated collections filtered by a domain field.</p>
        <ul>
          <li><strong>Input interface:</strong> Filter field + pagination params (limit, direction, cursors)</li>
          <li><strong>Validate filter:</strong> Check against domain constants array (e.g. <code>USER_STATUSES.includes()</code>)</li>
          <li><strong>Delegate to repository:</strong> Pass filter + pagination params directly</li>
          <li><strong>Return typed response:</strong> <code>IPaginatedResponse&lt;Entity&gt;</code> (DynamoDB) or <code>IOffsetPaginatedResponse&lt;Entity&gt;</code> (Prisma)</li>
        </ul>
        <p><strong>Key difference from other types:</strong> No entity load step, no save — it is a pure query.</p>
      `,
    },
    code: {
      subtitle: 'list-users-by-status.use-case.ts',
      content: `import { IUseCase, IPaginatedResponse } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { USER_STATUSES, UserStatus } from '../../../domain/constants';
import { User } from '../../../domain/entities';
import { InvalidInputError, InvalidUserStatusError } from '../../exceptions';

export interface ListUsersByStatusInput {
  status: UserStatus;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListUsersByStatusUseCase
  implements IUseCase<ListUsersByStatusInput, IPaginatedResponse<User>> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ListUsersByStatusInput): Promise<IPaginatedResponse<User>> {
    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }

    // Validate against domain constants
    if (!USER_STATUSES.includes(input.status)) {
      throw new InvalidUserStatusError(input.status);
    }

    return await this.userRepository.listByStatus(
      input.status,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer,
    );
  }
}`,
    },
    concepts: ['Input interface with filter + pagination', 'Validate filter against domain constants', 'Direct delegation to repository', 'No entity load/save (pure query)', 'Typed paginated response'],
    pitfalls: [
      'Always validate the filter value — do not pass arbitrary strings to the repository.',
      'Never hardcode status strings: use <code>USER_STATUSES.includes()</code> not <code>=== "ACTIVE"</code>.',
      'Cursor fields (<code>nextCursorPointer</code>) are opaque strings — never parse them in the use case.',
      'If pagination params are missing, pass <code>undefined</code> — the repository uses defaults.',
    ],
  },

  // 10 — ACL Decision Framework: Sync vs Async
  {
    id: '10-acl-decision-framework',
    label: 'ACL vs Events',
    title: 'When to Use ACL (Sync) vs Events (Async)',
    desc: 'The critical architectural decision: does this cross-domain dependency need a real-time gate check, or can it be resolved eventually through events?',
    complexity: { level: 3, text: 'Advanced' },
    spec: {
      title: 'Core Domain vs Supporting Domain: The Decision Framework',
      body: `
        <p>When your use case depends on data from another bounded context, you must decide: <strong>synchronous ACL</strong> or <strong>asynchronous events</strong>?
        This is arguably the most impactful architectural decision in a microservices system. Get it wrong and you either
        create orphaned data (async where sync was needed) or a brittle chain of HTTP calls that collapses under load
        (sync where async was appropriate).</p>

        <h3 style="margin-top:20px; font-size:0.95rem;">\u2705 Use Sync ACL When (Gate Check)</h3>
        <p style="margin-bottom:6px; font-style:italic; color:var(--text-muted);">
          "Can the operation <strong>proceed at all</strong> without an answer from the upstream domain?"
          If the answer is <strong>no</strong>, you need a sync ACL.
        </p>
        <ul>
          <li>The upstream entity is a <strong>core domain dependency</strong> \u2014 the operation <em>cannot proceed</em> without its answer</li>
          <li>The check is a <strong>go/no-go gate</strong>: "Does this customer exist and is it active?"</li>
          <li>The answer must be <strong>real-time accurate</strong> \u2014 stale data causes business harm (e.g. creating an order for a deleted customer)</li>
          <li>The caller needs an <strong>immediate error response</strong> if the dependency is invalid (HTTP 404/409 back to the user)</li>
          <li>The validation is <strong>fast and deterministic</strong> \u2014 a single lookup, not a multi-step workflow</li>
        </ul>

        <h3 style="margin-top:20px; font-size:0.95rem;">\u{1F4E8} Use Async Events When (Eventual Consistency)</h3>
        <p style="margin-bottom:6px; font-style:italic; color:var(--text-muted);">
          "Can the operation <strong>start</strong> in a provisional state and resolve later?"
          If the answer is <strong>yes</strong>, you should use events.
        </p>
        <ul>
          <li>The upstream data is <strong>supplementary</strong> \u2014 the operation can start without it and resolve later</li>
          <li>The validation is <strong>complex or slow</strong> (checking stock across warehouses, running fraud checks)</li>
          <li>The result is <strong>non-blocking</strong>: the entity enters a provisional state (DRAFT) and transitions when the event arrives</li>
          <li>Multiple services need to react \u2014 <strong>fan-out</strong> is more natural than sequential HTTP calls</li>
          <li>The upstream domain may be <strong>temporarily unavailable</strong> and you want the operation to be resilient</li>
        </ul>

        <h3 style="margin-top:24px; font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:6px;">
          \u{1F3AF} Our Codebase Example: CreateOrderUseCase
        </h3>
        <p>The Order domain has <strong>two</strong> cross-domain dependencies in a single use case. Each uses a different pattern:</p>
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:8px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:8px;">Dependency</th>
            <th style="text-align:left; padding:8px;">Pattern</th>
            <th style="text-align:left; padding:8px;">Why</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;"><strong>Customer (User domain)</strong></td>
            <td style="padding:8px;">\u{1F512} Sync ACL</td>
            <td style="padding:8px;">Cannot create an order for a non-existent or deleted customer. Immediate 404/409 needed. Fast lookup.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;"><strong>Product availability</strong></td>
            <td style="padding:8px;">\u{1F4E8} Async Event</td>
            <td style="padding:8px;">Products may have complex validation (stock, regional availability, pricing rules). Order starts as DRAFT; event resolves to PENDING or VALIDATION_FAILED.</td>
          </tr>
        </table>

        <h3 style="margin-top:28px; font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:6px;">
          \u{1F30D} Real-World Industry Examples
        </h3>
        <p style="margin-bottom:12px;">These patterns appear everywhere in production systems. Here are common real-world scenarios across different industries:</p>

        <h4 style="margin-top:16px; font-size:0.9rem;">\u{1F6D2} E-Commerce (Amazon/Shopify-style)</h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:6px;">Scenario</th>
            <th style="text-align:left; padding:6px;">Pattern</th>
            <th style="text-align:left; padding:6px;">Reasoning</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Checkout \u2192 validate payment method exists</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot start checkout with an expired/invalid payment method. User needs immediate feedback.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Checkout \u2192 charge payment</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Payment processing can take seconds (3DS, bank verification). Order enters PAYMENT_PENDING state. Stripe webhook resolves it.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Order placed \u2192 reserve inventory</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Inventory checks across multiple warehouses are slow. Order starts as CONFIRMED, inventory service reserves stock or triggers backorder.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Add item to cart \u2192 validate product exists</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot add a deleted/non-existent product. Immediate 404 error to the user.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Product price changed \u2192 update carts</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Thousands of carts may reference this product. Fan-out via event, carts update lazily. No immediate user action needed.</td>
          </tr>
        </table>

        <h4 style="margin-top:16px; font-size:0.9rem;">\u{1F3E6} Banking / FinTech (Stripe/Revolut-style)</h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:6px;">Scenario</th>
            <th style="text-align:left; padding:6px;">Pattern</th>
            <th style="text-align:left; padding:6px;">Reasoning</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Transfer money \u2192 validate recipient account</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot transfer to a closed or non-existent account. Immediate rejection required.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Transfer money \u2192 AML/fraud check</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Fraud detection involves ML models, risk scoring, sanctions list checks. Transfer enters PENDING_REVIEW, resolved by compliance service.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Loan application \u2192 verify KYC status</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot start a loan without verified identity. Immediate 409 if KYC not completed.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Loan application \u2192 credit scoring</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Credit bureau calls take seconds, may timeout. Application enters SCORING state, event resolves to APPROVED/REJECTED.</td>
          </tr>
        </table>

        <h4 style="margin-top:16px; font-size:0.9rem;">\u2708\uFE0F Travel / Booking (Booking.com/Airbnb-style)</h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:6px;">Scenario</th>
            <th style="text-align:left; padding:6px;">Pattern</th>
            <th style="text-align:left; padding:6px;">Reasoning</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Book hotel \u2192 validate guest identity</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot create booking without a valid guest account. Immediate feedback needed.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Book hotel \u2192 confirm room availability</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Property management system may be external, slow, or offline. Booking enters PENDING_CONFIRMATION, hotel responds via event.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Flight booked \u2192 send confirmation email</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Notification is fire-and-forget. Email service failure should never block the booking.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Flight booked \u2192 validate passenger passport</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">International flight cannot proceed without valid travel document on file. Immediate 409 if expired.</td>
          </tr>
        </table>

        <h4 style="margin-top:16px; font-size:0.9rem;">\u{1F3E5} Healthcare (Epic/Cerner-style)</h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:6px;">Scenario</th>
            <th style="text-align:left; padding:6px;">Pattern</th>
            <th style="text-align:left; padding:6px;">Reasoning</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Schedule appointment \u2192 validate patient record exists</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot schedule for unknown patient. Medical records linkage is mandatory.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Prescription created \u2192 drug interaction check</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Life-safety gate. Drug interaction check must complete before prescription is saved. No provisional state acceptable.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Prescription created \u2192 notify pharmacy</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Pharmacy notification is downstream. Prescription is valid regardless of whether pharmacy received the message yet.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Lab result received \u2192 update patient chart</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Lab results arrive from external systems on their own schedule. Patient chart subscribes and updates when event arrives.</td>
          </tr>
        </table>

        <h4 style="margin-top:16px; font-size:0.9rem;">\u{1F69A} Logistics / Delivery (Uber Eats/DoorDash-style)</h4>
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">
          <tr style="border-bottom:2px solid var(--border);">
            <th style="text-align:left; padding:6px;">Scenario</th>
            <th style="text-align:left; padding:6px;">Pattern</th>
            <th style="text-align:left; padding:6px;">Reasoning</th>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Create delivery \u2192 validate restaurant is open</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Cannot place an order with a closed restaurant. Immediate feedback to user.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Order accepted \u2192 assign driver</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Driver matching involves geolocation, availability, surge pricing. Order enters AWAITING_PICKUP, driver service matches asynchronously.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Package shipped \u2192 send tracking notification</td>
            <td style="padding:6px;">\u{1F4E8} Async Event</td>
            <td style="padding:6px;">Notification fan-out (SMS, push, email). Should never block the shipping operation.</td>
          </tr>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px;">Create shipment \u2192 validate sender address</td>
            <td style="padding:6px;">\u{1F512} Sync ACL</td>
            <td style="padding:6px;">Invalid address means undeliverable package. Immediate validation via address service.</td>
          </tr>
        </table>

        <h3 style="margin-top:28px; font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:6px;">
          \u{1F9ED} The Decision Flowchart
        </h3>
        <p>Ask these three questions in order:</p>
        <ol style="font-size:0.88rem; line-height:1.7;">
          <li><strong>Can the entity exist without the upstream answer?</strong><br/>
            No \u2192 <strong>Sync ACL</strong> (order cannot exist without a valid customer)<br/>
            Yes \u2192 Go to question 2</li>
          <li><strong>Is the validation fast and deterministic?</strong><br/>
            Yes \u2192 Consider <strong>Sync ACL</strong> if it simplifies the flow<br/>
            No (slow, external, multi-step) \u2192 Go to question 3</li>
          <li><strong>Can the entity start in a provisional state?</strong><br/>
            Yes \u2192 <strong>Async Events</strong> with a saga (DRAFT \u2192 resolve later)<br/>
            No \u2192 <strong>Sync ACL</strong> (even if slow, you must block)</li>
        </ol>

        <h3 style="margin-top:24px; font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:6px;">
          \u26A0\uFE0F The Grey Zone: When It Could Go Either Way
        </h3>
        <p style="font-size:0.88rem;">Some validations are genuinely ambiguous. In those cases, consider:</p>
        <ul style="font-size:0.88rem;">
          <li><strong>Latency tolerance:</strong> If the user is waiting for a response, sync is better UX. If it is a background job, async is fine.</li>
          <li><strong>Failure tolerance:</strong> If the upstream being down should <em>block</em> the operation, use sync. If you can retry later, use async.</li>
          <li><strong>Data staleness:</strong> If the data can become stale in milliseconds (seat booking), sync. If it is stable for hours (product catalog), async is safe.</li>
          <li><strong>Compensability:</strong> If you can easily undo the operation (cancel an order), async with compensation. If undoing is expensive (money transferred), sync gate.</li>
        </ul>
      `,
    },
    code: {
      subtitle: 'create-order.use-case.ts \u2014 both patterns in one use case',
      content: `// ═══════════════════════════════════════════════════════════════
// CreateOrderUseCase — demonstrates BOTH patterns side by side
// ═══════════════════════════════════════════════════════════════
//
// SYNC ACL (ICustomerValidator):
//   Customer is a core dependency. The order literally references
//   the customer ID — an order for a non-existent customer is
//   invalid data. This is the same as:
//   - Stripe refusing a charge for a deleted payment method
//   - A hospital refusing a prescription for an unknown patient
//   - Airbnb refusing a booking for a suspended guest
//
// ASYNC EVENT (IEventPublisher):
//   Product validation involves checking stock, pricing rules,
//   and possibly external supplier APIs. This is the same as:
//   - Uber matching a driver after the ride is requested
//   - A bank running fraud checks after a transfer is initiated
//   - A hotel confirming room availability from an external PMS

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,  // ACL port
    private readonly eventPublisher: IEventPublisher<unknown>, // Event port
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    // ── SYNC ACL GATE ─────────────────────────────────────────
    // This MUST pass before any entity is created.
    // If the customer does not exist → CustomerNotFoundError (404)
    // If the customer is deleted/inactive → CustomerInvalidStatusError (409)
    // If the User API is down → CustomerServiceUnavailableError (502)
    //
    // Real-world parallel: Stripe's "validate payment method"
    // returns 402 immediately if the card is expired.
    await this.customerValidator.validate(input.customerId);

    // ── ENTITY CREATION ───────────────────────────────────────
    // Only reached if customer is valid. Order starts in DRAFT status.
    const order = Order.create({ customerId: input.customerId });
    for (const itemInput of input.items) {
      order.addItem(OrderItem.create(itemInput));
    }
    const savedOrder = await this.orderRepository.save(order);

    // ── ASYNC EVENT ───────────────────────────────────────────
    // Product validation happens asynchronously via choreography saga.
    //
    // Flow: Order API publishes ORDER_CREATED
    //   → Product Event Handler validates all items
    //   → Publishes PRODUCT_VALIDATION_SUCCEEDED or _FAILED
    //   → Order Event Handler resolves: DRAFT → PENDING or VALIDATION_FAILED
    //
    // Real-world parallel: Uber's ride request
    //   → Driver matching service finds available drivers
    //   → Publishes DRIVER_ASSIGNED or NO_DRIVERS_AVAILABLE
    //   → Ride service resolves: REQUESTED → MATCHED or CANCELLED
    await this.eventPublisher.publish({
      eventType: OrderEventTypeEnum.ORDER_CREATED,
      orderId: savedOrder.getOrderId(),
      items: input.items,
    }, { groupId: savedOrder.getOrderId() });

    return savedOrder; // Returns DRAFT — not yet validated
  }
}

// ── The ACL Port ──────────────────────────────────────────────
// Defined in application/interfaces/ (same level as repository)
// Implemented by HTTP adapter in the SERVICE layer (not domain)

export abstract class ICustomerValidator {
  // Validates customer exists and is active.
  // Throws typed exceptions — not HTTP errors.
  abstract validate(customerId: string): Promise<ValidatedCustomer>;
}

// ── The ACL Exception Hierarchy ───────────────────────────────
// Each exception maps to a specific upstream failure:
//   404 from User API → CustomerNotFoundError
//   409 from User API → CustomerInvalidStatusError
//   5xx / timeout     → CustomerServiceUnavailableError
// The use case doesn't know about HTTP — only typed errors.`,
    },
    concepts: [
      'Core dependency = sync ACL gate (existence/identity checks)',
      'Supporting dependency = async event (complex/slow validation)',
      'ACL blocks entity creation; events resolve provisional state later',
      'Decision flowchart: existence → speed → provisionality',
      'Both patterns coexist in one use case when dependencies differ',
      'Grey zone: consider latency, failure tolerance, staleness, compensability',
    ],
    pitfalls: [
      'Do not use async events for core dependencies \u2014 you end up with orphaned entities that reference non-existent upstream data. <strong>Example:</strong> If you async-validate a customer and they were deleted, you now have an order pointing to a ghost customer ID.',
      'Do not use sync ACL for everything \u2014 it creates tight coupling, adds latency, and cascading failures. <strong>Example:</strong> Uber using sync calls to match drivers would block the API for 30+ seconds per ride request.',
      'Watch for the <strong>"notification trap"</strong> \u2014 sending emails, SMS, or push notifications should <em>always</em> be async events. A slow SMTP server should never block order creation.',
      'Async validation requires an <strong>idempotent resolver</strong> \u2014 the event handler must check current state before transitioning (order might already be cancelled). Chris Richardson calls this "lack of isolation" in the Saga pattern.',
      'If the upstream service is down, the ACL throws <code>ServiceUnavailableError</code> (mapped to 502). This is intentional \u2014 better to fail fast than create invalid data. Microsoft\u2019s ACL documentation calls this "maintaining data consistency over availability."',
      '<strong>The re-validation pattern:</strong> Even after the initial sync ACL gate, you may need to re-validate later. Our <code>ConfirmOrderUseCase</code> re-validates the customer before confirming \u2014 because the customer might have been deactivated between order creation and confirmation.',
    ],
  },

  // 11 — Create with Cross-Domain Validation (ACL)
  {
    id: '11-create-with-acl',
    label: 'ACL',
    title: 'Create with Cross-Domain Validation (ACL)',
    desc: 'Use case injects a validator interface (ACL port) alongside the repository. Validates upstream entity before proceeding.',
    complexity: { level: 3, text: 'Advanced' },
    spec: {
      title: 'ACL Pattern: Validator Port + Repository',
      body: `
        <p>When a use case needs real-time validation from another bounded context, it uses an <strong>Anti-Corruption Layer (ACL)</strong>:</p>
        <ul>
          <li><strong>Abstract validator class:</strong> Defined in <code>application/interfaces/</code> (same level as repository interface)</li>
          <li><strong>Injected into constructor:</strong> Alongside the repository</li>
          <li><strong>Called before entity creation:</strong> Throws typed exceptions if validation fails</li>
          <li><strong>Implementation lives in infrastructure:</strong> HTTP adapter in the service layer (not in the domain package)</li>
        </ul>
        <p><strong>The use case never knows about HTTP, URLs, or upstream types.</strong> It only knows the abstract validator contract.</p>
      `,
    },
    code: {
      subtitle: 'create-order.use-case.ts (with ACL)',
      content: `import { IUseCase, IEventPublisher } from '@mma/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderEventTypeEnum } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

export interface CreateOrderInput {
  customerId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
}

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,
    private readonly eventPublisher: IEventPublisher<unknown>,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.customerId) {
      throw new InvalidInputError('Customer ID is required');
    }
    if (!input.items || input.items.length === 0) {
      throw new InvalidInputError('At least one item is required');
    }

    // ACL gate check — throws if customer is invalid
    await this.customerValidator.validate(input.customerId);

    // Create domain aggregate
    const order = Order.create({ customerId: input.customerId });
    for (const itemInput of input.items) {
      const item = OrderItem.create({
        productId: itemInput.productId,
        productName: itemInput.productName,
        quantity: itemInput.quantity,
        price: itemInput.price,
      });
      order.addItem(item);
    }

    // Persist
    const savedOrder = await this.orderRepository.save(order);

    // Publish domain event for async downstream processing
    const orderId = savedOrder.getOrderId();
    if (orderId) {
      await this.eventPublisher.publish({
        eventType: OrderEventTypeEnum.ORDER_CREATED,
        orderId,
        customerId: input.customerId,
        items: input.items,
        occurredAt: new Date().toISOString(),
      }, { groupId: orderId });
    }

    return savedOrder;
  }
}`,
    },
    concepts: ['ICustomerValidator (ACL port)', 'Multiple constructor dependencies', 'ACL validates before entity creation', 'IEventPublisher for domain events', 'Aggregate root creation with children'],
    pitfalls: [
      'Never import the upstream domain package — only use the local ACL interface.',
      'The ACL validator throws domain-level exceptions — the use case does not wrap them.',
      'Event publishing happens AFTER save — never publish before persistence succeeds.',
      'The <code>groupId</code> on FIFO events ensures ordering per entity.',
    ],
  },

  // 12 — Aggregate Mutation Use Case
  {
    id: '12-aggregate-mutation',
    label: 'Aggregate',
    title: 'Aggregate Mutation (Child Entity Operations)',
    desc: 'Load the aggregate root, mutate children through root methods, persist entire aggregate in one save().',
    complexity: { level: 3, text: 'Advanced' },
    spec: {
      title: 'Aggregate Pattern: Load Root \u2192 Root.method(child) \u2192 save(root)',
      body: `
        <p>When a use case modifies child entities (e.g. OrderItems inside an Order), it always goes through the aggregate root:</p>
        <ul>
          <li><strong>Load aggregate root:</strong> <code>findById()</code> loads root + all children</li>
          <li><strong>Create child entity:</strong> <code>ChildEntity.create({...})</code></li>
          <li><strong>Add through root method:</strong> <code>root.addItem(child)</code> — root enforces status guard + duplicates</li>
          <li><strong>Persist root:</strong> <code>save(root)</code> persists entire aggregate (including new children)</li>
        </ul>
        <p><strong>Never</strong> persist children independently — always go through the root.</p>
      `,
    },
    code: {
      subtitle: 'add-order-item.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export interface AddOrderItemInput {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export class AddOrderItemUseCase implements IUseCase<AddOrderItemInput, Order> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: AddOrderItemInput): Promise<Order> {
    if (!input.orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    // Load aggregate root (includes all children)
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    // Create child entity via factory
    const item = OrderItem.create({
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      price: input.price,
    });

    // Add through root method (enforces: must be DRAFT, no duplicates)
    order.addItem(item);

    // Persist entire aggregate
    return await this.orderRepository.save(order);
  }
}`,
    },
    concepts: ['Root loaded with children (findById)', 'Child created via own factory', 'Root method enforces add/remove rules', 'Single save() persists entire aggregate', 'Returns root (not child)'],
    pitfalls: [
      'Never create a separate <code>IOrderItemRepository</code> — children are accessed through the root.',
      'The root enforces status guards (DRAFT only) — the use case does not check status.',
      'Always return the root entity so the Application Service can serialize the full aggregate.',
      'If a child needs updating, load root \u2192 find child in root \u2192 call child method \u2192 save root.',
    ],
  },

  // 13 — Action with ACL Re-Validation
  {
    id: '13-action-with-revalidation',
    label: 'Revalidate',
    title: 'Action with ACL Re-Validation',
    desc: 'Before confirming an order, re-validate that the customer is still active. Combines action + ACL patterns.',
    complexity: { level: 3, text: 'Advanced' },
    spec: {
      title: 'Re-Validation Pattern: Load \u2192 ACL Check \u2192 entity.action() \u2192 save()',
      body: `
        <p>Some state transitions require re-validating external state before proceeding:</p>
        <ul>
          <li><strong>Example:</strong> Confirming an order re-validates that the customer is still active</li>
          <li><strong>Why:</strong> Time may have passed since creation — customer could have been deactivated</li>
          <li><strong>Pattern:</strong> Same ACL validator injected + called between load and domain method</li>
        </ul>
        <p>The sequence is: <strong>Load entity \u2192 Extract upstream ID from entity \u2192 ACL validate \u2192 Domain action \u2192 Save</strong></p>
      `,
    },
    code: {
      subtitle: 'confirm-order.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

export class ConfirmOrderUseCase implements IUseCase<string, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,
  ) {}

  async execute(orderId: string): Promise<Order> {
    if (!orderId) {
      throw new InvalidInputError('Order ID is required');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    // Re-validate customer is still active before confirming
    // (time may have passed since order creation)
    await this.customerValidator.validate(order.getCustomerId());

    // Domain entity enforces: must be DRAFT + has items + has payment
    order.confirmOrder();

    return await this.orderRepository.save(order);
  }
}`,
    },
    concepts: ['ACL re-validation on critical transitions', 'Extract upstream ID from loaded entity', 'Two injected dependencies (repo + validator)', 'Domain method still owns the full rule set', 'Temporal consistency check'],
    pitfalls: [
      'Not all actions need re-validation — only transitions that depend on external state.',
      'The ACL call adds latency — only use for critical business gates (not every status change).',
      'If the ACL throws, the order stays in its current state (no half-transitions).',
      'Ship/deliver/cancel typically do NOT re-validate — customer status is irrelevant at that point.',
    ],
  },

  // 14 — Batch/Pagination Use Case (Event Handler)
  {
    id: '14-batch-use-case',
    label: 'Batch',
    title: 'Batch Processing Use Case',
    desc: 'Iterates through paginated results, applies domain logic to each entity, returns a summary. Used by event handlers.',
    complexity: { level: 4, text: 'Expert' },
    spec: {
      title: 'Batch Pattern: Paginate \u2192 Filter \u2192 Mutate \u2192 Save \u2192 Summarize',
      body: `
        <p>Batch use cases process multiple entities in response to an event (e.g. product price change). They:</p>
        <ul>
          <li><strong>Paginate through results:</strong> Process page-by-page to avoid memory overflow</li>
          <li><strong>Filter in-memory:</strong> Only mutate entities in the correct state (e.g. DRAFT orders only)</li>
          <li><strong>Save individually:</strong> Each entity is persisted separately (no bulk transaction)</li>
          <li><strong>Return summary:</strong> Custom output (e.g. list of affected IDs)</li>
        </ul>
        <p><strong>Used by event handlers</strong> when a domain event from another bounded context affects multiple entities in this domain.</p>
      `,
    },
    code: {
      subtitle: 'update-item-latest-price.use-case.ts',
      content: `import { IUseCase } from '@mma/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { OrderStatusEnum } from '../../../domain/constants';

export interface UpdateItemLatestPriceInput {
  productId: string;
  newPrice: number;
}

export interface UpdateItemLatestPriceOutput {
  updatedOrderIds: string[];
}

export class UpdateItemLatestPriceUseCase
  implements IUseCase<UpdateItemLatestPriceInput, UpdateItemLatestPriceOutput> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: UpdateItemLatestPriceInput): Promise<UpdateItemLatestPriceOutput> {
    const updatedOrderIds: string[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
      const result = await this.orderRepository.findByProductId(
        input.productId, currentPage, pageSize,
      );

      for (const order of result.data) {
        // Only update DRAFT orders — confirmed+ orders have frozen prices
        if (order.getOrderStatus() !== OrderStatusEnum.DRAFT) {
          continue;
        }

        let modified = false;
        for (const item of order.getItems()) {
          if (item.getProductId() === input.productId) {
            item.updateLatestKnownPrice(input.newPrice);
            modified = true;
          }
        }

        if (modified) {
          await this.orderRepository.save(order);
          const orderId = order.getOrderId();
          if (orderId) updatedOrderIds.push(orderId);
        }
      }

      hasMore = currentPage < result.totalPages;
      currentPage++;
    }

    return { updatedOrderIds };
  }
}`,
    },
    concepts: ['Custom Input + Output interfaces', 'Page-by-page iteration', 'In-memory status filtering', 'Individual save per entity', 'Summary return for logging/auditing'],
    pitfalls: [
      'Never load ALL pages into memory — process one page at a time.',
      'Use domain constants for status checks: <code>OrderStatusEnum.DRAFT</code> not <code>"DRAFT"</code>.',
      'Track which entities were modified for downstream reporting / event emission.',
      'Batch use cases can be slow — suitable for async event handlers, not synchronous HTTP.',
    ],
  },
];

// ─── HTML Generation ─────────────────────────────────────────────────────────

function generateNavLinks() {
  return modules.map(m => `<a href="#${m.id}">${m.label}</a>`).join('\n    ');
}

function generateOverviewCards() {
  return modules.map((m, i) => `<a class="intro-card" href="#${m.id}" style="text-decoration:none; color:inherit;">
      <div class="num">Module ${String(i + 1).padStart(2, '0')}</div>
      <div class="name">${m.title}</div>
      <div class="desc">${m.desc}</div>
    </a>`).join('\n    ');
}

function generateModuleSection(m) {
  const complexityClass = `l${m.complexity.level}`;
  return `
<section class="module" id="${m.id}">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">${m.label}</div>
        <h2>${m.title}</h2>
        <p class="module-desc">${m.desc}</p>
      </div>
      <span class="complexity ${complexityClass}">\u25CF ${m.complexity.text}</span>
    </div>

    <div class="split fade-in">
      ${specPanel(m.spec.title, m.spec.body)}
      ${codePanel(m.code.subtitle, m.code.content)}
    </div>

    ${conceptPills(m.concepts)}
    ${pitfalls(m.pitfalls)}
  </div>
</section>`;
}

function generateHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Layer Masterclass</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:#fff; --bg-alt:#f7f8fa; --bg-card:#fff;
  --bg-code:#1e1e2e; --bg-code-text:#cdd6f4;
  --bg-nav:rgba(255,255,255,0.92); --border:#e4e7ec;
  --text:#111827; --text-muted:#6b7280; --text-light:#9ca3af;
  --accent:#6366f1; --accent-hover:#4f46e5; --accent-light:#eef2ff;
  --accent-gradient:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);
  --hero-gradient:linear-gradient(135deg,#0f172a 0%,#1e1b4b 40%,#312e81 70%,#4c1d95 100%);
  --success:#10b981; --success-bg:#ecfdf5;
  --warning:#f59e0b; --warning-bg:#fffbeb;
  --danger:#ef4444; --danger-bg:#fef2f2;
  --info:#3b82f6; --info-bg:#eff6ff;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.05);
  --shadow:0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg:0 10px 15px -3px rgba(0,0,0,0.08);
  --radius:12px; --radius-sm:8px;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'SF Mono','Cascadia Code','Fira Code',Consolas,monospace;
  --transition:0.2s ease;
}
[data-theme="dark"] {
  --bg:#0f1117; --bg-alt:#161922; --bg-card:#1a1d28;
  --bg-nav:rgba(15,17,23,0.92); --border:#2d3148;
  --text:#e5e7eb; --text-muted:#9ca3af; --text-light:#6b7280;
  --accent:#818cf8; --accent-hover:#a5b4fc; --accent-light:#1e1b4b;
  --success-bg:#064e3b; --warning-bg:#451a03;
  --danger-bg:#450a0a; --info-bg:#172554;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.3);
  --shadow:0 4px 6px rgba(0,0,0,0.3);
  --shadow-lg:0 10px 25px rgba(0,0,0,0.4);
}
html { font-size:16px; scroll-behavior:smooth; scroll-padding-top:80px; }
body { font-family:var(--font); color:var(--text); background:var(--bg); line-height:1.7; -webkit-font-smoothing:antialiased; }

.scroll-progress { position:fixed; top:0; left:0; height:3px; z-index:1001; background:var(--accent-gradient); width:0%; transition:width 0.1s linear; }

.top-nav { position:fixed; top:0; left:0; right:0; z-index:1000; background:var(--bg-nav); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); padding:0 24px; height:60px; display:flex; align-items:center; justify-content:space-between; transition:box-shadow var(--transition); }
.top-nav.scrolled { box-shadow:var(--shadow); }
.nav-brand { font-weight:800; font-size:1rem; color:var(--accent); text-decoration:none; white-space:nowrap; }
.nav-links { display:flex; gap:4px; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.nav-links a { padding:8px 14px; font-size:0.8rem; font-weight:600; color:var(--text-muted); text-decoration:none; border-radius:8px; white-space:nowrap; transition:background var(--transition), color var(--transition); }
.nav-links a:hover, .nav-links a.active { background:var(--accent-light); color:var(--accent); }
.nav-controls { display:flex; gap:8px; align-items:center; }
.theme-toggle { width:38px; height:38px; border-radius:10px; border:1px solid var(--border); background:var(--bg); cursor:pointer; font-size:1.1rem; display:flex; align-items:center; justify-content:center; transition:background var(--transition), border-color var(--transition); }
.theme-toggle:hover { background:var(--accent-light); border-color:var(--accent); }
.hamburger { display:none; width:38px; height:38px; border-radius:10px; border:1px solid var(--border); background:var(--bg); cursor:pointer; font-size:1.2rem; align-items:center; justify-content:center; }

.hero { background:var(--hero-gradient); padding:140px 24px 80px; text-align:center; color:#fff; position:relative; overflow:hidden; }
.hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse at 70% 50%, rgba(168,85,247,0.1) 0%, transparent 70%); }
.hero-content { position:relative; z-index:1; max-width:800px; margin:0 auto; }
.hero h1 { font-size:3rem; font-weight:900; letter-spacing:-0.04em; line-height:1.1; margin-bottom:16px; }
.hero .lead { font-size:1.25rem; color:rgba(255,255,255,0.8); margin-bottom:32px; line-height:1.6; }
.hero-meta { display:flex; gap:24px; justify-content:center; flex-wrap:wrap; }
.hero-meta span { font-size:0.85rem; color:rgba(255,255,255,0.6); display:flex; align-items:center; gap:6px; }
.hero-meta span strong { color:rgba(255,255,255,0.9); }

.module { padding:64px 24px; }
.module:nth-child(even) { background:var(--bg-alt); }
.module-inner { max-width:1280px; margin:0 auto; }
.module-header { margin-bottom:32px; display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.module-header .module-meta { flex:1; min-width:280px; }
.module-label { display:inline-flex; align-items:center; gap:8px; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--accent); margin-bottom:12px; background:var(--accent-light); padding:4px 12px; border-radius:20px; }
.module-header h2 { font-size:1.85rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:8px; }
.module-header .module-desc { font-size:1rem; color:var(--text-muted); max-width:680px; }
.complexity { display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:700; padding:6px 12px; border-radius:20px; }
.complexity.l1 { background:#dcfce7; color:#166534; }
.complexity.l2 { background:#dbeafe; color:#1e40af; }
.complexity.l3 { background:#fef3c7; color:#92400e; }
.complexity.l4 { background:#ffedd5; color:#9a3412; }
[data-theme="dark"] .complexity.l1 { background:#14532d; color:#bbf7d0; }
[data-theme="dark"] .complexity.l2 { background:#1e3a5f; color:#93c5fd; }
[data-theme="dark"] .complexity.l3 { background:#78350f; color:#fef3c7; }
[data-theme="dark"] .complexity.l4 { background:#7c2d12; color:#fed7aa; }

.split { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:20px; margin:24px 0; align-items:stretch; }
.split > .panel { display:flex; flex-direction:column; }
.panel { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow-sm); }
.panel-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; background:var(--bg-alt); }
.panel-header .icon { font-size:1rem; }
.panel-header .title { font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text); }
.panel-header .subtitle { font-size:0.75rem; color:var(--text-muted); margin-left:auto; font-family:var(--mono); }
.panel-body { padding:20px 24px; flex:1; overflow:auto; }
.panel-body.code-body { padding:0; background:var(--bg-code); }
.panel-body.code-body pre { margin:0; padding:18px 20px; background:transparent; border-radius:0; font-size:0.78rem; line-height:1.55; max-height:680px; }
.spec-title { font-size:1.05rem; font-weight:700; margin-bottom:12px; color:var(--text); }
.spec-body { font-size:0.92rem; }
.spec-body p { margin-bottom:12px; }
.spec-body ul, .spec-body ol { padding-left:22px; margin-bottom:12px; }
.spec-body li { margin-bottom:6px; }
.spec-body strong { color:var(--text); font-weight:700; }
.spec-body em { color:var(--accent); font-style:normal; font-weight:600; background:var(--accent-light); padding:1px 6px; border-radius:4px; }

.concepts { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 8px; }
.concept-pill { display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:600; padding:6px 12px; border-radius:20px; background:var(--accent-light); color:var(--accent); border:1px solid var(--accent); }

.pitfalls { background:var(--warning-bg); border-left:4px solid var(--warning); border-radius:0 var(--radius-sm) var(--radius-sm) 0; padding:14px 18px; margin-top:20px; }
.pitfalls-title { font-weight:700; font-size:0.85rem; margin-bottom:6px; color:#92400e; display:flex; align-items:center; gap:6px; }
[data-theme="dark"] .pitfalls-title { color:#fef3c7; }
.pitfalls ul { padding-left:20px; margin:0; font-size:0.86rem; }
.pitfalls li { margin-bottom:4px; }

pre code { background:none; padding:0; color:inherit; font-family:var(--mono); }
pre .kw  { color:#c084fc; }
pre .str { color:#a7f3d0; }
pre .com { color:#64748b; font-style:italic; }
pre .ty  { color:#7dd3fc; }
pre .fn  { color:#fde68a; }
pre .num { color:#fda4af; }

code { font-family:var(--mono); font-size:0.85em; background:var(--bg-alt); padding:2px 7px; border-radius:5px; }

.fade-in { opacity:0; transform:translateY(20px); transition:opacity 0.5s ease, transform 0.5s ease; }
.fade-in.visible { opacity:1; transform:translateY(0); }

.intro-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; margin-top:24px; }
.intro-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:16px; transition:border-color var(--transition), box-shadow var(--transition); }
.intro-card:hover { border-color:var(--accent); box-shadow:var(--shadow); }
.intro-card .num { font-size:0.7rem; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px; }
.intro-card .name { font-weight:700; font-size:0.95rem; margin-bottom:4px; }
.intro-card .desc { font-size:0.82rem; color:var(--text-muted); }

@media print {
  .top-nav, .scroll-progress, .theme-toggle, .hamburger { display:none !important; }
  .hero { padding-top:40px; }
  .module { padding:32px 0; break-inside:avoid; }
  .split { grid-template-columns:1fr; }
}
@media (max-width:1024px) {
  .split { grid-template-columns:1fr; }
}
@media (max-width:768px) {
  .nav-links { display:none; }
  .nav-links.open { display:flex; flex-direction:column; position:absolute; top:60px; left:0; right:0; background:var(--bg-nav); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); padding:12px; z-index:999; }
  .hamburger { display:flex; }
  .hero h1 { font-size:2rem; }
  .hero .lead { font-size:1rem; }
  .hero-meta { flex-direction:column; gap:8px; }
  .module { padding:40px 16px; }
}
  </style>
</head>
<body>
<div class="scroll-progress" id="scrollProgress"></div>
<nav class="top-nav" id="topNav">
  <a href="#" class="nav-brand">Application Layer</a>
  <div class="nav-links" id="navLinks">
    <a href="#overview">Overview</a>
    ${generateNavLinks()}
  </div>
  <div class="nav-controls">
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme">\u{1F319}</button>
    <button class="hamburger" id="hamburger" aria-label="Menu">\u2630</button>
  </div>
</nav>

<header class="hero">
  <div class="hero-content">
    <h1>Application Layer Masterclass</h1>
    <p class="lead">Use Cases, Repository Interfaces, and Application Exceptions \u2014 the orchestration layer between domain entities and the outside world.</p>
    <div class="hero-meta">
      <span>\u{1F4DA} <strong>${modules.length} Patterns</strong></span>
      <span>\u{1F3AF} <strong>Foundation \u2192 Expert</strong></span>
      <span>\u{1F527} <strong>Clean Architecture</strong></span>
      <span>\u26A1 <strong>IUseCase&lt;In, Out&gt;</strong></span>
    </div>
  </div>
</header>

<section class="module" id="overview">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">Course Overview</div>
        <h2>Use Case Patterns: Simple to Complex</h2>
        <p class="module-desc">From basic CRUD operations to advanced patterns with cross-domain validation, aggregate mutations, and batch processing. Each pattern builds on the previous one.</p>
      </div>
    </div>
    <div class="intro-grid">
    ${generateOverviewCards()}
    </div>
  </div>
</section>

${modules.map(generateModuleSection).join('\n')}

<script>
(function () {
  // Theme
  const toggle = document.getElementById('themeToggle');
  const html = document.documentElement;
  const stored = localStorage.getItem('theme');
  if (stored) html.setAttribute('data-theme', stored);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.setAttribute('data-theme', 'dark');
  toggle.textContent = html.getAttribute('data-theme') === 'dark' ? '\u2600\uFE0F' : '\u{1F319}';
  toggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    toggle.textContent = next === 'dark' ? '\u2600\uFE0F' : '\u{1F319}';
  });

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));

  // Scroll progress
  const bar = document.getElementById('scrollProgress');
  const nav = document.getElementById('topNav');
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
    nav.classList.toggle('scrolled', window.scrollY > 10);
  });

  // Active nav link
  const sections = document.querySelectorAll('.module[id]');
  const links = document.querySelectorAll('.nav-links a');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(s => observer.observe(s));

  // Fade-in
  const fadeObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => fadeObs.observe(el));
})();
</script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const html = generateHtml();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, html, 'utf-8');
console.log(`\u2705 Generated: ${OUTPUT_PATH}`);
console.log(`   Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
