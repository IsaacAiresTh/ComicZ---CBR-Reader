import { Module } from '@nestjs/common';
import { ComicsModule } from '../comics/comics.module';
import { FilesModule } from '../files/files.module';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  imports: [ComicsModule, FilesModule],
  controllers: [CharactersController],
  providers: [CharactersService],
})
export class CharactersModule {}
