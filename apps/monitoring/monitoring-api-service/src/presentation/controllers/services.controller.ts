import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MonitoringService } from '../../application/services/monitoring.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { MetricQuery } from '@mma/monitoring-sdk';

/** Lambda pricing constants (us-east-1 / eu-west-2 standard pricing). */
const PRICE_PER_GB_SECOND = 0.0000166667;
const PRICE_PER_REQUEST = 0.0000002;

@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // ─── List Services ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all Lambda functions grouped by type (api/worker)' })
  @Get()
  async listServices() {
    const namePrefix = this.monitoringService.getNamePrefix();
    const [functions, alarms] = await Promise.all([
      this.monitoringService.getLambda().listFunctions(namePrefix),
      this.monitoringService.getMetrics().listAlarms(namePrefix),
    ]);

    const enriched = functions.map((fn) => {
      const relatedAlarms = alarms.filter((a) =>
        a.alarmName.includes(fn.functionName.replace(namePrefix + '-', '')),
      );
      return { ...fn, alarms: relatedAlarms };
    });

    const apiServices = enriched.filter((fn) => fn.serviceType === 'api');
    const workerServices = enriched.filter((fn) => fn.serviceType === 'worker');

    return { apiServices, workerServices, allAlarms: alarms };
  }

  // ─── Function Config ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get Lambda function configuration (last modified, runtime, etc.)' })
  @ApiParam({ name: 'functionName', required: true })
  @Get(':functionName/config')
  async getFunctionConfig(
    @Param('functionName') functionName: string,
  ) {
    const config = await this.monitoringService.getLambda().getFunctionConfig(functionName);
    if (!config) {
      return { error: 'Function not found' };
    }
    return config;
  }

  // ─── Health Check ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Invoke health check on an API Lambda function' })
  @ApiParam({ name: 'functionName', required: true })
  @ApiQuery({ name: 'domain', required: true, description: 'Service domain (e.g. user, product, order)' })
  @Post(':functionName/health-check')
  async healthCheck(
    @Param('functionName') functionName: string,
    @Query('domain') domain: string,
  ) {
    return this.monitoringService.getLambda().invokeHealthCheck(functionName, domain);
  }

  // ─── Logs ──────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get recent logs for a Lambda function' })
  @ApiQuery({ name: 'functionName', required: true })
  @ApiQuery({ name: 'minutes', required: false, description: 'Look-back window in minutes (default 30)' })
  @ApiQuery({ name: 'filter', required: false, description: 'CloudWatch filter pattern (e.g. ERROR, WARN)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max log lines to return (default 4)' })
  @ApiQuery({ name: 'nextToken', required: false })
  @Get('logs')
  async getLogs(
    @Query('functionName') functionName: string,
    @Query('minutes') minutesStr: string,
    @Query('filter') filter: string,
    @Query('limit') limitStr: string,
    @Query('nextToken') nextToken: string,
  ) {
    const minutes = parseInt(minutesStr ?? '30', 10);
    const limit = parseInt(limitStr ?? '4', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    // CloudWatch FilterLogEvents returns oldest-first. Fetch a larger batch
    // and return only the most recent `limit` lines in descending order.
    const fetchSize = Math.max(limit * 25, 100);
    const result = await this.monitoringService.getLogs().queryLogs({
      functionName,
      startTime,
      endTime,
      filterPattern: filter ?? undefined,
      limit: fetchSize,
      nextToken: nextToken ?? undefined,
    });

    const sorted = [...result.lines].sort((a, b) => b.timestamp - a.timestamp);
    return {
      lines: sorted.slice(0, limit),
      nextToken: result.nextToken,
    };
  }

  // ─── Per-Function Metrics ──────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get Lambda error + duration metrics for a function' })
  @ApiQuery({ name: 'functionName', required: true })
  @ApiQuery({ name: 'hours', required: false, description: 'Look-back window in hours (default 1)' })
  @Get('metrics')
  async getMetrics(
    @Query('functionName') functionName: string,
    @Query('hours') hoursStr: string,
  ) {
    const hours = parseInt(hoursStr ?? '1', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    return this.monitoringService.getMetrics().getMetricData({
      startTime,
      endTime,
      queries: [
        { namespace: 'AWS/Lambda', metricName: 'Errors', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'Sum' },
        { namespace: 'AWS/Lambda', metricName: 'Invocations', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'Sum' },
        { namespace: 'AWS/Lambda', metricName: 'Throttles', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'Sum' },
        { namespace: 'AWS/Lambda', metricName: 'Duration', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'p95' },
        { namespace: 'AWS/Lambda', metricName: 'Duration', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'p99' },
      ],
    });
  }

  // ─── Batch Metrics Overview ────────────────────────────────────────────────

  @ApiOperation({ summary: 'Batch metrics overview for all functions: errors, invocations, max memory, concurrency (5-min periods)' })
  @ApiQuery({ name: 'hours', required: false, description: 'Look-back window in hours (default 1)' })
  @Get('metrics-overview')
  async getMetricsOverview(
    @Query('hours') hoursStr: string,
  ) {
    const namePrefix = this.monitoringService.getNamePrefix();
    const hours = parseInt(hoursStr ?? '1', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const functions = await this.monitoringService.getLambda().listFunctions(namePrefix);

    // Build batch CW queries: 3 metrics per function (Errors, Invocations, MaxMemoryUsed)
    const queries: MetricQuery[] = [];
    for (const fn of functions) {
      queries.push(
        { namespace: 'AWS/Lambda', metricName: 'Errors', dimensionName: 'FunctionName', dimensionValue: fn.functionName, stat: 'Sum', periodSeconds: 300 },
        { namespace: 'AWS/Lambda', metricName: 'Invocations', dimensionName: 'FunctionName', dimensionValue: fn.functionName, stat: 'Sum', periodSeconds: 300 },
        { namespace: 'AWS/Lambda', metricName: 'ConcurrentExecutions', dimensionName: 'FunctionName', dimensionValue: fn.functionName, stat: 'Maximum', periodSeconds: 300 },
      );
    }

    const results = queries.length > 0
      ? await this.monitoringService.getMetrics().getMetricData({ startTime, endTime, queries })
      : [];

    // Group results by function name
    const overview: Record<string, {
      totalErrors: number;
      totalInvocations: number;
      errorRate: number;
      errorSparkline: { timestamp: string; value: number }[];
      invocationSparkline: { timestamp: string; value: number }[];
      maxConcurrency: number;
    }> = {};

    for (let i = 0; i < functions.length; i++) {
      const fn = functions[i];
      const errorsResult = results[i * 3];
      const invocationsResult = results[i * 3 + 1];
      const concurrencyResult = results[i * 3 + 2];

      const totalErrors = (errorsResult?.dataPoints ?? []).reduce((sum, dp) => sum + dp.value, 0);
      const totalInvocations = (invocationsResult?.dataPoints ?? []).reduce((sum, dp) => sum + dp.value, 0);

      overview[fn.functionName] = {
        totalErrors,
        totalInvocations,
        errorRate: totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0,
        errorSparkline: (errorsResult?.dataPoints ?? [])
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map((dp) => ({ timestamp: new Date(dp.timestamp).toISOString(), value: dp.value })),
        invocationSparkline: (invocationsResult?.dataPoints ?? [])
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map((dp) => ({ timestamp: new Date(dp.timestamp).toISOString(), value: dp.value })),
        maxConcurrency: Math.max(0, ...(concurrencyResult?.dataPoints ?? []).map((dp) => dp.value)),
      };
    }

    return { overview, startTime: startTime.toISOString(), endTime: endTime.toISOString() };
  }

  // ─── Deployment History ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get recent deployment versions for a Lambda function' })
  @ApiParam({ name: 'functionName', required: true })
  @ApiQuery({ name: 'limit', required: false, description: 'Max versions to return (default 5)' })
  @Get(':functionName/versions')
  async getFunctionVersions(
    @Param('functionName') functionName: string,
    @Query('limit') limitStr: string,
  ) {
    const limit = parseInt(limitStr ?? '5', 10);
    return this.monitoringService.getLambda().listFunctionVersions(functionName, limit);
  }

  // ─── Cold Start Analysis ───────────────────────────────────────────────────

  @ApiOperation({ summary: 'Analyze cold starts for a Lambda function from INIT_START log messages' })
  @ApiParam({ name: 'functionName', required: true })
  @ApiQuery({ name: 'minutes', required: false, description: 'Look-back window in minutes (default 60)' })
  @Get(':functionName/cold-starts')
  async getColdStarts(
    @Param('functionName') functionName: string,
    @Query('minutes') minutesStr: string,
  ) {
    const minutes = parseInt(minutesStr ?? '60', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    const result = await this.monitoringService.getLogs().queryLogs({
      functionName,
      startTime,
      endTime,
      filterPattern: 'INIT_START',
      limit: 100,
    });

    // Parse init durations from INIT_START messages
    // Format: "INIT_START Runtime Version: ... Runtime Version ARN: ..."
    const initDurations: number[] = [];
    for (const line of result.lines) {
      const match = line.message.match(/Init Duration:\s*([\d.]+)\s*ms/);
      if (match) {
        initDurations.push(parseFloat(match[1]));
      }
    }

    const count = result.lines.length;
    const avgDuration = initDurations.length > 0
      ? initDurations.reduce((a, b) => a + b, 0) / initDurations.length
      : 0;
    const maxDuration = initDurations.length > 0 ? Math.max(...initDurations) : 0;

    return {
      functionName,
      coldStartCount: count,
      avgInitDurationMs: Math.round(avgDuration * 100) / 100,
      maxInitDurationMs: Math.round(maxDuration * 100) / 100,
      windowMinutes: minutes,
    };
  }

  // ─── DLQ Depths ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get DLQ message depths for all project queues' })
  @Get('dlq')
  async getDlqDepths() {
    const namePrefix = this.monitoringService.getNamePrefix();
    const dlqs = await this.monitoringService.getSqs().getDlqDepths(namePrefix);
    return { dlqs };
  }

  // ─── Concurrency ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get concurrency configuration for a Lambda function' })
  @ApiParam({ name: 'functionName', required: true })
  @Get(':functionName/concurrency')
  async getConcurrency(
    @Param('functionName') functionName: string,
  ) {
    return this.monitoringService.getLambda().getConcurrency(functionName);
  }

  // ─── Cost Estimation ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Estimate Lambda cost for a function based on recent metrics' })
  @ApiParam({ name: 'functionName', required: true })
  @ApiQuery({ name: 'hours', required: false, description: 'Look-back window in hours (default 24)' })
  @Get(':functionName/cost')
  async estimateCost(
    @Param('functionName') functionName: string,
    @Query('hours') hoursStr: string,
  ) {
    const hours = parseInt(hoursStr ?? '24', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    // Get function config for memory size
    const config = await this.monitoringService.getLambda().getFunctionConfig(functionName);
    const memoryMb = config?.memorySize ?? 128;

    // Get invocation + duration metrics
    const results = await this.monitoringService.getMetrics().getMetricData({
      startTime,
      endTime,
      queries: [
        { namespace: 'AWS/Lambda', metricName: 'Invocations', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'Sum' },
        { namespace: 'AWS/Lambda', metricName: 'Duration', dimensionName: 'FunctionName', dimensionValue: functionName, stat: 'Average' },
      ],
    });

    const totalInvocations = (results[0]?.dataPoints ?? []).reduce((sum, dp) => sum + dp.value, 0);
    const avgDurationMs = (results[1]?.dataPoints ?? []).length > 0
      ? (results[1]?.dataPoints ?? []).reduce((sum, dp) => sum + dp.value, 0) / (results[1]?.dataPoints ?? []).length
      : 0;

    const avgDurationSeconds = avgDurationMs / 1000;
    const memoryGb = memoryMb / 1024;

    // Compute cost
    const computeCost = totalInvocations * avgDurationSeconds * memoryGb * PRICE_PER_GB_SECOND;
    const requestCost = totalInvocations * PRICE_PER_REQUEST;
    const totalCost = computeCost + requestCost;

    // Extrapolate to monthly
    const hoursInMonth = 730;
    const monthlyCost = hours > 0 ? (totalCost / hours) * hoursInMonth : 0;

    return {
      functionName,
      windowHours: hours,
      memoryMb,
      totalInvocations: Math.round(totalInvocations),
      avgDurationMs: Math.round(avgDurationMs * 100) / 100,
      computeCost: Math.round(computeCost * 1000000) / 1000000,
      requestCost: Math.round(requestCost * 1000000) / 1000000,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
    };
  }

  // ─── Service Dependency Map ────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get X-Ray service dependency graph' })
  @ApiQuery({ name: 'hours', required: false, description: 'Look-back window in hours (default 1)' })
  @Get('service-map')
  async getServiceMap(
    @Query('hours') hoursStr: string,
  ) {
    const hours = parseInt(hoursStr ?? '1', 10);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    return this.monitoringService.getTraces().getServiceGraph(startTime, endTime);
  }

  // ─── Static Architecture Map ───────────────────────────────────────────────

  @ApiOperation({ summary: 'Get static architecture graph derived from service-registry.json', description: 'Returns all services, queues, data stores and their connections regardless of runtime activity.' })
  @Get('architecture-map')
  async getArchitectureMap() {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Deployed Lambda: file is copied to output dir via webpack assets.
    // Local dev (nx serve): resolve from workspace root.
    const candidates = [
      path.resolve(__dirname, 'service-registry.json'),
      path.resolve(process.cwd(), '.github/service-registry.json'),
    ];
    let raw: string | undefined;
    for (const candidate of candidates) {
      try {
        raw = await fs.readFile(candidate, 'utf-8');
        break;
      } catch {
        // try next
      }
    }
    if (!raw) {
      return { nodes: [], edges: [] };
    }
    const registry = JSON.parse(raw) as {
      apiServices: Array<{ name: string; domain: string; type: string; envVars: string[] }>;
      eventHandlerServices: Array<{ name: string; domain: string; type: string; envVars: string[]; sqsQueueRef?: string }>;
      webapp?: { name: string; envVars: string[] };
      infrastructure: {
        dynamodbTables: Array<{ envVar: string; domain: string }>;
        sqsQueues: Array<{ envVar: string; domain: string; description?: string }>;
        s3Buckets?: Array<{ name: string; envVar: string; domain: string }>;
        rds?: Array<{ envVar: string; domain: string; dbName: string }>;
      };
    };

    type NodeType = 'api' | 'worker' | 'webapp' | 'queue' | 'dynamodb' | 'rds' | 's3' | 'cognito';
    interface ArchNode { name: string; type: NodeType; domain: string }
    interface ArchEdge { source: string; target: string; type: 'publishes' | 'consumes' | 'http' | 'reads/writes' }

    const nodes: ArchNode[] = [];
    const edges: ArchEdge[] = [];
    const nodeNames = new Set<string>();

    const addNode = (name: string, type: NodeType, domain: string) => {
      if (!nodeNames.has(name)) { nodeNames.add(name); nodes.push({ name, type, domain }); }
    };

    // ─ Build lookup maps ─────────────────────────────────────────────────
    // SQS: env var suffix → queue display name  (e.g. USERS_SQS_QUEUE_URL → user-events)
    const sqsEnvToName = new Map<string, string>();
    for (const q of registry.infrastructure.sqsQueues) {
      // USERS_SQS_QUEUE_NAME → user-events  (derive from domain + description or convention)
      const queueName = q.description?.replace(/ inbox$/, '').replace(/-event-handler/, '-events')
        ?? `${q.domain}-events`;
      sqsEnvToName.set(q.envVar.replace('_NAME', '_URL'), queueName);
      sqsEnvToName.set(q.envVar, queueName);
      addNode(queueName, 'queue', q.domain);
    }

    // DynamoDB: env var → table display name
    const dynamoEnvToName = new Map<string, string>();
    for (const t of registry.infrastructure.dynamodbTables) {
      const tableName = `${t.domain}-table`;
      dynamoEnvToName.set(t.envVar, tableName);
      addNode(tableName, 'dynamodb', t.domain);
    }

    // RDS: env var → db display name
    const rdsEnvToName = new Map<string, string>();
    for (const r of registry.infrastructure.rds ?? []) {
      rdsEnvToName.set(r.envVar, r.dbName);
      addNode(r.dbName, 'rds', r.domain);
    }

    // S3: env var → bucket display name
    const s3EnvToName = new Map<string, string>();
    for (const b of registry.infrastructure.s3Buckets ?? []) {
      s3EnvToName.set(b.envVar, `s3:${b.name}`);
      addNode(`s3:${b.name}`, 's3', b.domain);
    }

    // API services: domain → service name (for HTTP edge resolution)
    const domainToApiService = new Map<string, string>();
    for (const svc of registry.apiServices) {
      domainToApiService.set(svc.domain, svc.name);
    }

    // ─ Process services ──────────────────────────────────────────────────
    const processService = (svc: { name: string; domain: string; type: string; envVars: string[]; sqsQueueRef?: string }) => {
      const nodeType: NodeType = svc.type === 'worker' ? 'worker' : 'api';
      addNode(svc.name, nodeType, svc.domain);

      for (const env of svc.envVars) {
        // SQS publish: service has *_SQS_QUEUE_URL in envVars
        if (env.endsWith('_SQS_QUEUE_URL')) {
          const queueName = sqsEnvToName.get(env);
          if (queueName) edges.push({ source: svc.name, target: queueName, type: 'publishes' });
        }

        // HTTP call: service has API_*_URL in envVars
        if (env.startsWith('API_') && env.endsWith('_URL')) {
          const targetDomain = env.replace('API_', '').replace('_URL', '').toLowerCase();
          const targetService = domainToApiService.get(targetDomain);
          if (targetService) edges.push({ source: svc.name, target: targetService, type: 'http' });
        }

        // DynamoDB: service has *_DYNAMODB_TABLE_NAME
        if (env.endsWith('_DYNAMODB_TABLE_NAME')) {
          const tableName = dynamoEnvToName.get(env);
          if (tableName) edges.push({ source: svc.name, target: tableName, type: 'reads/writes' });
        }

        // RDS: service has AWS_SECRETS_ARN → find RDS by matching domain
        if (env === 'AWS_SECRETS_ARN') {
          for (const [rdsEnv, dbName] of rdsEnvToName) {
            // Match if the service domain matches the RDS domain
            const rdsDomain = registry.infrastructure.rds?.find((r) => r.envVar === rdsEnv)?.domain;
            if (rdsDomain === svc.domain) edges.push({ source: svc.name, target: dbName, type: 'reads/writes' });
          }
        }

        // S3: service has *_S3_BUCKET_NAME
        if (env.endsWith('_S3_BUCKET_NAME')) {
          const bucketName = s3EnvToName.get(env);
          if (bucketName) edges.push({ source: svc.name, target: bucketName, type: 'reads/writes' });
        }
      }

      // SQS consume: worker has sqsQueueRef
      if (svc.sqsQueueRef) {
        const queueName = sqsEnvToName.get(svc.sqsQueueRef);
        if (queueName) edges.push({ source: queueName, target: svc.name, type: 'consumes' });
      }
    };

    for (const svc of registry.apiServices) processService(svc);
    for (const svc of registry.eventHandlerServices) processService(svc);

    // ─ Webapp connections ────────────────────────────────────────────────
    if (registry.webapp) {
      addNode('webapp', 'webapp', 'frontend');
      for (const env of registry.webapp.envVars) {
        if (env.startsWith('NEXT_PUBLIC_API_') && env.endsWith('_URL')) {
          const targetDomain = env.replace('NEXT_PUBLIC_API_', '').replace('_URL', '').toLowerCase();
          const targetService = domainToApiService.get(targetDomain);
          if (targetService) edges.push({ source: 'webapp', target: targetService, type: 'http' });
        }
      }
    }

    // ─ Cognito (if any auth service references it) ───────────────────────
    const hasCognito = registry.apiServices.some((svc) =>
      svc.envVars.some((e) => e === 'COGNITO_USER_POOL_ID'),
    );
    if (hasCognito) {
      addNode('cognito', 'cognito', 'auth');
      for (const svc of registry.apiServices) {
        if (svc.envVars.includes('COGNITO_USER_POOL_ID')) {
          edges.push({ source: svc.name, target: 'cognito', type: 'reads/writes' });
        }
      }
    }

    return { nodes, edges };
  }
}
