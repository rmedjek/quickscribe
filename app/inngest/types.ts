// File: app/inngest/types.ts

// This type map defines all the events that our application can send to Inngest.
// By defining it here, we get end-to-end type safety and autocompletion.
export type AppEvents = {
  "transcription.requested": {
    data: {
      jobId: string;
      isLinkJob: boolean;
    };
  };

  // We can add other events here in the future, for example:
  // 'user.signup': { data: { userId: string } };
  // 'summary.requested': { data: { jobId: string } };
};
