import { createTree } from '@nx/devkit/testing';
import { addPathAliases } from './update-tsconfig-base';

describe('addPathAliases', () => {
  const seedTree = () => {
    const tree = createTree();
    tree.write(
      'tsconfig.base.json',
      JSON.stringify(
        { compilerOptions: { paths: { '@mma/common': ['packages/common/src/index.ts'] } } },
        null,
        2,
      ),
    );
    return tree;
  };

  it('adds a new alias', () => {
    const tree = seedTree();
    addPathAliases(tree, { '@mma/shipping-domain': 'packages/shipping-domain/src/index.ts' });
    const json = JSON.parse(tree.read('tsconfig.base.json', 'utf-8') ?? '{}');
    expect(json.compilerOptions.paths['@mma/shipping-domain']).toEqual([
      'packages/shipping-domain/src/index.ts',
    ]);
    expect(json.compilerOptions.paths['@mma/common']).toBeDefined();
  });

  it('is idempotent for identical alias+target', () => {
    const tree = seedTree();
    addPathAliases(tree, { '@mma/common': 'packages/common/src/index.ts' });
    expect(() =>
      addPathAliases(tree, { '@mma/common': 'packages/common/src/index.ts' }),
    ).not.toThrow();
  });

  it('throws when overwriting an alias with a different target', () => {
    const tree = seedTree();
    expect(() =>
      addPathAliases(tree, { '@mma/common': 'packages/different/src/index.ts' }),
    ).toThrow();
  });

  it('throws when tsconfig.base.json missing', () => {
    const tree = createTree();
    expect(() => addPathAliases(tree, { '@x/y': 'a/b' })).toThrow();
  });
});
