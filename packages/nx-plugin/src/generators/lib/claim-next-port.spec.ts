import { createTree } from '@nx/devkit/testing';
import { claimNextPort } from './claim-next-port';

describe('claimNextPort', () => {
  it('returns startFrom when no ports are claimed', () => {
    const tree = createTree();
    tree.write('.github/service-registry.env', '# header\n');
    expect(claimNextPort(tree)).toBe(3000);
    expect(claimNextPort(tree, 4000)).toBe(4000);
  });

  it('skips already-claimed ports', () => {
    const tree = createTree();
    tree.write(
      '.github/service-registry.env',
      'USER_SERVICE_PORT=3000\nPRODUCT_SERVICE_PORT=3001\nORDER_SERVICE_PORT=3002\n',
    );
    expect(claimNextPort(tree)).toBe(3003);
  });

  it('handles non-contiguous claimed ports', () => {
    const tree = createTree();
    tree.write(
      '.github/service-registry.env',
      'A_SERVICE_PORT=3000\nB_SERVICE_PORT=3002\n',
    );
    expect(claimNextPort(tree)).toBe(3001);
  });

  it('throws when registry env file is missing', () => {
    const tree = createTree();
    expect(() => claimNextPort(tree)).toThrow();
  });
});
