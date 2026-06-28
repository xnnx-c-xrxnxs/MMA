// Pure rendering helpers — no I/O. Each renderer takes a plain data object and returns HTML.

/** Escape HTML in code blocks. */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Lightweight, additive TypeScript syntax highlighter.
 * Single-pass tokenizer over the already-escaped source so a span emitted
 * for one token never gets re-matched as another (e.g. "com" inside a
 * comment span being mis-tagged as a string).
 */
export function highlightTs(escapedCode) {
  const KEYWORDS = new Set([
    'class', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'switch', 'case', 'break', 'continue', 'new', 'this', 'private', 'public', 'protected',
    'readonly', 'static', 'async', 'await', 'throw', 'try', 'catch', 'finally', 'extends',
    'implements', 'import', 'from', 'export', 'default', 'true', 'false', 'null', 'undefined',
    'typeof', 'instanceof', 'in', 'of', 'as', 'interface', 'type', 'enum', 'void', 'never',
  ]);
  const TYPES = new Set(['string', 'number', 'boolean', 'Date', 'Array', 'Promise', 'Record', 'Partial']);

  // Token order matters — comments and strings win over identifiers.
  // Note: source is HTML-escaped, so '<' is '&lt;' etc. — the patterns operate on
  // ASCII characters that survive escaping (//, /*, ', ", `, word-chars, digits).
  const TOKEN = new RegExp([
    '(\\/\\/[^\\n]*)',                      // 1: line comment
    '(\\/\\*[\\s\\S]*?\\*\\/)',             // 2: block comment
    "('(?:\\\\.|[^'\\\\\\n])*')",           // 3: single-quoted string
    '("(?:\\\\.|[^"\\\\\\n])*")',           // 4: double-quoted string
    '(`(?:\\\\.|[^`\\\\])*`)',              // 5: template literal
    '(\\b\\d+(?:\\.\\d+)?\\b)',             // 6: number
    '(\\b[A-Za-z_$][A-Za-z0-9_$]*\\b)',     // 7: identifier (keyword/type/other)
  ].join('|'), 'g');

  let out = '';
  let last = 0;
  let m;
  while ((m = TOKEN.exec(escapedCode)) !== null) {
    out += escapedCode.slice(last, m.index);
    if (m[1] || m[2]) out += `<span class="com">${m[0]}</span>`;
    else if (m[3] || m[4] || m[5]) out += `<span class="str">${m[0]}</span>`;
    else if (m[6]) out += `<span class="num">${m[0]}</span>`;
    else if (m[7]) {
      const id = m[7];
      if (KEYWORDS.has(id)) out += `<span class="kw">${id}</span>`;
      else if (TYPES.has(id)) out += `<span class="ty">${id}</span>`;
      else out += id;
    }
    last = m.index + m[0].length;
  }
  out += escapedCode.slice(last);
  return out;
}

/** Render a code block with optional filename header. */
export function renderCodePanel({ icon = '⚙️', title, subtitle, code }) {
  const highlighted = highlightTs(esc(code.trimEnd()));
  return `<div class="panel">
  <div class="panel-header">
    <span class="icon">${icon}</span>
    <span class="title">${esc(title)}</span>
    ${subtitle ? `<span class="subtitle">${esc(subtitle)}</span>` : ''}
  </div>
  <div class="panel-body code-body"><pre><code>${highlighted}</code></pre></div>
</div>`;
}

/** Render the spec panel (left side). Spec body is HTML — author writes lists with <ul><li>. */
export function renderSpecPanel({ title, bodyHtml }) {
  return `<div class="panel">
  <div class="panel-header">
    <span class="icon">📋</span>
    <span class="title">Specification</span>
    <span class="subtitle">plain English</span>
  </div>
  <div class="panel-body">
    <div class="spec-title">${esc(title)}</div>
    <div class="spec-body">${bodyHtml}</div>
  </div>
</div>`;
}

