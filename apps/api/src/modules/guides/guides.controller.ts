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
import {
  guideItemInputSchema,
  guideCharacterSchema,
  guideNodeSchema,
  reorderGuideCharactersSchema,
  reorderGuideItemsSchema,
  upsertGuideSchema,
  type GuideCharacterInput,
  type GuideItemInput,
  type GuideNodeInput,
  type ReorderGuideCharactersInput,
  type ReorderGuideItemsInput,
  type UpsertGuideInput,
} from '@comicz/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CoverService, OPCOES_CAPA, type UploadedCover } from '../files/cover.service';
import { GuidesService } from './guides.service';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(
    private readonly guides: GuidesService,
    private readonly covers: CoverService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista os guias de leitura' })
  list(@CurrentUser() user: AuthenticatedUser, @Query('kind') kind?: string) {
    const filtro = kind === 'EVENT' || kind === 'GUIDE' ? kind : undefined;
    return this.guides.list(user.role === Role.ADMIN, user.id, filtro);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Guia com a ordem de leitura' })
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.guides.findOne(idOrSlug, user.id, user.role === Role.ADMIN);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: '[admin] Cria um guia' })
  create(
    @Body(new ZodValidationPipe(upsertGuideSchema)) body: UpsertGuideInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guides.create(body, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: '[admin] Atualiza um guia' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(upsertGuideSchema)) body: UpsertGuideInput,
  ) {
    return this.guides.update(id, body);
  }

  @Roles(Role.ADMIN)
  @Put(':id/cover')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[admin] Define a capa do guia (imagem ja redimensionada)' })
  @UseInterceptors(FileInterceptor('file', OPCOES_CAPA))
  setCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedCover | undefined,
  ) {
    if (!file) throw new BadRequestException('Envie a imagem no campo "file"');
    return this.covers.setGuideCover(id, file);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/cover')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Volta o guia para a capa da primeira HQ da ordem' })
  clearCover(@Param('id', ParseUUIDPipe) id: string) {
    return this.covers.clearGuideCover(id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove um guia' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.guides.remove(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/items')
  @ApiOperation({ summary: '[admin] Adiciona uma HQ ao guia' })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guideItemInputSchema)) body: GuideItemInput,
  ) {
    return this.guides.addItem(id, body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: '[admin] Atualiza a nota de um item' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(guideItemInputSchema.partial())) body: Partial<GuideItemInput>,
  ) {
    return this.guides.updateItem(id, itemId, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove um item do guia' })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.guides.removeItem(id, itemId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reorder')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Define a nova ordem dos itens' })
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderGuideItemsSchema)) body: ReorderGuideItemsInput,
  ) {
    return this.guides.reorder(id, body.itemIds);
  }

  // ------------------------------------------------------------- elenco

  @Roles(Role.ADMIN)
  @Post(':id/personagens')
  @ApiOperation({ summary: '[admin] Acrescenta um rosto ao elenco do evento' })
  addCharacter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guideCharacterSchema)) body: GuideCharacterInput,
  ) {
    return this.guides.addCharacter(id, body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/personagens/:characterId')
  @ApiOperation({ summary: '[admin] Renomeia um rosto do elenco' })
  updateCharacter(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @Body(new ZodValidationPipe(guideCharacterSchema)) body: GuideCharacterInput,
  ) {
    return this.guides.updateCharacter(id, characterId, body);
  }

  @Roles(Role.ADMIN)
  @Put(':id/personagens/:characterId/imagem')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '[admin] Define a imagem do rosto (ja redimensionada)' })
  @UseInterceptors(FileInterceptor('file', OPCOES_CAPA))
  async setCharacterImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
    @UploadedFile() file: UploadedCover | undefined,
  ) {
    if (!file) throw new BadRequestException('Envie a imagem no campo "file"');
    // Confere o dono antes de gravar: a rota de midia serve por id, entao um
    // personagem de outro guia nao pode receber imagem por aqui.
    await this.guides.ownedCharacter(id, characterId);
    return this.covers.setGuideCharacterImage(characterId, file);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/personagens/:characterId')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove um rosto do elenco' })
  removeCharacter(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('characterId', ParseUUIDPipe) characterId: string,
  ) {
    return this.guides.removeCharacter(id, characterId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/personagens-ordem')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Define a nova ordem do elenco' })
  reorderCharacters(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderGuideCharactersSchema)) body: ReorderGuideCharactersInput,
  ) {
    return this.guides.reorderCharacters(id, body.characterIds);
  }

  // ---------------------------------------------------------- mapa (blocos)

  @Roles(Role.ADMIN)
  @Post(':id/blocos')
  @ApiOperation({ summary: '[admin] Cria um bloco do mapa do evento' })
  addNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guideNodeSchema)) body: GuideNodeInput,
  ) {
    return this.guides.addNode(id, body);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/blocos/:nodeId')
  @ApiOperation({ summary: '[admin] Atualiza um bloco do mapa' })
  updateNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
    @Body(new ZodValidationPipe(guideNodeSchema.partial())) body: Partial<GuideNodeInput>,
  ) {
    return this.guides.updateNode(id, nodeId, body);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/blocos/:nodeId')
  @HttpCode(204)
  @ApiOperation({ summary: '[admin] Remove um bloco (as edicoes continuam no guia)' })
  removeNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId', ParseUUIDPipe) nodeId: string,
  ) {
    return this.guides.removeNode(id, nodeId);
  }
}
