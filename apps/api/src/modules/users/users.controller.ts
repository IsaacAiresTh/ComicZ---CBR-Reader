import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuario autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findPublic(user.id);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Contadores da biblioteca do usuario' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.users.stats(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualiza o perfil' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.users.updateProfile(user.id, body);
  }

  @Patch('me/password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Troca a senha e encerra as outras sessoes' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.users.changePassword(user.id, body);
  }
}
