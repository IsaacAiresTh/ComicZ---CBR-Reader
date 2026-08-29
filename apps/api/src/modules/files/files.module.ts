import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MediaController } from './media.controller';
import { MediaTokenService } from './media-token.service';
import { STORAGE, storageProvider } from './storage.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MediaController],
  providers: [storageProvider, MediaTokenService],
  exports: [STORAGE, MediaTokenService],
})
export class FilesModule {}
