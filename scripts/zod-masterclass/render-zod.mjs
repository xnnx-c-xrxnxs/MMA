// Zod-masterclass-specific renderers. Reuses esc/highlightTs/renderCodePanel
// from the entity masterclass. Adds:
//   - renderZodModule: side-by-side ENTITY (left) | three stacked schemas (right)
//   - renderHero (custom heading)
//   - renderIntroGrid (overview cards)
//   - renderTopicsModule (intro discussion of Zod fundamentals)
//   - renderCheatSheet (final reference module)

import { esc, highlightTs, renderCodePanel } from '../masterclass/render.mjs';

export const EXTRA_CSS = `
/* Right column = three stacked schema panels */
.schemas-stack { display:flex; flex-direction:column; gap:14px; }
.schemas-stack .panel { box-shadow:none; }
.schemas-stack .panel-header { padding:10px 16px; }
.schemas-stack .panel-body.code-body pre { font-size:0.74rem; max-height:340px; }

/* Discussion / topic block */
.discussion { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:22px 26px; margin-top:24px; }
.discussion h4 { font-size:1.05rem; font-weight:700; margin:18px 0 8px; color:var(--text); }
.discussion h4:first-child { margin-top:0; }
.discussion p { font-size:0.94rem; margin-bottom:10px; }
.discussion ul { padding-left:20px; margin-bottom:12px; font-size:0.92rem; }
.discussion li { margin-bottom:4px; }
.discussion code { font-size:0.84em; }

/* Topic callouts */
.callout { padding:14px 18px; border-radius:var(--radius-sm); border-left:4px solid var(--info); background:var(--info-bg); margin:14px 0; font-size:0.92rem; }
.callout.success { border-left-color:var(--success); background:var(--success-bg); }
.callout.warning { border-left-color:var(--warning); background:var(--warning-bg); }
.callout strong { display:block; margin-bottom:4px; }

/* Cheat sheet */
.cheat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:16px; }
.cheat-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:16px 18px; }
.cheat-card h4 { font-size:0.9rem; font-weight:700; margin-bottom:10px; color:var(--accent); }
.cheat-card pre { background:var(--bg-code); color:var(--bg-code-text); padding:12px; border-radius:8px; font-size:0.74rem; overflow-x:auto; }
.cheat-card code { background:none; padding:0; color:inherit; }

/* Foundations / vs panels */
.vs { display:grid; grid-template-columns:1fr auto 1fr; gap:14px; align-items:stretch; margin:16px 0; }
.vs-side .panel-header { font-size:0.78rem; }
.vs-divider { display:flex; align-items:center; justify-content:center; font-weight:800; color:var(--text-muted); font-size:0.85rem; padding:0 6px; }
@media (max-width:900px) { .vs { grid-template-columns:1fr; } .vs-divider { padding:6px 0; } }
`;

/** Render the right-hand stack: 3 (or N) schema panels stacked vertically. */
function renderSchemaStack(schemas) {
  const panels = schemas.map((s) =>
    renderCodePanel({
      icon: s.icon || '🔍',
      title: s.title,
      subtitle: s.subtitle || '',
      code: s.code,
    }),
  ).join('\n');
  return `<div class="schemas-stack">${panels}</div>`;
}

/**
 * Render one Zod-masterclass module.
 * @param {object} m
 * @param {string} m.id, m.title, m.domain, m.intro
 * @param {number} m.level
 * @param {string} m.complexityLabel
 * @param {string} m.entityFilename
 * @param {string} m.entityCode             — left panel: real domain entity
 * @param {Array<{title:string,subtitle?:string,code:string,icon?:string}>} m.schemas — right column
 * @param {string[]} [m.zodTopics]          — pill list under the split
 * @param {string} [m.discussionHtml]       — body-text section after the split (HTML)
 */
export function renderZodModule(m) {
  const topics = (m.zodTopics || []).map((t) => `<span class="concept-pill">✦ ${esc(t)}</span>`).join('');

  return `<section class="module" id="${m.id}">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">${esc(m.domain)} Domain</div>
        <h2>${esc(m.title)}</h2>
        <p class="module-desc">${esc(m.intro)}</p>
      </div>
      <span class="complexity l${m.level}">${esc(m.complexityLabel)}</span>
    </div>

    <div class="split fade-in">
      ${renderCodePanel({ icon: '📦', title: 'Domain Entity', subtitle: m.entityFilename, code: m.entityCode })}
      ${renderSchemaStack(m.schemas)}
    </div>

    ${topics ? `<div class="concepts fade-in">${topics}</div>` : ''}
    ${m.discussionHtml ? `<div class="discussion fade-in">${m.discussionHtml}</div>` : ''}
  </div>
</section>`;
}

export function renderHero({ title, lead, meta }) {
  const metaHtml = meta.map((m) => `<span>${m}</span>`).join('\n      ');
  return `<header class="hero">
  <div class="hero-content">
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
    <div class="hero-meta">${metaHtml}</div>
  </div>
</header>`;
}

