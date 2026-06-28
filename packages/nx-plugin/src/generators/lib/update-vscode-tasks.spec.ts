import { createTree } from '@nx/devkit/testing';
import { addServeTask } from './update-vscode-tasks';

const seed = () => {
  const tree = createTree();
  tree.write(
    '.vscode/tasks.json',
    JSON.stringify({
      version: '2.0.0',
      tasks: [
        { label: 'Services: Start All', dependsOn: ['Service: Serve user-api-service'] },
        { label: 'Service: Serve user-api-service', type: 'shell', command: 'pnpm nx run user-api-service:serve' },
      ],
    }, null, 2),
  );
  return tree;
};

describe('addServeTask', () => {
  it('adds a new serve task and updates compound task dependsOn', () => {
    const tree = seed();
    addServeTask(tree, {
      label: 'Service: Serve shipping-api-service',
      nxProject: 'shipping-api-service',
      appendToCompoundTasks: ['Services: Start All'],
    });
    const json = JSON.parse(tree.read('.vscode/tasks.json', 'utf-8') ?? '{}');
    expect(json.tasks).toHaveLength(3);
    const compound = json.tasks.find((t: { label: string }) => t.label === 'Services: Start All');
    expect(compound.dependsOn).toContain('Service: Serve shipping-api-service');
  });

  it('does not duplicate when called twice', () => {
    const tree = seed();
    addServeTask(tree, {
      label: 'Service: Serve user-api-service',
      nxProject: 'user-api-service',
      appendToCompoundTasks: ['Services: Start All'],
    });
    const json = JSON.parse(tree.read('.vscode/tasks.json', 'utf-8') ?? '{}');
    const labelCount = json.tasks.filter((t: { label: string }) => t.label === 'Service: Serve user-api-service').length;
    expect(labelCount).toBe(1);
    const compound = json.tasks.find((t: { label: string }) => t.label === 'Services: Start All');
    expect(compound.dependsOn.filter((d: string) => d === 'Service: Serve user-api-service')).toHaveLength(1);
  });
});
