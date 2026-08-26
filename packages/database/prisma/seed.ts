import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { hash } from '@node-rs/argon2';
import { PrismaClient, Role } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@comicz.local';
  const username = process.env.ADMIN_USERNAME ?? 'admin';

  /**
   * Sem ADMIN_PASSWORD no .env, sorteamos uma senha e a imprimimos uma unica vez.
   *
   * Nao existe fallback fixo de proposito: um valor padrao no codigo viraria a
   * senha de administrador de toda instalacao que esquecesse de configurar.
   */
  const provided = process.env.ADMIN_PASSWORD;
  const password = provided ?? randomBytes(12).toString('base64url');

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN },
    create: { email, username, passwordHash, role: Role.ADMIN },
  });

  if (provided) {
    console.log(`[seed] admin pronto: ${admin.email} (senha do ADMIN_PASSWORD)`);
  } else {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────────────');
    console.log('  │ ADMIN_PASSWORD nao estava definido. Senha gerada agora:');
    console.log(`  │   usuario: ${admin.email}`);
    console.log(`  │   senha:   ${password}`);
    console.log('  │ Anote: ela nao sera exibida de novo.');
    console.log('  └─────────────────────────────────────────────────────────');
    console.log('');
  }

  const publishers = ['DC Comics', 'Marvel Comics', 'Boom! Studios', 'Panini'];
  for (const name of publishers) {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    await prisma.publisher.upsert({ where: { slug }, update: {}, create: { name, slug } });
  }
  console.log(`[seed] ${publishers.length} editoras garantidas`);
}

main()
  .catch((error) => {
    console.error('[seed] falhou', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
