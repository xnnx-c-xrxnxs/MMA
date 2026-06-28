// Build script — assembles the Domain Entity Masterclass HTML.
// Run with:  node scripts/masterclass/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { renderShell } from './layout.mjs';
import { renderHero, renderIntroModule, renderModule } from './render.mjs';

import category from './entities/01-category.mjs';
import productBasic from './entities/02-product-basic.mjs';
import user from './entities/03-user.mjs';
import productLifecycle from './entities/04-product-lifecycle.mjs';
import customerAddress from './entities/05-customer-address.mjs';
import orderItems from './entities/06-order-items.mjs';
import shipment from './entities/07-shipment.mjs';
import orderAggregate from './entities/08-order-aggregate.mjs';
import subscription from './entities/09-subscription.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, '../../docs/tutorial/domain-entities-masterclass.html');

const entities = [
  category, productBasic, user, productLifecycle, customerAddress,
  orderItems, shipment, orderAggregate, subscription,
];

const navItems = [
  { id: 'overview', label: 'Overview' },
  ...entities.map((e, i) => ({ id: e.id, label: `${i + 1}. ${e.title}` })),
];

const hero = renderHero({
  title: 'Domain Entity<br>Masterclass',
  lead: 'Nine real-world domain entities, from a single-field Category to a multi-state Subscription. Each example pairs a written specification with the production code that satisfies it.',
  meta: [
    '🧱 <strong>Clean Architecture · Domain Layer</strong>',
    '📈 <strong>9 Levels · Simple → Complex</strong>',
    '✅ <strong>Real code from this repo</strong>',
  ],
});

const body = [
  renderIntroModule(entities),
  ...entities.map(renderModule),
].join('\n\n');

const html = renderShell({
  title: 'Domain Entity Masterclass',
  navItems,
  hero,
  body,
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, html, 'utf8');
console.log(`✓ wrote ${path.relative(process.cwd(), OUTPUT)} (${(html.length / 1024).toFixed(1)} KB)`);
