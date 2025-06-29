// app/actions/generateTitleAction.ts
"use server";

import Groq from "groq-sdk";

const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

export async function generateTitleAction(
  transcriptText: string
): Promise<string> {
  if (!transcriptText) {
    return "Untitled Transcription";
  }

  const systemPrompt =
    "You are an expert at summarizing long texts. Based on the following transcription, generate a concise, descriptive title of no more than 4-5 words. Do not use quotation marks in your response.";

  try {
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192", // Use a fast model for this task
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: transcriptText.substring(0, 4000)}, // Use a substring to keep it fast
      ],
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content || "Untitled Transcription";
  } catch (error) {
    console.error("Error generating title:", error);
    return "Untitled Transcription"; // Fallback on error
  }
}