/**
 * Render one masterclass module (one entity example).
 * @param {object} entity
 * @param {string} entity.id              - anchor id, e.g. "01-category"
 * @param {number} entity.level           - 1..6 complexity tier (drives badge color)
 * @param {string} entity.complexityLabel - e.g. "L1 — Pure data"
 * @param {string} entity.domain          - e.g. "Catalog"
 * @param {string} entity.title           - e.g. "Category"
 * @param {string} entity.intro           - one-paragraph intro (plain text)
 * @param {string} entity.specTitle
 * @param {string} entity.specBodyHtml
 * @param {string} entity.entityFilename  - e.g. "category.entity.ts"
 * @param {string} entity.entityCode
 * @param {string[]} [entity.concepts]    - bullet pills under the split
 * @param {string} [entity.exceptionsFilename]
 * @param {string} [entity.exceptionsCode]
 * @param {string[]} [entity.pitfalls]
 */
export function renderModule(entity) {
  const concepts = (entity.concepts || []).map((c) => `<span class="concept-pill">✦ ${esc(c)}</span>`).join('');
  const pitfalls = entity.pitfalls && entity.pitfalls.length
    ? `<div class="pitfalls">
        <div class="pitfalls-title">⚠️ Common pitfalls</div>
        <ul>${entity.pitfalls.map((p) => `<li>${p}</li>`).join('')}</ul>
      </div>`
    : '';
  const exceptions = entity.exceptionsCode
    ? `<div class="exceptions">
        <div class="exceptions-header">🚫 Domain exceptions thrown</div>
        ${renderCodePanel({ icon: '🚫', title: 'Exceptions', subtitle: entity.exceptionsFilename || '', code: entity.exceptionsCode })}
      </div>`
    : '';

  return `<section class="module" id="${entity.id}">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">${esc(entity.domain)} Domain</div>
        <h2>${esc(entity.title)}</h2>
        <p class="module-desc">${esc(entity.intro)}</p>
      </div>
      <span class="complexity l${entity.level}">${esc(entity.complexityLabel)}</span>
    </div>

    <div class="split fade-in">
      ${renderSpecPanel({ title: entity.specTitle, bodyHtml: entity.specBodyHtml })}
      ${renderCodePanel({ icon: '📦', title: 'Entity', subtitle: entity.entityFilename, code: entity.entityCode })}
    </div>

    ${concepts ? `<div class="concepts fade-in">${concepts}</div>` : ''}
    ${exceptions ? `<div class="fade-in">${exceptions}</div>` : ''}
    ${pitfalls}
  </div>
</section>`;
}

/**
 * Parse an entityCode/exceptionsCode block that contains both an OLD TEMPLATE
 * and a NEW TEMPLATE section separated by comment headers.
 * Returns { old, oldLabel, new, newLabel, hasOld }.
 */
function splitComparison(code) {
  const lines = code.split('\n');
  const oldLines = [];
  const newLines = [];
  let inOld = false;
  let inNew = false;
  let oldLabel = 'Before · old template';
  let newLabel = 'After · new template';

  for (const line of lines) {
    // Match:  //  OLD TEMPLATE — some/path.ts  (one or two spaces after //)
    const oldM = line.match(/\/\/\s+OLD TEMPLATE(?:\s+[—–]\s+(.+))?/);
    if (oldM) { inOld = true; inNew = false; if (oldM[1]) oldLabel = oldM[1].trim(); continue; }

    // Match:  //  NEW TEMPLATE — some/path.ts
    const newM = line.match(/\/\/\s+NEW TEMPLATE(?:\s+[—–]\s+(.+))?/);
    if (newM) { inOld = false; inNew = true; if (newM[1]) newLabel = newM[1].trim(); continue; }

    // Skip separator lines made of ─ or ═ characters (Unicode box-drawing)
    if (/^\/\/ [─═]{8,}/.test(line)) continue;

    if (inOld) {
      // Strip the leading "// " (or "//" with no space) comment prefix
      oldLines.push(line.replace(/^\/\/ ?/, ''));
    } else if (inNew) {
      newLines.push(line);
    }
  }

  return {
    old: oldLines.join('\n').trimEnd(),
    oldLabel,
    new: newLines.join('\n').trimEnd(),
    newLabel,
    hasOld: oldLines.some((l) => l.trim().length > 0),
  };
}

/**
 * Render a side-by-side comparison module.
 * entityCode must contain both an OLD TEMPLATE and a NEW TEMPLATE section.
 * exceptionsCode (optional) is rendered below — as a second comparison pair if it
 * also has both sections, or as a single full-width "After" panel otherwise.
 */
