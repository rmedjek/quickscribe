// app/actions/interactWithTranscriptAction.ts
"use server";

import Groq from 'groq-sdk';
import { get_encoding, Tiktoken } from "tiktoken"; // Changed TiktokenEncoding to Tiktoken

// Ensure GROQ_API_KEY is available
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is not set. This is a server configuration issue.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_LLM_MODEL = "llama3-70b-8192";

export type AIInteractionTaskType = "summarize" | "extract_key_points" | "custom_question";

export interface AIInteractionParams {
  transcriptText: string;
  taskType: AIInteractionTaskType;
  customPrompt?: string;
  llmModel?: string;
}

type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

// Model context limits (adjust as needed, leave buffer)
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
    "llama3-8b-8192": 8000,
    "llama3-70b-8192": 8000,
    "gemma-7b-it": 8000,
};
const DEFAULT_CONTEXT_WINDOW = 8000;

export async function interactWithTranscriptAction(
  params: AIInteractionParams
): Promise<Response> {
  console.log("[AI Action] interactWithTranscriptAction called with params:", params.taskType, "Custom Prompt:", params.customPrompt);

  const { transcriptText, taskType, customPrompt, llmModel } = params;
  const modelToUse = llmModel || DEFAULT_LLM_MODEL;

  if (!transcriptText || transcriptText.trim() === "") {
    return Response.json({ success: false, error: "Transcript text cannot be empty." }, { status: 400 });
  }

  let systemPrompt = "";
  let userMessageForLlm = "";
  let processedTranscriptForUserMessage = transcriptText;

  switch (taskType) {
    case "summarize":
      systemPrompt = "You are a helpful AI assistant. Your task is to provide a concise summary of the following transcript. Focus on the main points and key information.";
      // userMessageForLlm will be set after token check
      break;
    case "extract_key_points":
      systemPrompt = "You are a helpful AI assistant. Your task is to extract the key points or main takeaways from the following transcript. Present them clearly, ideally as a bulleted list.";
      // userMessageForLlm will be set after token check
      break;
    case "custom_question":
      if (!customPrompt || customPrompt.trim() === "") {
        return Response.json({ success: false, error: "Question cannot be empty for the Q&A task." }, { status: 400 });
      }
      systemPrompt = "You are an AI assistant. Your task is to answer the following question based *solely* on the provided transcript text. If the information is not in the text, state that clearly. Do not make up information.";
      // userMessageForLlm will be constructed after token check for the transcript part
      break;
    default:
      return Response.json({ success: false, error: `Unsupported AI task type: ${taskType}` }, { status: 400 });
  }

  let encoding: Tiktoken; // Correct type for the encoder instance
  try {
    encoding = get_encoding("cl100k_base");
  } catch (e) {
    console.error("Failed to get tiktoken encoding:", e);
    return Response.json({ success: false, error: "Failed to initialize token counter." }, { status: 500 });
  }

  const systemPromptTokens = encoding.encode(systemPrompt).length;
  const maxTokensForModel = MODEL_CONTEXT_WINDOWS[modelToUse] || DEFAULT_CONTEXT_WINDOW; // Changed to const
  const TOKENS_FOR_RESPONSE_AND_OVERHEAD = 500;

  const availableTokensForUserContent = maxTokensForModel - systemPromptTokens - TOKENS_FOR_RESPONSE_AND_OVERHEAD;

  if (availableTokensForUserContent <= 0) {
      encoding.free();
      return Response.json({ success: false, error: "Not enough tokens for user content after accounting for system prompt and desired response length." }, { status: 413 });
  }

  if (taskType === "custom_question") {
    const qaPreamble = "Based on the following transcript:\n\n---\n";
    const qaPostamble = `\n---\n\nPlease answer this question: ${customPrompt}`; // Ensure customPrompt is defined here
    const qaPreambleTokens = encoding.encode(qaPreamble).length;
    const qaPostambleTokens = encoding.encode(qaPostamble || "").length; // Handle if customPrompt somehow undefined
    const availableTokensForTranscriptInQa = availableTokensForUserContent - qaPreambleTokens - qaPostambleTokens;

    if (availableTokensForTranscriptInQa <= 0) {
        encoding.free();
        return Response.json({ success: false, error: "Not enough tokens for the transcript within the Q&A prompt structure." }, { status: 413 });
    }
    
    const transcriptTokens = encoding.encode(transcriptText);
    if (transcriptTokens.length > availableTokensForTranscriptInQa) {
        console.warn(`[AI Action] Transcript too long for Q&A (${transcriptTokens.length} tokens), truncating to ${availableTokensForTranscriptInQa} tokens for model ${modelToUse}.`);
        const truncatedTranscriptTokens = transcriptTokens.slice(0, availableTokensForTranscriptInQa);
        processedTranscriptForUserMessage = encoding.decode(truncatedTranscriptTokens) + "\n... [TRUNCATED BY TOKEN LIMIT]";
    } else {
        processedTranscriptForUserMessage = transcriptText;
    }
    userMessageForLlm = `${qaPreamble}${processedTranscriptForUserMessage}${qaPostamble}`;

  } else { 
    const transcriptTokens = encoding.encode(transcriptText);
    if (transcriptTokens.length > availableTokensForUserContent) {
        console.warn(`[AI Action] Transcript too long for ${taskType} (${transcriptTokens.length} tokens), truncating to ${availableTokensForUserContent} tokens for model ${modelToUse}.`);
        const truncatedTranscriptTokens = transcriptTokens.slice(0, availableTokensForUserContent);
        processedTranscriptForUserMessage = encoding.decode(truncatedTranscriptTokens) + "\n... [TRUNCATED BY TOKEN LIMIT]";
    } else {
        processedTranscriptForUserMessage = transcriptText;
    }
    userMessageForLlm = processedTranscriptForUserMessage;
  }
  
  const finalUserMessageTokens = encoding.encode(userMessageForLlm).length;
  const totalInputTokens = systemPromptTokens + finalUserMessageTokens;
  console.log(`[AI Action] Total estimated input tokens: ${totalInputTokens} (System: ${systemPromptTokens}, User: ${finalUserMessageTokens}) for model ${modelToUse} (Context: ${maxTokensForModel})`);

  // A slightly more generous check for the final message to allow some response tokens.
  // The key is that `availableTokensForUserContent` already reserved `TOKENS_FOR_RESPONSE_AND_OVERHEAD`.
  // This check ensures the *constructed* user message doesn't accidentally push it over due to added pre/postambles.
  if (totalInputTokens >= maxTokensForModel - (TOKENS_FOR_RESPONSE_AND_OVERHEAD / 5)) { // Reduced the divisor for a stricter check on input
      encoding.free();
      const errorMsg = `The final constructed message (${totalInputTokens} tokens) is too large for the model's context window (${maxTokensForModel} tokens), even after attempting truncation. Please shorten the transcript or question further.`;
      console.error(errorMsg);
      return Response.json({ success: false, error: errorMsg }, { status: 413 });
  }
  
  encoding.free();

  try {
    console.log(`[AI Action] Creating stream with Groq model ${modelToUse} for task ${taskType}.`);
    const messagesForGroq: GroqMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessageForLlm },
    ];

    const groqStream = await groq.chat.completions.create({
      messages: messagesForGroq,
      model: modelToUse,
      stream: true,
      // max_tokens: TOKENS_FOR_RESPONSE_AND_OVERHEAD - 50, // Example: ensure output fits reserved space
    });

    const readableWebStream = new ReadableStream({
        async start(controller) {
            try {
              for await (const chunk of groqStream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }
            } catch (error) {
              console.error("Error in stream processing:", error);
              controller.error(error);
            } finally {
              controller.close();
            }
          },
    });
    return new Response(readableWebStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error("[AI Action] Error during Groq API stream call:", error);
    let errorMessage = "An unexpected error occurred during AI interaction.";
    let statusCode = 500;
    if (error instanceof Groq.APIError) {
      errorMessage = `Groq API Error (${error.status || 'unknown status'}): ${error.message}`;
      if (error.status) statusCode = error.status;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return Response.json({ success: false, error: errorMessage }, { status: statusCode });
  }
}