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
