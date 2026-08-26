import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './configuration';

/**
 * Torna a configuracao validada injetavel em qualquer modulo.
 * Global porque storage, auth e midia dependem dela em pontos distantes.
 */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: loadConfig }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
