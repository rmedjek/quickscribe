declare module '@ffmpeg/ffmpeg' {
  // Define the FFmpeg class constructor and its instance methods
  export class FFmpeg {
    constructor(options?: unknown); // Keep options flexible or define them if known

    load(options?: {
      coreURL?: string;
      wasmURL?: string;
     // workerURL?: string;
      // Add other specific load options if documented for this version
    }): Promise<void>;

    on(event: 'log' | 'progress', callback: (data: { type: string; message: string } | { progress: number; time?: number }) => void): void;
    writeFile(path: string, data: Uint8Array | string | ArrayBuffer): Promise<void>;
    readFile(path: string, encoding?: string): Promise<Uint8Array>;
    exec(args: string[]): Promise<number>; // Returns exit code
    terminate?(): void; // Optional, might not always be present or needed
    // For file system operations like unlinking files
    // The exact structure of FS can vary; this is a general representation
    FS?(method: 'unlink' | 'readFile' | 'writeFile' | string, ...args: unknown[]): unknown; 
    isLoaded?(): boolean; // Optional, some versions provide this
  }

  // You can also export FFFSType if you plan to use it,
  // but it's not critical for the core ffmpeg functionality.
  // export enum FFFSType { /* ... values if known ... */ }
  // For now, focusing on FFmpeg class.
}

declare module '@ffmpeg/util' {
  export function fetchFile(data: string | File | Blob | Response): Promise<Uint8Array>;
}