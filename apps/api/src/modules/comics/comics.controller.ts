import { rm } from 'node:fs/promises';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@comicz/database';
import {
  listComicsQuerySchema,
  upsertComicSchema,
  type ListComicsQuery,
  type UpsertComicInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { ComicsService, type UploadedComicFile } from './comics.service';

@ApiTags('comics')
@Controller('comics')
export class ComicsController {
  constructor(
    private readonly comics: ComicsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista o catalogo com busca e paginacao' })
  list(
    @Query(new ZodValidationPipe(listComicsQuerySchema)) query: ListComicsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comics.list(query, user.id);
  }

  @Get('continue-reading')
  @ApiOperation({ summary: 'HQs com leitura em andamento' })
  continueReading(@CurrentUser() user: AuthenticatedUser) {
    return this.comics.continueReading(user.id);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Detalhe de uma HQ' })
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.comics.findOne(idOrSlug, user.id);
  }

  // ---------------------------------------------------------------- admin

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: '[admin] Cria uma HQ' })
  create(@Body(new ZodValidationPipe(upsertComicSchema)) body: UpsertComicInput) {
    return this.comics.create(body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[admin] Atualiza os metadados de uma HQ' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(upsertComicSchema)) body: UpsertComicInput,
  ) {
    return this.comics.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove a HQ e seus arquivos' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.comics.remove(id);
  }

  /**
   * Upload do .cbr/.cbz. Responde 202: o arquivo fica em PENDING e o worker
   * extrai as paginas em segundo plano.
   */
  @Roles(Role.ADMIN)
  @Post(':id/file')
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[admin] Envia o arquivo da HQ e enfileira o processamento' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedComicFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Envie o arquivo no campo "file"');
    try {
      return await this.comics.attachUpload(id, file);
    } catch (error) {
      // O arquivo ja esta em disco: se o anexo falhar, nao deixa lixo no staging.
      await rm(file.path, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  @Roles(Role.ADMIN)
  @Post(':id/reprocess')
  @HttpCode(202)
  @ApiOperation({ summary: '[admin] Reprocessa o arquivo desta HQ' })
  reprocess(@Param('id', ParseUUIDPipe) id: string) {
    return this.comics.reprocess(id);
  }
}
