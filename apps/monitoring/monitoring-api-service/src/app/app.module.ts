import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MonitoringModule } from '../modules/monitoring.module';

@Module({
  imports: [MonitoringModule],
  controllers: [AppController],
})
export class AppModule {}
