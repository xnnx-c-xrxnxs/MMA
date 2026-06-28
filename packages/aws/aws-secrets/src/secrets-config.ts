import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * Reads the project-level Secrets Manager secret (AWS_SECRETS_ARN) once at
 * Lambda cold-start and populates process.env with the specified keys from it.
 * Subsequent calls with the same allowList are no-ops (guarded by `resolved` flag).
 *
 * Usage — call at the very start of the Lambda handler, before NestJS bootstrap:
 *   await SecretsConfig.resolve(['ORDERS_DATABASE_URL']);
 *
 * Pass only the env var names this service actually needs. Keys not in the
 * allowList are never written to process.env, keeping each service isolated
 * from secrets it doesn't own (e.g. a shipping DB URL in the order Lambda).
 *
 * Local development: STAGE === 'local' → skipped entirely.
 */
export class SecretsConfig {
  private static resolved = false;

  static async resolve(allowList: string[]): Promise<void> {
    if (process.env.STAGE === 'local' || this.resolved) return;

    const arn = process.env.AWS_SECRETS_ARN;
    if (!arn) return;

    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: arn }),
    );

    const secrets = JSON.parse(response.SecretString ?? '{}') as Record<
      string,
      string
    >;
    for (const key of allowList) {
      if (key in secrets) {
        process.env[key] = secrets[key];
      }
    }

    this.resolved = true;
  }
}
