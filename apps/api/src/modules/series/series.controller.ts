import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@comicz/database';
import { upsertSeriesSchema, type UpsertSeriesInput } from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SeriesService } from './series.service';

@ApiTags('series')
@Controller('series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as series' })
  list(@Query('q') q?: string) {
    return this.series.list(q);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Serie com todas as suas edicoes em ordem' })
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.series.findOne(idOrSlug, user.id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: '[admin] Cria uma serie' })
  create(@Body(new ZodValidationPipe(upsertSeriesSchema)) body: UpsertSeriesInput) {
    return this.series.create(body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[admin] Atualiza uma serie' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(upsertSeriesSchema)) body: UpsertSeriesInput,
  ) {
    return this.series.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove uma serie (as HQs ficam sem serie)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.series.remove(id);
  }
}
