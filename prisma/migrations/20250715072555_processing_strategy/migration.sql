-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN     "chunks_completed" INTEGER DEFAULT 0,
ADD COLUMN     "chunks_total" INTEGER,
ADD COLUMN     "processing_strategy" TEXT DEFAULT 'SINGLE';