export function renderComparisonModule(entity) {
  function comparisonGrid(parts) {
    const oldHl = highlightTs(esc(parts.old.trimEnd()));
    const newHl = highlightTs(esc(parts.new.trimEnd()));
    return `<div class="comparison-grid fade-in">
  <div class="panel panel-before">
    <div class="panel-header">
      <span class="icon">⚠️</span>
      <span class="title">Before</span>
      <span class="subtitle">${esc(parts.oldLabel)}</span>
    </div>
    <div class="panel-body code-body"><pre><code>${oldHl}</code></pre></div>
  </div>
  <div class="panel panel-after">
    <div class="panel-header">
      <span class="icon">✅</span>
      <span class="title">After</span>
      <span class="subtitle">${esc(parts.newLabel)}</span>
    </div>
    <div class="panel-body code-body"><pre><code>${newHl}</code></pre></div>
  </div>
</div>`;
  }

  const concepts = (entity.concepts || [])
    .map((c) => `<span class="concept-pill">✦ ${esc(c)}</span>`)
    .join('');
  const pitfalls =
    entity.pitfalls && entity.pitfalls.length
      ? `<div class="pitfalls">
        <div class="pitfalls-title">⚠️ Common pitfalls</div>
        <ul>${entity.pitfalls.map((p) => `<li>${p}</li>`).join('')}</ul>
      </div>`
      : '';

  // Primary split (entityCode)
  const primary = splitComparison(entity.entityCode);

  // Secondary section (exceptionsCode — optional)
  let secondary = '';
  if (entity.exceptionsCode) {
    const sec = splitComparison(entity.exceptionsCode);
    const secHeader = `<div class="comparison-section-header fade-in">${esc(entity.exceptionsFilename || 'Additional Example')}</div>`;
    if (sec.hasOld) {
      // Has its own old/new split
      secondary = `\n    ${secHeader}\n    ${comparisonGrid(sec)}`;
    } else {
      // New-code-only panel (e.g. a companion file like providers.tsx)
      secondary = `\n    ${secHeader}\n    <div class="fade-in">${renderCodePanel({
        icon: '✅',
        title: entity.exceptionsFilename || 'Additional',
        subtitle: '',
        code: entity.exceptionsCode,
      })}</div>`;
    }
  }

  return `<section class="module" id="${entity.id}">
  <div class="module-inner">
    <div class="module-header fade-in">
      <div class="module-meta">
        <div class="module-label">${esc(entity.domain)} Domain</div>
        <h2>${esc(entity.title)}</h2>
        <p class="module-desc">${esc(entity.intro)}</p>
      </div>
      <span class="complexity l${entity.level}">${esc(entity.complexityLabel)}</span>
    </div>

    <div class="fade-in">
      ${renderSpecPanel({ title: entity.specTitle, bodyHtml: entity.specBodyHtml })}
    </div>

    ${comparisonGrid(primary)}
    ${secondary}

    ${concepts ? `<div class="concepts fade-in">${concepts}</div>` : ''}
    ${pitfalls}
  </div>
</section>`;
}

export function renderHero({ title, lead, meta }) {
  const metaHtml = meta.map((m) => `<span>${m}</span>`).join('\n      ');
  return `<header class="hero">
  <div class="hero-content">
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
    <div class="hero-meta">
      ${metaHtml}
    </div>
  </div>
</header>`;
}

export function renderIntroModule(entities) {
  const cards = entities.map((e, i) => `
    <a class="intro-card" href="#${e.id}" style="text-decoration:none; color:inherit;">
      <div class="num">Level ${e.level} · #${String(i + 1).padStart(2, '0')}</div>
      <div class="name">${esc(e.title)}</div>
      <div class="desc">${esc(e.introShort || e.intro)}</div>
    </a>`).join('');
  return `<section class="module" id="overview">
    <div class="module-inner">
      <div class="module-header fade-in">
        <div class="module-meta">
          <div class="module-label">Overview</div>
          <h2>${entities.length} modules, foundation → advanced</h2>
          <p class="module-desc">Each module pairs a spec panel with real implementation code — comparing the old template pattern against the new. Concepts build up: architecture → file structure → SSG → data access → UI primitives → pages → auth → forms → components.</p>
        </div>
      </div>
      <div class="intro-grid">${cards}</div>
    </div>
  </section>`;
}
