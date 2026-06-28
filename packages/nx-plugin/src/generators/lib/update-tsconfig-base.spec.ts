import { createTree } from '@nx/devkit/testing';
import { addPathAliases } from './update-tsconfig-base';

describe('addPathAliases', () => {
  const seedTree = () => {
    const tree = createTree();
    tree.write(
      'tsconfig.base.json',
      JSON.stringify(
        { compilerOptions: { paths: { '@old-st/common': ['packages/common/src/index.ts'] } } },
        null,
        2,
      ),
    );
    return tree;
  };

  it('adds a new alias', () => {
    const tree = seedTree();
    addPathAliases(tree, { '@old-st/shipping-domain': 'packages/shipping-domain/src/index.ts' });
    const json = JSON.parse(tree.read('tsconfig.base.json', 'utf-8') ?? '{}');
    expect(json.compilerOptions.paths['@old-st/shipping-domain']).toEqual([
      'packages/shipping-domain/src/index.ts',
    ]);
    expect(json.compilerOptions.paths['@old-st/common']).toBeDefined();
  });

  it('is idempotent for identical alias+target', () => {
    const tree = seedTree();
    addPathAliases(tree, { '@old-st/common': 'packages/common/src/index.ts' });
    expect(() =>
      addPathAliases(tree, { '@old-st/common': 'packages/common/src/index.ts' }),
    ).not.toThrow();
  });

  it('throws when overwriting an alias with a different target', () => {
    const tree = seedTree();
    expect(() =>
      addPathAliases(tree, { '@old-st/common': 'packages/different/src/index.ts' }),
    ).toThrow();
  });

  it('throws when tsconfig.base.json missing', () => {
    const tree = createTree();
    expect(() => addPathAliases(tree, { '@x/y': 'a/b' })).toThrow();
  });
});
