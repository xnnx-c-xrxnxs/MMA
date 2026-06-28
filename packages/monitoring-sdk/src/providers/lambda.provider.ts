import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionConfigurationCommand,
  InvokeCommand,
  ListVersionsByFunctionCommand,
  GetFunctionConcurrencyCommand,
} from '@aws-sdk/client-lambda';
import {
  ILambdaProvider,
  LambdaFunctionSummary,
  HealthCheckResult,
  LambdaVersionInfo,
  ConcurrencyInfo,
} from '../interfaces/lambda-provider.interface';

function deriveServiceType(functionName: string): 'api' | 'worker' {
  return functionName.includes('event-handler') ? 'worker' : 'api';
}

function toSummary(fn: {
  FunctionName?: string;
  Description?: string;
  Runtime?: string;
  MemorySize?: number;
  Timeout?: number;
  LastModified?: string;
  CodeSize?: number;
  State?: string;
}): LambdaFunctionSummary {
  const functionName = fn.FunctionName ?? '';
  return {
    functionName,
    description: fn.Description ?? '',
    runtime: fn.Runtime ?? '',
    memorySize: fn.MemorySize ?? 0,
    timeout: fn.Timeout ?? 0,
    lastModified: fn.LastModified ?? '',
    codeSize: fn.CodeSize ?? 0,
    state: fn.State ?? 'Active',
    serviceType: deriveServiceType(functionName),
  };
}

/**
 * Builds a minimal API Gateway HTTP API v2 event for GET /api/health.
 * AWS Lambda Web Adapter parses this into an HTTP request and forwards it to the
 * NestJS server running inside the Lambda container.
 */
function buildHealthCheckEvent(domain: string): string {
  return JSON.stringify({
    version: '2.0',
    routeKey: `GET /${domain}/api/health`,
    rawPath: `/${domain}/api/health`,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'monitoring-dashboard/health-check',
    },
    requestContext: {
      accountId: '000000000000',
      apiId: 'health-check',
      domainName: 'monitoring.internal',
      http: {
        method: 'GET',
        path: `/${domain}/api/health`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'monitoring-dashboard/health-check',
      },
      requestId: `health-${Date.now()}`,
      routeKey: `ANY /${domain}/{proxy+}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    pathParameters: { proxy: 'api/health' },
    isBase64Encoded: false,
  });
}

export class LambdaProvider implements ILambdaProvider {
  private readonly client: LambdaClient;

  constructor(region: string) {
    this.client = new LambdaClient({ region });
  }

  async listFunctions(namePrefix: string): Promise<LambdaFunctionSummary[]> {
    const functions: LambdaFunctionSummary[] = [];
    let marker: string | undefined;

    do {
      const response = await this.client.send(
        new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }),
      );

      const matching = (response.Functions ?? [])
        .filter((fn) => fn.FunctionName?.startsWith(namePrefix))
        .map(toSummary);

      functions.push(...matching);
      marker = response.NextMarker;
    } while (marker);

    return functions.sort((a, b) => a.functionName.localeCompare(b.functionName));
  }

  async getFunctionConfig(functionName: string): Promise<LambdaFunctionSummary | null> {
    try {
      const response = await this.client.send(
        new GetFunctionConfigurationCommand({ FunctionName: functionName }),
      );
      return toSummary(response);
    } catch {
      return null;
    }
  }

  async invokeHealthCheck(functionName: string, domain: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await this.client.send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'RequestResponse',
          Payload: new TextEncoder().encode(buildHealthCheckEvent(domain)),
        }),
      );

      const latencyMs = Date.now() - start;
      const payloadStr = response.Payload
        ? new TextDecoder().decode(response.Payload)
        : '';

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(payloadStr) as Record<string, unknown>;
      } catch {
        // payload not JSON
      }

      const statusCode = (parsed.statusCode as number) ?? response.StatusCode ?? 0;
      let body: Record<string, unknown> | null = null;
      try {
        body = typeof parsed.body === 'string'
          ? (JSON.parse(parsed.body) as Record<string, unknown>)
          : (parsed.body as Record<string, unknown>) ?? null;
      } catch {
        body = null;
      }

      return {
        functionName,
        healthy: statusCode >= 200 && statusCode < 300,
        statusCode,
        body,
        latencyMs,
        error: response.FunctionError ?? undefined,
      };
    } catch (err) {
      return {
        functionName,
        healthy: false,
        statusCode: 0,
        body: null,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async listFunctionVersions(functionName: string, limit = 5): Promise<LambdaVersionInfo[]> {
    try {
      let allVersions: { Version?: string; Description?: string; LastModified?: string; CodeSize?: number; Runtime?: string }[] = [];
      let marker: string | undefined;

      // Paginate to collect all versions (AWS returns oldest-first)
      do {
        const response = await this.client.send(
          new ListVersionsByFunctionCommand({
            FunctionName: functionName,
            Marker: marker,
          }),
        );
        allVersions = allVersions.concat(response.Versions ?? []);
        marker = response.NextMarker;
      } while (marker);

      return allVersions
        .filter((v) => v.Version !== '$LATEST')
        .map((v) => ({
          version: v.Version ?? '',
          description: v.Description ?? '',
          lastModified: v.LastModified ?? '',
          codeSize: v.CodeSize ?? 0,
          runtime: v.Runtime ?? '',
        }))
        .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async getConcurrency(functionName: string): Promise<ConcurrencyInfo> {
    try {
      const response = await this.client.send(
        new GetFunctionConcurrencyCommand({ FunctionName: functionName }),
      );
      return {
        functionName,
        reservedConcurrency: response.ReservedConcurrentExecutions ?? null,
        allocatedProvisionedConcurrency: null,
      };
    } catch {
      return {
        functionName,
        reservedConcurrency: null,
        allocatedProvisionedConcurrency: null,
      };
    }
  }
}
