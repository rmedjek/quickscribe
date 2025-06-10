// app/lib/ffmpeg-utils.ts
import { FFmpeg, FFmpegProgressData } from '@ffmpeg/ffmpeg'; // Import types from your .d.ts
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
const publicBaseURL = typeof window !== 'undefined' ? `${window.location.origin}` : '';

export async function getFFmpegInstance(
  logCallback?: (message: string) => void,
  progressCallback?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && typeof ffmpegInstance.isLoaded === 'function' && ffmpegInstance.isLoaded()) {
    console.log('[ffmpeg-utils] Returning cached FFmpeg instance.');
    // Note: Re-attaching specific log/progress handlers to a cached global instance
    // might require the FFmpeg library to support removing old listeners or adding multiple.
    // For now, the initial setup of listeners on the cached instance will persist.
    return ffmpegInstance;
  }

  console.log('[ffmpeg-utils] Creating new FFmpeg instance...');
  const instance = new FFmpeg();

  // Setup log listener
  instance.on('log', (logData) => { // With overloads, logData should be FFmpegLogData
      // Type guard still useful for robustness or if overloads don't perfectly match library behavior
      if ('message' in logData && 'type' in logData) {
        const fullLogMessage = `FFMPEG_WASM_LOG: [${logData.type}] ${logData.message}`;
        console.log(fullLogMessage); // Always log to dev console for debugging
        if (logCallback) {
            logCallback(fullLogMessage);
        }
      } else {
        // This case should ideally not be hit if overloads are working correctly
        // and the 'log' event only emits FFmpegLogData.
        console.warn('[ffmpeg-utils] Received unexpected data structure on "log" event:', logData);
      }
  });

  // Setup progress listener
  if (progressCallback) {
    instance.on('progress', (progressData) => { // progressData should be FFmpegProgressData
        // Type guard for robustness
        if ('progress' in progressData && typeof progressData.progress === 'number') {
            progressCallback(progressData.progress);
        } else {
            console.warn('[ffmpeg-utils] Received unexpected data structure on "progress" event:', progressData);
        }
    });
  }

  console.log('[ffmpeg-utils] Attempting to load FFmpeg UMD core from /public/ffmpeg-core-umd/');
  try {
    await instance.load({
        coreURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.js`,
        wasmURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.wasm`,
    });
    console.log('[ffmpeg-utils] FFmpeg UMD core loaded successfully.');
    ffmpegInstance = instance;
  } catch (error) {
    console.error('[ffmpeg-utils] Error loading FFmpeg UMD core:', error);
    throw error;
  }
  return ffmpegInstance;
}

export interface ExtractAudioOptions {
    file: File;
    outputFormat?: 'mp3' | 'opus' | 'flac' | 'wav';
    onLog?: (message: string) => void;
    onProgress?: (progress: number) => void;
    ffmpeg?: FFmpeg | null;
}

