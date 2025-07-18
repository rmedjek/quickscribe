/*
  Warnings:

  - A unique constraint covering the columns `[external_id]` on the table `transcription_jobs` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN     "external_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transcription_jobs_external_id_key" ON "transcription_jobs"("external_id");
