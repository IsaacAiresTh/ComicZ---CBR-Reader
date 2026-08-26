import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ARCHIVE_EXTENSIONS } from '@comicz/shared';
import { Public } from '../../common/decorators/public.decorator';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

/**
 * Configuracao publica que o frontend precisa conhecer antes de agir — hoje,
 * o limite de upload, para avisar o admin sobre um arquivo grande demais
 * ANTES de gastar minutos enviando bytes que serao recusados.
 */
@ApiTags('meta')
@Controller('config')
export class MetaController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Limites e formatos aceitos pela instalacao' })
  get() {
    return {
      maxUploadMb: this.config.maxUploadMb,
      maxUploadBytes: this.config.maxUploadBytes,
      acceptedFormats: [...ARCHIVE_EXTENSIONS],
    };
  }
}
