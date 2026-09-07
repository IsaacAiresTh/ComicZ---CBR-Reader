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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@comicz/database';
import {
  importCharactersSchema,
  reorderCharacterImagesSchema,
  setCharacterComicsSchema,
  setMilestonesSchema,
  setSeriesNotesSchema,
  updateCharacterSchema,
  type ImportCharactersInput,
  type ReorderCharacterImagesInput,
  type SetCharacterComicsInput,
  type SetMilestonesInput,
  type SetSeriesNotesInput,
  type UpdateCharacterInput,
} from '@comicz/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CoverService, OPCOES_CAPA, type UploadedCover } from '../files/cover.service';
import { CharactersService } from './characters.service';

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(
    private readonly characters: CharactersService,
    private readonly covers: CoverService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Todos os personagens — tambem serve de indice para os links no texto' })
  list() {
    return this.characters.list();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Personagem, com as HQs em que aparece e os eventos em que esta no elenco',
  })
  findOne(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.characters.findOne(slug, user.id);
  }

  @Roles(Role.ADMIN)
  @Post('importar')
  @ApiOperation({
    summary: '[admin] Importa fichas de arquivo — `simular: true` so relata, sem gravar',
  })
  importar(@Body(new ZodValidationPipe(importCharactersSchema)) body: ImportCharactersInput) {
    return this.characters.importar(body.personagens, body.simular);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[admin] Atualiza resumo, texto e apelidos' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCharacterSchema)) body: UpdateCharacterInput,
  ) {
    return this.characters.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Put(':id/marcos')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Grava a linha do tempo inteira, na ordem enviada' })
  setMilestones(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setMilestonesSchema)) body: SetMilestonesInput,
  ) {
    return this.characters.setMilestones(id, body.marcos);
  }

  @Roles(Role.ADMIN)
  @Put(':id/edicoes')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Em quais edicoes ele esta no elenco — a lista inteira' })
  setComics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setCharacterComicsSchema)) body: SetCharacterComicsInput,
  ) {
    return this.characters.setComics(id, body.comicIds);
  }

  @Roles(Role.ADMIN)
  @Put(':id/sagas')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Ordem e nota de cada saga em "onde aparece"' })
  setSeriesNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setSeriesNotesSchema)) body: SetSeriesNotesInput,
  ) {
    return this.characters.setSeriesNotes(id, body.sagas);
  }

  @Roles(Role.ADMIN)
  @Put(':id/imagens')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[admin] Acrescenta uma imagem a galeria (ja redimensionada)' })
  @UseInterceptors(FileInterceptor('file', OPCOES_CAPA))
  addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedCover | undefined,
  ) {
    if (!file) throw new BadRequestException('Envie a imagem no campo "file"');
    return this.covers.addCharacterImage(id, file);
  }

  @Roles(Role.ADMIN)
  @Put(':id/imagens/ordem')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Reordena a galeria — a 1ª vira o retrato' })
  reorderImages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderCharacterImagesSchema)) body: ReorderCharacterImagesInput,
  ) {
    return this.characters.reorderImages(id, body.ids);
  }

  @Roles(Role.ADMIN)
  @Delete('imagens/:imageId')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove uma imagem da galeria' })
  removeImage(@Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.covers.removeCharacterImage(imageId);
  }
}
