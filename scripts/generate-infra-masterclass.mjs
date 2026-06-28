#!/usr/bin/env node
/**
 * generate-infra-masterclass.mjs
 *
 * Generates docs/tutorial/infrastructure-layer-masterclass.html
 * A comprehensive tutorial on the Infrastructure Layer (DynamoDB + Prisma repositories).
 *
 * Usage: node scripts/generate-infra-masterclass.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'docs', 'tutorial', 'infrastructure-layer-masterclass.html');

// ─── Reusable building blocks ────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code) {
  // Light syntax highlighting with span classes (placeholder approach prevents corruption)
  // Uses \x01PH{i}\x01 format — the "PH" prefix prevents \b from matching the digit index.
  let out = escapeHtml(code);
  const placeholders = [];
  function ph(html) {
    const i = placeholders.length;
    placeholders.push(html);
    return `\x01PH${i}\x01`;
  }

  // 1. Comments → placeholders
  out = out.replace(/(\/\/.*$|\/\*\*[\s\S]*?\*\/|\/\*[\s\S]*?\*\/)/gm, (m) => ph(`<span class="com">${m}</span>`));
  // 2. Strings → placeholders
  out = out.replace(/(&#x27;[^&#]*?&#x27;|'[^']*?')/g, (m) => ph(`<span class="str">${m}</span>`));
  // 3. Keywords (single-pass)
  out = out.replace(/\b(import|export|from|class|interface|private|readonly|const|let|async|await|return|if|else|new|this|type|extends|implements|static|throw|function|typeof|as|null|undefined|void|true|false)\b/g, (m) => ph(`<span class="kw">${m}</span>`));
  // 4. Types (single-pass)
  out = out.replace(/\b(Table|string|number|boolean|Promise|User|Product|Order|OrderItem|OrderPayment|ProductCategory|IPaginatedResponse|IOffsetPaginatedResponse|PrismaClient|PrismaOrder|PrismaOrderItem|PrismaOrderPayment|UserDataType|ProductDataType|CategoryDataType|Entity|Date|Record|Partial|object)\b/g, (m) => ph(`<span class="ty">${m}</span>`));
  // 5. Numbers
  out = out.replace(/\b(\d+)\b/g, (m) => ph(`<span class="num">${m}</span>`));
  // 6. Function-like names
  out = out.replace(/\b([a-z][a-zA-Z0-9]*)\s*\(/g, (m, fn) => ph(`<span class="fn">${fn}</span>`) + '(');
  // 7. Restore all placeholders
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
  return panel('📋', 'Specification', title, `<div class="spec-title">${title}</div><div class="spec-body">${bodyHtml}</div>`);
}

function codePanel(subtitle, code) {
  return panel('💻', 'Implementation', subtitle, highlight(code), true);
}

function conceptPills(concepts) {
  return `<div class="concepts fade-in">${concepts.map(c => `<span class="concept-pill">✦ ${c}</span>`).join('')}</div>`;
}

function pitfalls(items) {
  return `<div class="pitfalls">
  <div class="pitfalls-title">⚠️ Common Pitfalls</div>
  <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
</div>`;
}

// ─── Sections Data ───────────────────────────────────────────────────────────

const modules = [
  // 01 — Local Model Interface
  {
    id: '01-local-model-interface',
    label: 'Infrastructure Pattern',
    title: 'Local Model Interface',
    desc: 'Avoid dynamodb-onetable\'s complex generic types by defining a local structural interface for the Model instance.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'Why a Local IModel Interface?',
      body: `
        <p>DynamoDB OneTable's <code>Model&lt;Entity&lt;Schema&gt;&gt;</code> generics produce <strong>deeply nested mapped types</strong> that confuse IDE IntelliSense, slow TypeScript compilation, and make repository code unreadable.</p>
        <p>The solution: define a <strong>local structural interface</strong> typed for <em>read returns</em> (the schema's DataType) with <em>flexible object inputs</em>.</p>
        <ul>
          <li><strong>Inputs:</strong> <code>object</code> — avoid EntityParametersForCreate complexity</li>
          <li><strong>Outputs:</strong> <code>Promise&lt;DataType&gt;</code> — fully typed results</li>
          <li><strong>Methods:</strong> Only the methods you actually use: <code>create</code>, <code>upsert</code>, <code>get</code>, <code>find</code></li>
        </ul>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `import { Table } from 'dynamodb-onetable';
import { UserDataType } from '../schemas/UserSchema';

/**
 * Local structural interface for the dynamodb-onetable Model instance.
 * Typed for read returns (UserDataType) with flexible object inputs,
 * avoiding dynamodb-onetable's complex EntityParametersForCreate mapped types.
 */
