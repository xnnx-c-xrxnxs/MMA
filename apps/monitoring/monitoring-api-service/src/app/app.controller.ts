import { Controller, Get } from '@nestjs/common';
import { Public } from '../presentation/guards/jwt-auth.guard';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'monitoring-api-service' };
  }

  @Public()
  @Get('env-info')
  envInfo() {
    return {
      environment: process.env.TARGET_ENVIRONMENT ?? 'dev',
      projectName: process.env.PROJECT_NAME ?? 'mma',
      awsAccountId: process.env.AWS_ACCOUNT_ID ?? 'unknown',
    };
  }
}
