// lib/ffmpeg-utils.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'; // Confirmed this is the correct import
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
  // ... (other checks for existing instance if needed) ...

  console.log('Creating new FFmpeg instance...');
  const instance = new FFmpeg(); 

  if (logCallback) {
    instance.on('log', (logData) => {
        if ('message' in logData) {
            logCallback(logData.message as string);
        }
    });
  }
  if (progressCallback) {
    instance.on('progress', (data) => {
        if ('progress' in data) {
            progressCallback(data.progress as number);
        }
    });
  }
  
  console.log('Attempting to load FFmpeg core from /public/ffmpeg-core-umd/ (UMD, no explicit workerURL)');
  try {
    await instance.load({
        coreURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.js`,   // From public/ffmpeg-core/
        wasmURL: `${publicBaseURL}/ffmpeg-core-umd/ffmpeg-core.wasm`, // From public/ffmpeg-core/
        // NO workerURL should be specified here as the file doesn't exist
        // and the library (for this version/build) should handle worker creation internally.
    });
    console.log('FFmpeg core (from /public, ESM, no explicit workerURL) loaded successfully.');
    ffmpegInstance = instance;
  } catch (error) {
    console.error('Error loading FFmpeg core (from /public, ESM, no explicit workerURL):', error);
    throw error;
  }
  
  return ffmpegInstance;
}

// ... (extractAudio function remains the same, using this getFFmpegInstance) ...
// Ensure ExtractAudioOptions and the Promise<Blob> return type are correct.
interface ExtractAudioOptions {
    file: File;
    outputFormat?: 'mp3' | 'opus' | 'flac' | 'wav';
    onLog?: (message: string) => void;      // For logs during load AND exec
    onProgress?: (progress: number) => void; // For progress during load AND exec
  }
  
  export async function extractAudio({
    file,
    outputFormat = 'opus',
    onLog,
    onProgress, // This will be used by getFFmpegInstance for the instance's global progress handler
  }: ExtractAudioOptions): Promise<Blob> {
    // getFFmpegInstance will set up the onLog and onProgress handlers for the ffmpegInstance
    const ffmpeg = await getFFmpegInstance(onLog, onProgress); 
    
    const extension = file.name.split('.').pop()?.toLowerCase() || 'tmp'; // Get file extension
    const inputFileName = `input.${extension}`; // Use correct file variable
    const outputFileName = `output.${outputFormat}`;
  
    console.log(`[extractAudio] Writing file ${inputFileName} to FFmpeg FS...`);
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));
    console.log('[extractAudio] File written to FFmpeg FS.');
  
    const args = ['-i', inputFileName, '-vn'];
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
      const exitCode = await ffmpeg.exec(args); // This will trigger the 'progress' events
      if (exitCode !== 0) {
          throw new Error(`FFmpeg exited with code ${exitCode}.`);
      }
      console.log('[extractAudio] FFmpeg command finished successfully.');
  
      const data = await ffmpeg.readFile(outputFileName);
      
      if (ffmpeg.FS) {
          try {
              ffmpeg.FS('unlink', inputFileName);
              ffmpeg.FS('unlink', outputFileName);
              console.log('[extractAudio] Cleaned up files from FFmpeg FS.');
          } catch (fsError) {
              console.warn('[extractAudio] Could not unlink files from FFmpeg FS:', fsError);
          }
      }
  
      console.log(`[extractAudio] Extracted audio file ${outputFileName} with size: ${data.length}`);
      return new Blob([data], { type: `audio/${outputFormat}` });
  
    } catch (error) {
      console.error('[extractAudio] Error during FFmpeg execution:', error);
      throw error;
    }
  }