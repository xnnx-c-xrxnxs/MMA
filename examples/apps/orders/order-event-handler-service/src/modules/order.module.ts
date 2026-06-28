import { Module } from '@nestjs/common';
import {
  IOrderRepository,
  CancelDraftOrdersByProductUseCase,
  UpdateItemLatestPriceUseCase,
  ApproveProductValidationUseCase,
  FailOrderValidationUseCase,
} from '@old-st/order-domain';
import { PrismaOrderRepository, PrismaClient } from '@old-st/order-domain/infrastructure';
import { PrismaConfig } from '../infrastructure/config/prisma.config';
import { OrderEventHandlerService } from '../application/services/order-event-handler.service';
import {
  ProductDeactivatedHandler,
  ProductDiscontinuedHandler,
  ProductDeletedHandler,
  ProductPriceChangedHandler,
  ProductValidationSucceededHandler,
  ProductValidationFailedHandler,
} from '../application/services/handlers';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const ORDER_REPOSITORY = 'ORDER_REPOSITORY';

/**
 * OrderModule (order-event-handler-service)
 *
 * Wires the event dispatcher, per-event handlers, Prisma repository,
 * and the local SQS polling service.
 *
 * - No `controllers` array — this service has no HTTP layer.
 * - Prisma wiring is needed because handlers invoke use cases that read/write orders.
 * - Add one plain class provider per new event handler.
 */
@Module({
  providers: [
    // ─── Prisma ────────────────────────────────────────────────────────────
    {
      provide: PRISMA_CLIENT,
      useFactory: () => PrismaConfig.getClient(),
    },
    {
      provide: ORDER_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaOrderRepository(prisma),
      inject: [PRISMA_CLIENT],
    },

    // ─── Use cases ─────────────────────────────────────────────────────────
    {
      provide: CancelDraftOrdersByProductUseCase,
      useFactory: (repo: IOrderRepository) =>
        new CancelDraftOrdersByProductUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: UpdateItemLatestPriceUseCase,
      useFactory: (repo: IOrderRepository) =>
        new UpdateItemLatestPriceUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ApproveProductValidationUseCase,
      useFactory: (repo: IOrderRepository) =>
        new ApproveProductValidationUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: FailOrderValidationUseCase,
      useFactory: (repo: IOrderRepository) =>
        new FailOrderValidationUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },

    // ─── Per-event handlers ────────────────────────────────────────────────
    ProductDeactivatedHandler,
    ProductDiscontinuedHandler,
    ProductDeletedHandler,
    ProductPriceChangedHandler,
    ProductValidationSucceededHandler,
    ProductValidationFailedHandler,

    // ─── Event dispatcher ─────────────────────────────────────────────────
    OrderEventHandlerService,

    // ─── Local polling (STAGE=local only — no-op in Lambda) ───────────────
    SqsLocalService,
  ],
  exports: [OrderEventHandlerService],
})
export class OrderModule {}
