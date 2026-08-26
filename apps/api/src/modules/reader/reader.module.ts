import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ReaderController } from './reader.controller';
import { ReaderService } from './reader.service';

@Module({
  imports: [FilesModule],
  controllers: [ReaderController],
  providers: [ReaderService],
})
export class ReaderModule {}
