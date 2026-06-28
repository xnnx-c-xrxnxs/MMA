// Build script for the Zod Masterclass HTML page.
// Run with:  node scripts/zod-masterclass/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { renderShell } from '../masterclass/layout.mjs';
import {
  EXTRA_CSS,
  renderHero,
  renderIntroGrid,
  renderTopicsModule,
  renderZodModule,
  renderVs,
  renderCheatSheet,
} from './render-zod.mjs';

import e01 from './entities/01-category.mjs';
import e02 from './entities/02-product-basic.mjs';
import e03 from './entities/03-user.mjs';
import e04 from './entities/04-product-lifecycle.mjs';
import e05 from './entities/05-customer-address.mjs';
import e06 from './entities/06-order-items.mjs';
import e07 from './entities/07-shipment.mjs';
import e08 from './entities/08-order-aggregate.mjs';
import e09 from './entities/09-subscription.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../../docs/tutorial/zod-masterclass.html');

const modules = [e01, e02, e03, e04, e05, e06, e07, e08, e09];

// ───────────────────────────────── Foundations module ─────────────────────────────────
const foundationsBody = `
  <h4>Why Zod, and why three schemas per entity?</h4>
  <p>
    Every entity in this codebase exposes <strong>three Zod schemas</strong>:
    one for <code>POST</code> (<em>create</em>), one for <code>PATCH</code> (<em>update</em>),
    and one for the API <em>response</em>. They are the contract between client and server —
    the same file is imported by the backend pipe that validates the incoming request and by
    the frontend API client that validates the outgoing response. One source of truth, runtime
    checks at both ends, TypeScript types derived for free via <code>z.infer</code>.
  </p>

  <h4>Manual validation vs Zod</h4>
  ${renderVs({
    leftTitle: 'Manual — fragile, redundant',
    leftCode: `interface CreateUserInput {
  email: string;
  firstName: string;
}

function validate(body: any): CreateUserInput {
  if (!body.email) throw new Error('email required');
  if (typeof body.email !== 'string') throw new Error('...');
  if (!body.email.includes('@')) throw new Error('invalid email');
  if (!body.firstName) throw new Error('firstName required');
  if (body.firstName.length > 100) throw new Error('too long');
  // ...20 more lines, then:
  return body as CreateUserInput;          // 😱 unsafe cast
}`,
    rightTitle: 'Zod — schema is the type AND the validator',
    rightCode: `const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

const input = createUserSchema.parse(body);
// fully typed, fully validated, structured error on failure:
// [{ code: 'invalid_string', validation: 'email', path: ['email'], message: '...' }]`,
  })}

  <h4><code>parse</code> vs <code>safeParse</code></h4>
  <ul>
    <li><strong><code>schema.parse(data)</code></strong> — throws <code>ZodError</code> on failure. Use in application services that map entities → DTOs (a malformed entity is a bug; crash and let <code>DomainExceptionFilter</code> turn it into a 500).</li>
    <li><strong><code>schema.safeParse(data)</code></strong> — returns <code>{ success, data | error }</code>. Use in <code>ZodValidationPipe</code> (return 400) and SQS event handlers (skip malformed messages, keep processing the batch).</li>
  </ul>

  <h4>Where Zod fits in the layered architecture</h4>
  <ul>
    <li><strong>Presentation</strong> — <code>ZodValidationPipe</code> validates request bodies and query strings; throws <code>BadRequestException</code> (400) on invalid input.</li>
    <li><strong>Application service</strong> — <code>schema.parse(entity)</code> guarantees the response shape; surfaces accidental field drift immediately.</li>
    <li><strong>Frontend API client</strong> — <code>schema.parse(json)</code> on every response so a backend bug never produces silently broken UI state.</li>
    <li><strong>Domain layer</strong> — <em>no Zod</em>. Domain entities use real domain methods and throw typed domain exceptions. Zod is the perimeter, the entity is the core.</li>
  </ul>

  <div class="callout success">
    <strong>Read the side-by-side modules below as a teaching ladder.</strong>
    Module 1 introduces <code>z.object</code>; module 3 enums from constants; module 6 arrays with bounds; module 8 cross-field <code>.refine()</code>; module 9 discriminated unions. Each entity adds exactly one new Zod pattern.
  </div>
`;

const foundations = renderTopicsModule({
  id: 'foundations',
  label: 'Foundations',
  title: 'Zod in 60 seconds',
  desc: 'The whole story before we walk the 9 entities.',
  body: foundationsBody,
});

// ───────────────────────────────── Page assembly ─────────────────────────────────
const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'foundations', label: 'Foundations' },
  ...modules.map((m, i) => ({ id: m.id, label: `${i + 1}. ${m.title}` })),
  { id: 'cheat-sheet', label: 'Cheat Sheet' },
];

const hero = renderHero({
  title: 'Zod Masterclass<br>One schema, every layer',
  lead: 'Nine real entities from this codebase, each with its three production Zod schemas — create, update, response — alongside the domain entity they validate. Zod patterns layer up from primitives to discriminated unions.',
  meta: [
    '🛡️ <strong>Runtime validation · Compile-time types</strong>',
    '📈 <strong>9 Entities · Simple → Complex</strong>',
    '🔄 <strong>Same schema on backend & frontend</strong>',
  ],
});

const body = [
  renderIntroGrid(modules),
  foundations,
  ...modules.map(renderZodModule),
  renderCheatSheet(),
].join('\n\n');

const html = renderShell({
  title: 'Zod Masterclass — Schema Validation for TypeScript',
  brand: 'Zod Masterclass',
  navItems,
  hero,
  body,
  extraHeadCss: EXTRA_CSS,
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html, 'utf8');
console.log(`✓ wrote ${path.relative(process.cwd(), OUTPUT)} (${(html.length / 1024).toFixed(1)} KB)`);
