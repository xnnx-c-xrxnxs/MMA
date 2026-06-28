#!/usr/bin/env node

// ensure-node.js — Run a command using the Node version specified in .nvmrc
// Cross-platform: works with nvm-for-windows (NVM_HOME) and nvm-sh (NVM_DIR).
// Usage: node scripts/ensure-node.js <command> [args...]

const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const nvmrcPath = path.resolve(__dirname, '..', '.nvmrc');
if (!fs.existsSync(nvmrcPath)) {
  console.error('❌  .nvmrc not found at', nvmrcPath);
  process.exit(1);
}

const requiredMajor = parseInt(fs.readFileSync(nvmrcPath, 'utf-8').trim(), 10);
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);

// If the current Node already satisfies .nvmrc, just run the command directly
if (currentMajor >= requiredMajor) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error('Usage: node scripts/ensure-node.js <command> [args...]');
    process.exit(1);
  }
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: true });
  process.exit(result.status || 0);
}

// Otherwise, find the correct Node version from nvm
const isWindows = os.platform() === 'win32';
let nodeBinDir = null;

if (isWindows) {
  // nvm-for-windows: NVM_HOME/v{version}/node.exe
  const nvmHome = process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm');
  nodeBinDir = findVersionDir(nvmHome, requiredMajor);
} else {
  // nvm-sh (macOS/Linux): NVM_DIR/versions/node/v{version}/bin/node
  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  const versionsDir = path.join(nvmDir, 'versions', 'node');
  const versionDir = findVersionDir(versionsDir, requiredMajor);
  if (versionDir) {
    nodeBinDir = path.join(versionDir, 'bin');
  }
}

if (!nodeBinDir) {
  console.error(
    `❌  Node.js ${requiredMajor} is not installed in nvm.\n` +
    `   Running:  ${process.version}\n` +
    `   Fix: run "nvm install ${requiredMajor}"\n`
  );
  process.exit(1);
}

// Prepend the correct Node to PATH
const pathSep = isWindows ? ';' : ':';
const newPath = nodeBinDir + pathSep + process.env.PATH;
const env = { ...process.env, PATH: newPath };

// Verify the resolved Node version
try {
  const resolvedVersion = execFileSync(
    path.join(nodeBinDir, isWindows ? 'node.exe' : 'node'),
    ['-v'],
    { encoding: 'utf-8', env }
  ).trim();
  console.log(`✅  Using Node ${resolvedVersion} from ${nodeBinDir}`);
} catch {
  console.error(`❌  Failed to verify Node at ${nodeBinDir}`);
  process.exit(1);
}

// Run the actual command
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/ensure-node.js <command> [args...]');
  process.exit(1);
}

const result = spawnSync(cmd, args, { stdio: 'inherit', env, shell: true });
process.exit(result.status || 0);

// ── Helpers ──────────────────────────────────────────────────────────────────

function findVersionDir(baseDir, major) {
  if (!fs.existsSync(baseDir)) return null;

  const dirs = fs.readdirSync(baseDir)
    .filter((d) => {
      const match = d.match(/^v?(\d+)\./);
      return match && parseInt(match[1], 10) === major;
    })
    .map((d) => ({
      name: d,
      version: parseVersion(d),
    }))
    .sort((a, b) => compareVersions(b.version, a.version)); // descending

  if (dirs.length === 0) return null;
  return path.join(baseDir, dirs[0].name);
}

function parseVersion(str) {
  const match = str.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
