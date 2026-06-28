import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';

const TASKS_PATH = '.vscode/tasks.json';

interface VscodeTasksShape {
  tasks?: Array<Record<string, unknown>>;
}

/**
 * Append a `Service: Serve {label}` shell task and add it to the
 * dependsOn arrays of the named compound tasks (e.g. `Services: Start All`,
 * `Domain: Start Shipping`).
 *
 * Idempotent: if a task with `label` already exists, only updates dependsOn arrays.
 */
export const addServeTask = (
  tree: Tree,
  options: {
    label: string; // e.g. "Service: Serve shipping-api-service"
    nxProject: string; // e.g. "shipping-api-service"
    appendToCompoundTasks: string[]; // e.g. ["Services: Start All", "Domain: Start Shipping"]
  },
): void => {
  if (!tree.exists(TASKS_PATH)) {
    throw new Error(`addServeTask: ${TASKS_PATH} not found.`);
  }
  updateJson(tree, TASKS_PATH, (json: VscodeTasksShape) => {
    json.tasks ??= [];
    const exists = json.tasks.some((t) => t.label === options.label);
    if (!exists) {
      json.tasks.push({
        label: options.label,
        type: 'shell',
        command: `pnpm nx run ${options.nxProject}:serve`,
        isBackground: true,
        problemMatcher: [],
        presentation: { reveal: 'always', panel: 'dedicated' },
      });
    }
    for (const compoundLabel of options.appendToCompoundTasks) {
      const compound = json.tasks.find((t) => t.label === compoundLabel);
      if (!compound) continue;
      const deps = (compound['dependsOn'] as string[] | undefined) ?? [];
      if (!deps.includes(options.label)) {
        deps.push(options.label);
        compound['dependsOn'] = deps;
      }
    }
    return json;
  });
};
