import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';

/**
 * Add (or replace) one or more path aliases in tsconfig.base.json.
 * Throws if the file is missing or already has the alias with a different target.
 */
export const addPathAliases = (
  tree: Tree,
  aliases: Record<string, string>,
): void => {
  const tsconfigPath = 'tsconfig.base.json';
  if (!tree.exists(tsconfigPath)) {
    throw new Error('addPathAliases: tsconfig.base.json not found at workspace root.');
  }
  updateJson(tree, tsconfigPath, (json: { compilerOptions?: { paths?: Record<string, string[]> } }) => {
    json.compilerOptions ??= {};
    json.compilerOptions.paths ??= {};
    const paths = json.compilerOptions.paths;
    for (const [alias, target] of Object.entries(aliases)) {
      const existing = paths[alias];
      if (existing && existing[0] !== target) {
        throw new Error(
          `addPathAliases: alias '${alias}' already exists with target '${existing[0]}' (cannot overwrite with '${target}').`,
        );
      }
      paths[alias] = [target];
    }
    return json;
  });
};
