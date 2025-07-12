/*
  Warnings:

  - The values [PROCESSING] on the enum `JobStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "JobStatus_new" AS ENUM ('PENDING', 'CHUNKING', 'PROCESSING_CHUNKS', 'ASSEMBLING', 'COMPLETED', 'FAILED', 'CANCELLED');
ALTER TABLE "transcription_jobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "transcription_jobs" ALTER COLUMN "status" TYPE "JobStatus_new" USING ("status"::text::"JobStatus_new");
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";
ALTER TABLE "transcription_jobs" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN     "chunks_completed" INTEGER DEFAULT 0,
ADD COLUMN     "chunks_total" INTEGER,
ADD COLUMN     "processing_strategy" TEXT DEFAULT 'SINGLE';

-- CreateTable
CREATE TABLE "job_chunks" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "start_time" DOUBLE PRECISION NOT NULL,
    "end_time" DOUBLE PRECISION NOT NULL,
    "blob_url" TEXT NOT NULL,
    "transcript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "job_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_chunks_jobId_idx" ON "job_chunks"("jobId");

-- AddForeignKey
ALTER TABLE "job_chunks" ADD CONSTRAINT "job_chunks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "transcription_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
