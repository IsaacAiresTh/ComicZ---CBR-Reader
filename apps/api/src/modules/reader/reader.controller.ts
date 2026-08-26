import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { updateProgressSchema, type UpdateProgressInput } from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReaderService } from './reader.service';

@ApiTags('reader')
@Controller('comics/:comicId')
export class ReaderController {
  constructor(private readonly reader: ReaderService) {}

  @Get('reader')
  @ApiOperation({ summary: 'Abre o leitor: paginas, progresso e token de midia' })
  open(
    @Param('comicId', ParseUUIDPipe) comicId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reader.open(comicId, user.id);
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
