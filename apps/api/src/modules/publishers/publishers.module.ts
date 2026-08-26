import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { PublishersController } from './publishers.controller';

@Module({
  imports: [ComicsModule],
  controllers: [PublishersController],
})
export class PublishersModule {}
