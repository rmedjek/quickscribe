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

  "audio.chunk.ready": {
    data: {
      parentJobId: string;
      chunkIndex: number;
      chunkUrl: string;
      transcriptionMode: TranscriptionMode;
    };
  };

  "job.assembly.ready": {
    data: {
      jobId: string;
    };
  };

  "audio.chunk.ready.v3": {
    data: {
      parentJobId: string;
      chunkIndex: number;
      chunkUrl: string;
      transcriptionMode: TranscriptionMode;
    };
  };

  "app/revalidate": {
    data: {
      path: string;
    };
  };
};
