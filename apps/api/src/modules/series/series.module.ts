import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { FilesModule } from '../files/files.module';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [ComicsModule, FilesModule],
  controllers: [SeriesController],
  providers: [SeriesService],
})
export class SeriesModule {}
