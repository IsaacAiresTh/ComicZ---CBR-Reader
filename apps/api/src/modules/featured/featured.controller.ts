import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@comicz/database';
import { saveFeaturedSchema, type FeaturedItem, type SaveFeaturedInput } from '@comicz/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FeaturedService } from './featured.service';

@ApiTags('featured')
@Controller('featured')
export class FeaturedController {
  constructor(private readonly featured: FeaturedService) {}

  @Get()
  @ApiOperation({ summary: 'Os destaques do inicio, na ordem do painel' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FeaturedItem[]> {
    return this.featured.list(user.id);
  }

  @Put()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[admin] Regrava a lista de destaques (ate 4)' })
  save(
    @Body(new ZodValidationPipe(saveFeaturedSchema)) body: SaveFeaturedInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeaturedItem[]> {
    return this.featured.save(body, user.id);
  }
}
