import type { Tree } from '@nx/devkit';

/**
 * Read all `*_SERVICE_PORT=NNNN` lines from the service-registry.env file
 * and return the next free port starting from `startFrom` (default 3000).
 *
 * Throws if the registry env file is missing.
 */
export const claimNextPort = (
  tree: Tree,
  startFrom = 3000,
  registryEnvPath = '.github/service-registry.env',
): number => {
  if (!tree.exists(registryEnvPath)) {
    throw new Error(
      `claimNextPort: ${registryEnvPath} does not exist — cannot determine next free port.`,
    );
  }

  const content = tree.read(registryEnvPath, 'utf-8') ?? '';
  const used = new Set<number>();
  const portRegex = /^[A-Z][A-Z0-9_]*_SERVICE_PORT\s*=\s*(\d+)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = portRegex.exec(content)) !== null) {
    used.add(Number(match[1]));
  }

  let candidate = startFrom;
  while (used.has(candidate)) candidate++;
  return candidate;
};
