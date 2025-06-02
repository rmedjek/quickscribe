// app/lib/ffmpeg-utils.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'; 
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
const publicBaseURL = typeof window !== 'undefined' ? `${window.location.origin}` : '';

export async function getFFmpegInstance(
  logCallback?: (message: string) => void,
  progressCallback?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && typeof ffmpegInstance.isLoaded === 'function' && ffmpegInstance.isLoaded()) {
    return ffmpegInstance;
  }

  console.log('Creating new FFmpeg instance...');
  const instance = new FFmpeg(); 

  if (logCallback) {
    instance.on('log', (logData) => {
        if ('message' in logData && typeof logData.message === 'string') {
            logCallback(logData.message);
        }
    });
  }
  if (progressCallback) {
    instance.on('progress', (data) => { 
        if ('progress' in data && typeof data.progress === 'number') {
            progressCallback(data.progress);
        }
    });
  }
  
  console.log('Attempting to load FFmpeg UMD core from /public/ffmpeg-core-umd/ (UMD, no explicit workerURL)');
  try {
    await instance.load({
        coreURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.js`,
        wasmURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.wasm`,
    });
    console.log('FFmpeg UMD core (from /public, no explicit workerURL) loaded successfully.'); 
    ffmpegInstance = instance;
  } catch (error) {
    console.error('Error loading FFmpeg UMD core (from /public, no explicit workerURL):', error); 
    throw error;
  }
  
  return ffmpegInstance;
}

export interface ExtractAudioOptions {
    file: File;
    outputFormat?: 'mp3' | 'opus' | 'flac' | 'wav';
    onLog?: (message: string) => void;
    onProgress?: (progress: number) => void;
}
  
export async function extractAudio({
    file,
    outputFormat = 'opus',
    onLog,
    onProgress,
}: ExtractAudioOptions): Promise<Blob> {
    const ffmpeg = await getFFmpegInstance(onLog, onProgress); 
    
    const extension = file.name.split('.').pop()?.toLowerCase() || 'tmp';
    const inputFileName = `input.${extension}`;
    const outputFileName = `output.${outputFormat}`;
  
    console.log(`[extractAudio] Writing file ${inputFileName} to FFmpeg FS...`);
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));
    console.log('[extractAudio] File written to FFmpeg FS.');
  
    const args: string[] = ['-i', inputFileName, '-vn'];
    switch (outputFormat) {
      case 'opus': args.push('-acodec', 'libopus', '-b:a', '64k', '-ar', '16000', '-ac', '1'); break;
      case 'mp3': args.push('-acodec', 'libmp3lame', '-b:a', '128k', '-ar', '16000', '-ac', '1'); break;
      case 'flac': args.push('-acodec', 'flac', '-ar', '16000', '-ac', '1'); break;
      case 'wav': args.push('-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1'); break;
      default: throw new Error(`Unsupported output format: ${outputFormat}`);
    }
    args.push(outputFileName);
  
    console.log(`[extractAudio] Running FFmpeg command: ffmpeg ${args.join(' ')}`);
    
    try {
      const exitCode = await ffmpeg.exec(args); 
      
      if (exitCode !== 0) {
          const ffmpegErrorLog = onLog ? " Check console for FFmpeg logs." : "";
          let errorMessage = `FFmpeg exited with code ${exitCode}.${ffmpegErrorLog}`;
          if (onLog) { 
            errorMessage += " Possible no audio track or unsupported format for client-side processing.";
          }
          throw new Error(errorMessage);
      }
      console.log('[extractAudio] FFmpeg command finished successfully.');
  
      const data = await ffmpeg.readFile(outputFileName);

      if (data.length === 0) {
        throw new Error("Extracted audio is empty. The video might not have an audio track or the format is unsupported for client-side processing.");
      }
      
      // Attempt to delete files using the FS('unlink', ...) method
      if (ffmpeg.FS && typeof ffmpeg.FS === 'function') {
          try {
              console.log(`[extractAudio] Attempting to unlink ${inputFileName} and ${outputFileName} from FFmpeg FS...`);
              ffmpeg.FS('unlink', inputFileName);
              ffmpeg.FS('unlink', outputFileName);
              console.log('[extractAudio] FFmpeg FS files cleanup successful via FS.unlink.');
          } catch (fsError) {
              console.warn('[extractAudio] Could not unlink files from FFmpeg FS:', fsError);
          }
      } else {
          console.warn("[extractAudio] ffmpeg.FS method not available for cleanup.");
      }
  
      console.log(`[extractAudio] Extracted audio file ${outputFileName} with size: ${data.length}`);
      return new Blob([data], { type: `audio/${outputFormat}` });
  
    } catch (error) {
      console.error('[extractAudio] Error during FFmpeg execution/post-processing:', error);
      throw error; 
    }
}