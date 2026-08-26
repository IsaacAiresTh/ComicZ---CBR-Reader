import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MediaController } from './media.controller';
import { MediaTokenService } from './media-token.service';
import { StorageService } from './storage.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MediaController],
  providers: [StorageService, MediaTokenService],
  exports: [StorageService, MediaTokenService],
})
export class FilesModule {}
