import { randomBytes } from 'node:crypto';

/**
 * Imprime segredos prontos para colar no .env.
 *
 * Existe porque o .env.example traz placeholders legiveis ("dev-...-troque-me"),
 * e placeholder que da para adivinhar tende a sobreviver ate producao.
 */
const secret = () => randomBytes(48).toString('base64url');

console.log(`
Cole no seu .env (cada execucao gera valores novos):

JWT_ACCESS_SECRET=${secret()}
JWT_REFRESH_SECRET=${secret()}
PAGE_TOKEN_SECRET=${secret()}
POSTGRES_PASSWORD=${randomBytes(18).toString('base64url')}
ADMIN_PASSWORD=${randomBytes(12).toString('base64url')}

Lembre-se de refletir POSTGRES_PASSWORD tambem na DATABASE_URL.
`);
