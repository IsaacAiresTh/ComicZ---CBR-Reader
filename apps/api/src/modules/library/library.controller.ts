import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  listLibraryQuerySchema,
  updateLibraryItemSchema,
  type ListLibraryQuery,
  type UpdateLibraryItemInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LibraryService } from './library.service';

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({ summary: 'Biblioteca do usuario autenticado' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listLibraryQuerySchema)) query: ListLibraryQuery,
  ) {
    return this.library.list(user.id, query);
  }

  @Post(':comicId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Adiciona uma HQ a biblioteca' })
  add(@CurrentUser() user: AuthenticatedUser, @Param('comicId', ParseUUIDPipe) comicId: string) {
    return this.library.add(user.id, comicId);
  }

  @Patch(':comicId')
  @ApiOperation({ summary: 'Atualiza status e favorito' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('comicId', ParseUUIDPipe) comicId: string,
    @Body(new ZodValidationPipe(updateLibraryItemSchema)) body: UpdateLibraryItemInput,
  ) {
    return this.library.update(user.id, comicId, body);
  }

  @Delete(':comicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a HQ da biblioteca' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('comicId', ParseUUIDPipe) comicId: string) {
    return this.library.remove(user.id, comicId);
  }
}
