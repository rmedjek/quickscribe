/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import * as fsPromises from 'node:fs/promises';
import * as fsCore from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fetch from 'node-fetch-commonjs'; 
// We don't strictly need play.validate if we're defaulting to yt-dlp for non-direct links,
// but it can be a quick check for explicit YouTube URLs if desired.
// import play from 'play-dl'; 
import { transcribeAudioAction, DetailedTranscriptionResult } from './transcribeAudioAction'; 
import { TranscriptionMode } from '@/components/ConfirmationView';

const GROQ_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024; // 25MB

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200); 
}

export async function processVideoLinkAction(
  videoUrl: string,
  mode: TranscriptionMode // Add mode parameter
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log(`[VideoLinkAction] Processing URL: ${videoUrl} with mode: ${mode}`);
  let tempDownloadedFilePath: string | null = null;
  let tempOpusAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    console.log("[VideoLinkAction] Preparing to download video/audio content...");
    
    const downloadedFileNameBase = `temp_downloaded_content_${uniqueId}`;
    let downloadedFileExtension = 'mp4'; // Default, will be input to FFmpeg

    let isDirectKnownVideoFileLink = false;
    try {
        const parsedUrl = new URL(videoUrl);
        // Regex to check for common video file extensions at the end of the pathname
        if (/\.(mp4|mov|webm|avi|mkv|flv|mpeg|mpg|wmv|m4a|aac|ogg|wav|flac|opus)$/i.test(parsedUrl.pathname)) {
            isDirectKnownVideoFileLink = true;
            const extFromPath = parsedUrl.pathname.split('.').pop()?.toLowerCase();
            if (extFromPath) downloadedFileExtension = extFromPath;
        }
    } catch (e) {
        console.warn("[VideoLinkAction] URL parsing failed, will attempt download with yt-dlp:", e);
        // If URL is malformed, yt-dlp will likely fail, which is desired.
    }

    tempDownloadedFilePath = path.join(os.tmpdir(), `${downloadedFileNameBase}.${downloadedFileExtension}`);

    if (isDirectKnownVideoFileLink) {
      console.log(`[VideoLinkAction] Detected direct file link: ${videoUrl}. Attempting download with fetch...`);
      const response = await fetch(videoUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download from direct link: ${response.status} ${response.statusText} for URL: ${videoUrl}`);
      }
      const fileStream = fsCore.createWriteStream(tempDownloadedFilePath);
      await new Promise<void>((resolve, reject) => {
          response.body!.pipe(fileStream);
          response.body!.on("error", (err) => { console.error("[VideoLinkAction] Direct link response body stream error:", err); reject(err); });
          fileStream.on("finish", () => { console.log("[VideoLinkAction] Direct link stream piped to file successfully."); resolve(); });
          fileStream.on("error", (err) => { console.error("[VideoLinkAction] Direct link fileStream error:", err); reject(err); });
      });
    } else {
      // For YouTube, Vimeo, Dailymotion, and MANY other sites, or if unsure, try yt-dlp
      console.log(`[VideoLinkAction] URL (${videoUrl}) is not a clear direct file link or failed parsing. Attempting download with yt-dlp CLI...`);
      
      // yt-dlp command to download best audio and output as m4a (which FFmpeg handles well)
      // -x or --extract-audio: Extract audio track.
      // --audio-format m4a: Convert audio to m4a.
      // -o: Output template. We specify the full path.
      const ytDlpOutputExtension = 'm4a'; // Ask yt-dlp to give us M4A
      tempDownloadedFilePath = path.join(os.tmpdir(), `${downloadedFileNameBase}.${ytDlpOutputExtension}`);
      const ytDlpCommand = `yt-dlp --quiet --progress --force-overwrites -x --audio-format ${ytDlpOutputExtension} -o "${tempDownloadedFilePath}" --no-playlist "${videoUrl}"`;
      
      console.log(`[VideoLinkAction] Executing yt-dlp: ${ytDlpCommand}`);
      try {
        const { stdout: ytStdout, stderr: ytStderr } = await execAsync(ytDlpCommand, { timeout: 300000 }); // 5 min timeout
        
        if (ytStdout) console.log(`[VideoLinkAction] yt-dlp stdout: ${ytStdout}`);
        if (ytStderr) console.log(`[VideoLinkAction] yt-dlp stderr (often progress/info): ${ytStderr}`);
        
        // Check if the file was actually created by yt-dlp
        await fsPromises.stat(tempDownloadedFilePath); 
        console.log(`[VideoLinkAction] Content successfully downloaded by yt-dlp to: ${tempDownloadedFilePath}`);
      } catch (ytDlpError: any) {
        console.error(`[VideoLinkAction] yt-dlp execution error:`, ytDlpError);
        const errorMessage = ytDlpError.stderr ? `yt-dlp failed: ${ytDlpError.stderr}` : `yt-dlp failed: ${ytDlpError.message}`;
        throw new Error(errorMessage);
      }
    }
    
    if (!tempDownloadedFilePath) { // Should not happen if logic above is correct
        throw new Error("Download path was not set, indicating a download failure or logic error.");
    }
    console.log(`[VideoLinkAction] Content successfully downloaded to: ${tempDownloadedFilePath}`);

    // --- 2. Use FFmpeg on the server to convert downloaded content to Opus ---
    const audioOutputFormat = 'opus';
    const opusAudioFileName = sanitizeFilename(`extracted_audio_opus_${uniqueId}.${audioOutputFormat}`);
    tempOpusAudioPath = path.join(os.tmpdir(), opusAudioFileName);

    // FFmpeg command takes the downloaded file (could be video or already audio like m4a)
    // -vn ensures only audio is processed if it was a video file.
    const ffmpegCommand = `ffmpeg -i "${tempDownloadedFilePath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempOpusAudioPath}"`;
    
    console.log(`[VideoLinkAction] Executing FFmpeg: ${ffmpegCommand}`);
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stdout) console.log(`[VideoLinkAction] FFmpeg stdout: ${stdout}`);
    if (stderr) console.log(`[VideoLinkAction] FFmpeg stderr (often informational): ${stderr}`);
    
    try {
        const stats = await fsPromises.stat(tempOpusAudioPath);
        if (stats.size === 0) {
            throw new Error(`Extracted Opus audio file is empty. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
        }
        console.log(`[VideoLinkAction] Opus audio extracted to: ${tempOpusAudioPath}, size: ${stats.size}`);
    } catch (statError: any) {
        console.error(`[VideoLinkAction] Error accessing extracted Opus audio file stats: ${statError.message}`);
        throw new Error(`Extracted Opus audio file not found or unreadable after FFmpeg. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
    }
    
    const audioFileBuffer = await fsPromises.readFile(tempOpusAudioPath);
    
    if (audioFileBuffer.length > GROQ_AUDIO_LIMIT_BYTES) {
      const fileSizeMB = (audioFileBuffer.length / (1024 * 1024)).toFixed(2);
      const limitMB = (GROQ_AUDIO_LIMIT_BYTES / (1024 * 1024)).toFixed(2);
      const errorMessage = `Extracted audio (${fileSizeMB} MB) exceeds the transcription service limit of ${limitMB} MB. Please use a shorter video.`;
      console.error(`[ServerAction] ${errorMessage}`);
      // Clean up temp files before returning
      if (tempDownloadedFilePath) await fsPromises.unlink(tempDownloadedFilePath).catch(console.warn);
      if (tempOpusAudioPath) await fsPromises.unlink(tempOpusAudioPath).catch(console.warn);
      return { success: false, error: errorMessage };
    }

    const formData = new FormData();
    const audioBlobForGroq = new Blob([audioFileBuffer], { type: `audio/${audioOutputFormat}` });
    formData.append("audioBlob", audioBlobForGroq, opusAudioFileName); 

    console.log("[ServerAction] Calling transcribeAudioAction with server-extracted Opus audio...");
    return await transcribeAudioAction(formData, mode);

  } catch (error: any) {
    console.error("[VideoLinkAction] Error in processing pipeline:", error);
    const errorCode = (typeof error === 'object' && error !== null && 'code' in error) ? ` (Code: ${error.code}` : '';
    return { 
        success: false, 
        error: `Failed to process video link: ${error instanceof Error ? error.message : String(error)}${errorCode}` 
    };
  } finally {
    if (tempDownloadedFilePath) {
      console.log(`[VideoLinkAction] Attempting to delete temp downloaded file: ${tempDownloadedFilePath}`);
      fsPromises.unlink(tempDownloadedFilePath)
        .then(() => console.log(`[VideoLinkAction] Deleted temp downloaded file: ${tempDownloadedFilePath}`))
        .catch(err => console.warn(`[VideoLinkAction] Failed to delete temp downloaded file (${tempDownloadedFilePath}):`, err.message));
    }
    if (tempOpusAudioPath) {
      console.log(`[VideoLinkAction] Attempting to delete temp Opus audio: ${tempOpusAudioPath}`);
      fsPromises.unlink(tempOpusAudioPath)
        .then(() => console.log(`[VideoLinkAction] Deleted temp Opus audio: ${tempOpusAudioPath}`))
        .catch(err => console.warn(`[VideoLinkAction] Failed to delete temp Opus audio (${tempOpusAudioPath}):`, err.message));
    }
  }
}