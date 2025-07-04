// app/lib/link-processor.ts
"use server";

import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {exec} from "node:child_process";
import {promisify} from "node:util";

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
}

// --- REFACTORED & FIXED ---
// This function now returns the path to the processed audio file.
export async function prepareAudioFromLink(videoUrl: string): Promise<
  | {
      success: true;
      tempAudioPath: string;
      audioFileName: string;
    }
  | {
      success: false;
      error: string;
    }
> {
  console.log(`[LinkProcessor] Preparing audio from URL: ${videoUrl}`);
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    const audioOutputFormat = "opus";
    const opusAudioFileName = sanitizeFilename(
      `extracted_audio_link_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), opusAudioFileName);

    const ytDlpCommand = `yt-dlp --quiet --progress --force-overwrites -x --audio-format ${audioOutputFormat} --audio-quality 0 -o "${tempAudioPath}" --no-playlist "${videoUrl}"`;

    await execAsync(ytDlpCommand, {timeout: 300000});

    return {success: true, tempAudioPath, audioFileName: opusAudioFileName};
  } catch (error: any) {
    // Attempt cleanup on failure
    if (tempAudioPath) await fs.unlink(tempAudioPath).catch(() => {});
    console.error(
      "[LinkProcessor] Error in audio preparation pipeline:",
      error
    );
    return {success: false, error: `Failed to process link: ${error.message}`};
  }
}
