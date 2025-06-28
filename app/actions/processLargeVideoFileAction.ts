"use server";

import * as fsPromises from "node:fs/promises";
// fsCore might not be needed if we write the buffer directly
// import * as fsCore from 'node:fs';
import path from "node:path";
import os from "node:os";
import {exec} from "node:child_process";
import {promisify} from "node:util";

// Import the existing action for transcription
import {
  transcribeAudioAction,
  DetailedTranscriptionResult,
} from "./transcribeAudioAction";
import {TranscriptionMode} from "@/components/ConfirmationView";

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").substring(0, 200);
}

export async function processLargeVideoFileAction(
  formData: FormData, // Expects FormData with the video file
  mode: TranscriptionMode // Add mode parameter
): Promise<{
  success: boolean;
  data?: DetailedTranscriptionResult;
  error?: string;
}> {
  console.log(
    `[LargeFileAction] Processing uploaded video file with mode: ${mode}`
  );
  let tempVideoPath: string | null = null;
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  const videoFile = formData.get("videoFile") as File | null;

  if (!videoFile) {
    console.error("[LargeFileAction] No videoFile found in FormData");
    return {success: false, error: "No video file received by server."};
  }

  console.log(
    `[LargeFileAction] Received video file: ${videoFile.name}, size: ${videoFile.size}, type: ${videoFile.type}`
  );

  try {
    // --- 1. Save the uploaded video file to a temporary location ---
    const videoFileBuffer = Buffer.from(await videoFile.arrayBuffer()); // Convert File to Buffer

    // Try to get original extension, fallback to mp4 or a generic binary extension
    let originalExtension = videoFile.name.split(".").pop()?.toLowerCase();
    if (!originalExtension || originalExtension.length > 5) {
      // Guess based on MIME type if possible, otherwise default
      const mimeParts = videoFile.type.split("/");
      if (mimeParts[0] === "video" && mimeParts[1]) {
        originalExtension = mimeParts[1];
      } else {
        originalExtension = "mp4"; // Default if type is unhelpful (e.g. application/octet-stream)
      }
    }

    const tempVideoFileName = sanitizeFilename(
      `temp_uploaded_video_${uniqueId}.${originalExtension}`
    );
    tempVideoPath = path.join(os.tmpdir(), tempVideoFileName);

    console.log(`[LargeFileAction] Saving uploaded video to: ${tempVideoPath}`);
    await fsPromises.writeFile(tempVideoPath, videoFileBuffer);
    console.log(
      `[LargeFileAction] Uploaded video saved successfully to: ${tempVideoPath}`
    );

    // --- 2. Use FFmpeg on the server to extract audio ---
    const audioOutputFormat = "opus";
    const audioFileName = sanitizeFilename(
      `extracted_audio_large_${uniqueId}.${audioOutputFormat}`
    );
    tempAudioPath = path.join(os.tmpdir(), audioFileName);

    const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempAudioPath}"`;

    console.log(`[LargeFileAction] Executing FFmpeg: ${ffmpegCommand}`);
    const {stdout, stderr} = await execAsync(ffmpegCommand);

    if (stdout) console.log(`[LargeFileAction] FFmpeg stdout: ${stdout}`);
    if (stderr)
      console.log(
        `[LargeFileAction] FFmpeg stderr (often informational): ${stderr}`
      );

    try {
      const stats = await fsPromises.stat(tempAudioPath);
      if (stats.size === 0) {
        throw new Error(
          `Extracted audio file is empty. FFmpeg stderr (if any): ${
            stderr || "N/A"
          }`
        );
      }
      console.log(
        `[LargeFileAction] Audio extracted to: ${tempAudioPath}, size: ${stats.size}`
      );
    } catch (statError: any) {
      console.error(
        `[LargeFileAction] Error accessing extracted audio file stats: ${statError.message}`
      );
      throw new Error(
        `Extracted audio file not found or unreadable after FFmpeg. FFmpeg stderr (if any): ${
          stderr || "N/A"
        }`
      );
    }

    // --- 3. Prepare audio data for transcription ---
    const audioFileBuffer = await fsPromises.readFile(tempAudioPath);

    const formDataForGroq = new FormData();
    // Create a Blob from buffer to mimic client-side File for FormData
    const audioBlobForGroq = new Blob([audioFileBuffer], {
      type: `audio/${audioOutputFormat}`,
    });
    formDataForGroq.append("audioBlob", audioBlobForGroq, audioFileName);

    // --- 4. Call the transcription action ---
    console.log(
      "[LargeFileAction] Calling transcribeAudioAction with server-extracted audio and mode:",
      mode
    );
    return await transcribeAudioAction(formDataForGroq, mode);
  } catch (error: any) {
    console.error("[LargeFileAction] Error in processing pipeline:", error);
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? ` (Code: ${error.code})`
        : "";
    return {
      success: false,
      error: `Failed to process uploaded video file: ${
        error instanceof Error ? error.message : String(error)
      }${errorCode}`,
    };
  } finally {
    // --- 5. Cleanup temporary files ---
    if (tempVideoPath) {
      console.log(
        `[LargeFileAction] Attempting to delete temp video: ${tempVideoPath}`
      );
      fsPromises
        .unlink(tempVideoPath)
        .then(() =>
          console.log(`[LargeFileAction] Deleted temp video: ${tempVideoPath}`)
        )
        .catch((err) =>
          console.warn(
            `[LargeFileAction] Failed to delete temp video (${tempVideoPath}):`,
            err.message
          )
        );
    }
    if (tempAudioPath) {
      console.log(
        `[LargeFileAction] Attempting to delete temp audio: ${tempAudioPath}`
      );
      fsPromises
        .unlink(tempAudioPath)
        .then(() =>
          console.log(`[LargeFileAction] Deleted temp audio: ${tempAudioPath}`)
        )
        .catch((err) =>
          console.warn(
            `[LargeFileAction] Failed to delete temp audio (${tempAudioPath}):`,
            err.message
          )
        );
    }
  }
}
