import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MonitoringService } from '../../application/services/monitoring.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('alarms')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('alarms')
export class AlarmsController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @ApiOperation({ summary: 'List all alarms for the target environment' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state: OK | ALARM | INSUFFICIENT_DATA' })
  @Get()
  async listAlarms(@Query('state') stateFilter: string) {
    const namePrefix = this.monitoringService.getNamePrefix();
    const alarms = await this.monitoringService.getMetrics().listAlarms(namePrefix);

    if (stateFilter) {
      return { alarms: alarms.filter((a) => a.state === stateFilter) };
    }

    return { alarms };
  }
}
