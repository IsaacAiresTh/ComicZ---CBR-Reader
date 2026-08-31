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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createCollectionSchema,
  renameCollectionSchema,
  reorderCollectionSchema,
  type CreateCollectionInput,
  type RenameCollectionInput,
  type ReorderCollectionInput,
} from '@comicz/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CollectionsService } from './collections.service';

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Pastas da biblioteca do usuario autenticado' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.collections.list(user.id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Cria uma pasta' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCollectionSchema)) body: CreateCollectionInput,
  ) {
    return this.collections.create(user.id, body.name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Conteudo de uma pasta, na ordem escolhida' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.collections.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomeia a pasta' })
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(renameCollectionSchema)) body: RenameCollectionInput,
  ) {
    return this.collections.rename(user.id, id, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Apaga a pasta; as HQs continuam na biblioteca' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.collections.remove(user.id, id);
  }

  @Patch(':id/reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordena os itens da pasta' })
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderCollectionSchema)) body: ReorderCollectionInput,
  ) {
    return this.collections.reorder(user.id, id, body.itemIds);
  }

  @Post(':id/series/:seriesId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Guarda a saga inteira como um item so' })
  addSeries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
  ) {
    return this.collections.addSeries(user.id, id, seriesId);
  }

  @Post(':id/comics/:comicId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Poe uma HQ na pasta' })
  addComic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comicId', ParseUUIDPipe) comicId: string,
  ) {
    return this.collections.addComic(user.id, id, comicId);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Tira o item da pasta; o conteudo continua na biblioteca' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.collections.removeItem(user.id, id, itemId);
  }
}