interface IUserModel {
  create(properties: object): Promise<UserDataType>;
  upsert(properties: object): Promise<UserDataType>;
  get(properties: object, options?: object): Promise<UserDataType | undefined>;
  find(properties: object, options?: object): Promise<UserDataType[]>;
}

export class DynamoUserRepository implements IUserRepository {
  private readonly UserModel: IUserModel;

  constructor(private readonly table: Table) {
    // Cast via unknown to bypass OneTable's complex generics
    this.UserModel = this.table.getModel('User') as unknown as IUserModel;
  }
}`,
    },
    concepts: ['Local structural interface', 'Typed outputs, flexible inputs', 'Cast via unknown', 'Only expose methods you use'],
    pitfalls: [
      'Never expose the raw OneTable Model type in repository signatures — it leaks infrastructure types.',
      'The <code>as unknown as IModel</code> cast is intentional and safe — it is an approved workaround.',
      'Keep the interface next to the repository, not in a shared package.',
    ],
  },

  // 02 — Save (Create vs Update)
  {
    id: '02-save-pattern',
    label: 'CRUD Operations',
    title: 'Save Pattern (Create vs Update)',
    desc: 'A single save() method that branches on whether the entity already has an ID — create for new, upsert for existing.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Create-or-Update in One Method',
      body: `
        <p>The repository interface exposes a single <code>save(entity)</code> method. Internally, it branches:</p>
        <ul>
          <li><strong>Entity has an ID</strong> → <code>upsert()</code> — full entity replacement</li>
          <li><strong>Entity has no ID</strong> → <code>create()</code> — DynamoDB generates one</li>
        </ul>
        <p>The method converts domain→persistence via <code>toPersistence()</code>, calls OneTable, then converts the result back via <code>toDomain()</code>.</p>
        <p><em>Why upsert instead of update?</em> OneTable's <code>update()</code> requires you to specify which fields changed. <code>upsert()</code> replaces the entire item, which is simpler and avoids partial-update bugs.</p>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `/**
 * Save a user entity (create or update)
 */
