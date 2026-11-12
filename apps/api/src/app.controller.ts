import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'API health check' })
  getHealth() {
    return {
      status: 'ok',
      service: 'diriddle-api',
      mode: this.prisma.isInMemory ? 'in-memory' : 'postgresql',
      timestamp: new Date().toISOString(),
    };
  }
}