export async function extractAudio({
    file,
    outputFormat = 'opus',
    onLog, // Operation-specific log handler
    onProgress, // Operation-specific progress handler
    ffmpeg: providedFfmpeg,
}: ExtractAudioOptions): Promise<Blob> {

    const isProvidedFfmpegReady = !!(
        providedFfmpeg &&
        typeof providedFfmpeg.isLoaded === 'function' &&
        providedFfmpeg.isLoaded()
    );
    console.log(`[extractAudio] Using provided FFmpeg instance: ${isProvidedFfmpegReady}`);

    // For getFFmpegInstance, we pass the operation-specific onLog if we might load a new instance.
    // However, the instance's general log listener (set up when it's first created) will always fire to console.
    const ffmpegToUse = isProvidedFfmpegReady
                        ? providedFfmpeg!
                        : await getFFmpegInstance(onLog, undefined); // Pass onLog for new instance creation phase

    if (!ffmpegToUse || (typeof ffmpegToUse.isLoaded === 'function' && !ffmpegToUse.isLoaded())) {
        throw new Error("[extractAudio] FFmpeg instance is not available or not loaded.");
    }

  // For specific exec operations, set and clear listeners per exec
  // to avoid accumulating callbacks across multiple conversions.
  const supportsOff = typeof (ffmpegToUse as any).off === 'function';
  let operationProgressListener: ((data: FFmpegProgressData) => void) | null = null;

  if (onProgress && typeof ffmpegToUse.on === 'function') {
      operationProgressListener = (progressData) => {
           if ('progress' in progressData && typeof progressData.progress === 'number') {
              onProgress(progressData.progress);
          }
      };

      const marker = '__qsProgressAttached';
      const alreadyAttached = (ffmpegToUse as any)[marker];
      if (supportsOff || !alreadyAttached) {
          ffmpegToUse.on('progress', operationProgressListener);
          (ffmpegToUse as any)[marker] = true;
      }
  }
    // Similarly for operation-specific logs if needed beyond the global console log:
    // let operationLogListener: ((data: FFmpegLogData) => void) | null = null;
    // if (onLog && typeof ffmpegToUse.on === 'function') {
    //     operationLogListener = (logData) => { onLog(`[EXEC_LOG][${logData.type}] ${logData.message}`); };
    //     ffmpegToUse.on('log', operationLogListener);
    // }


    const extension = file.name.split('.').pop()?.toLowerCase() || 'tmp';
    const inputFileName = `input.${extension}`;
    const outputFileName = `output.${outputFormat}`;

    console.log(`[extractAudio] Writing file "${inputFileName}" to FFmpeg's virtual file system...`);
    await ffmpegToUse.writeFile(inputFileName, await fetchFile(file));
    console.log(`[extractAudio] File "${inputFileName}" written successfully.`);

    const args: string[] = [ '-y', '-i', inputFileName, '-vn' ];
    switch (outputFormat) {
      case 'opus': args.push('-acodec', 'libopus', '-b:a', '64k', '-ar', '16000', '-ac', '1'); break;
      case 'mp3': args.push('-acodec', 'libmp3lame', '-b:a', '128k', '-ar', '16000', '-ac', '1'); break;
      case 'flac': args.push('-acodec', 'flac', '-ar', '16000', '-ac', '1'); break;
      case 'wav': args.push('-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'); break;
      default: throw new Error(`[extractAudio] Unsupported output format: ${outputFormat}`);
    }
    args.push(outputFileName);
    console.log(`[extractAudio] Running FFmpeg command: ffmpeg ${args.join(' ')}`);

    try {
      const exitCode = await ffmpegToUse.exec(args);

      if (operationProgressListener) {
          if (supportsOff) {
              (ffmpegToUse as any).off('progress', operationProgressListener);
          } else if (typeof ffmpegToUse.on === 'function') {
              // Fall back to setting an empty handler if .off() is unavailable
              ffmpegToUse.on('progress', () => {});
          }
      }
      // if (operationLogListener && typeof ffmpegToUse.on === 'function') {
      //     ffmpegToUse.on('log', () => {}); // Deregister log if it was operation specific
      // }

      if (exitCode !== 0) {
          let errorMessage = `[extractAudio] FFmpeg exited with code ${exitCode}.`;
          errorMessage += " Check console for FFMPEG_WASM_LOG entries for details.";
          if (exitCode === 1) {
            errorMessage += " This commonly indicates issues like unsupported input format, file corruption, no audio track, or internal FFmpeg errors.";
          }
          throw new Error(errorMessage);
      }
      console.log('[extractAudio] FFmpeg command finished successfully.');

      const data = await ffmpegToUse.readFile(outputFileName);

      if (data.length === 0) {
        throw new Error("[extractAudio] Extracted audio is empty. The video might not have an audio track or the format is unsupported.");
      }

      if (ffmpegToUse.FS && typeof ffmpegToUse.FS === 'function') {
          try {
              console.log(`[extractAudio] Unlinking "${inputFileName}" and "${outputFileName}" from FFmpeg FS...`);
              ffmpegToUse.FS('unlink', inputFileName);
              ffmpegToUse.FS('unlink', outputFileName);
              console.log('[extractAudio] FFmpeg FS files unlinked successfully.');
          } catch (fsError) {
              console.warn('[extractAudio] Could not unlink files from FFmpeg FS:', fsError);
          }
      } else {
          console.warn("[extractAudio] ffmpeg.FS method not available for cleanup.");
      }

      console.log(`[extractAudio] Extracted audio file "${outputFileName}" with size: ${data.length} bytes.`);
      return new Blob([data], { type: `audio/${outputFormat}` });

    } catch (error) {
      if (operationProgressListener) {
          if (supportsOff) {
              (ffmpegToUse as any).off('progress', operationProgressListener);
          } else if (typeof ffmpegToUse.on === 'function') {
              ffmpegToUse.on('progress', () => {});
          }
      }
      // if (operationLogListener && typeof ffmpegToUse.on === 'function') {
      //     ffmpegToUse.on('log', () => {});
      // }
      console.error('[extractAudio] Error during FFmpeg execution or post-processing:', error);
      throw error;
    }
}