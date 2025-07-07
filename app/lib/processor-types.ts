// app/lib/processor-types.ts

export type AudioPreparationResult =
  | {
      success: true;
      tempAudioPath: string;
      audioFileName: string;
      displayTitle?: string; // This property is optional
    }
  | {
      success: false;
      error: string;
    };
