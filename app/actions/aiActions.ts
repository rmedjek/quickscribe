// app/actions/aiActions.ts
"use server";

import {assemblyai} from "@/lib/assemblyai";

export async function askQuestionAboutTranscript(
  transcriptId: string,
  question: string
): Promise<{success: boolean; answer?: string; error?: string}> {
  if (!transcriptId || !question) {
    return {
      success: false,
      error: "Transcript ID and question cannot be empty.",
    };
  }

  console.log(
    `[LeMUR Action] Asking question about transcript ID: ${transcriptId}`
  );

  try {
    // --- THIS IS THE CORRECT, FINAL SDK USAGE ---
    // We call the `questionAnswer` method directly. It is a single,
    // synchronous-style promise that resolves with the final answer.
    // There is no polling or task ID involved for this specific feature.
    const response = await assemblyai.lemur.questionAnswer({
      transcript_ids: [transcriptId],
      questions: [
        {
          question: question,
          context:
            "You are a helpful assistant answering questions about a meeting transcript. Be concise and base the answer only on the provided text. If the answer is not in the transcript, say so clearly.",
        },
      ],
      temperature: 0.1,
    });
    // --- END FIX ---

    // The response object contains an array of answers.
    const answer =
      response.response[0]?.answer ||
      "Sorry, I couldn't find an answer in the transcript.";

    return {success: true, answer};
  } catch (error: any) {
    console.error("Error asking LeMUR question:", error);
    const errorMessage =
      error.message || "An unexpected error occurred while asking the AI.";
    return {success: false, error: errorMessage};
  }
}
