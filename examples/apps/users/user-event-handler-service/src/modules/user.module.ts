import { Module } from '@nestjs/common';
import { UserEventHandlerService } from '../application/services/user-event-handler.service';
import { UserDeletedHandler } from '../application/services/handlers';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

/**
 * UserModule (user-event-handler-service)
 *
 * Wires the event dispatcher, per-event handlers, and the local SQS polling service.
 *
 * - No `controllers` array — this service has no HTTP layer.
 * - No DynamoDB wiring — the full user snapshot travels in the SQS message body.
 * - Add one plain class provider per new event handler.
 */
@Module({
  providers: [
    // ─── Per-event handlers ────────────────────────────────────────────────
    // One entry per event type. Add here and in the UserEventHandlerService switch.
    UserDeletedHandler,

    // ─── Event dispatcher ─────────────────────────────────────────────────
    UserEventHandlerService,

    // ─── Local polling (STAGE=local only — no-op in Lambda) ───────────────
    SqsLocalService,
  ],
  exports: [UserEventHandlerService],
})
export class UserModule {}
