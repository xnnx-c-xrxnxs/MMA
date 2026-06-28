import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from '../application/services/auth.service';
import { MonitoringService } from '../application/services/monitoring.service';

import { AuthController } from '../presentation/controllers/auth.controller';
import { ServicesController } from '../presentation/controllers/services.controller';
import { TracesController } from '../presentation/controllers/traces.controller';
import { AlarmsController } from '../presentation/controllers/alarms.controller';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.MONITORING_JWT_SECRET ?? 'dev-secret-change-in-prod',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [
    AuthController,
    ServicesController,
    TracesController,
    AlarmsController,
  ],
  providers: [
    AuthService,
    MonitoringService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class MonitoringModule {}
