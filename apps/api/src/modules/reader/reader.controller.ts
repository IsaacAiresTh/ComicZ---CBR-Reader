import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { updateProgressSchema, type UpdateProgressInput } from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MediaTokenService } from '../files/media-token.service';
import { ReaderService } from './reader.service';

@ApiTags('reader')
@Controller('comics/:comicId')
export class ReaderController {
  constructor(
    private readonly reader: ReaderService,
    private readonly mediaToken: MediaTokenService,
  ) {}

  /**
   * Renova o cookie de midia aqui tambem: uma aba aberta por mais tempo que o
   * PAGE_TOKEN_TTL comecaria a receber 401 nas imagens se dependesse apenas do
   * cookie emitido no login.
   */
  @Get('reader')
  @ApiOperation({ summary: 'Abre o leitor: paginas e progresso' })
  async open(
    @Param('comicId', ParseUUIDPipe) comicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.reader.open(comicId, user.id);
    this.mediaToken.attach(res, user.id);
    return payload;
  }

  @Get('progress')
  @ApiOperation({ summary: 'Progresso do usuario nesta HQ' })
  progress(
    @Param('comicId', ParseUUIDPipe) comicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reader.getProgress(comicId, user.id);
  }

  @Patch('progress')
  @ApiOperation({ summary: 'Salva a pagina atual' })
  save(
    @Param('comicId', ParseUUIDPipe) comicId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProgressSchema)) body: UpdateProgressInput,
  ) {
    return this.reader.saveProgress(comicId, user.id, body);
  }
}
