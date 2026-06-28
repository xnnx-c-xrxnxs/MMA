import { Module, Scope } from '@nestjs/common';
import {
  IOrderRepository,
  ICustomerValidator,
  CreateOrderUseCase,
  GetOrderByIdUseCase,
  DeleteOrderUseCase,
  AddOrderItemUseCase,
  RemoveOrderItemUseCase,
  UpdateOrderItemQuantityUseCase,
  ConfirmOrderUseCase,
  StartProcessingOrderUseCase,
  ShipOrderUseCase,
  DeliverOrderUseCase,
  CancelOrderUseCase,
  RefundOrderUseCase,
  ListOrdersByCustomerUseCase,
  ListOrdersByStatusUseCase,
  AddOrderPaymentUseCase,
  AuthorizePaymentUseCase,
  CapturePaymentUseCase,
} from '@old-st/order-domain';
import { PrismaOrderRepository, PrismaClient } from '@old-st/order-domain/infrastructure';
import { IEventPublisher } from '@old-st/common';
import {
  SqsFifoEventPublisher,
  createLocalSqsClient,
  createAwsSqsClient,
} from '@old-st/aws-sqs';
import { PrismaConfig } from '../infrastructure/config/prisma.config';
import { OrderApplicationService } from '../application/services/order-application.service';
import { OrderController } from '../presentation/controllers/order.controller';
import { UserApiClient } from '../infrastructure/clients/user-api.client';

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const ORDER_REPOSITORY = 'ORDER_REPOSITORY';
const ORDER_EVENT_PUBLISHER = 'ORDER_EVENT_PUBLISHER';

@Module({
  imports: [],
  controllers: [OrderController],
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => PrismaConfig.getClient(),
    },
    {
      provide: ORDER_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaOrderRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    {
      provide: ICustomerValidator,
      useClass: UserApiClient,
      scope: Scope.REQUEST,
    },
    {
      provide: ORDER_EVENT_PUBLISHER,
      useFactory: () => {
        const client =
          process.env.STAGE === 'local'
            ? createLocalSqsClient()
            : createAwsSqsClient();
        const queueUrl = process.env.PRODUCT_EVENTS_SQS_QUEUE_URL ?? '';
        if (!queueUrl && process.env.STAGE !== 'local') {
          throw new Error('Missing required env var: PRODUCT_EVENTS_SQS_QUEUE_URL');
        }
        return new SqsFifoEventPublisher(client, queueUrl);
      },
    },
    {
      provide: CreateOrderUseCase,
      useFactory: (repo: IOrderRepository, validator: ICustomerValidator, publisher: IEventPublisher<unknown>) =>
        new CreateOrderUseCase(repo, validator, publisher),
      inject: [ORDER_REPOSITORY, ICustomerValidator, ORDER_EVENT_PUBLISHER],
    },
    {
      provide: GetOrderByIdUseCase,
      useFactory: (repo: IOrderRepository) => new GetOrderByIdUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: DeleteOrderUseCase,
      useFactory: (repo: IOrderRepository) => new DeleteOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: AddOrderItemUseCase,
      useFactory: (repo: IOrderRepository) => new AddOrderItemUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: RemoveOrderItemUseCase,
      useFactory: (repo: IOrderRepository) => new RemoveOrderItemUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: UpdateOrderItemQuantityUseCase,
      useFactory: (repo: IOrderRepository) => new UpdateOrderItemQuantityUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ConfirmOrderUseCase,
      useFactory: (repo: IOrderRepository, validator: ICustomerValidator) =>
        new ConfirmOrderUseCase(repo, validator),
      inject: [ORDER_REPOSITORY, ICustomerValidator],
    },
    {
      provide: StartProcessingOrderUseCase,
      useFactory: (repo: IOrderRepository) => new StartProcessingOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ShipOrderUseCase,
      useFactory: (repo: IOrderRepository) => new ShipOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: DeliverOrderUseCase,
      useFactory: (repo: IOrderRepository) => new DeliverOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: CancelOrderUseCase,
      useFactory: (repo: IOrderRepository) => new CancelOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: RefundOrderUseCase,
      useFactory: (repo: IOrderRepository) => new RefundOrderUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ListOrdersByCustomerUseCase,
      useFactory: (repo: IOrderRepository) => new ListOrdersByCustomerUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ListOrdersByStatusUseCase,
      useFactory: (repo: IOrderRepository) => new ListOrdersByStatusUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: AddOrderPaymentUseCase,
      useFactory: (repo: IOrderRepository) => new AddOrderPaymentUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: AuthorizePaymentUseCase,
      useFactory: (repo: IOrderRepository) => new AuthorizePaymentUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: CapturePaymentUseCase,
      useFactory: (repo: IOrderRepository) => new CapturePaymentUseCase(repo),
      inject: [ORDER_REPOSITORY],
    },
    OrderApplicationService,
  ],
  exports: [OrderApplicationService],
})
export class OrderModule {}