export function renderIntroGrid(modules) {
  const cards = modules.map((m, i) => `
    <a class="intro-card" href="#${m.id}" style="text-decoration:none; color:inherit;">
      <div class="num">Level ${m.level} · #${String(i + 1).padStart(2, '0')}</div>
      <div class="name">${esc(m.title)}</div>
      <div class="desc">${esc(m.introShort || m.intro)}</div>
    </a>`).join('');
  return `<section class="module" id="overview">
    <div class="module-inner">
      <div class="module-header fade-in">
        <div class="module-meta">
          <div class="module-label">Overview</div>
          <h2>Real entities, real schemas</h2>
          <p class="module-desc">Each module pairs a production domain entity with the three Zod schemas the API exposes for it: <code>create</code>, <code>update</code>, and <code>response</code>. Zod patterns layer up alongside entity complexity — primitives → enums → arrays → discriminated unions → cross-field refinements.</p>
        </div>
      </div>
      <div class="intro-grid">${cards}</div>
    </div>
  </section>`;
}

/** Foundations: parse vs safeParse, z.infer, where Zod fits, ZodValidationPipe. */
export function renderTopicsModule({ id, label, title, desc, body }) {
  return `<section class="module" id="${id}">
    <div class="module-inner">
      <div class="module-header fade-in">
        <div class="module-meta">
          <div class="module-label">${esc(label)}</div>
          <h2>${esc(title)}</h2>
          <p class="module-desc">${esc(desc)}</p>
        </div>
      </div>
      <div class="discussion fade-in">${body}</div>
    </div>
  </section>`;
}

/** A vertical-stack alternative for showing two snippets side by side ("manual vs zod"). */
export function renderVs({ leftTitle, leftCode, rightTitle, rightCode }) {
  return `<div class="vs">
    <div class="vs-side">${renderCodePanel({ icon: '🛠️', title: leftTitle, code: leftCode })}</div>
    <div class="vs-divider">vs</div>
    <div class="vs-side">${renderCodePanel({ icon: '⚡', title: rightTitle, code: rightCode })}</div>
  </div>`;
}

export function renderCheatSheet() {
  const card = (title, code) => `<div class="cheat-card"><h4>${esc(title)}</h4><pre><code>${highlightTs(esc(code))}</code></pre></div>`;
  return `<section class="module" id="cheat-sheet">
    <div class="module-inner">
      <div class="module-header fade-in">
        <div class="module-meta">
          <div class="module-label">Reference</div>
          <h2>Cheat sheet</h2>
          <p class="module-desc">Every Zod construct used across the 9 entity modules, in one place.</p>
        </div>
      </div>
      <div class="cheat-grid fade-in">
${card('Primitives', `z.string()
z.number()
z.boolean()
z.date()
z.literal('SUCCESS')
z.unknown()                  // safer than z.any()`)}
${card('String validators', `z.string().email()
z.string().uuid()
z.string().url()
z.string().datetime()        // ISO 8601
z.string().min(1).max(200)
z.string().regex(/^[A-Z]/)`)}
${card('Number validators', `z.number().int()
z.number().positive()        // > 0
z.number().min(0)            // >= 0
z.number().min(1).max(100)
z.coerce.number()            // "42" -> 42 (query params!)`)}
${card('Objects', `z.object({ id: z.string() })
schema.optional()            // T | undefined
schema.nullable()            // T | null
schema.default('USER')
schema.partial()             // all fields optional
schema.pick({ a: true })
schema.omit({ b: true })
schema.extend({ age: z.number() })`)}
${card('Arrays & tuples', `z.array(itemSchema)
z.array(itemSchema).min(1)   // non-empty
z.array(itemSchema).max(50)
z.tuple([z.string(), z.number()])`)}
${card('Enums (from domain)', `import { USER_STATUSES } from '@mma/user-domain';

z.enum(USER_STATUSES)        // 'PENDING' | 'ACTIVE' | ...
// NOT z.enum(['PENDING','ACTIVE',...])  <- duplicates source of truth`)}
${card('Discriminated unions', `z.discriminatedUnion('type', [
  z.object({ type: z.literal('SUCCESS'), tokens: tokensSchema }),
  z.object({ type: z.literal('NEW_PASSWORD_REQUIRED'), session: z.string() }),
])`)}
${card('Cross-field refinements', `createOrderSchema.refine(
  (o) => o.items.every((i) => i.quantity > 0),
  { message: 'Quantities must be positive', path: ['items'] },
)`)}
${card('Type inference', `type CreateUserInput = z.infer<typeof createUserSchema>;
type UserResponse  = z.infer<typeof userResponseSchema>;
// schema is the single source of truth — no hand-written interface`)}
${card('Parsing', `schema.parse(data)         // throws ZodError on failure
schema.safeParse(data)     // { success, data | error }
// parse: DTO mapping in app services
// safeParse: validation pipes, SQS handlers`)}
${card('Composition (generic)', `const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursorPointer: z.string().optional(),
  });

const paginatedUsers = paginated(userResponseSchema);`)}
${card('NestJS pipe', `@Post()
createUser(
  @Body(new ZodValidationPipe(createUserSchema))
  body: CreateUserInput,
) { ... }`)}
      </div>
    </div>
  </section>`;
}
