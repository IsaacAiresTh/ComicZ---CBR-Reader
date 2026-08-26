-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('UNKNOWN', 'ONGOING', 'COMPLETED', 'HIATUS');

-- AlterTable
ALTER TABLE "series" ADD COLUMN     "end_year" INTEGER,
ADD COLUMN     "status" "SeriesStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "total_issues" INTEGER;

-- CreateTable
CREATE TABLE "series_creators" (
    "series_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'writer',

    CONSTRAINT "series_creators_pkey" PRIMARY KEY ("series_id","creator_id","role")
);

-- AddForeignKey
ALTER TABLE "series_creators" ADD CONSTRAINT "series_creators_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_creators" ADD CONSTRAINT "series_creators_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
