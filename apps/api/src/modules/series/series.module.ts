import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [ComicsModule],
  controllers: [SeriesController],
  providers: [SeriesService],
})
export class SeriesModule {}
