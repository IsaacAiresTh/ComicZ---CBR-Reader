import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComicsModule } from './modules/comics/comics.module';
import { FilesModule } from './modules/files/files.module';
import { GuidesModule } from './modules/guides/guides.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { LibraryModule } from './modules/library/library.module';
import { MetaModule } from './modules/meta/meta.module';
import { PublishersModule } from './modules/publishers/publishers.module';
import { ReaderModule } from './modules/reader/reader.module';
import { SeriesModule } from './modules/series/series.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    MetaModule,
    FilesModule,
    AuthModule,
    UsersModule,
    ComicsModule,
    SeriesModule,
    PublishersModule,
    LibraryModule,
    CollectionsModule,
    ReaderModule,
    GuidesModule,
    AdminModule,
  ],
  providers: [
    // A ordem importa: autentica, aplica rate limit, depois checa o papel.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
