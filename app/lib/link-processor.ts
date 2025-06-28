// app/lib/link-processor.ts
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

export async function processLink(
  videoUrl: string,
  mode: TranscriptionMode
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  console.log(`[LinkProcessor] Processing URL: ${videoUrl} with mode: ${mode}`);
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    // 1. Use yt-dlp to download and extract audio directly to Opus
    const audioOutputFormat = "opus";
    const opusAudioFileName = sanitizeFilename(
      `extracted_audio_link_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), opusAudioFileName);

    // Command to download best audio, convert to opus in one step
    const ytDlpCommand = `yt-dlp --quiet --progress --force-overwrites -x --audio-format ${audioOutputFormat} --audio-quality 0 -o "${tempAudioPath}" --no-playlist "${videoUrl}"`;

    console.log(`[LinkProcessor] Executing yt-dlp: ${ytDlpCommand}`);
    await execAsync(ytDlpCommand, {timeout: 300000}); // 5 min timeout

    // 2. Prepare audio data for transcription
    const audioFileBuffer = await fs.readFile(tempAudioPath);
    const formData = new FormData();
    const audioBlobForGroq = new Blob([audioFileBuffer], {
      type: `audio/${audioOutputFormat}`,
    });
    formData.append("audioBlob", audioBlobForGroq, opusAudioFileName);

    // 3. Call the transcription action
    return await transcribeAudioAction(formData, mode);
  } catch (error: any) {
    console.error("[LinkProcessor] Error in processing pipeline:", error);
    return {success: false, error: `Failed to process link: ${error.message}`};
  } finally {
    // 4. Cleanup temporary file
    if (tempAudioPath) {
      await fs
        .unlink(tempAudioPath)
        .catch((err) =>
          console.warn(`Failed to delete temp link audio file:`, err)
        );
    }
  }
}
