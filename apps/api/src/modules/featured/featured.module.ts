import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { FeaturedController } from './featured.controller';
import { FeaturedService } from './featured.service';

@Module({
  imports: [ComicsModule],
  controllers: [FeaturedController],
  providers: [FeaturedService],
})
export class FeaturedModule {}
