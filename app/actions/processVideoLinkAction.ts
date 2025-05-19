/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/processVideoLinkAction.ts
"use server";

import * as fsPromises from 'node:fs/promises';
// fsCore might not be needed if yt-dlp downloads the file directly
import * as fsCore from 'node:fs'; 
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fetch from 'node-fetch-commonjs'; 
import play from 'play-dl'; // Still useful for play.validate()

import { transcribeAudioAction, DetailedTranscriptionResult } from './transcribeAudioAction'; 

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200); 
}

export async function processVideoLinkAction(
  videoUrl: string
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log(`[VideoLinkAction - YTDLP] Processing URL: ${videoUrl}`);
  let tempVideoPath: string | null = null;
  let tempAudioPath: string | null = null;
  const uniqueId = Date.now();

  try {
    console.log("[VideoLinkAction - YTDLP] Preparing to download video...");
    
    const videoFileNameBase = `temp_video_ytdlp_${uniqueId}`;
    // yt-dlp by default will try to get a good container, often .webm or .mp4
    // We can specify output template to control extension if needed, but let's keep it simple first
    let videoFileExtension = 'mp4'; // yt-dlp can be told to output mp4
    tempVideoPath = path.join(os.tmpdir(), `${videoFileNameBase}.${videoFileExtension}`);
    
    const validationResult = await play.validate(videoUrl);
    console.log(`[VideoLinkAction - YTDLP] play.validate result for ${videoUrl}: ${validationResult}`);

    if (validationResult === 'yt_video' || videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
      console.log("[VideoLinkAction - YTDLP] YouTube URL detected. Downloading with yt-dlp CLI...");

      // yt-dlp command:
      // -o "${tempVideoPath}" : Output to this specific filepath and name.
      // -f "bv*[ext=mp4][height<=480]+ba[ext=m4a]/b[ext=mp4][height<=480]" : Format selection string.
      //   - Tries to get best video (bv*) with mp4 extension up to 480p height,
      //     PLUS best audio (ba) with m4a extension.
      //   - Then fallback to best overall (b) with mp4 extension up to 480p.
      //   - This ensures we get audio and video, and FFmpeg (which yt-dlp uses for merging) will output mp4.
      // --force-overwrites : Overwrite if file exists.
      // --no-playlist : Only download the single video if URL is part of a playlist.
      // You might need to adjust the format string (-f) based on desired quality/size.
      // A simpler option for testing is just letting yt-dlp pick: `yt-dlp --force-overwrites -o "${tempVideoPath}" --no-playlist "${videoUrl}"`
      // For audio extraction, getting a decent quality video is enough.
      const ytDlpFormat = `bv*[ext=mp4][height<=480]+ba[ext=m4a]/b[ext=mp4][height<=480]`; // Request 480p MP4
      const ytDlpCommand = `yt-dlp --quiet --progress --force-overwrites -f "${ytDlpFormat}" -o "${tempVideoPath}" --no-playlist "${videoUrl}"`;
      
      console.log(`[VideoLinkAction - YTDLP] Executing yt-dlp: ${ytDlpCommand}`);
      try {
        // execAsync can have buffer limits for stdout/stderr. If yt-dlp is very verbose, this might be an issue.
        // For very verbose output, consider child_process.spawn instead.
        const { stdout: ytStdout, stderr: ytStderr } = await execAsync(ytDlpCommand, { timeout: 300000 }); // 5 min timeout
        
        if (ytStdout) console.log(`[VideoLinkAction - YTDLP] yt-dlp stdout: ${ytStdout}`);
        // yt-dlp often uses stderr for progress and info, so only treat as error if exit code was non-zero (caught by execAsync reject)
        if (ytStderr) console.log(`[VideoLinkAction - YTDLP] yt-dlp stderr: ${ytStderr}`);
        
        await fsPromises.stat(tempVideoPath); 
        console.log(`[VideoLinkAction - YTDLP] Video successfully downloaded by yt-dlp to: ${tempVideoPath}`);
      } catch (ytDlpError: any) {
        console.error(`[VideoLinkAction - YTDLP] yt-dlp execution error:`, ytDlpError);
        // Include stderr in the error message if available, as it's often informative
        const errorMessage = ytDlpError.stderr ? `yt-dlp failed: ${ytDlpError.stderr}` : `yt-dlp failed: ${ytDlpError.message}`;
        throw new Error(errorMessage);
      }
    } else if (validationResult && (validationResult.startsWith('sp_') || validationResult.startsWith('so_'))) {
        return { success: false, error: `Platform (${validationResult}) is not supported for video/audio download in this app.` };
    } else {
      // Direct link fetch logic
      console.log("[VideoLinkAction - YTDLP] Assuming direct link or unknown URL. Attempting download with fetch...");
      // ... (same direct link download logic as before, using fetch and fsCore.createWriteStream) ...
      try {
        const parsedUrl = new URL(videoUrl); 
        const extFromPath = parsedUrl.pathname.split('.').pop()?.toLowerCase();
        if (extFromPath && extFromPath.length > 1 && extFromPath.length <= 5) { 
            videoFileExtension = extFromPath;
        }
      } catch (urlParseError) {
        console.warn(`[VideoLinkAction - YTDLP] Could not parse URL to get extension: ${videoUrl}`, urlParseError);
      }
      tempVideoPath = path.join(os.tmpdir(), `${videoFileNameBase}.${videoFileExtension}`);
      
      const response = await fetch(videoUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download video from direct link: ${response.status} ${response.statusText} for URL: ${videoUrl}`);
      }
      const fileStream = fsCore.createWriteStream(tempVideoPath);
      await new Promise<void>((resolve, reject) => {
          response.body!.pipe(fileStream);
          response.body!.on("error", (err) => { console.error("[VideoLinkAction - YTDLP] Direct link response body stream error:", err); reject(err); });
          fileStream.on("finish", () => { console.log("[VideoLinkAction - YTDLP] Direct link stream piped to file successfully."); resolve(); });
          fileStream.on("error", (err) => { console.error("[VideoLinkAction - YTDLP] Direct link fileStream error:", err); reject(err); });
      });
    }
    // If tempVideoPath is null here, it means no download path was taken or it failed before setting.
    if (!tempVideoPath) {
        throw new Error("Video download failed or was not attempted for the given URL.");
    }
    console.log(`[VideoLinkAction - YTDLP] Video/audio content successfully downloaded to: ${tempVideoPath}`);


    // --- 2. Use FFmpeg on the server to extract/convert audio ---
    // ... (This part remains the same) ...
    const audioOutputFormat = 'opus';
    const audioFileName = sanitizeFilename(`extracted_audio_${uniqueId}.${audioOutputFormat}`);
    tempAudioPath = path.join(os.tmpdir(), audioFileName);

    const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempAudioPath}"`;
    
    console.log(`[VideoLinkAction - YTDLP] Executing FFmpeg: ${ffmpegCommand}`);
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stdout) console.log(`[VideoLinkAction - YTDLP] FFmpeg stdout: ${stdout}`);
    if (stderr) console.log(`[VideoLinkAction - YTDLP] FFmpeg stderr (often informational): ${stderr}`);
    
    try {
        const stats = await fsPromises.stat(tempAudioPath);
        if (stats.size === 0) {
            throw new Error(`Extracted audio file is empty. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
        }
        console.log(`[VideoLinkAction - YTDLP] Audio extracted to: ${tempAudioPath}, size: ${stats.size}`);
    } catch (statError: any) {
        console.error(`[VideoLinkAction - YTDLP] Error accessing extracted audio file stats: ${statError.message}`);
        throw new Error(`Extracted audio file not found or unreadable after FFmpeg. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
    }
    
    const audioFileBuffer = await fsPromises.readFile(tempAudioPath);

    const formData = new FormData();
    const audioBlobForGroq = new Blob([audioFileBuffer], { type: `audio/${audioOutputFormat}` });
    formData.append("audioBlob", audioBlobForGroq, audioFileName); 

    console.log("[VideoLinkAction - YTDLP] Calling transcribeAudioAction with server-extracted audio...");
    return await transcribeAudioAction(formData);

  } catch (error: any) {
    console.error("[VideoLinkAction - YTDLP] Error in processing pipeline:", error);
    const errorCode = (typeof error === 'object' && error !== null && 'code' in error) ? ` (Code: ${error.code}` : '';
    // Input might not be relevant for yt-dlp errors in the same way as Invalid URL
    return { 
        success: false, 
        error: `Failed to process video link: ${error instanceof Error ? error.message : String(error)}${errorCode}` 
    };
  } finally {
    // ... (Cleanup logic as before) ...
    if (tempVideoPath) {
      console.log(`[VideoLinkAction - YTDLP] Attempting to delete temp video: ${tempVideoPath}`);
      fsPromises.unlink(tempVideoPath)
        .then(() => console.log(`[VideoLinkAction - YTDLP] Deleted temp video: ${tempVideoPath}`))
        .catch(err => console.warn(`[VideoLinkAction - YTDLP] Failed to delete temp video (${tempVideoPath}):`, err.message));
    }
    if (tempAudioPath) {
      console.log(`[VideoLinkAction - YTDLP] Attempting to delete temp audio: ${tempAudioPath}`);
      fsPromises.unlink(tempAudioPath)
        .then(() => console.log(`[VideoLinkAction - YTDLP] Deleted temp audio: ${tempAudioPath}`))
        .catch(err => console.warn(`[VideoLinkAction - YTDLP] Failed to delete temp audio (${tempAudioPath}):`, err.message));
    }
  }
}