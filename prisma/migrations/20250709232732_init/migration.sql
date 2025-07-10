-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_jobs" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "sourceFileName" TEXT NOT NULL,
    "sourceFileSize" INTEGER NOT NULL,
    "sourceFileHash" TEXT,
    "fileUrl" TEXT NOT NULL,
    "processingSubStage" TEXT,
    "transcriptText" TEXT,
    "transcriptSrt" TEXT,
    "transcriptVtt" TEXT,
    "displayTitle" TEXT,
    "transcript_tsvector" tsvector,
    "engineUsed" TEXT NOT NULL DEFAULT 'groq',
    "language" TEXT,
    "duration" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "transcription_jobs_userId_idx" ON "transcription_jobs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Create the high-performance GIN index on the tsvector column
CREATE INDEX "transcription_jobs_transcript_tsvector_idx" ON "transcription_jobs" USING GIN ("transcript_tsvector");

-- Create the language-aware function to update the tsvector
CREATE OR REPLACE FUNCTION update_transcript_tsvector_language_aware()
RETURNS TRIGGER AS $$
DECLARE
  language_config regconfig := CASE
    WHEN NEW.language = 'ar' THEN 'arabic' WHEN NEW.language = 'da' THEN 'danish'
    WHEN NEW.language = 'nl' THEN 'dutch'  WHEN NEW.language = 'en' THEN 'english'
    WHEN NEW.language = 'fi' THEN 'finnish' WHEN NEW.language = 'fr' THEN 'french'
    WHEN NEW.language = 'de' THEN 'german' WHEN NEW.language = 'hu' THEN 'hungarian'
    WHEN NEW.language = 'it' THEN 'italian' WHEN NEW.language = 'no' THEN 'norwegian'
    WHEN NEW.language = 'pt' THEN 'portuguese' WHEN NEW.language = 'ro' THEN 'romanian'
    WHEN NEW.language = 'ru' THEN 'russian' WHEN NEW.language = 'es' THEN 'spanish'
    WHEN NEW.language = 'sv' THEN 'swedish' WHEN NEW.language = 'tr' THEN 'turkish'
    ELSE 'simple'
  END;
BEGIN
  NEW.transcript_tsvector :=
    setweight(to_tsvector(language_config, coalesce(NEW."displayTitle", '')), 'A') ||
    setweight(to_tsvector(language_config, coalesce(NEW."transcriptText", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to run the function automatically
CREATE TRIGGER transcript_tsvector_update_language_aware
BEFORE INSERT OR UPDATE OF "displayTitle", "transcriptText", "language" ON "transcription_jobs"
FOR EACH ROW
EXECUTE FUNCTION update_transcript_tsvector_language_aware();