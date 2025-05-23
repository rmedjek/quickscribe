/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/processVideoLinkAction.ts
"use server";

import * as fsPromises from 'node:fs/promises';
import * as fsCore from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fetch from 'node-fetch-commonjs'; 
import play from 'play-dl';       

import { transcribeAudioAction, DetailedTranscriptionResult } from './transcribeAudioAction'; 

const execAsync = promisify(exec);

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200); 
}

export async function processVideoLinkAction(
  videoUrl: string
): Promise<{ success: boolean; data?: DetailedTranscriptionResult; error?: string }> {
  console.log(`[VideoLinkAction - YTDLP AudioOnly] Processing URL: ${videoUrl}`);
  let tempDownloadedFilePath: string | null = null; // This will now store the path to the downloaded audio
  let tempOpusAudioPath: string | null = null;    // This will be the path for the final Opus audio
  const uniqueId = Date.now();

  try {
    console.log("[VideoLinkAction - YTDLP AudioOnly] Preparing to download audio from video link...");
    
    const downloadedFileNameBase = `temp_downloaded_audio_${uniqueId}`;
    // yt-dlp with 'bestaudio' often defaults to .m4a or .webm (audio).
    // We'll let FFmpeg handle the input format regardless.
    let downloadedFileExtension = 'm4a'; // A common audio extension yt-dlp might use
    
    const validationResult = await play.validate(videoUrl);
    console.log(`[VideoLinkAction - YTDLP AudioOnly] play.validate result for ${videoUrl}: ${validationResult}`);

    if (validationResult === 'yt_video' || videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
      console.log("[VideoLinkAction - YTDLP AudioOnly] YouTube URL detected. Downloading audio with yt-dlp CLI...");
      
      tempDownloadedFilePath = path.join(os.tmpdir(), `${downloadedFileNameBase}.${downloadedFileExtension}`);

      // yt-dlp command for best audio:
      // -f bestaudio: Selects the best quality audio-only stream.
      // --extract-audio or -x: (Often used with bestaudio) Tells yt-dlp to ensure the output is an audio file.
      // --audio-format mp3/m4a/opus/etc.: If you want yt-dlp itself to convert. 
      //     However, since we use FFmpeg later for Opus, just getting bestaudio is fine.
      // -o "${tempDownloadedFilePath}" : Output to this specific filepath.
      // --force-overwrites : Overwrite if file exists.
      // --no-playlist : Only download the single video's audio if URL is part of a playlist.
      // Let's try a simpler format selection for best audio and specify an output template that sets extension.
      // Using `%(ext)s` in output template lets yt-dlp set the correct extension.
      // We'll need to find the actual filename after download if we use %(ext)s.

      // For simplicity in finding the file, let's specify a common audio output for yt-dlp if it needs to convert.
      // Or, let it download whatever 'bestaudio' is and let our FFmpeg handle it.
      // The command below aims to download the best audio and let FFmpeg figure out the input.
      // yt-dlp will name the file based on the -o template. If `%(ext)s` is used, we need to find the file.
      // Let's fix the output name for predictability.
      // -x is shortcut for --extract-audio. --audio-format best tells it to keep best audio format.

      // To ensure we get a known extension for FFmpeg and avoid complex filename discovery,
      // let's tell yt-dlp to output as m4a (a common, good quality audio format FFmpeg handles well).
      downloadedFileExtension = 'm4a'; // We'll ask yt-dlp for this
      tempDownloadedFilePath = path.join(os.tmpdir(), `${downloadedFileNameBase}.${downloadedFileExtension}`);
      const finalYtDlpCommand = `yt-dlp --quiet --progress --force-overwrites -x --audio-format m4a -o "${tempDownloadedFilePath}" --no-playlist "${videoUrl}"`;


      console.log(`[VideoLinkAction - YTDLP AudioOnly] Executing yt-dlp: ${finalYtDlpCommand}`);
      try {
        const { stdout: ytStdout, stderr: ytStderr } = await execAsync(finalYtDlpCommand, { timeout: 300000 }); // 5 min timeout
        
        if (ytStdout) console.log(`[VideoLinkAction - YTDLP AudioOnly] yt-dlp stdout: ${ytStdout}`);
        if (ytStderr) console.log(`[VideoLinkAction - YTDLP AudioOnly] yt-dlp stderr: ${ytStderr}`);
        
        await fsPromises.stat(tempDownloadedFilePath); 
        console.log(`[VideoLinkAction - YTDLP AudioOnly] Audio successfully downloaded by yt-dlp to: ${tempDownloadedFilePath}`);
      } catch (ytDlpError: any) {
        console.error(`[VideoLinkAction - YTDLP AudioOnly] yt-dlp execution error:`, ytDlpError);
        const errorMessage = ytDlpError.stderr ? `yt-dlp failed: ${ytDlpError.stderr}` : `yt-dlp failed: ${ytDlpError.message}`;
        throw new Error(errorMessage);
      }
    } else { // Direct link logic remains largely the same (downloads the file as is)
      console.log("[VideoLinkAction - YTDLP AudioOnly] Assuming direct link or unknown URL. Attempting download with fetch...");
      try {
        const parsedUrl = new URL(videoUrl); 
        const extFromPath = parsedUrl.pathname.split('.').pop()?.toLowerCase();
        if (extFromPath && extFromPath.length > 1 && extFromPath.length <= 5) { 
            downloadedFileExtension = extFromPath; // This is a video extension
        } else {
            downloadedFileExtension = 'mp4'; // Default if no clear extension
        }
      } catch (urlParseError) {
        console.warn(`[VideoLinkAction - YTDLP AudioOnly] Could not parse URL to get extension: ${videoUrl}`, urlParseError);
        downloadedFileExtension = 'mp4'; // Fallback
      }
      tempDownloadedFilePath = path.join(os.tmpdir(), `${downloadedFileNameBase}.${downloadedFileExtension}`);
      
      const response = await fetch(videoUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download video from direct link: ${response.status} ${response.statusText} for URL: ${videoUrl}`);
      }
      const fileStream = fsCore.createWriteStream(tempDownloadedFilePath);
      await new Promise<void>((resolve, reject) => { /* ... stream piping ... */ 
          response.body!.pipe(fileStream);
          response.body!.on("error", (err) => { console.error("[VideoLinkAction - YTDLP AudioOnly] Direct link response body stream error:", err); reject(err); });
          fileStream.on("finish", () => { console.log("[VideoLinkAction - YTDLP AudioOnly] Direct link stream piped to file successfully."); resolve(); });
          fileStream.on("error", (err) => { console.error("[VideoLinkAction - YTDLP AudioOnly] Direct link fileStream error:", err); reject(err); });
      });
    }
    if (!tempDownloadedFilePath) {
        throw new Error("Video/Audio download failed or was not attempted for the given URL.");
    }
    console.log(`[VideoLinkAction - YTDLP AudioOnly] Content successfully downloaded to: ${tempDownloadedFilePath}`);

    // --- 2. Use FFmpeg on the server to convert downloaded audio (or extract from video) to Opus ---
    const audioOutputFormat = 'opus';
    const opusAudioFileName = sanitizeFilename(`extracted_audio_opus_${uniqueId}.${audioOutputFormat}`);
    tempOpusAudioPath = path.join(os.tmpdir(), opusAudioFileName);

    // FFmpeg command will take the downloaded file (which might be m4a, webm, mp4, etc.)
    // and convert it to Opus. If it was already audio, -vn is harmless.
    const ffmpegCommand = `ffmpeg -i "${tempDownloadedFilePath}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tempOpusAudioPath}"`;
    
    console.log(`[VideoLinkAction - YTDLP AudioOnly] Executing FFmpeg: ${ffmpegCommand}`);
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stdout) console.log(`[VideoLinkAction - YTDLP AudioOnly] FFmpeg stdout: ${stdout}`);
    if (stderr) console.log(`[VideoLinkAction - YTDLP AudioOnly] FFmpeg stderr (often informational): ${stderr}`);
    
    try {
        const stats = await fsPromises.stat(tempOpusAudioPath);
        if (stats.size === 0) {
            throw new Error(`Extracted Opus audio file is empty. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
        }
        console.log(`[VideoLinkAction - YTDLP AudioOnly] Opus audio extracted to: ${tempOpusAudioPath}, size: ${stats.size}`);
    } catch (statError: any) {
        console.error(`[VideoLinkAction - YTDLP AudioOnly] Error accessing extracted Opus audio file stats: ${statError.message}`);
        throw new Error(`Extracted Opus audio file not found or unreadable after FFmpeg. FFmpeg stderr (if any): ${stderr || 'N/A'}`);
    }
    
    const audioFileBuffer = await fsPromises.readFile(tempOpusAudioPath);

    const formData = new FormData();
    const audioBlobForGroq = new Blob([audioFileBuffer], { type: `audio/${audioOutputFormat}` });
    formData.append("audioBlob", audioBlobForGroq, opusAudioFileName); 

    console.log("[VideoLinkAction - YTDLP AudioOnly] Calling transcribeAudioAction with server-extracted Opus audio...");
    return await transcribeAudioAction(formData);

  } catch (error: any) {
    console.error("[VideoLinkAction - YTDLP AudioOnly] Error in processing pipeline:", error);
    const errorCode = (typeof error === 'object' && error !== null && 'code' in error) ? ` (Code: ${error.code}` : '';
    return { 
        success: false, 
        error: `Failed to process video link: ${error instanceof Error ? error.message : String(error)}${errorCode}` 
    };
  } finally {
    if (tempDownloadedFilePath) {
      console.log(`[VideoLinkAction - YTDLP AudioOnly] Attempting to delete temp downloaded file: ${tempDownloadedFilePath}`);
      fsPromises.unlink(tempDownloadedFilePath)
        .then(() => console.log(`[VideoLinkAction - YTDLP AudioOnly] Deleted temp downloaded file: ${tempDownloadedFilePath}`))
        .catch(err => console.warn(`[VideoLinkAction - YTDLP AudioOnly] Failed to delete temp downloaded file (${tempDownloadedFilePath}):`, err.message));
    }
    if (tempOpusAudioPath) {
      console.log(`[VideoLinkAction - YTDLP AudioOnly] Attempting to delete temp Opus audio: ${tempOpusAudioPath}`);
      fsPromises.unlink(tempOpusAudioPath)
        .then(() => console.log(`[VideoLinkAction - YTDLP AudioOnly] Deleted temp Opus audio: ${tempOpusAudioPath}`))
        .catch(err => console.warn(`[VideoLinkAction - YTDLP AudioOnly] Failed to delete temp Opus audio (${tempOpusAudioPath}):`, err.message));
    }
  }
}