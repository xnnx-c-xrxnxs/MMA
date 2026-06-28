// Build script — assembles the Frontend Webapp Masterclass HTML.
//
// Run with:
//   node scripts/masterclass/build-fe-webapp.mjs
//
// Output:
//   docs/tutorial/fe-webapp-masterclass.html

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { renderShell } from './layout.mjs';
import { renderComparisonModule, renderHero, renderIntroModule, renderModule } from './render.mjs';

import architectureOverview from './fe-webapp/01-architecture-overview.mjs';
import fileStructure from './fe-webapp/02-file-structure.mjs';
import staticSiteGeneration from './fe-webapp/03-static-site-generation.mjs';
import dataAccessLayer from './fe-webapp/04-data-access-layer.mjs';
import uiPrimitives from './fe-webapp/05-ui-primitives.mjs';
import pageThinOrchestrator from './fe-webapp/06-page-thin-orchestrator.mjs';
import authFlow from './fe-webapp/07-auth-flow.mjs';
import formsRhfZod from './fe-webapp/08-forms-rhf-zod.mjs';
import componentPatterns from './fe-webapp/09-component-patterns.mjs';
import newCodebaseSetup from './fe-webapp/10-new-codebase-setup.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(
    __dirname,
    '../../docs/tutorial/fe-webapp-masterclass.html',
);

const modules = [
    architectureOverview,
    fileStructure,
    staticSiteGeneration,
    dataAccessLayer,
    uiPrimitives,
    pageThinOrchestrator,
    authFlow,
    formsRhfZod,
    componentPatterns,
    newCodebaseSetup,
];

const navItems = [
    { id: 'overview', label: 'Overview' },
    ...modules.map((m, i) => ({ id: m.id, label: `${i + 1}. ${m.title}` })),
];

const hero = renderHero({
    title: 'Frontend Webapp<br>Masterclass',
    lead: 'Ten real-world lessons on building a production Next.js webapp with Clean Architecture — comparing every decision against the old template so you understand not just <em>what</em> changed, but <em>why</em>.',
    meta: [
        '🖥️ <strong>Clean Architecture · Frontend Layer</strong>',
        '📊 <strong>10 Modules · Old vs New</strong>',
        '⚡ <strong>Static Site Generation · S3 + CloudFront</strong>',
        '🔒 <strong>Secure Auth · httpOnly Cookies + React Query</strong>',
    ],
});

const body = [
    renderIntroModule(modules),
    renderModule(architectureOverview),           // Module 01 — architecture only (no comparison)
    renderComparisonModule(fileStructure),         // Module 02
    renderComparisonModule(staticSiteGeneration),  // Module 03
    renderComparisonModule(dataAccessLayer),       // Module 04
    renderComparisonModule(uiPrimitives),          // Module 05
    renderComparisonModule(pageThinOrchestrator),  // Module 06
    renderComparisonModule(authFlow),              // Module 07
    renderComparisonModule(formsRhfZod),           // Module 08
    renderComparisonModule(componentPatterns),     // Module 09
    renderComparisonModule(newCodebaseSetup),       // Module 10
].join('\n\n');

const html = renderShell({
    title: 'Frontend Webapp Masterclass',
    navItems,
    hero,
    body,
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html, 'utf8');
console.log(
    `✓ wrote ${path.relative(process.cwd(), OUTPUT)} (${(html.length / 1024).toFixed(1)} KB)`,
);
