import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { AuthModule } from '../modules/auth.module';
import { AppController } from './app.controller';

@Module({
  imports: [AuthModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
