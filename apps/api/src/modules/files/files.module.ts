import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoverService } from './cover.service';
import { MediaController } from './media.controller';
import { MediaTokenService } from './media-token.service';
import { STORAGE, storageProvider } from './storage.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MediaController],
  providers: [storageProvider, MediaTokenService, CoverService],
  exports: [STORAGE, MediaTokenService, CoverService],
})
export class FilesModule {}
