import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MonitoringService } from '../../application/services/monitoring.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('traces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('traces')
export class TracesController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @ApiOperation({ summary: 'List recent event chains grouped by correlationId' })
  @ApiQuery({ name: 'minutes', required: false, description: 'Look-back window in minutes (default 60)' })
  @Get()
  async getEventChains(
    @Query('minutes') minutesStr: string,
  ) {
    const minutes = parseInt(minutesStr ?? '60', 10);
    const prefix = this.monitoringService.getNamePrefix();
    const logGroupNames = await this.monitoringService.getLogGroupNames(prefix);

    const result = await this.monitoringService
      .getLogs()
      .queryRecentEventChains(logGroupNames, minutes);

    return result;
  }

  @ApiOperation({ summary: 'Get all correlated logs for a specific event chain (correlationId)' })
  @ApiParam({ name: 'correlationId', description: 'Correlation ID that ties together logs across services' })
  @ApiQuery({ name: 'minutes', required: false, description: 'Look-back window in minutes (default 120)' })
  @Get(':correlationId')
  async getEventChainDetail(
    @Param('correlationId') correlationId: string,
    @Query('minutes') minutesStr: string,
  ) {
    const minutes = parseInt(minutesStr ?? '120', 10);
    const prefix = this.monitoringService.getNamePrefix();
    const logGroupNames = await this.monitoringService.getLogGroupNames(prefix);

    const result = await this.monitoringService
      .getLogs()
      .queryLogsByCorrelationId(correlationId, logGroupNames, minutes);

    return result;
  }
}
