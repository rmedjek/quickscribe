/* eslint-disable @typescript-eslint/no-explicit-any */
// app/lib/file-processor.ts
"use server";

import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {exec} from "node:child_process";
import {promisify} from "node:util";
import {
  transcribeAudioAction,
  DetailedTranscriptionResult,
} from "@/actions/transcribeAudioAction";
import {TranscriptionMode} from "@/components/ConfirmationView";

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
}

export async function processFileFromBlob(
  blobUrl: string,
  originalFilename: string,
  mode: TranscriptionMode
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  console.log(`[FileProcessor] Processing blob: ${blobUrl} with mode: ${mode}`);
  let tempFilePath: string | null = null;
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    // --- THIS IS THE CORRECTED PART ---
    // 1. Download the file from Vercel Blob storage using the standard fetch API.
    console.log(`[FileProcessor] Downloading blob from URL: ${blobUrl}`);
    const response = await fetch(blobUrl);
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download file from blob storage. Status: ${response.status}`
      );
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    // --- END CORRECTION ---

    const tempFileName = sanitizeFilename(
      `temp_uploaded_${uniqueId}_${originalFilename}`
    );
    tempFilePath = path.join(os.tmpdir(), tempFileName);

    console.log(`[FileProcessor] Saving downloaded file to: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, fileBuffer);

    // 2. Use FFmpeg on the server to extract audio
    const audioOutputFormat = "opus";
    const audioFileName = sanitizeFilename(
      `extracted_audio_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), audioFileName);
    const ffmpegCommand = `ffmpeg -i "${tempFilePath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempAudioPath}"`;

    console.log(`[FileProcessor] Executing FFmpeg: ${ffmpegCommand}`);
    await execAsync(ffmpegCommand);

    // 3. Prepare audio data for transcription
    const audioFileBuffer = await fs.readFile(tempAudioPath);
    const formDataForGroq = new FormData();
    const audioBlobForGroq = new Blob([audioFileBuffer], {
      type: `audio/${audioOutputFormat}`,
    });
    formDataForGroq.append("audioBlob", audioBlobForGroq, audioFileName);

    // 4. Call the transcription action
    return await transcribeAudioAction(formDataForGroq, mode);
  } catch (error: any) {
    console.error("[FileProcessor] Error in processing pipeline:", error);
    return {success: false, error: `Failed to process file: ${error.message}`};
  } finally {
    // 5. Cleanup temporary files
    if (tempFilePath) {
      await fs
        .unlink(tempFilePath)
        .catch((err) => console.warn(`Failed to delete temp video file:`, err));
    }
    if (tempAudioPath) {
      await fs
        .unlink(tempAudioPath)
        .catch((err) => console.warn(`Failed to delete temp audio file:`, err));
    }
  }
}
