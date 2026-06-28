import type { Tree } from '@nx/devkit';

/**
 * Append a section of `KEY=VALUE` lines to the registry env file.
 * Section is prefixed with a `# --- {sectionTitle} ---` header.
 *
 * Idempotent: if a section with the same title already exists in the file,
 * this is a no-op (returns false). Otherwise appends and returns true.
 */
export const appendEnvSection = (
  tree: Tree,
  filePath: string,
  sectionTitle: string,
  entries: Array<{ key: string; value: string }>,
): boolean => {
  const existing = tree.exists(filePath) ? tree.read(filePath, 'utf-8') ?? '' : '';
  const headerLine = `# --- ${sectionTitle} ---`;
  if (existing.includes(headerLine)) {
    return false;
  }
  const block =
    headerLine +
    '\n' +
    entries.map(({ key, value }) => `${key}=${value}`).join('\n') +
    '\n';
  const sep = existing.length > 0 && !existing.endsWith('\n\n') ? '\n' : '';
  tree.write(filePath, existing + sep + block);
  return true;
};
