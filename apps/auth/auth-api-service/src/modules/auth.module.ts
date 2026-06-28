import { Module } from '@nestjs/common';
import {
  CognitoAuthProvider,
  LocalAuthProvider,
  type IAuthProvider,
} from '@mma/aws-cognito';
import { AuthApplicationService } from '../application/services/auth-application.service';
import { AuthController } from '../presentation/controllers/auth.controller';

const AUTH_PROVIDER = 'AUTH_PROVIDER';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_PROVIDER,
      useFactory: (): IAuthProvider => {
        if (process.env.STAGE === 'local') {
          return new LocalAuthProvider();
        }
        const userPoolId = process.env.COGNITO_USER_POOL_ID;
        const clientId = process.env.COGNITO_CLIENT_ID;
        const region = process.env.COGNITO_REGION || process.env.AWS_REGION;
        if (!userPoolId || !clientId) {
          throw new Error(
            'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID env vars are required',
          );
        }
        return new CognitoAuthProvider(userPoolId, clientId, region);
      },
    },
    {
      provide: AuthApplicationService,
      useFactory: (provider: IAuthProvider) =>
        new AuthApplicationService(provider),
      inject: [AUTH_PROVIDER],
    },
  ],
  exports: [AuthApplicationService],
})
export class AuthModule {}
