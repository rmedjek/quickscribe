// app/inngest/types.ts

export type AppEvents = {
  "transcription.requested": {
    data: {
      jobId: string;
      isLinkJob: boolean;
    };
  };

  "app/revalidate": {
    data: {
      path: string;
    };
  };
};
