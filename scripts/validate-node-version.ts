import * as fs from 'fs';
import * as path from 'path';

const nvmrcPath = path.resolve(__dirname, '..', '.nvmrc');
const requiredMajor = parseInt(
  fs.readFileSync(nvmrcPath, 'utf-8').trim(),
  10,
);
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);

if (currentMajor < requiredMajor) {
  console.error(
    `\n❌  Node.js version mismatch!\n` +
      `   Required: >= ${requiredMajor} (from .nvmrc)\n` +
      `   Running:  ${process.version}\n\n` +
      `   Fix: run "nvm use" (or "nvm install ${requiredMajor}" first) in an admin terminal, then restart VS Code.\n`,
  );
  process.exit(1);
}

console.log(`✅  Node.js ${process.version} meets requirement (>= ${requiredMajor})`);
