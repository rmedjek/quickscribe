// app/lib/link-processor.ts
"use server";

import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {exec} from "node:child_process";
import {promisify} from "node:util";
import type {AudioPreparationResult} from "./processor-types";

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
}

export async function prepareAudioFromLink(
  videoUrl: string
): Promise<AudioPreparationResult> {
  console.log(`[LinkProcessor] Preparing audio from URL: ${videoUrl}`);
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    // Step 1: Fetch the video title.
    const getTitleCommand = `yt-dlp --get-title --no-playlist "${videoUrl}"`;
    const {stdout: titleStdout} = await execAsync(getTitleCommand);

    // Step 2: Use the fetched title, or fall back to the URL if the title is empty.
    const displayTitle = titleStdout.trim() || videoUrl;

    // Step 3: Download the audio content.
    const audioOutputFormat = "opus";
    const opusAudioFileName = sanitizeFilename(
      `extracted_audio_link_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), opusAudioFileName);

    const ytDlpCommand = `yt-dlp --quiet --progress --force-overwrites -x --audio-format ${audioOutputFormat} --audio-quality 0 -o "${tempAudioPath}" --no-playlist "${videoUrl}"`;
    await execAsync(ytDlpCommand, {timeout: 300000});

    // Step 4: Return the result using the consistent 'displayTitle' property.
    return {
      success: true,
      tempAudioPath,
      audioFileName: opusAudioFileName,
      displayTitle: displayTitle,
    };
  } catch (error: any) {
    if (tempAudioPath) {
      await fs
        .unlink(tempAudioPath)
        .catch((err) =>
          console.warn(
            `[LinkProcessor Cleanup] Failed to delete temp file:`,
            err.message
          )
        );
    }
    console.error(
      "[LinkProcessor] Error in audio preparation pipeline:",
      error
    );
    return {success: false, error: `Failed to process link: ${error.message}`};
  }
}
