import { createTree } from '@nx/devkit/testing';
import { appendEnvSection } from './update-env-file';

describe('appendEnvSection', () => {
  it('creates the file if missing', () => {
    const tree = createTree();
    const wrote = appendEnvSection(tree, '.env.local.example', 'Shipping', [
      { key: 'SHIPPING_SERVICE_PORT', value: '3005' },
    ]);
    expect(wrote).toBe(true);
    const content = tree.read('.env.local.example', 'utf-8') ?? '';
    expect(content).toContain('# --- Shipping ---');
    expect(content).toContain('SHIPPING_SERVICE_PORT=3005');
  });

  it('is idempotent for the same section title', () => {
    const tree = createTree();
    appendEnvSection(tree, '.env.local.example', 'Shipping', [{ key: 'A', value: '1' }]);
    const wrote = appendEnvSection(tree, '.env.local.example', 'Shipping', [{ key: 'B', value: '2' }]);
    expect(wrote).toBe(false);
    const content = tree.read('.env.local.example', 'utf-8') ?? '';
    expect(content).toContain('A=1');
    expect(content).not.toContain('B=2');
  });
});
