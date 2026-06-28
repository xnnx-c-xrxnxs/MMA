import path from 'path';
import { PrismaClient } from '@old-st/order-domain/infrastructure';

/**
 * Provides a singleton PrismaClient for the order-event-handler-service.
 *
 * Secret resolution (ORDERS_DATABASE_URL ARN → postgresql:// URL) is handled
 * by SecretsConfig.resolve() at Lambda cold-start — PrismaConfig assumes the
 * env var is already a valid connection string when getClient() is called.
 */
export class PrismaConfig {
  private static client: PrismaClient;

  static async getClient(): Promise<PrismaClient> {
    if (!this.client) {
      if (process.env.STAGE !== 'local') {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
          __dirname,
          'libquery_engine-linux-arm64-openssl-3.0.x.so.node',
        );
      }
      this.client = new PrismaClient();
    }
    return this.client;
  }
}
