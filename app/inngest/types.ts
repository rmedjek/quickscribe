// app/inngest/types.ts

import {TranscriptionMode} from "@/components/ConfirmationView";

export type AppEvents = {
  "media.submitted": {
    data: {
      userId: string;
      transcriptionMode: TranscriptionMode;
      isLinkJob: boolean;
      // Use client-side temporary ID for tracking before a DB record exists
      tempJobId: string;
      // All other fields are optional and depend on the job type
      blobUrl?: string;
      linkUrl?: string;
      originalFileName?: string;
      fileHash?: string;
    };
  };

  "app/revalidate": {
    data: {
      path: string;
    };
  };
};