async save(user: User): Promise<User> {
  const data = this.toPersistence(user);

  if (user.getUserId()) {
    // Update existing user - use upsert to ensure full entity is saved
    const updated = await this.UserModel.upsert(data);
    return this.toDomain(updated);
  } else {
    // Create new user
    const created = await this.UserModel.create(data);
    return this.toDomain(created);
  }
}`,
    },
    concepts: ['Single save() method', 'Branch on entity ID presence', 'upsert() for full replacement', 'Always return the reconstituted entity'],
    pitfalls: [
      'Never use OneTable <code>update()</code> for full saves — it requires explicit field lists and can miss new fields.',
      'Always return the domain entity after save, not the input — the DB may have generated fields (ID, timestamps).',
      'For Prisma: the pattern is similar but uses <code>$transaction</code> for aggregate saves.',
    ],
  },

  // 03 — findById (Primary Key Lookup)
  {
    id: '03-find-by-id',
    label: 'Query Patterns',
    title: 'Find by Primary Key',
    desc: 'The simplest query — get a single entity by its primary key. Returns null (not throw) when not found.',
    complexity: { level: 1, text: 'Foundation' },
    spec: {
      title: 'Primary Key Lookup',
      body: `
        <p>Every repository must implement <code>findById(id): Promise&lt;Entity | null&gt;</code>.</p>
        <ul>
          <li>Uses OneTable's <code>get()</code> — queries the primary key directly</li>
          <li>Returns <code>null</code> when the item doesn't exist (never throws)</li>
          <li>Use cases decide whether to throw <code>NotFoundError</code> — the repository stays neutral</li>
        </ul>
        <p><strong>Rule:</strong> Repositories return <code>null</code> for missing entities. Use cases throw domain exceptions.</p>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `/**
 * Find user by ID (Primary Key)
 */
async findById(userId: string): Promise<User | null> {
  const result = await this.UserModel.get({ userId });
  return result ? this.toDomain(result) : null;
}

// Prisma equivalent:
async findById(orderId: string): Promise<Order | null> {
  const record = await this.prisma.order.findUnique({
    where: { orderId },
    include: { items: true, payment: true },
  });
  if (!record) return null;
  return this.toDomain(record, record.items, record.payment);
}`,
    },
    concepts: ['get() for PK lookup', 'Return null, not throw', 'toDomain() conversion', 'Prisma uses findUnique + include'],
    pitfalls: [
      'Never throw from <code>findById</code> when the entity does not exist — that is the use case\'s job.',
      'In DynamoDB, <code>get()</code> is a point read (fast). <code>find()</code> is a query (scan) — never use it for PK lookups.',
      'In Prisma, use <code>findUnique</code> (not <code>findFirst</code>) for PK lookups — it is optimized.',
    ],
  },

  // 04 — Find by GSI (Secondary Index)
  {
    id: '04-find-by-gsi',
    label: 'Query Patterns',
    title: 'Find by GSI (Secondary Index)',
    desc: 'Query a Global Secondary Index to find entities by non-primary attributes like email or name.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'GSI-Based Lookups',
      body: `
        <p>When you need to find entities by a non-primary attribute (email, status, category), you query a <strong>Global Secondary Index (GSI)</strong>.</p>
        <ul>
          <li><strong>GSI4:</strong> <code>GSI4PK = 'USER#\${email}'</code> — email lookup</li>
          <li><strong>GSI5:</strong> <code>GSI5PK = 'USER#\${userStatus}'</code> — status listing</li>
          <li><strong>GSI1:</strong> <code>GSI1PK = 'USER#\${userRole}#\${userStatus}'</code> — composite</li>
        </ul>
        <p><strong>Key rule:</strong> Always pass the <code>index</code> option to <code>find()</code>. Without it, OneTable scans the main table — expensive and slow.</p>
        <p>For unique lookups (email), add <code>limit: 1</code> and return the first result or null.</p>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `/**
 * Find user by email (GSI4: GSI4PK = 'USER#{email}')
 */
async findByEmail(email: string): Promise<User | null> {
  const results = await this.UserModel.find(
    { email },
    {
      index: 'GSI4',
      limit: 1,
    }
  );

  return results.length > 0 ? this.toDomain(results[0]) : null;
}

// Category findByName (GSI1 overloaded):
async findByName(name: string): Promise<ProductCategory | null> {
  const results = await this.CategoryModel.find(
    { name },
    { index: 'GSI1', limit: 1 }
  );
  return results.length > 0 ? this.toDomain(results[0]) : null;
}`,
    },
    concepts: ['Always specify index name', 'limit: 1 for unique lookups', 'GSI key design drives query patterns', 'find() returns array, not single item'],
    pitfalls: [
      'Forgetting the <code>index</code> option causes a full table scan — catastrophic at scale.',
      'GSI queries return arrays even for unique items — always take <code>[0]</code> or check length.',
      'GSI PK value templates must match the schema exactly (e.g., <code>USER#\${email}</code>).',
    ],
  },

  // 05 — Cursor-Based Pagination (DynamoDB)
  {
    id: '05-cursor-pagination',
    label: 'Pagination',
    title: 'Cursor-Based Pagination (DynamoDB)',
    desc: 'DynamoDB uses exclusive start keys for pagination. The repository wraps this in a clean IPaginatedResponse.',
    complexity: { level: 3, text: 'Intermediate' },
    spec: {
      title: 'How Cursor Pagination Works',
      body: `
        <p>DynamoDB doesn't support <code>OFFSET</code>/<code>LIMIT</code> — it uses <strong>exclusive start keys</strong>. The <code>pageRecordHandler</code> utility wraps this into a consumer-friendly interface:</p>
        <ul>
          <li><strong>Input:</strong> <code>limit</code>, <code>direction</code> ('next'|'prev'), optional <code>cursor</code></li>
          <li><strong>Output:</strong> <code>{ data, nextCursorPointer, prevCursorPointer }</code></li>
        </ul>
        <p>The pipeline:</p>
        <ol>
          <li>Pick cursor based on direction (next→nextCursor, prev→prevCursor)</li>
          <li>Build DynamoDB options with <code>createDynamoDbOptionWithPKSKIndex()</code></li>
          <li>Query DynamoDB via <code>find()</code></li>
          <li>Process results with <code>pageRecordHandler()</code> — extracts cursor keys for next/prev</li>
          <li>Map raw records → domain entities</li>
        </ol>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `async listByStatus(
  userStatus: UserStatus,
  limit = 20,
  direction = 'next',
  nextCursorPointer?: string,
  prevCursorPointer?: string
): Promise<IPaginatedResponse<User>> {
  // 1. Determine which cursor to use based on direction
  const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

  // 2. Build DynamoDB query options
  const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
    limit,
    'GSI5',
    direction,
    cursorPointer || ''
  );

  // 3. Query DynamoDB
  const results = await this.UserModel.find(
    { userStatus },
    dynamoDbOptions
  );

  // 4. Paginate on raw records, then map to domain entities
  const paginatedResult = pageRecordHandler<UserDataType>(
    [...results],
    limit,
    direction,
    'GSI5PK',   // GSI partition key field
    'GSI5SK',   // GSI sort key field
    'PK',       // Table partition key field
    'SK',       // Table sort key field
    nextCursorPointer || '',
    prevCursorPointer || ''
  );

  return {
    data: paginatedResult.data.map((item) => this.toDomain(item)),
    nextCursorPointer: paginatedResult.nextCursorPointer,
    prevCursorPointer: paginatedResult.prevCursorPointer,
  };
}`,
    },
    concepts: ['Direction-based cursor selection', 'createDynamoDbOptionWithPKSKIndex utility', 'pageRecordHandler for cursor extraction', 'GSI key fields must match schema', 'Spread results to avoid mutation'],
    pitfalls: [
      'Always spread results <code>[...results]</code> — <code>pageRecordHandler</code> may mutate the array.',
      'The 4 key field arguments to <code>pageRecordHandler</code> must match the GSI you queried. Wrong fields = broken pagination.',
      'Never decode/encode cursors in the repository — that\'s the application service\'s job.',
      'An empty string cursor means "no cursor" — don\'t pass <code>null</code> or <code>undefined</code>.',
    ],
  },

  // 06 — Offset-Based Pagination (Prisma)
  {
    id: '06-offset-pagination',
    label: 'Pagination',
    title: 'Offset-Based Pagination (Prisma)',
    desc: 'Prisma uses skip/take with a parallel count() query to return IOffsetPaginatedResponse.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Offset Pagination in Prisma',
      body: `
        <p>Prisma repositories use <strong>offset-based pagination</strong> with <code>skip</code>/<code>take</code> and a parallel <code>count()</code> query.</p>
        <ul>
          <li><strong>Input:</strong> <code>page</code> (1-based), <code>limit</code></li>
          <li><strong>Output:</strong> <code>{ data, total, page, limit, totalPages }</code></li>
        </ul>
        <p>The pattern uses <code>Promise.all</code> to run <code>findMany</code> and <code>count</code> in parallel — a single round-trip optimization.</p>
        <p><strong>Rule:</strong> Never mix pagination styles. Prisma domains always use offset. DynamoDB domains always use cursor.</p>
      `,
    },
    code: {
      subtitle: 'prisma-order.repository.ts',
      content: `async findByStatus(
  orderStatus: OrderStatus,
  page = 1,
  limit = 20,
): Promise<IOffsetPaginatedResponse<Order>> {
  const where = { orderStatus };

  // Parallel query: data + count in one round-trip
  const [records, total] = await Promise.all([
    this.prisma.order.findMany({
      where,
      include: { items: true, payment: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { dateCreated: 'desc' },
    }),
    this.prisma.order.count({ where }),
  ]);

  const orders = records.map((r) =>
    this.toDomain(r, r.items, r.payment)
  );

  return createOffsetPaginatedResponse(orders, total, page, limit);
}`,
    },
    concepts: ['Promise.all for parallel queries', 'skip = (page-1) * limit', 'count() for total', 'createOffsetPaginatedResponse helper', 'include for eager loading'],
    pitfalls: [
      'Always run <code>findMany</code> and <code>count</code> with the same <code>where</code> clause — mismatched filters corrupt pagination.',
      'Page is 1-based, not 0-based. <code>skip = (page - 1) * limit</code>.',
      'Use <code>orderBy</code> to ensure deterministic ordering — without it, results may shift between pages.',
      'Avoid deep offset pagination (page > 1000) — it is O(n) in Postgres. Consider cursor for large datasets.',
    ],
  },

  // 07 — toDomain() Mapping
  {
    id: '07-to-domain',
    label: 'Data Mapping',
    title: 'toDomain() — Record to Entity',
    desc: 'Private method that converts a raw database record into a domain entity via reconstitute().',
    complexity: { level: 3, text: 'Intermediate' },
    spec: {
      title: 'Converting Persistence Records to Domain',
      body: `
        <p>Every repository has a private <code>toDomain()</code> method that takes a raw DB record and returns a domain entity using <code>Entity.reconstitute()</code>.</p>
        <ul>
          <li><strong>DynamoDB:</strong> Handles OneTable's <code>timestamps: true</code> behavior — <code>createdAt</code>/<code>updatedAt</code> may be Date objects or ISO strings. Must guard against undefined.</li>
          <li><strong>Prisma:</strong> Handles Prisma's native Date fields — convert to ISO strings for the domain layer.</li>
        </ul>
        <p><strong>Key invariant:</strong> The domain entity constructor receives <em>only domain-meaningful data</em>. GSI keys, partition keys, and other infrastructure artifacts are stripped.</p>
        <p>Always validate critical fields (e.g., throw if <code>userId</code> is missing from a DynamoDB record).</p>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `/**
 * Private: Convert DynamoDB record to domain entity
 */
private toDomain(raw: UserDataType): User {
  // dynamodb-onetable adds createdAt/updatedAt when timestamps: true.
  // With isoDates: true these are returned as Date objects.
  // Guard against undefined for records from before timestamps were enabled.
  const record = raw as UserDataType & {
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  const toIsoString = (
    value: Date | string | undefined,
    fallback: string
  ): string => {
    if (!value) return fallback;
    return value instanceof Date ? value.toISOString() : value;
  };

  const dateCreated = record.dateCreated ?? new Date().toISOString();
  const userId = record.userId;
  if (!userId) throw new Error('DynamoDB record missing userId');

  return User.reconstitute({
    userId,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    emailVerified: record.emailVerified ?? false,
    userRole: record.userRole as UserRole,
    userStatus: record.userStatus as UserStatus,
    dateCreated,
    data: record.data || {},
    updatedAt: toIsoString(record.updatedAt, dateCreated),
  });
}`,
    },
    concepts: ['Always use reconstitute(), never create()', 'Guard against undefined timestamps', 'Date→ISO string conversion', 'Validate critical fields', 'Strip infrastructure artifacts'],
    pitfalls: [
      'Never call <code>Entity.create()</code> from <code>toDomain()</code> — that runs business validation. Use <code>reconstitute()</code>.',
      'OneTable <code>timestamps: true</code> + <code>isoDates: true</code> produces Date objects, not strings — always convert.',
      'The domain entity maps <code>createdAt</code> (OneTable) → <code>dateCreated</code> (domain). Never add <code>createdAt</code> to entities.',
      'Default values (e.g., <code>emailVerified ?? false</code>) prevent undefined from leaking into the domain.',
    ],
  },

  // 08 — toPersistence() Mapping
  {
    id: '08-to-persistence',
    label: 'Data Mapping',
    title: 'toPersistence() — Entity to Record',
    desc: 'Private method that converts a domain entity into a flat database record for storage.',
    complexity: { level: 2, text: 'Core Pattern' },
    spec: {
      title: 'Converting Domain Entities to Persistence',
      body: `
        <p>The inverse of <code>toDomain()</code>: takes a domain entity and produces a flat object suitable for DynamoDB/Prisma.</p>
        <ul>
          <li><strong>Conditional ID:</strong> Only include <code>userId</code> if it exists (omit for new entities — DB generates it)</li>
          <li><strong>GSI values:</strong> NOT included — OneTable's value templates auto-compute them from the data</li>
          <li><strong>Timestamps:</strong> NOT included — OneTable's <code>timestamps: true</code> manages them</li>
          <li><strong>Entity getters:</strong> Use entity getters exclusively — never access private fields</li>
        </ul>
        <p>The output is a <code>Partial&lt;DataType&gt;</code> — partial because <code>userId</code> may be absent on create.</p>
      `,
    },
    code: {
      subtitle: 'dynamo-user.repository.ts',
      content: `/**
 * Private: Convert domain entity to database record
 */
private toPersistence(user: User): Partial<UserDataType> {
  const userId = user.getUserId();

  return {
    ...(userId && { userId }),
    email: user.getEmail(),
    firstName: user.getFirstName(),
    lastName: user.getLastName(),
    emailVerified: user.isEmailVerified(),
    userRole: user.getUserRole(),
    userStatus: user.getUserStatus(),
    dateCreated: user.getDateCreated(),
    data: user.getData(),
  };
}

// Prisma equivalent (Order aggregate):
private toPersistence(order: Order) {
  return {
    customerId: order.getCustomerId(),
    orderStatus: order.getOrderStatus(),
    totalAmount: order.getTotalAmount(),
  };
}`,
    },
    concepts: ['Conditional ID spread', 'GSI keys auto-computed by OneTable', 'Timestamps managed by DB layer', 'Use entity getters only', 'Partial<DataType> return type'],
    pitfalls: [
      'Never include GSI fields (<code>GSI1PK</code>, <code>GSI5SK</code>) in <code>toPersistence()</code> — OneTable value templates handle them.',
      'Don\'t include <code>updatedAt</code> — <code>timestamps: true</code> auto-manages it. Including it can overwrite with stale values.',
      'The conditional spread <code>...(userId && { userId })</code> is critical — passing <code>userId: null</code> to <code>create()</code> breaks ID generation.',
    ],
  },

  // 09 — Prisma Aggregate Save (Transaction)
  {
    id: '09-prisma-aggregate',
    label: 'Advanced Patterns',
    title: 'Aggregate Save with $transaction',
    desc: 'Prisma repositories save aggregate roots (parent + children) atomically using $transaction.',
    complexity: { level: 4, text: 'Advanced' },
    spec: {
      title: 'Transactional Aggregate Persistence',
      body: `
        <p>When an aggregate root owns child entities (Order → OrderItems + OrderPayment), all changes must be saved <strong>atomically</strong>.</p>
        <p>The pattern:</p>
        <ol>
          <li><strong>Update path:</strong> Update parent, delete all children, re-create children</li>
          <li><strong>Create path:</strong> Create parent, then create children with the new parent ID</li>
          <li>All inside <code>$transaction</code> — if any step fails, nothing is committed</li>
        </ol>
        <p><strong>Why delete + re-create?</strong> Selective upserts are complex and error-prone for collections. Delete-all + create-many is simpler and correct for bounded collections (&lt;100 items).</p>
      `,
    },
    code: {
      subtitle: 'prisma-order.repository.ts',
      content: `async save(order: Order): Promise<Order> {
  const orderId = order.getOrderId();

  if (orderId) {
    // Update existing order using a transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Update order metadata
      await tx.order.update({
        where: { orderId },
        data: {
          customerId: order.getCustomerId(),
          orderStatus: order.getOrderStatus(),
          totalAmount: order.getTotalAmount(),
        },
      });

      // 2. Delete existing items and payment
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.orderPayment.deleteMany({ where: { orderId } });

      // 3. Re-create items
      const items = order.getItems();
      if (items.length > 0) {
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId,
            productId: item.getProductId(),
            productName: item.getProductName(),
            quantity: item.getQuantity(),
            price: item.getPrice(),
            latestKnownPrice: item.getLatestKnownPrice(),
          })),
        });
      }

      // 4. Create payment if exists
      const payment = order.getPayment();
      if (payment) {
        await tx.orderPayment.create({
          data: {
            orderId,
            paymentMethod: payment.getPaymentMethod(),
            paymentStatus: payment.getPaymentStatus(),
            amount: payment.getAmount(),
            transactionId: payment.getTransactionId(),
          },
        });
      }
    });

    return this.findById(orderId) as Promise<Order>;
  }

  // Create path — similar but with tx.order.create first
  // ...
}`,
    },
    concepts: ['$transaction for atomicity', 'Delete + re-create for children', 'Parent first, children second', 'Re-fetch after save for consistency', 'Bounded collections only'],
    pitfalls: [
      'Never save children outside the transaction — partial saves corrupt the aggregate.',
      'Delete + re-create resets child auto-increment IDs. Use <code>@default(uuid())</code> to avoid issues.',
      'The <code>tx</code> client inside <code>$transaction</code> is a different instance — do not use <code>this.prisma</code> inside.',
      'For unbounded collections (>1000 items), consider batch operations or a different strategy.',
    ],
  },

  // 10 — DynamoDB Schema
  {
    id: '10-dynamo-schema',
    label: 'Schema Design',
    title: 'OneTable Schema Definition',
    desc: 'The schema defines models, indexes, value templates, and data types — driving all repository queries.',
    complexity: { level: 4, text: 'Advanced' },
    spec: {
      title: 'DynamoDB OneTable Schema',
      body: `
        <p>The schema is the <strong>single source of truth</strong> for your DynamoDB table structure. It defines:</p>
        <ul>
          <li><strong>Indexes:</strong> Primary key + GSIs with hash/sort key names</li>
          <li><strong>Models:</strong> Entity schemas with types, required flags, enums, and defaults</li>
          <li><strong>Value templates:</strong> <code>GSI1PK: { value: 'USER#\${userRole}#\${userStatus}' }</code></li>
          <li><strong>Params:</strong> <code>isoDates: true</code>, <code>timestamps: true</code></li>
        </ul>
        <p><strong>Key insight:</strong> Value templates auto-compute GSI keys from entity data. You never set them manually in <code>toPersistence()</code>.</p>
        <p>The exported <code>Entity&lt;typeof Schema.models.User&gt;</code> type provides the <code>UserDataType</code> used throughout the repository.</p>
      `,
    },
    code: {
      subtitle: 'UserSchema.ts',
      content: `import { Entity } from "dynamodb-onetable";
