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
import { Role } from '@comicz/database';
import {
  guideItemInputSchema,
  reorderGuideItemsSchema,
  upsertGuideSchema,
  type GuideItemInput,
  type ReorderGuideItemsInput,
  type UpsertGuideInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { GuidesService } from './guides.service';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os guias de leitura' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.guides.list(user.role === Role.ADMIN);
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
}
