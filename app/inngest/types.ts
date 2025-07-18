// app/inngest/types.ts

// We no longer need TranscriptionMode here for the submission event
// import {TranscriptionMode} from "@/components/ConfirmationView";
export type AppEvents = {
  "media.submitted": {
    data: {
      jobId: string;
      fileUrl: string;
      isLinkJob: boolean;
      originalFileName?: string;
    };
  };

  // This event will be used by our AssemblyAI webhook handler later.
  "assemblyai.transcript.ready": {
    data: {
      jobId: string;
      transcript: any; // The full payload from AssemblyAI
    };
  };

  "app/revalidate": {
    data: {
      path: string;
    };
  };
};
