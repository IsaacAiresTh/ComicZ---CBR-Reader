import { SetMetadata } from '@nestjs/common';
import type { Role } from '@comicz/database';

export const ROLES_KEY = 'roles';

/** Exige que o usuario autenticado tenha um dos papeis informados. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
