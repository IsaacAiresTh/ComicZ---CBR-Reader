import { Injectable } from '@nestjs/common';
import { slugify, suffixSlug } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';

type SluggedDelegate = {
  findUnique(args: { where: { slug: string } }): Promise<{ id: string } | null>;
};

/**
 * Upsert por nome para editoras, series, autores, personagens e tags.
 * O admin digita "DC Comics" e nao precisa gerenciar IDs.
 */
@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  async uniqueSlug(base: string, delegate: SluggedDelegate): Promise<string> {
    const root = slugify(base) || 'item';
    for (let attempt = 1; attempt < 50; attempt += 1) {
      const candidate = suffixSlug(root, attempt);
      const existing = await delegate.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  async publisherByName(name: string): Promise<string> {
    const existing = await this.prisma.publisher.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.publisher.create({
      data: { name, slug: await this.uniqueSlug(name, this.prisma.publisher) },
    });
    return created.id;
  }

  async seriesByName(name: string, publisherId?: string | null): Promise<string> {
    const existing = await this.prisma.series.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.series.create({
      data: {
        name,
        slug: await this.uniqueSlug(name, this.prisma.series),
        ...(publisherId ? { publisherId } : {}),
      },
    });
    return created.id;
  }

  async creatorIds(names: string[]): Promise<string[]> {
    return this.resolveMany(names, async (name) => {
      const existing = await this.prisma.creator.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await this.prisma.creator.create({
        data: { name, slug: await this.uniqueSlug(name, this.prisma.creator) },
      });
      return created.id;
    });
  }

  async characterIds(names: string[]): Promise<string[]> {
    return this.resolveMany(names, async (name) => {
      const existing = await this.prisma.character.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await this.prisma.character.create({
        data: { name, slug: await this.uniqueSlug(name, this.prisma.character) },
      });
      return created.id;
    });
  }

  async tagIds(names: string[]): Promise<string[]> {
    return this.resolveMany(names, async (name) => {
      const existing = await this.prisma.tag.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await this.prisma.tag.create({
        data: { name, slug: await this.uniqueSlug(name, this.prisma.tag) },
      });
      return created.id;
    });
  }

  private async resolveMany(
    names: string[],
    resolver: (name: string) => Promise<string>,
  ): Promise<string[]> {
    const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    const ids: string[] = [];
    for (const name of unique) ids.push(await resolver(name));
    return ids;
  }
}
