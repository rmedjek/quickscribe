// app/inngest/types.ts
import type {TranscriptionMode} from "@/components/ConfirmationView";

export type AppEvents = {
  "media.submitted": {
    data: {
      jobId: string;
      userId: string;
      transcriptionMode: TranscriptionMode;
      isLinkJob: boolean;
      processingStrategy: "SINGLE" | "CHUNKED";
      blobUrl?: string;
      linkUrl?: string;
      originalFileName?: string;
      fileHash?: string;
    };
  };

  // --- NEW EVENTS FOR CHUNKING WORKFLOW ---
  "audio.chunk.ready": {
    data: {
      parentJobId: string;
      chunkIndex: number;
      chunkUrl: string;
      // We also need to pass the transcription mode to the chunk worker
      transcriptionMode: TranscriptionMode;
    };
  };

  "job.assembly.ready": {
    data: {
      jobId: string;
    };
  };
  // --- END NEW EVENTS ---

  "app/revalidate": {
    data: {
      path: string;
    };
  };
};
