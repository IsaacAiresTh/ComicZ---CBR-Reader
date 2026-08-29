import 'reflect-metadata';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { REPO_ROOT } from './config/paths';

// O .env vive na raiz do monorepo; a API roda de apps/api.
loadEnv({ path: join(REPO_ROOT, '.env') });

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/configuration';

// Prisma devolve BigInt (size_bytes) e JSON.stringify nao sabe serializa-lo.
(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  const logger = new Logger('Bootstrap');

  /**
   * Sem isto, atras de um proxy o req.ip vira o IP do proxy e o rate limit
   * passa a ser global. O valor e a quantidade de hops confiaveis, e nao
   * `true`: confiar na cadeia inteira deixaria qualquer cliente forjar o
   * proprio IP no X-Forwarded-For e escapar do throttler.
   */
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  app.setGlobalPrefix(config.prefix);
  app.use(cookieParser());
  app.use(
    helmet({
      // As imagens sao servidas para o dev server do Vite em outra porta.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: config.isProduction ? undefined : false,
    }),
  );

  app.enableCors({
    origin: config.webOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // A validacao e feita por ZodValidationPipe nos controllers (schemas
  // compartilhados com o frontend via @comicz/shared).
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('ComicZ API')
    .setDescription('Leitor de HQs e guias de leitura para novos leitores')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${config.prefix}/docs`, app, SwaggerModule.createDocument(app, swagger));

  /**
   * Uploads de centenas de MB podem levar minutos em uma conexao lenta.
   * O padrao do Node (5 min) derrubaria a requisicao no meio; 30 min cobre um
   * CBR de ~1 GB mesmo em rede modesta, sem desligar a protecao por completo.
   */
  const server = app.getHttpServer();
  server.requestTimeout = 30 * 60_000;
  server.headersTimeout = 65_000;

  // O host e explicito porque um PaaS so considera o servico no ar quando ele
  // responde na interface externa; escutar apenas em localhost derruba o deploy.
  await app.listen(config.port, '0.0.0.0');
  logger.log(`API na porta ${config.port} sob /${config.prefix}`);
  logger.log(`Swagger em /${config.prefix}/docs`);
  logger.log(`Origens permitidas: ${config.webOrigin}`);
  logger.log(`Storage em ${config.storageRoot}`);
  logger.log(`Upload maximo: ${config.maxUploadMb} MB (staging em ${config.uploadTmpDir})`);
}

void bootstrap();
