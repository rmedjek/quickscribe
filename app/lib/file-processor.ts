// app/lib/file-processor.ts
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
export async function prepareAudioFromFileBlob(
  blobUrl: string,
  originalFilename: string
): Promise<
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
  console.log(`[FileProcessor] Preparing audio from blob: ${blobUrl}`);
  let tempFilePath: string | null = null;
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    const response = await fetch(blobUrl);
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download file from blob storage. Status: ${response.status}`
      );
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer());

    const tempFileName = sanitizeFilename(
      `temp_uploaded_${uniqueId}_${originalFilename}`
    );
    tempFilePath = path.join(os.tmpdir(), tempFileName);

    await fs.writeFile(tempFilePath, fileBuffer);

    const audioOutputFormat = "opus";
    const audioFileName = sanitizeFilename(
      `extracted_audio_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), audioFileName);
    const ffmpegCommand = `ffmpeg -i "${tempFilePath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempAudioPath}"`;

    await execAsync(ffmpegCommand);

    // Clean up the large source file immediately after conversion
    await fs.unlink(tempFilePath);

    // Return the successful result with the path
    return {success: true, tempAudioPath, audioFileName};
  } catch (error: any) {
    // Attempt cleanup on failure
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {});
    if (tempAudioPath) await fs.unlink(tempAudioPath).catch(() => {});
    console.error(
      "[FileProcessor] Error in audio preparation pipeline:",
      error
    );
    return {success: false, error: `Failed to process file: ${error.message}`};
  }
}

// --- NEW FUNCTION TO SPLIT AUDIO ---
interface ChunkInfo {
  index: number;
  fileName: string;
  filePath: string;
  startTime: number;
  endTime: number;
}

export async function splitAudio(
  sourcePath: string,
  jobId: string,
  segmentDuration = 600 // 10 minutes
): Promise<
  {success: true; chunks: ChunkInfo[]} | {success: false; error: string}
> {
  const outputDir = path.join("/tmp", `chunks_${jobId}`);
  try {
    await fs.mkdir(outputDir, {recursive: true});

    // Use ffmpeg to split the audio into segments
    const outputPattern = path.join(outputDir, `chunk_%03d.opus`);
    const ffmpegCommand = `ffmpeg -i "${sourcePath}" -f segment -segment_time ${segmentDuration} -c:a libopus -b:a 64k -vn "${outputPattern}"`;

    await execAsync(ffmpegCommand);

    const files = await fs.readdir(outputDir);
    const chunks: ChunkInfo[] = files
      .filter((file) => file.endsWith(".opus"))
      .map((fileName, index) => ({
        index,
        fileName,
        filePath: path.join(outputDir, fileName),
        startTime: index * segmentDuration,
        endTime: (index + 1) * segmentDuration,
      }));

    return {success: true, chunks};
  } catch (error: any) {
    console.error("Failed to split audio:", error);
    return {success: false, error: `FFmpeg split failed: ${error.message}`};
  }
}
