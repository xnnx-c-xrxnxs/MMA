export type Persistence = 'dynamodb';

export interface ServiceGeneratorSchema {
  domain: string;
  entity?: string;
  persistence?: Persistence;
  /**
   * If true, the service publishes domain events to SQS. Adds
   * `{DOMAIN}_SQS_QUEUE_URL` / `_NAME` to .env.local.example and the
   * `_QUEUE_URL` env var to the registry entry. Default: false.
   *
   * SQS env vars for an *event-handler* service are emitted by the
   * event-handler scaffold, not by this generator.
   */
  publishesEvents?: boolean;
  skipFormat?: boolean;
}
