import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Role } from '@comicz/database';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxonomyService } from '../comics/taxonomy.service';

const createPublisherSchema = z.object({ name: z.string().trim().min(1).max(200) });

@ApiTags('publishers')
@Controller('publishers')
export class PublishersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista as editoras' })
  list() {
    return this.prisma.publisher.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, _count: { select: { comics: true } } },
    });
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: '[admin] Cria (ou reaproveita) uma editora' })
  async create(
    @Body(new ZodValidationPipe(createPublisherSchema)) body: { name: string },
  ) {
    const id = await this.taxonomy.publisherByName(body.name);
    return this.prisma.publisher.findUniqueOrThrow({ where: { id } });
  }
}
