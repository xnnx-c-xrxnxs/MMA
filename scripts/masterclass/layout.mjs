// Shared CSS, nav, hero, and footer scripts for the Domain Entity Masterclass page.
// Kept in template literals so the build script can interpolate dynamic nav links.

export const HEAD_CSS = /* css */ `
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
  --danger:#ef4444;  --danger-bg:#fef2f2;
  --info:#3b82f6;    --info-bg:#eff6ff;
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
  --danger-bg:#450a0a;  --info-bg:#172554;
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

/* Side-by-side spec & code */
.split { display:grid; grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:20px; margin:24px 0; align-items:stretch; }
.split > .panel { display:flex; flex-direction:column; }

/* Old vs New comparison grid */
.comparison-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin:24px 0; align-items:start; }
.comparison-grid > .panel { display:flex; flex-direction:column; }
.panel.panel-before { border-color:#f97316; }
.panel.panel-before .panel-header { background:#fff7ed; border-bottom-color:#fed7aa; }
.panel.panel-after { border-color:#10b981; }
.panel.panel-after .panel-header { background:#ecfdf5; border-bottom-color:#a7f3d0; }
[data-theme="dark"] .panel.panel-before { border-color:#c2410c; }
[data-theme="dark"] .panel.panel-before .panel-header { background:#431407; border-bottom-color:#7c2d12; }
[data-theme="dark"] .panel.panel-after { border-color:#059669; }
[data-theme="dark"] .panel.panel-after .panel-header { background:#064e3b; border-bottom-color:#065f46; }
.comparison-section-header { font-size:0.82rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-muted); margin:24px 0 8px; padding-left:8px; border-left:3px solid var(--border); }
.panel { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow-sm); }
.panel-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; background:var(--bg-alt); }
.panel-header .icon { font-size:1rem; }
.panel-header .title { font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--text); }
.panel-header .subtitle { font-size:0.75rem; color:var(--text-muted); margin-left:auto; font-family:var(--mono); }
.panel-body { padding:20px 24px; flex:1; overflow:auto; }
.panel-body.code-body { padding:0; background:var(--bg-code); }
.panel-body.code-body pre { margin:0; padding:18px 20px; background:transparent; border-radius:0; font-size:0.78rem; line-height:1.55; max-height:680px; color:var(--bg-code-text); }
.spec-title { font-size:1.05rem; font-weight:700; margin-bottom:12px; color:var(--text); }
.spec-body { font-size:0.92rem; }
.spec-body p { margin-bottom:12px; }
.spec-body ul { padding-left:22px; margin-bottom:12px; }
.spec-body li { margin-bottom:6px; }
.spec-body strong { color:var(--text); font-weight:700; }
.spec-body em { color:var(--accent); font-style:normal; font-weight:600; background:var(--accent-light); padding:1px 6px; border-radius:4px; }

/* Concepts strip */
.concepts { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 8px; }
.concept-pill { display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:600; padding:6px 12px; border-radius:20px; background:var(--accent-light); color:var(--accent); border:1px solid var(--accent); }

/* Exceptions block */
.exceptions { margin-top:20px; }
.exceptions-header { display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--danger); margin-bottom:12px; }
.exceptions pre { font-size:0.76rem; max-height:320px; }

/* Pitfalls callout */
.pitfalls { background:var(--warning-bg); border-left:4px solid var(--warning); border-radius:0 var(--radius-sm) var(--radius-sm) 0; padding:14px 18px; margin-top:20px; }
.pitfalls-title { font-weight:700; font-size:0.85rem; margin-bottom:6px; color:#92400e; display:flex; align-items:center; gap:6px; }
[data-theme="dark"] .pitfalls-title { color:#fef3c7; }
.pitfalls ul { padding-left:20px; margin:0; font-size:0.86rem; }
.pitfalls li { margin-bottom:4px; }

/* Code highlighting (super-light, additive only) */
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

/* Intro module */
.intro-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:14px; margin-top:24px; }
.intro-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:16px; }
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
  .comparison-grid { grid-template-columns:1fr; }
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
`;

export const FOOTER_JS = /* js */ `
(function () {
  const toggle = document.getElementById('themeToggle');
  const setTheme = (dark) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    toggle.textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('entity-masterclass-theme', dark ? 'dark' : 'light');
  };
  toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(!isDark);
  });
  const saved = localStorage.getItem('entity-masterclass-theme');
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
`;

export function renderShell({ title, navItems, hero, body, brand = 'Domain Entities', extraHeadCss = '' }) {
  const navHtml = navItems.map((n) => `<a href="#${n.id}">${n.label}</a>`).join('\n    ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>${HEAD_CSS}${extraHeadCss}</style>
</head>
<body>
<div class="scroll-progress" id="scrollProgress"></div>
<nav class="top-nav" id="topNav">
  <a href="#" class="nav-brand">${brand}</a>
  <div class="nav-links" id="navLinks">
    ${navHtml}
  </div>
  <div class="nav-controls">
    <button class="theme-toggle" id="themeToggle" title="Toggle dark mode">🌙</button>
    <button class="hamburger" id="hamburger" title="Menu">☰</button>
  </div>
</nav>
${hero}
${body}
<script>${FOOTER_JS}</script>
</body>
</html>`;
}
