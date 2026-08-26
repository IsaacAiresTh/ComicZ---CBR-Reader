import { mkdirSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { FilesModule } from '../files/files.module';
import { ComicsController } from './comics.controller';
import { ComicsService } from './comics.service';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [
    FilesModule,
    /**
     * Uploads vao para disco (nunca para memoria) em uma pasta dentro do
     * storage. Dois motivos:
     *
     * 1. /tmp e tmpfs na maioria das distros — um CBR de 800 MB viraria 800 MB
     *    de RAM.
     * 2. Estando no mesmo dispositivo do destino final, promover o arquivo e um
     *    rename atomico em vez de copiar centenas de MB.
     */
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        mkdirSync(config.uploadTmpDir, { recursive: true });
        return {
          dest: config.uploadTmpDir,
          limits: { fileSize: config.maxUploadBytes, files: 1 },
        };
      },
    }),
  ],
  controllers: [ComicsController],
  providers: [ComicsService, TaxonomyService],
  exports: [ComicsService, TaxonomyService],
})
export class ComicsModule {}
