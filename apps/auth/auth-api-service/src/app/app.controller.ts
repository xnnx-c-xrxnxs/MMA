import { Controller, Get } from '@nestjs/common';
import { Public } from '../presentation/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'auth-api-service' };
  }
}
