import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { UserModule } from '../modules/user.module';
import { AppController } from './app.controller';

@Module({
  imports: [UserModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
