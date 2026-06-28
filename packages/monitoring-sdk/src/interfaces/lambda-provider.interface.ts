export interface LambdaFunctionSummary {
  functionName: string;
  description: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  lastModified: string;
  codeSize: number;
  state: string;
  /** Derived from naming convention: contains 'event-handler' = 'worker', otherwise 'api' */
  serviceType: 'api' | 'worker';
}

export interface HealthCheckResult {
  functionName: string;
  healthy: boolean;
  statusCode: number;
  body: Record<string, unknown> | null;
  latencyMs: number;
  error?: string;
}

export interface LambdaVersionInfo {
  version: string;
  description: string;
  lastModified: string;
  codeSize: number;
  runtime: string;
}

export interface ConcurrencyInfo {
  functionName: string;
  reservedConcurrency: number | null;
  allocatedProvisionedConcurrency: number | null;
}

export interface ILambdaProvider {
  listFunctions(namePrefix: string): Promise<LambdaFunctionSummary[]>;
  getFunctionConfig(functionName: string): Promise<LambdaFunctionSummary | null>;
  invokeHealthCheck(functionName: string, domain: string): Promise<HealthCheckResult>;
  listFunctionVersions(functionName: string, limit?: number): Promise<LambdaVersionInfo[]>;
  getConcurrency(functionName: string): Promise<ConcurrencyInfo>;
}
