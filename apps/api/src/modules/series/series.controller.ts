import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@comicz/database';
import { upsertSeriesSchema, type UpsertSeriesInput } from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CoverService, type UploadedCover } from '../files/cover.service';
import { SeriesService } from './series.service';

/**
 * Uma capa de 500px cabe folgada em 2 MB. O limite do multer para arquivo de
 * HQ e de centenas de MB, e reaproveita-lo aqui deixaria a rota aberta a um
 * upload gigante que o servico so recusaria depois de gravado em disco.
 */
const LIMITE_CAPA = { limits: { fileSize: 2 * 1024 * 1024, files: 1 } };

@ApiTags('series')
@Controller('series')
export class SeriesController {
  constructor(
    private readonly series: SeriesService,
    private readonly covers: CoverService,
  ) {}

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
  @Post(':id/comics/:comicId')
  @ApiOperation({ summary: '[admin] Move uma edicao para dentro desta saga' })
  attachComic(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comicId', ParseUUIDPipe) comicId: string,
  ) {
    return this.series.attachComic(id, comicId);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/comics/:comicId')
  @ApiOperation({ summary: '[admin] Tira uma edicao desta saga (a HQ continua existindo)' })
  detachComic(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comicId', ParseUUIDPipe) comicId: string,
  ) {
    return this.series.detachComic(id, comicId);
  }

  @Roles(Role.ADMIN)
  @Put(':id/cover')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[admin] Define a capa da saga (imagem ja redimensionada)' })
  @UseInterceptors(FileInterceptor('file', LIMITE_CAPA))
  setCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedCover | undefined,
  ) {
    if (!file) throw new BadRequestException('Envie a imagem no campo "file"');
    return this.covers.setSeriesCover(id, file);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/cover')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Volta a saga para a capa derivada das edicoes' })
  clearCover(@Param('id', ParseUUIDPipe) id: string) {
    return this.covers.clearSeriesCover(id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove uma serie (as HQs ficam sem serie)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.series.remove(id);
  }
}
