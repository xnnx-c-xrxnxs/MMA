#!/usr/bin/env node
/**
 * generate-api-service-masterclass.mjs
 * Generates docs/tutorial/api-service-masterclass.html
 *
 * Run: node scripts/generate-api-service-masterclass.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../docs/tutorial/api-service-masterclass.html');

// ─── Syntax Highlighter ──────────────────────────────────────────────────────

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(code) {
  let out = escapeHtml(code);
  const placeholders = [];
  function ph(html) {
    const i = placeholders.length;
    placeholders.push(html);
    return `\x01PH${i}\x01`;
  }

  // 1. Comments
  out = out.replace(/(\/\/[^\n]*)/g, (m) => ph(`<span class="com">${m}</span>`));
  out = out.replace(/(\/\*\*[\s\S]*?\*\/)/g, (m) => ph(`<span class="com">${m}</span>`));
  // 2. Strings
  out = out.replace(/('[^']*')/g, (m) => ph(`<span class="str">${m}</span>`));
  out = out.replace(/(`[^`]*`)/g, (m) => ph(`<span class="str">${m}</span>`));
  out = out.replace(/("[^"]*")/g, (m) => ph(`<span class="str">${m}</span>`));
  // 3. Decorators
  out = out.replace(/(@[A-Za-z]+\()/g, (m) => ph(`<span class="dec">${m}</span>`));
  out = out.replace(/(@[A-Za-z]+\b)(?!\()/g, (m) => ph(`<span class="dec">${m}</span>`));
  // 4. Keywords
  const kws = ['import','from','export','class','interface','type','const','let','var','function','return','if','else','throw','new','this','extends','implements','async','await','private','public','protected','readonly','abstract','override','void','null','undefined','true','false','for','of','in','continue','break','static','declare','satisfies'];
  const kwRe = new RegExp(`\\b(${kws.join('|')})\\b`, 'g');
  out = out.replace(kwRe, (m) => ph(`<span class="kw">${m}</span>`));
  // 5. Types
  const types = ['string','number','boolean','Promise','User','Order','OrderItem','OrderPayment','Product','ProductCategory','Category','IPaginatedResponse','IOffsetPaginatedResponse','IUseCase','IEventPublisher','IUserRepository','IOrderRepository','IProductRepository','ICategoryRepository','ICustomerValidator','UserRole','UserStatus','OrderStatus','ProductStatus','PaymentMethod','ValidatedCustomer','UserResponse','OrderResponse','ProductResponse','CreateUserInput','UpdateUserInput','CreateOrderInput','CreateProductInput','UserDomainEvent','OrderDomainEvent','ProductDomainEvent','ZodValidationPipe','DomainExceptionFilter','UserApplicationService','OrderApplicationService','ProductApplicationService','CreateUserUseCase','GetUserByIdUseCase','ActivateUserUseCase','DeactivateUserUseCase','VerifyUserEmailUseCase','CreateOrderUseCase','GetOrderByIdUseCase','ConfirmOrderUseCase','CancelOrderUseCase','Table','AuthenticatedUser','Injectable','Controller','Module','Get','Post','Patch','Delete','Body','Param','Query','HttpCode','HttpStatus'];
  const tyRe = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
  out = out.replace(tyRe, (m) => ph(`<span class="ty">${m}</span>`));
  // 6. Numbers
  out = out.replace(/\b(\d+)\b/g, (m) => ph(`<span class="num">${m}</span>`));
  // 7. Restore
  out = out.replace(/\x01PH(\d+)\x01/g, (_, idx) => placeholders[parseInt(idx)]);
  return out;
}

// ─── Component Builders ──────────────────────────────────────────────────────

function codeBlock(code, label = '') {
  return `<div class="code-wrap">${label ? `<div class="code-label">${label}</div>` : ''}<pre><code>${highlight(code)}</code></pre></div>`;
}

function callout(type, title, body) {
  return `<div class="callout callout-${type}"><div class="callout-title">${title}</div>${body}</div>`;
}

function badge(text, color = 'accent') {
  return `<span class="badge badge-${color}">${text}</span>`;
}

function layerDiagram() {
  return `
<div class="layer-diagram">
  <div class="layer layer-presentation">
    <div class="layer-label">Presentation</div>
    <div class="layer-items">
      <span>Controller</span><span>ZodValidationPipe</span><span>DomainExceptionFilter</span><span>JwtAuthGuard</span><span>@CurrentUser()</span>
    </div>
  </div>
  <div class="layer-arrow">↓ calls Application Service (never Use Cases directly)</div>
  <div class="layer layer-application">
    <div class="layer-label">Application</div>
    <div class="layer-items">
      <span>ApplicationService</span><span>Use Cases</span><span>IEventPublisher</span>
    </div>
  </div>
  <div class="layer-arrow">↓ calls Domain Entities + Repository Interface</div>
  <div class="layer layer-domain">
    <div class="layer-label">Domain</div>
    <div class="layer-items">
      <span>Entities</span><span>Constants</span><span>Domain Exceptions</span><span>Domain Events</span>
    </div>
  </div>
  <div class="layer-arrow">↓ implemented by Infrastructure</div>
  <div class="layer layer-infra">
    <div class="layer-label">Infrastructure</div>
    <div class="layer-items">
      <span>DynamoRepository</span><span>PrismaRepository</span><span>DynamoDBConfig</span><span>PrismaConfig</span><span>SqsEventPublisher</span>
    </div>
  </div>
</div>`;
}

function stepList(steps) {
  return `<ol class="step-list">${steps.map((s, i) => `<li><span class="step-num">${i + 1}</span><div>${s}</div></li>`).join('')}</ol>`;
}

function twoCol(left, right) {
  return `<div class="two-col">${left}${right}</div>`;
}

function sectionHeader(num, emoji, title, desc) {
  return `<div class="section-header">
  <div class="section-num">${num}</div>
  <div>
    <h2>${emoji} ${title}</h2>
    <p class="section-desc">${desc}</p>
  </div>
</div>`;
}

function ruleCard(rule, title, body) {
  return `<div class="rule-card"><div class="rule-num">Rule #${rule}</div><h4>${title}</h4>${body}</div>`;
}

function flowChart(items) {
  return `<div class="flow-chart">${items.map((item, i) => `
  <div class="flow-item">
    <div class="flow-box ${item.type || ''}">${item.label}</div>
    ${i < items.length - 1 ? '<div class="flow-arrow">↓</div>' : ''}
  </div>`).join('')}</div>`;
}

function errorMap(errors) {
  return `<table class="error-table">
  <thead><tr><th>Exception Class</th><th>HTTP Status</th><th>Scenario</th></tr></thead>
  <tbody>${errors.map(e => `<tr><td><code>${e[0]}</code></td><td class="status-${e[1] < 500 ? (e[1] < 400 ? 'ok' : (e[1] === 409 ? 'conflict' : 'bad')) : 'err'}">${e[1]}</td><td>${e[2]}</td></tr>`).join('')}</tbody>
</table>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #ffffff; --bg-alt: #f7f8fa; --bg-card: #ffffff; --bg-code: #1e1e2e; --bg-code-text: #cdd6f4;
  --bg-nav: rgba(255,255,255,0.92); --border: #e4e7ec; --text: #111827; --text-muted: #6b7280;
  --text-light: #9ca3af; --accent: #6366f1; --accent-hover: #4f46e5; --accent-light: #eef2ff;
  --accent-gradient: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7);
  --hero-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #4c1d95 100%);
  --success: #10b981; --success-bg: #ecfdf5; --warning: #f59e0b; --warning-bg: #fffbeb;
  --danger: #ef4444; --danger-bg: #fef2f2; --info: #3b82f6; --info-bg: #eff6ff;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08);
  --radius: 12px; --radius-sm: 8px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --transition: 0.2s ease;
}
[data-theme="dark"] {
  --bg: #0f1117; --bg-alt: #161922; --bg-card: #1a1d28; --bg-nav: rgba(15,17,23,0.92);
  --border: #2d3148; --text: #e5e7eb; --text-muted: #9ca3af; --text-light: #6b7280;
  --accent: #818cf8; --accent-hover: #a5b4fc; --accent-light: #1e1b4b;
  --success-bg: #064e3b; --warning-bg: #451a03; --danger-bg: #450a0a; --info-bg: #172554;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow: 0 4px 6px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.4);
}
html { font-size: 16px; scroll-behavior: smooth; scroll-padding-top: 80px; }
body { font-family: var(--font); color: var(--text); background: var(--bg); line-height: 1.7; -webkit-font-smoothing: antialiased; }

/* Nav */
.scroll-progress { position: fixed; top: 0; left: 0; height: 3px; z-index: 1001; background: var(--accent-gradient); width: 0%; transition: width 0.1s linear; }
.top-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: var(--bg-nav); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
.top-nav.scrolled { box-shadow: var(--shadow); }
.nav-brand { font-weight: 800; font-size: 1rem; color: var(--accent); text-decoration: none; white-space: nowrap; }
.nav-links { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.nav-links a { padding: 6px 12px; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-decoration: none; border-radius: 8px; white-space: nowrap; transition: background var(--transition), color var(--transition); }
.nav-links a:hover, .nav-links a.active { background: var(--accent-light); color: var(--accent); }
.theme-toggle { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; transition: background var(--transition), border-color var(--transition); }
.theme-toggle:hover { background: var(--accent-light); border-color: var(--accent); }

/* Hero */
.hero { background: var(--hero-gradient); padding: 130px 24px 80px; text-align: center; color: #fff; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse at 70% 50%, rgba(168,85,247,0.1) 0%, transparent 70%); }
.hero-content { position: relative; z-index: 1; max-width: 820px; margin: 0 auto; }
.hero h1 { font-size: 2.8rem; font-weight: 900; letter-spacing: -0.04em; line-height: 1.1; margin-bottom: 16px; }
.hero .lead { font-size: 1.15rem; color: rgba(255,255,255,0.8); margin-bottom: 32px; line-height: 1.6; }
.hero-chips { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
.hero-chip { font-size: 0.78rem; font-weight: 700; padding: 5px 14px; border-radius: 20px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.2); }
.hero-meta { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
.hero-meta span { font-size: 0.82rem; color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 6px; }
.hero-meta span strong { color: rgba(255,255,255,0.9); }

/* Sections */
.section { padding: 64px 24px; }
.section:nth-child(even) { background: var(--bg-alt); }
.section-inner { max-width: 980px; margin: 0 auto; }
.section-header { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid var(--border); }
.section-num { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-gradient); color: #fff; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.section-header h2 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 6px; }
.section-desc { font-size: 1rem; color: var(--text-muted); }

/* Layer Diagram */
.layer-diagram { margin: 24px 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.layer { padding: 14px 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.layer-presentation { background: linear-gradient(90deg, rgba(99,102,241,0.08), transparent); border-bottom: 1px solid var(--border); }
.layer-application { background: linear-gradient(90deg, rgba(139,92,246,0.08), transparent); border-bottom: 1px solid var(--border); }
.layer-domain { background: linear-gradient(90deg, rgba(236,72,153,0.08), transparent); border-bottom: 1px solid var(--border); }
.layer-infra { background: linear-gradient(90deg, rgba(59,130,246,0.08), transparent); }
.layer-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); min-width: 100px; }
.layer-items { display: flex; gap: 8px; flex-wrap: wrap; }
.layer-items span { font-size: 0.8rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; font-family: var(--mono); color: var(--text-muted); }
.layer-arrow { text-align: center; padding: 6px; font-size: 0.78rem; color: var(--text-light); background: var(--bg-alt); font-style: italic; border-bottom: 1px solid var(--border); }

/* Code */
.code-wrap { margin: 16px 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
.code-label { background: #2a2a3e; color: #888cb0; font-family: var(--mono); font-size: 0.72rem; padding: 6px 16px; letter-spacing: 0.04em; border-bottom: 1px solid #3a3a5a; }
pre { background: var(--bg-code); padding: 20px; overflow-x: auto; }
code { font-family: var(--mono); font-size: 0.82rem; line-height: 1.7; color: var(--bg-code-text); }
.kw  { color: #c792ea; }
.ty  { color: #82aaff; }
.str { color: #c3e88d; }
.num { color: #f78c6c; }
.com { color: #546e7a; font-style: italic; }
.dec { color: #ffcb6b; }

/* Callouts */
.callout { border-left: 4px solid var(--info); background: var(--info-bg); padding: 14px 20px; margin: 18px 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.callout-success { border-left-color: var(--success); background: var(--success-bg); }
.callout-warning { border-left-color: var(--warning); background: var(--warning-bg); }
.callout-danger  { border-left-color: var(--danger); background: var(--danger-bg); }
.callout-title { font-weight: 700; margin-bottom: 4px; font-size: 0.88rem; }
.callout p, .callout ul { margin: 0; }
.callout li { margin: 4px 0; }

/* Badges */
.badge { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
.badge-accent { background: var(--accent-light); color: var(--accent); }
.badge-success { background: var(--success-bg); color: var(--success); }
.badge-warning { background: var(--warning-bg); color: #92400e; }
.badge-danger { background: var(--danger-bg); color: var(--danger); }

/* Cards */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin: 20px 0; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-sm); transition: transform var(--transition), box-shadow var(--transition); }
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.card h4 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 700; }
.card p { font-size: 0.88rem; color: var(--text-muted); margin: 0; }
.card-icon { font-size: 1.5rem; margin-bottom: 10px; }

/* Two-col */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }

/* Rule cards */
.rule-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; margin: 12px 0; }
.rule-num { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 4px; }
.rule-card h4 { margin: 0 0 8px; font-size: 0.95rem; }
.rule-card p { font-size: 0.9rem; color: var(--text-muted); margin: 0; }
.rule-card code { background: var(--bg-alt); padding: 1px 5px; border-radius: 4px; font-size: 0.82rem; }
.rules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin: 20px 0; }

/* Step list */
.step-list { list-style: none; margin: 16px 0; padding: 0; }
.step-list li { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
.step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.step-list p { margin: 0; font-size: 0.92rem; }

/* Flow chart */
.flow-chart { display: flex; flex-direction: column; align-items: center; gap: 0; margin: 20px 0; }
.flow-item { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 700px; }
.flow-box { width: 100%; text-align: center; padding: 12px 20px; border-radius: var(--radius-sm); font-size: 0.88rem; font-weight: 600; border: 1px solid var(--border); background: var(--bg-card); }
.flow-box.presentation { border-color: #6366f1; background: #eef2ff; color: #3730a3; }
.flow-box.application { border-color: #8b5cf6; background: #f5f3ff; color: #5b21b6; }
.flow-box.domain { border-color: #ec4899; background: #fdf2f8; color: #9d174d; }
.flow-box.infra { border-color: #3b82f6; background: #eff6ff; color: #1e40af; }
[data-theme="dark"] .flow-box.presentation { background: #1e1b4b; color: #a5b4fc; }
[data-theme="dark"] .flow-box.application { background: #2e1065; color: #c4b5fd; }
[data-theme="dark"] .flow-box.domain { background: #500724; color: #f9a8d4; }
[data-theme="dark"] .flow-box.infra { background: #172554; color: #93c5fd; }
.flow-arrow { font-size: 1.3rem; color: var(--text-light); padding: 2px 0; }

/* Error table */
.error-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 16px 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
.error-table th { background: var(--bg-alt); padding: 10px 14px; text-align: left; font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.error-table td { padding: 9px 14px; border-bottom: 1px solid var(--border); }
.error-table tr:last-child td { border-bottom: none; }
.error-table code { background: var(--bg-alt); padding: 1px 5px; border-radius: 4px; font-size: 0.8rem; }
.status-ok { color: var(--success); font-weight: 700; }
.status-bad { color: var(--warning); font-weight: 700; }
.status-conflict { color: #8b5cf6; font-weight: 700; }
.status-err { color: var(--danger); font-weight: 700; }

/* Inline code */
p code, li code, h4 code { background: var(--bg-alt); padding: 2px 6px; border-radius: 4px; font-size: 0.84em; font-family: var(--mono); border: 1px solid var(--border); }

/* Topic separator */
.topic { margin-top: 48px; }
.topic > h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border); }
.topic p { margin-bottom: 14px; }
.topic ul, .topic ol { padding-left: 22px; margin-bottom: 14px; }
.topic li { margin-bottom: 6px; }

/* Comparison table */
.cmp-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 16px 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
.cmp-table th { background: var(--accent); color: #fff; padding: 10px 14px; text-align: left; font-weight: 700; }
.cmp-table td { padding: 9px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
.cmp-table tr:last-child td { border-bottom: none; }
.cmp-table .yes { color: var(--success); font-weight: 700; }
.cmp-table .no { color: var(--danger); font-weight: 700; }

/* Footer */
footer { background: #0f1117; color: rgba(255,255,255,0.5); text-align: center; padding: 40px 24px; font-size: 0.82rem; }
footer strong { color: rgba(255,255,255,0.8); }

/* Animations */
@media (prefers-reduced-motion: no-preference) {
  .fade-up { opacity: 0; transform: translateY(16px); transition: opacity 0.4s ease, transform 0.4s ease; }
  .fade-up.visible { opacity: 1; transform: none; }
}
`;

// ─── JS ───────────────────────────────────────────────────────────────────────

const JS = `
const html = document.documentElement;
const bar  = document.querySelector('.scroll-progress');
const nav  = document.querySelector('.top-nav');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('[data-section]');

window.addEventListener('scroll', () => {
  const p = (window.scrollY / (document.body.scrollHeight - innerHeight)) * 100;
  if (bar) bar.style.width = p + '%';
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  // Active nav
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.dataset.section; });
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
}, { passive: true });

document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.theme-toggle').textContent = isDark ? '🌙' : '☀️';
});

// Fade-up on scroll
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
  { threshold: 0.08 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// Prefer dark
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  html.setAttribute('data-theme', 'dark');
  const t = document.querySelector('.theme-toggle');
  if (t) t.textContent = '☀️';
}
`;

// ─── Section Content ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'architecture', label: '🏛️ Architecture' },
  { id: 'constants',    label: '🔢 Constants' },
  { id: 'entity',       label: '🧬 Entity' },
  { id: 'repository',   label: '📦 Repository' },
  { id: 'usecases',     label: '⚙️ Use Cases' },
  { id: 'contracts',    label: '📋 Contracts' },
  { id: 'appservice',   label: '🔀 App Service' },
  { id: 'controller',   label: '🌐 Controller' },
  { id: 'module',       label: '🔌 Module' },
  { id: 'exceptions',   label: '🚦 Exceptions' },
  { id: 'patterns',     label: '🔗 Patterns' },
];

function sectionArchitecture() {
  return `
<section class="section" id="architecture" data-section="architecture">
<div class="section-inner fade-up">
${sectionHeader('01', '🏛️', 'Clean Architecture Overview', 'The dependency rule: inner layers never import outer layers. Infrastructure adapts to the domain — not the other way around.')}

${layerDiagram()}

<div class="topic">
<h3>The Golden Rules</h3>
<div class="rules-grid">
${ruleCard(1, 'Controllers never call Use Cases directly', '<p>Controllers call the <code>ApplicationService</code>. The service orchestrates use cases and transforms domain entities to DTOs.</p>')}
${ruleCard(2, 'Application Services are always present', '<p>Even for simple pass-throughs. They are the boundary between presentation concerns (HTTP) and domain concerns.</p>')}
${ruleCard(3, 'Use Cases return Domain Entities', '<p>Use cases return <code>User</code>, <code>Order</code>, <code>Product</code> — never DTOs, never plain objects. Transformation is the App Service\'s job.</p>')}
${ruleCard(4, 'Domain layer has zero NestJS imports', '<p>No <code>@nestjs/*</code> inside <code>packages/{domain}-domain/src/domain/</code> or <code>application/</code>. Pure TypeScript only.</p>')}
${ruleCard(5, 'Repository interfaces live in Application layer', '<p>The port (<code>IUserRepository</code>) lives in <code>application/interfaces/</code>. The adapter (<code>DynamoUserRepository</code>) lives in <code>infrastructure/</code>.</p>')}
${ruleCard(10, 'Never trust userId from client input', '<p>Actor identity always comes from the JWT via <code>@CurrentUser(\'userId\') actorId: string</code>. Never from <code>@Body()</code> or <code>@Param()</code>.</p>')}
</div>
</div>

<div class="topic">
<h3>File Layout: User Service Example</h3>
${codeBlock(`apps/users/user-api-service/src/
  main.ts                           ← Bootstrap + STAGE branch
  app/                              ← AppModule (root)
  application/
    services/
      user-application.service.ts   ← Orchestration + DTO transform
  infrastructure/
    config/
      dynamodb.config.ts            ← Singleton DynamoDB client
  modules/
    user.module.ts                  ← NestJS DI wiring
  presentation/
    controllers/
      user.controller.ts            ← HTTP endpoints
    pipes/
      zod-validation.pipe.ts        ← Zod request parsing
    filters/
      domain-exception.filter.ts    ← Exception → HTTP status
    guards/
      jwt-auth.guard.ts             ← JWT verification
    decorators/
      current-user.decorator.ts     ← Actor extraction
    interceptors/
      http-logging.interceptor.ts   ← Request/response logging

packages/user-domain/src/
  domain/
    constants/                      ← USER_STATUSES, USER_ROLES
    entities/
      user.entity.ts                ← Business logic lives here
    exceptions/                     ← Domain rule violations
    events/                         ← Event type constants
  application/
    use-cases/                      ← One folder per operation
    interfaces/
      user-repository.interface.ts  ← Port (abstract class)
    exceptions/                     ← Input validation errors
  infrastructure/
    repositories/
      dynamo-user.repository.ts     ← DynamoDB adapter
    schemas/
      UserSchema.ts                 ← OneTable schema`, 'Directory structure')}
</div>
</div>
</section>`;
}

function sectionConstants() {
  return `
<section class="section" id="constants" data-section="constants">
<div class="section-inner fade-up">
${sectionHeader('02', '🔢', 'Domain Constants — Single Source of Truth', 'Constants are defined once in the domain package. Contracts re-export them. Never hardcode string literals in entity methods.')}

<div class="topic">
<h3>The Derived-Enum Pattern</h3>
<p>Use a <code>const</code> tuple array as the source of truth. Derive both the TypeScript union type <em>and</em> an enum-style object from it — no duplication, no drift between the two.</p>

${codeBlock(`// packages/user-domain/src/domain/constants/user-statuses.ts

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'DELETED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
// → 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'DELETED'

// Derive enum object from array — one source of truth, no duplication
export const UserStatusEnum = USER_STATUSES.reduce(
  (acc, status) => ({ ...acc, [status]: status }),
  {} as { [K in UserStatus]: K }
);
// UserStatusEnum.ACTIVE  → 'ACTIVE'
// UserStatusEnum.PENDING → 'PENDING'`, 'user-statuses.ts')}

${codeBlock(`// packages/user-domain/src/domain/constants/user-roles.ts

export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const UserRoleEnum = USER_ROLES.reduce(
  (acc, role) => ({ ...acc, [role]: role }),
  {} as { [K in UserRole]: K }
);`, 'user-roles.ts')}

${callout('warning', '⚠️ Never hardcode status strings in entity methods', `<p>Do this: <code>userStatus === UserStatusEnum.ACTIVE</code><br>Not this: <code>userStatus === 'ACTIVE'</code></p><p>The domain constant is the only place the string value exists. This prevents typos and makes renaming safe.</p>`)}

<h3>Order Status — More Complex Lifecycle</h3>
${codeBlock(`// packages/order-domain/src/domain/constants/order-statuses.ts

export const ORDER_STATUSES = [
  'DRAFT',               // Created, items being added
  'PENDING',             // Submitted, awaiting validation
  'VALIDATION_FAILED',   // Product validation failed
  'CONFIRMED',           // Validated, payment captured
  'PROCESSING',          // Being fulfilled
  'SHIPPED',             // In transit
  'DELIVERED',           // Received by customer
  'CANCELLED',           // Cancelled before ship
  'REFUNDED',            // Payment refunded post-delivery
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const OrderStatusEnum = ORDER_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s]: s }),
  {} as { [K in OrderStatus]: K }
);`, 'order-statuses.ts')}
</div>
</div>
</section>`;
}

function sectionEntity() {
  return `
<section class="section" id="entity" data-section="entity">
<div class="section-inner fade-up">
${sectionHeader('03', '🧬', 'Domain Entity', 'Private constructor. Two factory methods: create() for new, reconstitute() from DB. All business rules live here.')}

<div class="topic">
<h3>User Entity — Core Pattern</h3>
${codeBlock(`// packages/user-domain/src/domain/entities/user.entity.ts

import { UserRole, UserRoleEnum, UserStatus, UserStatusEnum } from '../constants';
import {
  InvalidEmailFormatError, InvalidNameError,
  EmailAlreadyVerifiedError, CannotActivateNonPendingUserError,
  CannotActivateUnverifiedEmailError, CannotDeactivateDeletedUserError,
  UserAlreadyDeletedError, CannotUpdateDeletedUserError,
} from '../exceptions';

export class User {
  // ─── Private constructor enforces factory usage ──────────────────
  private constructor(
    private readonly userId: string | null,  // null until persisted
    private readonly email: string,
    private firstName: string,
    private lastName: string,
    private emailVerified: boolean,
    private userRole: UserRole,
    private userStatus: UserStatus,
    private data: { country?: string },
    private readonly dateCreated: string,
    private updatedAt: string,
  ) {}

  // ─── Factory: new user (not yet persisted) ───────────────────────
  static create(props: {
    email: string; firstName: string; lastName: string;
    userRole?: UserRole; data?: { country?: string };
  }): User {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+\$/;
    if (!emailRegex.test(props.email)) throw new InvalidEmailFormatError();
    if (props.firstName.trim().length === 0) throw new InvalidNameError('First name');
    if (props.lastName.trim().length === 0)  throw new InvalidNameError('Last name');

    const now = new Date().toISOString();
    return new User(
      null,                           // userId generated by DB
      props.email.toLowerCase().trim(),
      props.firstName.trim(),
      props.lastName.trim(),
      false,                          // new users start unverified
      props.userRole || UserRoleEnum.USER,
      UserStatusEnum.PENDING,         // new users start PENDING
      props.data || {},
      now, now,
    );
  }

  // ─── Factory: reconstitute from DB record ────────────────────────
  static reconstitute(props: {
    userId: string; email: string; firstName: string; lastName: string;
    emailVerified: boolean; userRole: UserRole; userStatus: UserStatus;
    data: { country?: string }; dateCreated: string; updatedAt: string;
  }): User {
    return new User(
      props.userId, props.email, props.firstName, props.lastName,
      props.emailVerified, props.userRole, props.userStatus,
      props.data, props.dateCreated, props.updatedAt,
    );
  }

  // ─── Business methods (enforce invariants) ───────────────────────
  verifyEmail(): void {
    if (this.emailVerified) throw new EmailAlreadyVerifiedError();
    this.emailVerified = true;
    this.updatedAt = new Date().toISOString();
  }

  activate(): void {
    if (!this.emailVerified) throw new CannotActivateUnverifiedEmailError();
    if (this.userStatus === UserStatusEnum.DELETED) throw new CannotActivateNonPendingUserError();
    this.userStatus = UserStatusEnum.ACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  deactivate(): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new CannotDeactivateDeletedUserError();
    this.userStatus = UserStatusEnum.INACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  delete(): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new UserAlreadyDeletedError();
    this.userStatus = UserStatusEnum.DELETED;
    this.updatedAt = new Date().toISOString();
  }

  updateProfile(firstName?: string, lastName?: string, data?: { country?: string }): void {
    if (this.userStatus === UserStatusEnum.DELETED) throw new CannotUpdateDeletedUserError();
    if (firstName !== undefined) this.firstName = firstName.trim();
    if (lastName  !== undefined) this.lastName  = lastName.trim();
    if (data      !== undefined) this.data      = data;
    this.updatedAt = new Date().toISOString();
  }

  // ─── Getters (read-only access) ──────────────────────────────────
  getUserId()     { return this.userId; }
  getEmail()      { return this.email; }
  getFirstName()  { return this.firstName; }
  getLastName()   { return this.lastName; }
  getUserRole()   { return this.userRole; }
  getUserStatus() { return this.userStatus; }
  getData()       { return this.data; }
  getDateCreated(){ return this.dateCreated; }
  getUpdatedAt()  { return this.updatedAt; }
}`, 'user.entity.ts')}

${callout('danger', '🚫 Never add toObject() to entities', `<p>Serialisation is handled by the Application Service → <code>userResponseSchema.parse()</code> pipeline. Entities expose getters, not serialisation methods (Golden Rule #13).</p>`)}
</div>

<div class="topic">
<h3>Order Entity — Aggregate Root with Child Entities</h3>
${codeBlock(`// packages/order-domain/src/domain/entities/order.entity.ts

export class Order {
  private constructor(
    private readonly orderId: string | null,
    private customerId: string,
    private items: OrderItem[],              // Value objects
    private payment: OrderPayment | null,
    private orderStatus: OrderStatus,
    private totalAmount: number,
    private readonly dateCreated: string,
    private updatedAt: string,
  ) {}

  static create(props: { customerId: string }): Order {
    if (!props.customerId.trim()) throw new CustomerIdRequiredError();
    const now = new Date().toISOString();
    return new Order(null, props.customerId, [], null, OrderStatusEnum.DRAFT, 0, now, now);
  }

  // ─── Add item — only allowed on DRAFT orders ─────────────────────
  addItem(item: OrderItem): void {
    if (this.orderStatus !== OrderStatusEnum.DRAFT) {
      throw new CannotModifyNonDraftOrderError();
    }
    this.items.push(item);
    this.recalculateTotal();
    this.updatedAt = new Date().toISOString();
  }

  // ─── Confirm — requires payment and items ────────────────────────
  confirm(): void {
    if (this.items.length === 0) throw new CannotConfirmEmptyOrderError();
    if (!this.payment)           throw new PaymentRequiredForConfirmationError();
    if (!this.payment.isAuthorized()) throw new InvalidPaymentStateForConfirmationError();
    this.orderStatus = OrderStatusEnum.CONFIRMED;
    this.updatedAt   = new Date().toISOString();
  }

  // ─── State transition guard ──────────────────────────────────────
  cancel(): void {
    const cancellable = [OrderStatusEnum.DRAFT, OrderStatusEnum.PENDING, OrderStatusEnum.CONFIRMED];
    if (!cancellable.includes(this.orderStatus)) throw new CannotCancelOrderError(this.orderStatus);
    this.orderStatus = OrderStatusEnum.CANCELLED;
    this.updatedAt   = new Date().toISOString();
  }

  private recalculateTotal(): void {
    this.totalAmount = this.items.reduce((sum, i) => sum + i.getSubtotal(), 0);
  }
}`, 'order.entity.ts (aggregate root)')}
</div>
</div>
</section>`;
}

function sectionRepository() {
  return `
<section class="section" id="repository" data-section="repository">
<div class="section-inner fade-up">
${sectionHeader('04', '📦', 'Repository Interface & DynamoDB Implementation', 'The interface is the port (application layer). The DynamoDB class is the adapter (infrastructure layer). They never cross.')}

<div class="topic">
<h3>Repository Interface (Port)</h3>
${codeBlock(`// packages/user-domain/src/application/interfaces/user-repository.interface.ts

import { IPaginatedResponse } from '@mma/common';
import { UserRole, UserStatus } from '../../domain/constants';
import { User } from '../../domain/entities';

// Abstract CLASS (not TS interface) — enables NestJS DI token injection
export abstract class IUserRepository {
  // Save: entity.getUserId() === null → INSERT; otherwise UPSERT
  abstract save(user: User): Promise<User>;

  // Single-record lookups return null (never throw) if not found
  abstract findById(userId: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;

  // Paginated list queries — cursor-based for DynamoDB domains
  abstract listByStatus(
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<User>>;

  abstract listByRoleAndStatus(
    userRole: UserRole,
    userStatus: UserStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<User>>;
}`, 'user-repository.interface.ts')}

${callout('info', 'Why abstract class instead of interface?', `<p>TypeScript interfaces are erased at runtime. NestJS DI tokens must exist at runtime. Using <code>abstract class IUserRepository</code> gives you both: a compile-time contract <em>and</em> a runtime token for <code>inject: [USER_REPOSITORY]</code>.</p>`)}
</div>

<div class="topic">
<h3>DynamoDB Repository (Adapter)</h3>
${codeBlock(`// packages/user-domain/src/infrastructure/repositories/dynamo-user.repository.ts

import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@mma/common';
import { pageRecordHandler } from '@mma/dynamodb-onetable';
import { IUserRepository } from '../../application/interfaces/user-repository.interface';
import { User } from '../../domain/entities';
import { UserDataType } from '../schemas/UserSchema';

// Local structural interface — avoids OneTable generic type explosions
interface IUserModel {
  create(props: object): Promise<UserDataType>;
  upsert(props: object): Promise<UserDataType>;
  get(props: object, opts?: object): Promise<UserDataType | undefined>;
  find(props: object, opts?: object): Promise<UserDataType[]>;
}

export class DynamoUserRepository implements IUserRepository {
  private readonly UserModel: IUserModel;

  constructor(private readonly table: Table) {
    this.UserModel = this.table.getModel('User') as unknown as IUserModel;
  }

  async save(user: User): Promise<User> {
    const data = this.toPersistence(user);
    if (user.getUserId()) {
      const updated = await this.UserModel.upsert(data);
      return this.toDomain(updated);
    }
    const created = await this.UserModel.create(data);
    return this.toDomain(created);
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.UserModel.get({ userId });
    return result ? this.toDomain(result) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await this.UserModel.find(
      { email },
      { index: 'GSI4', limit: 1 },
    );
    return results.length > 0 ? this.toDomain(results[0]) : null;
  }

  async listByStatus(
    userStatus: string,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<User>> {
    return pageRecordHandler<UserDataType, User>(
      (opts) => this.UserModel.find({ userStatus }, opts),
      { limit, direction, nextCursorPointer, prevCursorPointer, index: 'GSI5' },
      (record) => this.toDomain(record),
    );
  }

  // ─── Private converters (keep inside infrastructure) ─────────────
  private toDomain(record: UserDataType): User {
    return User.reconstitute({
      userId:        record.userId,
      email:         record.email,
      firstName:     record.firstName,
      lastName:      record.lastName,
      emailVerified: record.emailVerified,
      userRole:      record.userRole,
      userStatus:    record.userStatus,
      data:          record.data || {},
      dateCreated:   record.createdAt,  // OneTable auto-field → domain dateCreated
      updatedAt:     record.updatedAt,
    });
  }

  private toPersistence(user: User): object {
    return {
      userId:        user.getUserId(),
      email:         user.getEmail(),
      firstName:     user.getFirstName(),
      lastName:      user.getLastName(),
      emailVerified: false,
      userRole:      user.getUserRole(),
      userStatus:    user.getUserStatus(),
      data:          user.getData(),
      updatedAt:     user.getUpdatedAt(),
    };
  }
}`, 'dynamo-user.repository.ts')}

${callout('warning', 'createdAt vs dateCreated', `<p>OneTable auto-manages a persistence-level <code>createdAt</code> field (via <code>timestamps: true</code>). The repository reads <code>record.createdAt</code> and maps it to the domain's <code>dateCreated</code>. The domain entity never has a <code>createdAt</code> field (Golden Rule #12).</p>`)}
</div>

<div class="topic">
<h3>DynamoDB Config — Singleton Client</h3>
${codeBlock(`// apps/users/user-api-service/src/infrastructure/config/dynamodb.config.ts

import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';
import { createDynamoLocalClient, createAWSClient, createTable } from '@mma/dynamodb-onetable';

export class DynamoDBConfig {
  private static client: Dynamo;
  private static tables = new Map<string, Table>();

  static getClient(): Dynamo {
    if (!this.client) {
      // STAGE=local is the ONLY check for local vs AWS — never NODE_ENV
      const isLocal = process.env.STAGE === 'local' || !!process.env.DYNAMODB_ENDPOINT;
      this.client = isLocal
        ? createDynamoLocalClient()
        : createAWSClient(process.env.AWS_REGION || 'eu-west-2');
    }
    return this.client;
  }

  static getTable(name: string, schema: object): Table {
    if (!this.tables.has(name)) {
      this.tables.set(name, createTable({ client: this.getClient(), name, schema }));
    }
    const table = this.tables.get(name);
    if (!table) throw new Error(\`Failed to initialise DynamoDB table: \${name}\`);
    return table;
  }
}`, 'dynamodb.config.ts')}
</div>
</div>
</section>`;
}

function sectionUseCases() {
  return `
<section class="section" id="usecases" data-section="usecases">
<div class="section-inner fade-up">
${sectionHeader('05', '⚙️', 'Use Cases — Single Responsibility Operations', 'One use case = one business operation. Each implements IUseCase<TInput, TOutput>. No HTTP, no NestJS, no DTOs.')}

<div class="topic">
<h3>CreateUser Use Case</h3>
${codeBlock(`// packages/user-domain/src/application/use-cases/create-user/create-user.use-case.ts

import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserRole, UserRoleEnum } from '../../../domain/constants';
import { EmailAlreadyExistsError } from '../../exceptions';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  userRole?: UserRole;
  data?: { country?: string };
}

export class CreateUserUseCase implements IUseCase<CreateUserInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: CreateUserInput): Promise<User> {
    // 1. Check uniqueness constraint
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new EmailAlreadyExistsError(input.email);
    }

    // 2. Create domain entity — business validation happens here (inside User.create)
    const user = User.create({
      email:     input.email,
      firstName: input.firstName,
      lastName:  input.lastName,
      userRole:  input.userRole || UserRoleEnum.USER,
      data:      input.data,
    });

    // 3. Persist and return entity (NOT a DTO)
    return await this.userRepository.save(user);
  }
}`, 'create-user.use-case.ts')}

<h3>CreateOrder Use Case — ACL + Event Publishing</h3>
${codeBlock(`// packages/order-domain/src/application/use-cases/create-order/create-order.use-case.ts

import { IUseCase, IEventPublisher } from '@mma/common';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { ICustomerValidator } from '../../interfaces/customer-validator.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderEventTypeEnum } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

export interface CreateOrderInput {
  customerId: string;
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>;
}

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerValidator: ICustomerValidator,   // ACL — not the User domain directly
    private readonly eventPublisher: IEventPublisher<unknown>,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.customerId)        throw new InvalidInputError('Customer ID is required');
    if (!input.items?.length)     throw new InvalidInputError('At least one item is required');

    // ─── ACL gate: validate customer exists and is active ────────────
    await this.customerValidator.validate(input.customerId);

    // ─── Create domain entity + add items ───────────────────────────
    const order = Order.create({ customerId: input.customerId });
    for (const i of input.items) {
      order.addItem(OrderItem.create({ ...i }));
    }

    // ─── Persist ─────────────────────────────────────────────────────
    const savedOrder = await this.orderRepository.save(order);

    // ─── Publish ORDER_CREATED for async product validation saga ─────
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
}`, 'create-order.use-case.ts')}

${callout('info', 'Why does the Use Case do event publishing?', `<p>Event publishing is tied to the successful completion of the domain operation — not to the HTTP layer. Placing it in the use case keeps the operation self-contained and ensures the event is published regardless of which transport (HTTP, Lambda, test) invokes the use case.</p>`)}

<h3>ActivateUser Use Case — State Transition</h3>
${codeBlock(`// packages/user-domain/src/application/use-cases/activate-user/activate-user.use-case.ts

import { IUseCase } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserNotFoundError } from '../../exceptions';

export interface ActivateUserInput {
  userId: string;
}

export class ActivateUserUseCase implements IUseCase<ActivateUserInput, User> {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ActivateUserInput): Promise<User> {
    // Find user — throw typed exception if not found
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    // Delegate business logic to entity — it enforces the invariants
    // entity throws: CannotActivateUnverifiedEmailError, CannotActivateNonPendingUserError
    user.activate();

    // Persist the state change
    return await this.userRepository.save(user);
  }
}`, 'activate-user.use-case.ts')}

<h3>ListUsersByStatus Use Case — Cursor Pagination</h3>
${codeBlock(`// packages/user-domain/src/application/use-cases/list-users-by-status/list-users-by-status.use-case.ts

import { IUseCase, IPaginatedResponse } from '@mma/common';
import { IUserRepository } from '../../interfaces/user-repository.interface';
import { User } from '../../../domain/entities';
import { UserStatus } from '../../../domain/constants';
import { InvalidUserStatusError } from '../../exceptions';

export interface ListUsersByStatusInput {
  userStatus: UserStatus;
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}

export class ListUsersByStatusUseCase
  implements IUseCase<ListUsersByStatusInput, IPaginatedResponse<User>>
{
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ListUsersByStatusInput): Promise<IPaginatedResponse<User>> {
    const { userStatus, limit, cursor, direction = 'next' } = input;

    return await this.userRepository.listByStatus(
      userStatus,
      limit,
      direction,
      direction === 'next'  ? cursor : undefined,  // nextCursorPointer
      direction === 'prev'  ? cursor : undefined,  // prevCursorPointer
    );
  }
}`, 'list-users-by-status.use-case.ts')}
</div>
</div>
</section>`;
}

function sectionContracts() {
  return `
<section class="section" id="contracts" data-section="contracts">
<div class="section-inner fade-up">
${sectionHeader('06', '📋', 'Contracts — Zod Schemas & TypeScript Types', 'Each domain has its own contracts package. Subpath imports only. Never import from the bare @mma/contracts root.')}

<div class="topic">
<h3>User Contracts Package</h3>
${codeBlock(`// packages/contracts/user/src/schemas.ts

import { z } from 'zod';
import { USER_ROLES, USER_STATUSES, UserRoleEnum, UserStatusEnum } from '@mma/user-domain';

// Re-export domain constants so consumers don't need both packages
export { USER_ROLES, USER_STATUSES, UserRoleEnum, UserStatusEnum };

// Zod schemas from domain constants — one source of truth
export const userRoleSchema   = z.enum(USER_ROLES);
export const userStatusSchema = z.enum(USER_STATUSES);

// ─── Create User (request body validation) ───────────────────────────
export const createUserSchema = z.object({
  email:     z.email(),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  userRole:  userRoleSchema.optional().default('USER'),
  data:      z.object({ country: z.string().optional() }).optional(),
});

// ─── Update User ──────────────────────────────────────────────────────
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  data:      z.object({ country: z.string().optional() }).optional(),
});

// ─── Response shape (also used for runtime output validation) ─────────
export const userResponseSchema = z.object({
  userId:      z.string(),
  email:       z.string().email(),
  firstName:   z.string(),
  lastName:    z.string(),
  userRole:    userRoleSchema,
  userStatus:  userStatusSchema,
  data:        z.object({ country: z.string().optional() }),
  dateCreated: z.string().datetime(),
  updatedAt:   z.string().datetime(),
});

// ─── TypeScript types inferred from Zod schemas ───────────────────────
export type UserResponse          = z.infer<typeof userResponseSchema>;
export type CreateUserInput       = z.infer<typeof createUserSchema>;
export type UpdateUserInput       = z.infer<typeof updateUserSchema>;`, 'packages/contracts/user/src/schemas.ts')}

${callout('danger', '⛔ Import Rule — Always use domain-scoped subpaths', `<p>✅ <code>import { createUserSchema } from '@mma/contracts/user'</code><br>❌ <code>import { createUserSchema } from '@mma/contracts'</code></p><p>Each domain sub-package compiles independently. A type error in the order contracts cannot break the user service. Golden Rule #11.</p>`)}

<h3>Common Pagination Types</h3>
${codeBlock(`// packages/contracts/common/src/pagination.ts

import { z } from 'zod';

// Cursor-based pagination (DynamoDB domains)
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data:               z.array(itemSchema),
    nextCursorPointer:  z.string().nullable().optional(),
    prevCursorPointer:  z.string().nullable().optional(),
  });

export type PaginatedResponse<T> = {
  data:               T[];
  nextCursorPointer?: string | null;
  prevCursorPointer?: string | null;
};

// Offset pagination (Prisma / PostgreSQL domains)
export type OffsetPaginatedResponse<T> = {
  data:        T[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
};`, 'packages/contracts/common/src/pagination.ts')}
</div>
</div>
</section>`;
}

function sectionAppService() {
  return `
<section class="section" id="appservice" data-section="appservice">
<div class="section-inner fade-up">
${sectionHeader('07', '🔀', 'Application Service', 'Orchestrates use cases, transforms domain entities to DTOs, publishes events. The only layer that knows both domain types AND DTO shapes.')}

<div class="topic">
<h3>UserApplicationService</h3>
${codeBlock(`// apps/users/user-api-service/src/application/services/user-application.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import { IPaginatedResponse, IEventPublisher } from '@mma/common';
import {
  userResponseSchema,
  CreateUserInput, UpdateUserInput, UserResponse,
  ListUsersByStatusInput, UserDomainEvent,
} from '@mma/contracts/user';
import { PaginatedResponse } from '@mma/contracts/common';
import {
  User,
  CreateUserUseCase, GetUserByIdUseCase, GetUserByEmailUseCase,
  UpdateUserProfileUseCase, DeleteUserUseCase,
  ActivateUserUseCase, DeactivateUserUseCase, VerifyUserEmailUseCase,
  UpdateUserRoleUseCase, ListUsersByStatusUseCase, ListUsersByRoleAndStatusUseCase,
} from '@mma/user-domain';

// Module-level singleton logger — NOT a class property (Golden Rule #35)
const logger = createLogger('user-api-service');

@Injectable()
export class UserApplicationService {
  constructor(
    private readonly createUserUseCase:                CreateUserUseCase,
    private readonly getUserByIdUseCase:               GetUserByIdUseCase,
    private readonly getUserByEmailUseCase:            GetUserByEmailUseCase,
    private readonly updateUserProfileUseCase:         UpdateUserProfileUseCase,
    private readonly deleteUserUseCase:                DeleteUserUseCase,
    private readonly activateUserUseCase:              ActivateUserUseCase,
    private readonly deactivateUserUseCase:            DeactivateUserUseCase,
    private readonly verifyUserEmailUseCase:           VerifyUserEmailUseCase,
    private readonly updateUserRoleUseCase:            UpdateUserRoleUseCase,
    private readonly listUsersByStatusUseCase:         ListUsersByStatusUseCase,
    private readonly listUsersByRoleAndStatusUseCase:  ListUsersByRoleAndStatusUseCase,
    @Inject('USER_EVENT_PUBLISHER')
    private readonly eventPublisher: IEventPublisher<UserDomainEvent>,
  ) {}

  // ─── Private: entity → DTO (uses Zod for output validation) ────────
  private toDto(user: User): UserResponse {
    return userResponseSchema.parse({
      userId:      user.getUserId(),
      email:       user.getEmail(),
      firstName:   user.getFirstName(),
      lastName:    user.getLastName(),
      userRole:    user.getUserRole(),
      userStatus:  user.getUserStatus(),
      data:        user.getData(),
      dateCreated: user.getDateCreated(),
      updatedAt:   user.getUpdatedAt(),
    });
  }

  private toPaginatedDto(result: IPaginatedResponse<User>): PaginatedResponse<UserResponse> {
    return {
      data:               result.data.map((u) => this.toDto(u)),
      nextCursorPointer:  result.nextCursorPointer,
      prevCursorPointer:  result.prevCursorPointer,
    };
  }

  // ─── Mutation methods accept actorId (Golden Rule #10a) ─────────────
  async createUser(input: CreateUserInput, actorId: string): Promise<UserResponse> {
    logger.info('Creating user', { email: input.email, userRole: input.userRole, actorId });
    const user = await this.createUserUseCase.execute({ ...input });
    return this.toDto(user);
  }

  async activateUser(userId: string, actorId: string): Promise<UserResponse> {
    logger.info('Activating user', { userId, actorId });
    const user = await this.activateUserUseCase.execute({ userId });
    return this.toDto(user);
  }

  async listUsersByStatus(input: ListUsersByStatusInput): Promise<PaginatedResponse<UserResponse>> {
    const result = await this.listUsersByStatusUseCase.execute(input);
    return this.toPaginatedDto(result);
  }

  // ─── Read methods do NOT need actorId ────────────────────────────────
  async getUserById(userId: string): Promise<UserResponse> {
    const user = await this.getUserByIdUseCase.execute({ userId });
    return this.toDto(user);
  }
}`, 'user-application.service.ts')}

${callout('warning', 'Application Service responsibilities', `<ul>
  <li>✅ Calls use cases via <code>this.xyzUseCase.execute({...})</code></li>
  <li>✅ Transforms domain entities to DTOs via <code>userResponseSchema.parse({...})</code></li>
  <li>✅ Logs all mutation operations with <code>actorId</code></li>
  <li>❌ Does NOT contain business logic — that belongs in the entity or use case</li>
  <li>❌ Does NOT import from <code>@nestjs/*</code> except <code>@Injectable</code>, <code>@Inject</code></li>
</ul>`)}
</div>
</div>
</section>`;
}

function sectionController() {
  return `
<section class="section" id="controller" data-section="controller">
<div class="section-inner fade-up">
${sectionHeader('08', '🌐', 'Controller & Presentation Layer', 'Thin HTTP adapter. Validates input via ZodValidationPipe, extracts actor via @CurrentUser, delegates to ApplicationService.')}

<div class="topic">
<h3>REST Naming Conventions</h3>
<table class="cmp-table">
<thead><tr><th>Intent</th><th>Method</th><th>Path</th><th>Status</th></tr></thead>
<tbody>
<tr><td>List with filter</td><td>GET</td><td><code>/users/by-status?userStatus=ACTIVE</code></td><td>200</td></tr>
<tr><td>Get by ID</td><td>GET</td><td><code>/users/:userId</code></td><td>200</td></tr>
<tr><td>Create</td><td>POST</td><td><code>/users</code></td><td>201</td></tr>
<tr><td>Partial update</td><td>PATCH</td><td><code>/users/:userId</code></td><td>200</td></tr>
<tr><td>Delete</td><td>DELETE</td><td><code>/users/:userId</code></td><td>204</td></tr>
<tr><td>State transition</td><td>POST</td><td><code>/users/:userId/activate</code></td><td>200</td></tr>
</tbody>
</table>

${callout('warning', 'Static paths before dynamic paths', `<p>NestJS routes are matched in declaration order. Declare <code>GET /users/by-status</code> and <code>GET /users/by-role-and-status</code> BEFORE <code>GET /users/:userId</code> — otherwise <code>by-status</code> is treated as a <code>userId</code> parameter.</p>`)}

<h3>Controller Implementation</h3>
${codeBlock(`// apps/users/user-api-service/src/presentation/controllers/user.controller.ts

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { createUserSchema, updateUserSchema, userStatusSchema, CreateUserInput, UpdateUserInput } from '@mma/contracts/user';
import { UserApplicationService } from '../../application/services/user-application.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { CurrentUser } from '../decorators/current-user.decorator';

// Query schemas with coercion — query params arrive as strings
const listByStatusQuerySchema = z.object({
  userStatus: userStatusSchema,
  limit:      z.coerce.number().min(1).max(100).optional().default(20),
  cursor:     z.string().optional(),
  direction:  z.enum(['next', 'prev']).optional().default('next'),
});

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userApplicationService: UserApplicationService) {}

  // ─── Static paths FIRST (before /:userId) ──────────────────────────
  @Get('by-status')
  @ApiOperation({ summary: 'List users by status', description: 'Cursor-paginated list filtered by status.' })
  @ApiOkResponse({ description: 'Paginated list of users' })
  listUsersByStatus(
    @Query(new ZodValidationPipe(listByStatusQuerySchema)) query: any,
  ) {
    return this.userApplicationService.listUsersByStatus(query);
  }

  // ─── Dynamic paths after static ────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ description: 'User created successfully' })
  createUser(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser('userId') actorId: string,   // Actor from JWT — NEVER from @Body
  ) {
    return this.userApplicationService.createUser(body, actorId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  getUserById(@Param('userId') userId: string) {
    return this.userApplicationService.getUserById(userId);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Update user profile' })
  updateUserProfile(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.updateUserProfile(userId, body, actorId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    await this.userApplicationService.deleteUser(userId, actorId);
  }

  @Post(':userId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate user — transitions PENDING/INACTIVE → ACTIVE' })
  activateUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.activateUser(userId, actorId);
  }

  @Post(':userId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user — transitions ACTIVE → INACTIVE' })
  deactivateUser(
    @Param('userId') userId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.userApplicationService.deactivateUser(userId, actorId);
  }
}`, 'user.controller.ts')}

<h3>ZodValidationPipe</h3>
${codeBlock(`// apps/users/user-api-service/src/presentation/pipes/zod-validation.pipe.ts

import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // Throw BadRequestException with Zod issue array — DomainExceptionFilter preserves it
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}`, 'zod-validation.pipe.ts')}

<h3>@CurrentUser Decorator</h3>
${codeBlock(`// apps/users/user-api-service/src/presentation/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export type AuthenticatedUser = {
  userId:   string;
  email:    string;
  userRole?: string;
};

// JwtAuthGuard sets request.user — this decorator extracts from it
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;
    return field ? user?.[field] : user;
  },
);

// Usage:
// @CurrentUser('userId') actorId: string      — just the ID
// @CurrentUser() user: AuthenticatedUser      — full user object`, 'current-user.decorator.ts')}
</div>
</div>
</section>`;
}

function sectionModule() {
  return `
<section class="section" id="module" data-section="module">
<div class="section-inner fade-up">
${sectionHeader('09', '🔌', 'NestJS Module Wiring', 'Factory providers inject the right implementations. Only the ApplicationService is exported. Use cases and repositories stay private to the module.')}

<div class="topic">
<h3>UserModule — Complete Wiring</h3>
${codeBlock(`// apps/users/user-api-service/src/modules/user.module.ts

import { Module } from '@nestjs/common';
import {
  IUserRepository,
  CreateUserUseCase, GetUserByIdUseCase, GetUserByEmailUseCase,
  UpdateUserProfileUseCase, DeleteUserUseCase,
  ActivateUserUseCase, DeactivateUserUseCase, VerifyUserEmailUseCase,
  UpdateUserRoleUseCase, ListUsersByStatusUseCase, ListUsersByRoleAndStatusUseCase,
} from '@mma/user-domain';
import { DynamoUserRepository, UserSchema } from '@mma/user-domain/infrastructure';
import { SqsFifoEventPublisher, createLocalSqsClient, createAwsSqsClient } from '@mma/aws-sqs';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { UserApplicationService } from '../application/services/user-application.service';
import { UserController } from '../presentation/controllers/user.controller';

// String tokens — defined locally, never exported
const DYNAMO_TABLE        = 'DYNAMO_TABLE';
const USER_REPOSITORY     = 'USER_REPOSITORY';
const USER_EVENT_PUBLISHER = 'USER_EVENT_PUBLISHER';

@Module({
  controllers: [UserController],
  providers: [
    // ─── 1. DynamoDB Table instance ───────────────────────────────────
    {
      provide: DYNAMO_TABLE,
      useFactory: () => DynamoDBConfig.getTable(
        process.env.USERS_DYNAMODB_TABLE_NAME || 'OldSTTable',
        UserSchema,
      ),
    },

    // ─── 2. Repository (adapter) ──────────────────────────────────────
    {
      provide: USER_REPOSITORY,
      useFactory: (table: Table) => new DynamoUserRepository(table),
      inject: [DYNAMO_TABLE],
    },

    // ─── 3. Use cases — each wired with only the deps it needs ────────
    { provide: CreateUserUseCase,               useFactory: (r: IUserRepository) => new CreateUserUseCase(r),               inject: [USER_REPOSITORY] },
    { provide: GetUserByIdUseCase,              useFactory: (r: IUserRepository) => new GetUserByIdUseCase(r),              inject: [USER_REPOSITORY] },
    { provide: GetUserByEmailUseCase,           useFactory: (r: IUserRepository) => new GetUserByEmailUseCase(r),           inject: [USER_REPOSITORY] },
    { provide: UpdateUserProfileUseCase,        useFactory: (r: IUserRepository) => new UpdateUserProfileUseCase(r),        inject: [USER_REPOSITORY] },
    { provide: DeleteUserUseCase,               useFactory: (r: IUserRepository) => new DeleteUserUseCase(r),               inject: [USER_REPOSITORY] },
    { provide: ActivateUserUseCase,             useFactory: (r: IUserRepository) => new ActivateUserUseCase(r),             inject: [USER_REPOSITORY] },
    { provide: DeactivateUserUseCase,           useFactory: (r: IUserRepository) => new DeactivateUserUseCase(r),           inject: [USER_REPOSITORY] },
    { provide: VerifyUserEmailUseCase,          useFactory: (r: IUserRepository) => new VerifyUserEmailUseCase(r),          inject: [USER_REPOSITORY] },
    { provide: UpdateUserRoleUseCase,           useFactory: (r: IUserRepository) => new UpdateUserRoleUseCase(r),           inject: [USER_REPOSITORY] },
    { provide: ListUsersByStatusUseCase,        useFactory: (r: IUserRepository) => new ListUsersByStatusUseCase(r),        inject: [USER_REPOSITORY] },
    { provide: ListUsersByRoleAndStatusUseCase, useFactory: (r: IUserRepository) => new ListUsersByRoleAndStatusUseCase(r), inject: [USER_REPOSITORY] },

    // ─── 4. SQS Event Publisher ──────────────────────────────────────
    {
      provide: USER_EVENT_PUBLISHER,
      useFactory: () => {
        const isLocal = process.env.STAGE === 'local';
        const client = isLocal
          ? createLocalSqsClient()
          : createAwsSqsClient(process.env.AWS_REGION || 'eu-west-2');
        return new SqsFifoEventPublisher(
          client,
          process.env.USER_SQS_QUEUE_URL || '',
        );
      },
    },

    // ─── 5. Application Service ──────────────────────────────────────
    UserApplicationService,
  ],
  // Only export the Application Service — never use cases or repositories
  exports: [UserApplicationService],
})
export class UserModule {}`, 'user.module.ts')}

${callout('info', 'Token naming convention', `<p>Use plain string constants, not enums: <code>const USER_REPOSITORY = 'USER_REPOSITORY'</code>. They are local to the module file and never exported.</p>`)}
</div>
</div>
</section>`;
}

function sectionExceptions() {
  return `
<section class="section" id="exceptions" data-section="exceptions">
<div class="section-inner fade-up">
${sectionHeader('10', '🚦', 'Exception Strategy & DomainExceptionFilter', 'Typed domain exceptions map to HTTP status codes. The filter is the only place that knows about HTTP — the domain never does.')}

<div class="topic">
<h3>Exception Class Hierarchy</h3>
${twoCol(
  `<div class="card"><div class="card-icon">📐</div><h4>Domain Exceptions</h4><p>Entity rule violations. Thrown by domain entity methods. Always conflict (409) or not-found (404).</p><ul style="font-size:0.85rem;color:var(--text-muted);padding-left:16px;margin:8px 0">
    <li><code>UserNotFoundError</code> → 404</li>
    <li><code>EmailAlreadyVerifiedError</code> → 409</li>
    <li><code>CannotActivateNonPendingUserError</code> → 409</li>
    <li><code>CannotModifyNonDraftOrderError</code> → 409</li>
  </ul></div>`,
  `<div class="card"><div class="card-icon">🔍</div><h4>Application Exceptions</h4><p>Input validation failures. Thrown by use cases when business pre-conditions aren't met. Always 400 or 409.</p><ul style="font-size:0.85rem;color:var(--text-muted);padding-left:16px;margin:8px 0">
    <li><code>EmailAlreadyExistsError</code> → 409</li>
    <li><code>InvalidInputError</code> → 400</li>
    <li><code>UserNotFoundError</code> → 404</li>
    <li><code>InvalidUserStatusError</code> → 400</li>
  </ul></div>`
)}

<h3>DomainExceptionFilter</h3>
${codeBlock(`// apps/users/user-api-service/src/presentation/filters/domain-exception.filter.ts

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import { Response } from 'express';
import {
  UserNotFoundError, EmailAlreadyExistsError, InvalidEmailFormatError,
  InvalidNameError, EmailAlreadyVerifiedError,
  CannotActivateNonPendingUserError, CannotActivateUnverifiedEmailError,
  CannotDeactivateDeletedUserError, UserAlreadyDeletedError,
  CannotUpdateDeletedUserError, InvalidInputError,
} from '@mma/user-domain';

const logger = createLogger('user-api-service');

type ErrorConstructor = new (...args: never[]) => Error;

// Ordered map: exception class → HTTP status code
const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  [UserNotFoundError,                   404],
  [InvalidEmailFormatError,             400],
  [InvalidNameError,                    400],
  [InvalidInputError,                   400],
  [EmailAlreadyExistsError,             409],
  [EmailAlreadyVerifiedError,           409],
  [CannotActivateNonPendingUserError,   409],
  [CannotActivateUnverifiedEmailError,  409],
  [CannotDeactivateDeletedUserError,    409],
  [UserAlreadyDeletedError,             409],
  [CannotUpdateDeletedUserError,        409],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Handle NestJS built-in HttpExceptions first
    //    Use getResponse() — NOT .message — to preserve Zod issue arrays
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res    = exception.getResponse();
      if (status >= 500) logger.error(\`[\${exception.constructor.name}] \${status}\`, {}, exception);
      else               logger.warn(\`[\${exception.constructor.name}] \${status}\`);
      response.status(status).json(
        typeof res === 'string'
          ? { statusCode: status, error: exception.constructor.name, message: res }
          : res,
      );
      return;
    }

    // 2. Map typed domain / application exceptions
    if (exception instanceof Error) {
      for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) {
        if (exception instanceof ErrorClass) {
          logger.warn(\`[\${exception.constructor.name}] \${exception.message}\`);
          response.status(statusCode).json({
            statusCode,
            error:   exception.constructor.name,
            message: exception.message,
          });
          return;
        }
      }
    }

    // 3. Unexpected errors — include actual class name and message, never generic strings
    const errorName    = exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    logger.error(\`[\${errorName}] \${errorMessage}\`, {}, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error:      errorName,
      message:    errorMessage,
    });
  }
}`, 'domain-exception.filter.ts')}

<h3>Standardised Error Response Shape</h3>
${codeBlock(`// Every error response from every service uses this exact shape:
{
  "statusCode": 409,
  "error": "CannotActivateNonPendingUserError",
  "message": "User must be in PENDING or INACTIVE status to activate"
}

// Fields:
//   statusCode — HTTP status code (number)
//   error      — exception class name (exception.constructor.name)
//   message    — human-readable error message
//
// Never include: timestamp, path, stack
// Never use generic: "InternalServerError" / "An unexpected error occurred"`, 'error response shape')}

<h3>User Domain Error Map</h3>
${errorMap([
  ['UserNotFoundError', 404, 'findById / findByEmail returned null'],
  ['InvalidEmailFormatError', 400, 'Email does not match regex in User.create()'],
  ['InvalidNameError', 400, 'firstName or lastName is empty after trim()'],
  ['InvalidInputError', 400, 'Use-case-level validation (missing required field)'],
  ['EmailAlreadyExistsError', 409, 'createUser — email already registered'],
  ['EmailAlreadyVerifiedError', 409, 'verifyEmail — already verified'],
  ['CannotActivateNonPendingUserError', 409, 'activate() called on DELETED user'],
  ['CannotActivateUnverifiedEmailError', 409, 'activate() before email verified'],
  ['CannotDeactivateDeletedUserError', 409, 'deactivate() on DELETED user'],
  ['UserAlreadyInactiveError', 409, 'deactivate() already INACTIVE'],
  ['UserAlreadyDeletedError', 409, 'delete() already DELETED'],
  ['CannotUpdateDeletedUserError', 409, 'updateProfile() on DELETED user'],
])}
</div>
</div>
</section>`;
}

function sectionPatterns() {
  return `
<section class="section" id="patterns" data-section="patterns">
<div class="section-inner fade-up">
${sectionHeader('11', '🔗', 'Cross-Service Patterns', 'Three integration patterns: synchronous ACL (real-time gate), async cross-domain events, and choreography sagas.')}

<div class="topic">
<h3>Pattern 1 — Synchronous ACL (HTTP Gate Check)</h3>
<p>Used when an operation <em>cannot proceed</em> without a real-time answer from another service. Example: Order service validates customer before creating an order.</p>

${flowChart([
  { label: 'POST /orders  →  CreateOrderUseCase', type: 'presentation' },
  { label: 'ICustomerValidator.validate(customerId)  — abstract interface', type: 'application' },
  { label: 'CustomerApiClient.validate()  — HTTP call to User API', type: 'infra' },
  { label: 'User API  →  GET /users/:userId  →  UserApplicationService', type: 'domain' },
])}

${codeBlock(`// packages/order-domain/src/application/interfaces/customer-validator.interface.ts

// The port — defined in the consuming domain's application layer
// Never imports from user-domain (no coupling)
export abstract class ICustomerValidator {
  abstract validate(customerId: string): Promise<void>;
  // Throws: CustomerNotFoundError | CustomerNotActiveError
}`, 'customer-validator.interface.ts (port — order domain)')}

${codeBlock(`// apps/orders/order-api-service/src/infrastructure/clients/customer-api.client.ts

import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getOutboundHeaders } from '@mma/telemetry'; // forwards correlation + Authorization
import { ICustomerValidator } from '@mma/order-domain';
import { CustomerNotFoundError, CustomerNotActiveError } from '@mma/order-domain';

// The adapter — in the ORDER service infrastructure (not the user-domain)
@Injectable()
export class CustomerApiClient implements ICustomerValidator {
  constructor(private readonly httpService: HttpService) {}

  async validate(customerId: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(\`\${process.env.API_USER_URL}/users/\${customerId}\`, {
          headers: getOutboundHeaders(),  // Propagates correlationId + Authorization JWT
          timeout: 5000,
        }),
      );
      if (response.data.userStatus !== 'ACTIVE') {
        throw new CustomerNotActiveError(customerId);
      }
    } catch (err) {
      if (err instanceof HttpException) {
        if (err.getStatus() === 404) throw new CustomerNotFoundError(customerId);
        if (err.getStatus() === 409) throw new CustomerNotActiveError(customerId);
      }
      throw err;
    }
  }
}`, 'customer-api.client.ts (adapter — order service)')}
</div>

<div class="topic">
<h3>Pattern 2 — Async Cross-Domain Events (SQS)</h3>
<p>Used when eventual consistency is acceptable. The publisher doesn't wait for the consumer to process the event.</p>

${codeBlock(`// Publishing side (in the use case — not the app service)
await this.eventPublisher.publish({
  eventType: OrderEventTypeEnum.ORDER_CREATED,
  orderId,
  customerId: input.customerId,
  items: input.items,
  occurredAt: new Date().toISOString(),
}, { groupId: orderId });

// Consuming side event schema (in contracts/order/src/event-schemas.ts)
import { z } from 'zod';
import { OrderEventTypeEnum } from '@mma/order-domain';

export const orderCreatedEventSchema = z.object({
  eventType:  z.literal(OrderEventTypeEnum.ORDER_CREATED),
  orderId:    z.string(),
  customerId: z.string(),
  items:      z.array(z.object({
    productId:   z.string(),
    productName: z.string(),
    quantity:    z.number(),
    price:       z.number(),
  })),
  occurredAt: z.string().datetime(),
  correlationId: z.string().optional(),
});

// Discriminated union — the event handler imports THIS, not the domain package
export const orderDomainEventSchema = z.discriminatedUnion('eventType', [
  orderCreatedEventSchema,
  orderConfirmedEventSchema,
  orderCancelledEventSchema,
]);`, 'SQS event publishing + schema')}

${callout('warning', 'Cross-domain import rule', `<p>A service consuming events from another bounded context imports event schemas from <code>@mma/contracts/{publishing-domain}</code>. It must <strong>never</strong> import from <code>@mma/{publishing-domain}-domain</code> (Golden Rule #15).</p>`)}
</div>

<div class="topic">
<h3>Pattern 3 — Choreography Saga (Order → Product Validation)</h3>

${flowChart([
  { label: '1. Order API: CreateOrderUseCase → save DRAFT order + publish ORDER_CREATED to product-events queue', type: 'application' },
  { label: '2. Product Event Handler: validates products → publishes PRODUCT_VALIDATION_SUCCEEDED or PRODUCT_VALIDATION_FAILED to order-events queue', type: 'domain' },
  { label: '3. Order Event Handler: ApproveProductValidationUseCase or FailOrderValidationUseCase (idempotent)', type: 'application' },
  { label: '4. Final state: order → PENDING (success) or order → VALIDATION_FAILED', type: 'infra' },
])}

${codeBlock(`// packages/order-domain/src/application/use-cases/approve-product-validation/
// approve-product-validation.use-case.ts

export class ApproveProductValidationUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: { orderId: string }): Promise<void> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new OrderNotFoundError(input.orderId);

    // ─── Idempotency guard — saga handlers MUST be idempotent ────────
    if (order.getOrderStatus() !== OrderStatusEnum.DRAFT) {
      // Already processed — log and skip (do NOT rethrow)
      return;
    }

    order.approveProductValidation();  // DRAFT → PENDING
    await this.orderRepository.save(order);
  }
}`, 'approve-product-validation.use-case.ts')}

${callout('danger', 'Saga idempotency is mandatory', `<p>SQS delivers messages <em>at least once</em>. Every saga handler MUST check the current state before transitioning. If the order is already past DRAFT, log the skip and return — never rethrow the domain exception.</p>`)}
</div>

<div class="topic">
<h3>Decision Matrix</h3>
<table class="cmp-table">
<thead><tr><th>Question</th><th>Sync ACL</th><th>Async Events</th><th>Choreography Saga</th></tr></thead>
<tbody>
<tr><td>Can operation proceed without an answer?</td><td class="no">No</td><td class="yes">Yes</td><td class="no">No (deferred)</td></tr>
<tr><td>Different bounded context?</td><td class="yes">Yes</td><td class="yes">Yes</td><td class="yes">Yes (both ways)</td></tr>
<tr><td>ACL adapter needed?</td><td class="yes">Yes (HTTP client)</td><td class="no">No</td><td class="no">No</td></tr>
<tr><td>State resolution</td><td>Immediate</td><td>Fire-and-forget</td><td>Eventual (request→response)</td></tr>
<tr><td>Consumer imports publisher's domain package?</td><td class="no">Never</td><td class="no">Never</td><td class="no">Never</td></tr>
</tbody>
</table>
</div>
</div>
</section>`;
}

// ─── Assemble Full HTML ───────────────────────────────────────────────────────

function buildHtml() {
  const navHtml = NAV_ITEMS.map(
    (n) => `<a href="#${n.id}">${n.label}</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Service Implementation Masterclass</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
<div class="scroll-progress"></div>

<nav class="top-nav">
  <a class="nav-brand" href="#">⚡ API Masterclass</a>
  <div class="nav-links">${navHtml}</div>
  <button class="theme-toggle" title="Toggle theme">🌙</button>
</nav>

<header class="hero">
  <div class="hero-content">
    <h1>API Service Implementation<br>Masterclass</h1>
    <p class="lead">End-to-end guide to building production-grade NestJS microservices using Clean Architecture — from domain constants to module wiring, with real code from our codebase.</p>
    <div class="hero-chips">
      <span class="hero-chip">NestJS + TypeScript</span>
      <span class="hero-chip">Clean Architecture</span>
      <span class="hero-chip">DynamoDB OneTable</span>
      <span class="hero-chip">Prisma + PostgreSQL</span>
      <span class="hero-chip">SQS Events</span>
      <span class="hero-chip">Zod Validation</span>
    </div>
    <div class="hero-meta">
      <span>📦 <strong>11 layers covered</strong></span>
      <span>🔢 <strong>Real examples from user, order &amp; product domains</strong></span>
      <span>⚙️ <strong>Golden Rules enforced</strong></span>
    </div>
  </div>
</header>

${sectionArchitecture()}
${sectionConstants()}
${sectionEntity()}
${sectionRepository()}
${sectionUseCases()}
${sectionContracts()}
${sectionAppService()}
${sectionController()}
${sectionModule()}
${sectionExceptions()}
${sectionPatterns()}

<footer>
  <strong>Old Street Labs — API Service Masterclass</strong><br>
  Generated from actual domain examples in the monorepo · Use <code>node scripts/generate-api-service-masterclass.mjs</code> to regenerate
</footer>

<script>${JS}</script>
</body>
</html>`;
}

// ─── Write Output ─────────────────────────────────────────────────────────────

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
const html = buildHtml();
writeFileSync(OUTPUT_PATH, html, 'utf8');
const kb = (html.length / 1024).toFixed(1);
console.log(`✅  Generated: ${OUTPUT_PATH}`);
console.log(`    Size: ${kb} KB`);
console.log(`    Sections: ${NAV_ITEMS.length}`);
