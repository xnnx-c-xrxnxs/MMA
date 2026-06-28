export type Persistence = 'dynamodb';

export interface DomainGeneratorSchema {
  name: string;
  entity?: string;
  persistence?: Persistence;
  fields?: string;
  statuses?: string;
  withService?: boolean;
  withContracts?: boolean;
  /**
   * If true, the service publishes domain events (adds SQS env vars to
   * .env.local.example and the registry entry). Default: false.
   */
  publishesEvents?: boolean;
  useCases?: string;
  dryRun?: boolean;
  skipFormat?: boolean;
}
