import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { FileModule } from '../modules/file.module';
import { AppController } from './app.controller';

@Module({
  imports: [FileModule],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
