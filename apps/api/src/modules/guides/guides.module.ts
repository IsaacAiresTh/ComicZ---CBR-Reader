import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [ComicsModule],
  controllers: [GuidesController],
  providers: [GuidesService],
})
export class GuidesModule {}
