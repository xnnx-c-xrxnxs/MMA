import { Module } from '@nestjs/common';
import {
  IUserRepository,
  CreateUserUseCase,
  GetUserByIdUseCase,
  GetUserByEmailUseCase,
  UpdateUserProfileUseCase,
  DeleteUserUseCase,
  ActivateUserUseCase,
  DeactivateUserUseCase,
  VerifyUserEmailUseCase,
  UpdateUserRoleUseCase,
  ListUsersByStatusUseCase,
  ListUsersByRoleAndStatusUseCase,
} from '@old-st/user-domain';
import { DynamoUserRepository, UserSchema } from '@old-st/user-domain/infrastructure';
import {
  SqsFifoEventPublisher,
  createLocalSqsClient,
  createAwsSqsClient,
} from '@old-st/aws-sqs';
import { Table } from 'dynamodb-onetable';
import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { UserApplicationService } from '../application/services/user-application.service';
import { UserController } from '../presentation/controllers/user.controller';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
const USER_REPOSITORY = 'USER_REPOSITORY';
const USER_EVENT_PUBLISHER = 'USER_EVENT_PUBLISHER';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: DYNAMO_TABLE,
      useFactory: () =>
        DynamoDBConfig.getTable(
          process.env.USERS_DYNAMODB_TABLE_NAME || 'OldSTTable',
          UserSchema,
        ),
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (table: Table) =>
        new DynamoUserRepository(table),
      inject: [DYNAMO_TABLE],
    },
    {
      provide: CreateUserUseCase,
      useFactory: (repo: IUserRepository) => new CreateUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: GetUserByIdUseCase,
      useFactory: (repo: IUserRepository) => new GetUserByIdUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: GetUserByEmailUseCase,
      useFactory: (repo: IUserRepository) => new GetUserByEmailUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: UpdateUserProfileUseCase,
      useFactory: (repo: IUserRepository) => new UpdateUserProfileUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: DeleteUserUseCase,
      useFactory: (repo: IUserRepository) => new DeleteUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: ActivateUserUseCase,
      useFactory: (repo: IUserRepository) => new ActivateUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: DeactivateUserUseCase,
      useFactory: (repo: IUserRepository) => new DeactivateUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: VerifyUserEmailUseCase,
      useFactory: (repo: IUserRepository) => new VerifyUserEmailUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: UpdateUserRoleUseCase,
      useFactory: (repo: IUserRepository) => new UpdateUserRoleUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: ListUsersByStatusUseCase,
      useFactory: (repo: IUserRepository) => new ListUsersByStatusUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: ListUsersByRoleAndStatusUseCase,
      useFactory: (repo: IUserRepository) => new ListUsersByRoleAndStatusUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    {
      provide: USER_EVENT_PUBLISHER,
      useFactory: () => {
        const client =
          process.env.STAGE === 'local'
            ? createLocalSqsClient()
            : createAwsSqsClient();
        const queueUrl = process.env.USERS_SQS_QUEUE_URL ?? '';
        if (!queueUrl && process.env.STAGE !== 'local') {
          throw new Error('Missing required env var: USERS_SQS_QUEUE_URL');
        }
        return new SqsFifoEventPublisher(client, queueUrl);
      },
    },
    UserApplicationService,
  ],
  exports: [UserApplicationService],
})
export class UserModule {}
