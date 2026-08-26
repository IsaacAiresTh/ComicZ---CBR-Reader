import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca a rota como acessivel sem access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
