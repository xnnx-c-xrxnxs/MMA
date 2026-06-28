import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';

const REGISTRY_PATH = '.github/service-registry.json';

export interface ApiServiceRegistryEntry {
  name: string;
  distPath: string;
  domain: string;
  type: 'api';
  handler: string;
  memorySize: number;
  timeout: number;
  envVars: string[];
  requiresVpc?: boolean;
  sqsQueueRef?: string;
}

export interface EventHandlerServiceRegistryEntry {
  name: string;
  distPath: string;
  domain: string;
  type: 'worker';
  handler: string;
  memorySize: number;
  timeout: number;
  /** Env var name (NOT URL) of the queue this worker is bound to via Lambda event source. */
  sqsQueueRef: string;
  envVars: string[];
  requiresVpc?: boolean;
}

export interface DynamoTableRegistryEntry {
  envVar: string;
  domain: string;
  gsis: Array<{
    indexName: string;
    hashKey: string;
    hashKeyType: 'S' | 'N';
    sortKey?: string;
    sortKeyType?: 'S' | 'N';
  }>;
}

export interface SqsQueueRegistryEntry {
  envVar: string;
  domain: string;
  fifo: boolean;
  description: string;
}

export interface PublicRouteEntry {
  service: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ANY';
  path: string;
}

interface ServiceRegistryShape {
  apiServices?: ApiServiceRegistryEntry[];
  eventHandlerServices?: EventHandlerServiceRegistryEntry[];
  webapp?: unknown;
  infrastructure?: {
    dynamodbTables?: DynamoTableRegistryEntry[];
    sqsQueues?: SqsQueueRegistryEntry[];
    rds?: unknown[];
    s3Buckets?: unknown[];
  };
  deployTasks?: unknown[];
  gatewayAuth?: { enabled?: boolean; publicRoutes?: PublicRouteEntry[] };
}

/** Add an api service entry. Throws if a service with the same name already exists. */
export const addApiServiceEntry = (
  tree: Tree,
  entry: ApiServiceRegistryEntry,
): void => {
  ensureRegistry(tree);
  updateJson(tree, REGISTRY_PATH, (json: ServiceRegistryShape) => {
    json.apiServices ??= [];
    if (json.apiServices.some((s) => s.name === entry.name)) {
      throw new Error(
        `addApiServiceEntry: service '${entry.name}' is already registered in service-registry.json.`,
      );
    }
    json.apiServices.push(entry);
    return json;
  });
};

/**
 * Seed the standard public routes for a new HTTP API service:
 *   - GET /api/health           (CD smoke test + load balancer probe)
 *   - GET /api/swagger          (Swagger UI HTML, env-gated by SWAGGER_ENABLED)
 *   - GET /api/swagger-json     (OpenAPI JSON)
 *   - GET /api/swagger/{proxy+} (Swagger UI static bundle: JS, CSS, icons)
 *
 * The Swagger routes are declared unconditionally because the gateway cannot
 * introspect Lambda env vars — unused routes simply return 404. Without them,
 * the gateway returns 401 for Swagger asset requests and the docs page is
 * blank. Idempotent: skips entries that already exist (matched by
 * service+method+path).
 */
export const addPublicRoutesForService = (
  tree: Tree,
  serviceName: string,
): void => {
  ensureRegistry(tree);
  const standard: PublicRouteEntry[] = [
    { service: serviceName, method: 'GET', path: '/api/health' },
    { service: serviceName, method: 'GET', path: '/api/swagger' },
    { service: serviceName, method: 'GET', path: '/api/swagger-json' },
    { service: serviceName, method: 'GET', path: '/api/swagger/{proxy+}' },
  ];
  updateJson(tree, REGISTRY_PATH, (json: ServiceRegistryShape) => {
    json.gatewayAuth ??= { enabled: true, publicRoutes: [] };
    json.gatewayAuth.publicRoutes ??= [];
    for (const route of standard) {
      const exists = json.gatewayAuth.publicRoutes.some(
        (r) =>
          r.service === route.service &&
          r.method === route.method &&
          r.path === route.path,
      );
      if (!exists) {
        json.gatewayAuth.publicRoutes.push(route);
      }
    }
    return json;
  });
};

/** Add an event-handler (worker) service entry. Throws if the service is already registered. */
export const addEventHandlerServiceEntry = (
  tree: Tree,
  entry: EventHandlerServiceRegistryEntry,
): void => {
  ensureRegistry(tree);
  updateJson(tree, REGISTRY_PATH, (json: ServiceRegistryShape) => {
    json.eventHandlerServices ??= [];
    if (json.eventHandlerServices.some((s) => s.name === entry.name)) {
      throw new Error(
        `addEventHandlerServiceEntry: service '${entry.name}' is already registered in service-registry.json.`,
      );
    }
    json.eventHandlerServices.push(entry);
    return json;
  });
};

/** Add an SQS queue entry under infrastructure.sqsQueues. Idempotent (no-op if envVar already exists). */
export const addSqsQueueEntry = (
  tree: Tree,
  entry: SqsQueueRegistryEntry,
): void => {
  ensureRegistry(tree);
  updateJson(tree, REGISTRY_PATH, (json: ServiceRegistryShape) => {
    json.infrastructure ??= {};
    json.infrastructure.sqsQueues ??= [];
    if (json.infrastructure.sqsQueues.some((q) => q.envVar === entry.envVar)) {
      return json;
    }
    json.infrastructure.sqsQueues.push(entry);
    return json;
  });
};

/** Add a DynamoDB table entry. Throws if envVar already exists. */
export const addDynamoTableEntry = (
  tree: Tree,
  entry: DynamoTableRegistryEntry,
): void => {
  ensureRegistry(tree);
  updateJson(tree, REGISTRY_PATH, (json: ServiceRegistryShape) => {
    json.infrastructure ??= {};
    json.infrastructure.dynamodbTables ??= [];
    if (json.infrastructure.dynamodbTables.some((t) => t.envVar === entry.envVar)) {
      throw new Error(
        `addDynamoTableEntry: table envVar '${entry.envVar}' already in service-registry.json.`,
      );
    }
    json.infrastructure.dynamodbTables.push(entry);
    return json;
  });
};

const ensureRegistry = (tree: Tree): void => {
  if (!tree.exists(REGISTRY_PATH)) {
    throw new Error(`Service registry not found at ${REGISTRY_PATH}.`);
  }
};
