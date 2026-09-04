import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { FilesModule } from '../files/files.module';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [ComicsModule, FilesModule],
  controllers: [GuidesController],
  providers: [GuidesService],
})
export class GuidesModule {}
