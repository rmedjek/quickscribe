// types/ffmpeg.d.ts

declare module '@ffmpeg/ffmpeg' {
  // Define specific types for event data
  export interface FFmpegLogData {
    type: string; // Typically 'stdout' or 'stderr' for FFmpeg logs
    message: string;
  }

  export interface FFmpegProgressData {
    progress: number; // A value between 0 and 1
    time?: number;    // Current time in seconds, if available (often related to output duration)
  }

  export class FFmpeg {
    constructor(options?: unknown);

    load(options?: {
      coreURL?: string;
      wasmURL?: string;
      // workerURL?: string; // If you ever use the multi-threaded version
    }): Promise<void>;

    // Function overloads for the .on() method for better type inference
    on(event: 'log', callback: (data: FFmpegLogData) => void): void;
    on(event: 'progress', callback: (data: FFmpegProgressData) => void): void;
    // Fallback for any other event types, though 'log' and 'progress' are primary
    // on(event: string, callback: (data: any) => void): void;

    writeFile(path: string, data: Uint8Array | string | ArrayBuffer): Promise<void>;
    readFile(path: string, encoding?: string): Promise<Uint8Array>;
    exec(args: string[]): Promise<number>; // Returns exit code
    terminate?(): void;
    FS?(method: 'unlink' | 'readFile' | 'writeFile' | string, ...args: unknown[]): unknown;
    isLoaded?(): boolean;
  }
}

declare module '@ffmpeg/util' {
  export function fetchFile(data: string | File | Blob | Response): Promise<Uint8Array>;
}