import { USER_ROLES, USER_STATUSES } from '../../domain/constants';

export const UserSchema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
    GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' },
    GSI4: { hash: 'GSI4PK' },
    GSI5: { hash: 'GSI5PK', sort: 'GSI5SK' },
  },
  models: {
    User: {
      PK: { type: String, value: 'USER', hidden: false },
      SK: { type: String, value: '\${userId}', hidden: false },
      userId: { type: String, generate: 'ulid' },
      email: { type: String, required: true },
      userRole: { type: String, enum: USER_ROLES, required: true },
      userStatus: { type: String, enum: USER_STATUSES, required: true },
      // GSI value templates — auto-computed from data fields
      GSI1PK: { type: String, value: 'USER#\${userRole}#\${userStatus}', hidden: false },
      GSI1SK: { type: String, value: '\${email}', hidden: false },
      GSI4PK: { type: String, value: 'USER#\${email}', hidden: false },
      GSI5PK: { type: String, value: 'USER#\${userStatus}', hidden: false },
      GSI5SK: { type: String, value: '\${email}', hidden: false },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      emailVerified: { type: Boolean, default: false },
      dateCreated: { type: String },
      data: { type: Object, default: {} },
    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};

export type UserDataType = Entity<typeof UserSchema.models.User>;`,
    },
    concepts: ['Value templates for GSI keys', 'Domain constants for enum validation', 'generate: "ulid" for auto-IDs', 'as const for type inference', 'Entity<> type export'],
    pitfalls: [
      '<code>hidden: false</code> on GSI fields is required for <code>pageRecordHandler</code> — it needs these fields in query results.',
      'Value templates reference field names, not the data. <code>\\${email}</code> means "the email field value".',
      'Domain constants (<code>USER_ROLES</code>) must be arrays for OneTable\'s <code>enum</code> validation.',
      'Adding a new GSI requires updating both the schema AND <code>scripts/setup-localstack.ts</code>.',
    ],
  },
];

// ─── HTML Generation ─────────────────────────────────────────────────────────

function generateNavLinks() {
  return modules.map(m =>
    `    <a href="#${m.id}">${m.title.split(' ')[0]}</a>`
  ).join('\n');
}

function generateOverviewCards() {
  return modules.map((m, i) =>
    `    <a class="intro-card" href="#${m.id}" style="text-decoration:none; color:inherit;">
      <div class="num">Level ${m.complexity.level} · #${String(i + 1).padStart(2, '0')}</div>
      <div class="name">${m.title}</div>
      <div class="desc">${m.desc}</div>
    </a>`
  ).join('\n');
}

function generateModuleSection(m) {
  return `
<section class="module" id="${m.id}">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">${m.label}</div>
        <h2>${m.title}</h2>
        <p class="module-desc">${m.desc}</p>
      </div>
      <span class="complexity l${m.complexity.level}">${m.complexity.text}</span>
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
  <title>Infrastructure Layer Masterclass</title>
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
.complexity.l5 { background:#f3e8ff; color:#6b21a8; }
.complexity.l6 { background:#fce7f3; color:#9d174d; }
[data-theme="dark"] .complexity.l1 { background:#14532d; color:#bbf7d0; }
[data-theme="dark"] .complexity.l2 { background:#1e3a5f; color:#93c5fd; }
[data-theme="dark"] .complexity.l3 { background:#78350f; color:#fef3c7; }
[data-theme="dark"] .complexity.l4 { background:#7c2d12; color:#fed7aa; }
[data-theme="dark"] .complexity.l5 { background:#581c87; color:#e9d5ff; }
[data-theme="dark"] .complexity.l6 { background:#831843; color:#fbcfe8; }
.split { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:20px; margin:24px 0; align-items:stretch; }
.split > .panel { display:flex; flex-direction:column; }
.panel { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow-sm); }
.panel-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; background:var(--bg-alt); }
.panel-header .icon { font-size:1rem; }
.panel-header .title { font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text); }
.panel-header .subtitle { font-size:0.75rem; color:var(--text-muted); margin-left:auto; font-family:var(--mono); }
.panel-body { padding:20px 24px; flex:1; overflow:auto; }
.panel-body.code-body { padding:0; background:var(--bg-code); }
.panel-body.code-body pre { margin:0; padding:18px 20px; background:transparent; border-radius:0; font-size:0.78rem; line-height:1.55; max-height:680px; color:#cdd6f4; overflow:auto; }
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
pre .kw { color:#c084fc; }
pre .str { color:#a7f3d0; }
pre .com { color:#64748b; font-style:italic; }
pre .ty { color:#7dd3fc; }
pre .fn { color:#fde68a; }
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
@media print { .top-nav, .scroll-progress, .theme-toggle, .hamburger { display:none !important; } .hero { padding-top:40px; } .module { padding:32px 0; break-inside:avoid; } .split { grid-template-columns:1fr; } }
@media (max-width:1024px) { .split { grid-template-columns:1fr; } }
@media (max-width:768px) { .nav-links { display:none; } .nav-links.open { display:flex; flex-direction:column; position:absolute; top:60px; left:0; right:0; background:var(--bg-nav); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); padding:12px; z-index:999; } .hamburger { display:flex; } .hero h1 { font-size:2rem; } .hero .lead { font-size:1rem; } .hero-meta { flex-direction:column; gap:8px; } .module { padding:40px 16px; } }
  </style>
</head>
<body>
<div class="scroll-progress" id="scrollProgress"></div>
<nav class="top-nav" id="topNav">
  <a href="#" class="nav-brand">Infrastructure Layer</a>
  <div class="nav-links" id="navLinks">
    <a href="#overview">Overview</a>
${generateNavLinks()}
  </div>
  <div class="nav-controls">
    <button class="theme-toggle" id="themeToggle">🌙</button>
    <button class="hamburger" id="hamburger">☰</button>
  </div>
</nav>

<header class="hero">
  <div class="hero-content">
    <h1>Infrastructure Layer<br>Masterclass</h1>
    <p class="lead">Ten patterns for building persistence repositories — from local model interfaces to cursor pagination to aggregate saves. DynamoDB OneTable and Prisma side by side.</p>
    <div class="hero-meta">
      <span>🗄️ <strong>Clean Architecture · Infrastructure Layer</strong></span>
      <span>📈 <strong>10 Patterns · Foundation → Advanced</strong></span>
      <span>✅ <strong>Real code from this repo</strong></span>
    </div>
  </div>
</header>

<section class="module" id="overview">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">Overview</div>
        <h2>10 patterns, foundation → advanced</h2>
        <p class="module-desc">Each pattern pairs a written explanation with real repository code. Patterns build on each other: interface → CRUD → queries → pagination → mapping → aggregates → schemas.</p>
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
  const toggle = document.getElementById('themeToggle');
  const setTheme = (dark) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    toggle.textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('infra-masterclass-theme', dark ? 'dark' : 'light');
  };
  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(!isDark);
  });
  const saved = localStorage.getItem('infra-masterclass-theme');
  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) setTheme(true);

  const progressBar = document.getElementById('scrollProgress');
  const topNav = document.getElementById('topNav');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('.module');

  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
    topNav.classList.toggle('scrolled', scrollTop > 10);
    let current = '';
    sections.forEach(s => { if (scrollTop >= s.offsetTop - 120) current = s.id; });
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  };
  window.addEventListener('scroll', update, { passive: true });

  const hamburger = document.getElementById('hamburger');
  const navLinksEl = document.getElementById('navLinks');
  hamburger.addEventListener('click', () => navLinksEl.classList.toggle('open'));
  navLinksEl.addEventListener('click', (e) => { if (e.target.tagName === 'A') navLinksEl.classList.remove('open'); });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
})();
</script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const html = generateHtml();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, html, 'utf-8');
console.log(`✅ Generated: ${OUTPUT_PATH}`);
console.log(`   Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
