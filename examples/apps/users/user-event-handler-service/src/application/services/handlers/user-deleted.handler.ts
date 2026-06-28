import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import { IEventHandler } from '../../interfaces/event-handler.interface';
import type { UserDeletedPayload } from '@old-st/user-domain';

const logger = createLogger('user-event-handler-service');

/**
 * UserDeletedHandler
 *
 * Handles the USER_DELETED SQS event.
 *
 * Responsibility: archive the deleted user snapshot to AWS S3 so the record
 * is recoverable after the DynamoDB soft-delete.
 *
 * Current status: TODO — S3 archival logic not yet implemented.
 * When implementing:
 *   1. Inject an S3Client (infrastructure concern — wire in user.module.ts).
 *   2. Serialise `payload` to JSON.
 *   3. PutObject to the configured bucket using a key such as
 *      `deleted-users/{payload.userId}/{payload.deletedAt}.json`.
 *   4. Add `S3_DELETED_USERS_BUCKET` to `.env.local` and the Lambda env.
 */
@Injectable()
export class UserDeletedHandler implements IEventHandler<UserDeletedPayload> {
  async handle(payload: UserDeletedPayload, messageId?: string): Promise<void> {
    logger.info('Handling USER_DELETED event', { userId: payload.userId, messageId: messageId ?? '(no id)' });

    // ─── TODO: Archive deleted user snapshot to S3 ────────────────────────────
    // const s3Key = `deleted-users/${payload.userId}/${payload.deletedAt}.json`;
    // await this.s3Client.send(
    //   new PutObjectCommand({
    //     Bucket: process.env.S3_DELETED_USERS_BUCKET,
    //     Key: s3Key,
    //     Body: JSON.stringify(payload),
    //     ContentType: 'application/json',
    //   }),
    // );
    // this.logger.log(`Archived deleted user to S3: ${s3Key}`);
    // ─────────────────────────────────────────────────────────────────────────

    logger.info('USER_DELETED processed (S3 archival not yet implemented)', { userId: payload.userId });
  }
}
