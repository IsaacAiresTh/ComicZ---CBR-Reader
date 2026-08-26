import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Role } from '@comicz/database';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

const setRoleSchema = z.object({ role: z.enum(['USER', 'ADMIN']) });
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: '[admin] Panorama da instalacao' })
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  @ApiOperation({ summary: '[admin] Lista os usuarios' })
  users(@Query(new ZodValidationPipe(paginationSchema)) query: { page: number; perPage: number }) {
    return this.admin.listUsers(query.page, query.perPage);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '[admin] Promove ou rebaixa um usuario' })
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setRoleSchema)) body: { role: 'USER' | 'ADMIN' },
  ) {
    return this.admin.setRole(id, body.role as Role);
  }

  @Get('jobs')
  @ApiOperation({ summary: '[admin] Fila de processamento' })
  jobs() {
    return this.admin.recentJobs();
  }
}
