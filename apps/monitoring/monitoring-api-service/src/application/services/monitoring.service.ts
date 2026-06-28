import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import {
  CloudWatchLogsProvider,
  CloudWatchMetricsProvider,
  XRayTracesProvider,
  LambdaProvider,
  SqsMonitoringProvider,
  ILogsProvider,
  IMetricsProvider,
  ITracesProvider,
  ILambdaProvider,
  ISqsMonitoringProvider,
} from '@old-st/monitoring-sdk';

const logger = createLogger('monitoring-api-service');

@Injectable()
export class MonitoringService {
  private readonly logs: ILogsProvider;
  private readonly metrics: IMetricsProvider;
  private readonly traces: ITracesProvider;
  private readonly lambda: ILambdaProvider;
  private readonly sqs: ISqsMonitoringProvider;

  constructor() {
    const region = process.env.AWS_REGION ?? process.env.DEFAULT_REGION ?? 'eu-west-2';
    this.logs = new CloudWatchLogsProvider(region);
    this.metrics = new CloudWatchMetricsProvider(region);
    this.traces = new XRayTracesProvider(region);
    this.lambda = new LambdaProvider(region);
    this.sqs = new SqsMonitoringProvider(region);
  }

  getLogs() {
    return this.logs;
  }

  getMetrics() {
    return this.metrics;
  }

  getTraces() {
    return this.traces;
  }

  getLambda() {
    return this.lambda;
  }

  getSqs() {
    return this.sqs;
  }

  getNamePrefix(): string {
    const project = process.env.PROJECT_NAME ?? 'old-st';
    const env = process.env.TARGET_ENVIRONMENT ?? 'dev';
    return `${project}-${env}`;
  }

  /** Return environment metadata for the monitoring dashboard label. */
  getEnvironmentInfo(): { environment: string; projectName: string; awsAccountId: string; namePrefix: string } {
    return {
      environment: process.env.TARGET_ENVIRONMENT ?? 'dev',
      projectName: process.env.PROJECT_NAME ?? 'old-st',
      awsAccountId: process.env.AWS_ACCOUNT_ID ?? 'unknown',
      namePrefix: this.getNamePrefix(),
    };
  }

  /** Get all Lambda log group names for a given environment prefix. */
  async getLogGroupNames(namePrefix: string): Promise<string[]> {
    const functions = await this.lambda.listFunctions(namePrefix);
    return functions.map((fn) => `/aws/lambda/${fn.functionName}`);
  }
}
