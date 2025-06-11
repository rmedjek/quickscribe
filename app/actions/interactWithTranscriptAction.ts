/* eslint-disable @typescript-eslint/no-explicit-any */
// app/actions/interactWithTranscriptAction.ts
"use server";

import Groq from 'groq-sdk';
import { get_encoding, Tiktoken } from "tiktoken";
import { retryWithBackoff } from '@/lib/api-utils';

// Ensure GROQ_API_KEY is available
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is not set. This is a server configuration issue.");
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 0, // Let our custom retryWithBackoff handle retries
});

//const DEFAULT_LLM_MODEL = "llama3-8b-8192";
const DEFAULT_LLM_MODEL = "llama3-70b-8192";

export type AIInteractionTaskType = "summarize" | "extract_key_points" | "custom_question" | "extract_action_items" | "identify_topics";
export interface AIInteractionParams { transcriptText: string; taskType: AIInteractionTaskType; customPrompt?: string; llmModel?: string; }
type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
    "llama3-8b-8192": 7800,
    "llama3-70b-8192": 7800,
    "gemma-7b-it": 7800,
};
const DEFAULT_CONTEXT_WINDOW = 7800;

function truncateStringToTokenLimit(text: string, limit: number, encoding: Tiktoken): { truncatedText: string; tokenCount: number; wasTruncated: boolean } {
  let currentText = text; let tokens = encoding.encode(currentText); let wasTruncated = false;
  const charsPerTokenEstimate = 2;
  while (tokens.length > limit) {
    wasTruncated = true; const tokensOver = tokens.length - limit;
    const charsToRemove = Math.max(1, Math.floor(tokensOver * charsPerTokenEstimate * 0.5));
    if (currentText.length <= charsToRemove) { currentText = ""; break; }
    currentText = currentText.substring(0, currentText.length - charsToRemove);
    tokens = encoding.encode(currentText);
  }
  return { truncatedText: currentText, tokenCount: tokens.length, wasTruncated };
}

export async function interactWithTranscriptAction(
  params: AIInteractionParams
): Promise<Response> {
  const { transcriptText, taskType, customPrompt, llmModel } = params;
  const modelToUse = llmModel || DEFAULT_LLM_MODEL;
  console.log(`[AI Action] Called for task: "${taskType}". Model: "${modelToUse}". Custom Prompt: ${customPrompt ? `"${customPrompt.substring(0,50)}..."` : 'N/A'}`);

  if (!transcriptText || transcriptText.trim() === "") {
    console.error("[AI Action] Error: Transcript text is empty.");
    return Response.json({ success: false, error: "Transcript text cannot be empty." }, { status: 400 });
  }

  let systemPrompt = "";
  let finalUserMessageContentForLlm: string;
  let userPayloadWasActuallyTruncated = false;

  switch (taskType) {
    case "summarize":
      systemPrompt = "You are a helpful AI assistant. Your task is to provide a concise summary of the following transcript. Focus on the main points and key information. The summary should be a single paragraph or a few short paragraphs if necessary.";
      break;
    case "extract_key_points":
      systemPrompt = "You are a helpful AI assistant. Your task is to extract the key points or main takeaways from the following transcript. Present them clearly, ideally as a bulleted list (e.g., using '-' or '*' as bullet points). Each point should be concise.";
      break;
    case "custom_question":
      if (!customPrompt || customPrompt.trim() === "") {
        console.error("[AI Action] Error: Question is empty for 'custom_question' task.");
        return Response.json({ success: false, error: "Question cannot be empty for the Q&A task." }, { status: 400 });
      }
      systemPrompt =
        "You are an AI assistant. Your task is to answer the question based *solely* on the provided transcript. If the answer is not in the text, state that clearly. Do not make up information. Be concise.";
      break;
    case "extract_action_items":
      systemPrompt = "You are an AI assistant specializing in identifying action items. Analyze the transcript and extract all explicit/implied action items, tasks, or commitments. For each, identify: 1. The action. 2. Who is responsible (if mentioned). 3. Any deadline (if mentioned). Present as a clear, numbered or bulleted list. If none, state 'No specific action items were identified.'";
      break;
    case "identify_topics":
      systemPrompt =
        "You are a helpful AI assistant. Your task is to analyze the following transcript and identify the main topics or subjects discussed. " +
        "List up to 5-7 of the most significant topics. " +
        "Present the topics as a simple bulleted list, with each topic being a short, concise phrase (2-5 words). " +
        "If the transcript is too short or lacks clear topics, state 'No distinct topics could be identified.'";
      break;
    default:
      console.error(`[AI Action] Error: Unsupported AI task type: ${taskType}`);
      return Response.json({ success: false, error: `Unsupported AI task type: ${taskType}` }, { status: 400 });
  }

  let encoding: Tiktoken;
  try {
    encoding = get_encoding("cl100k_base");
  } catch (e) {
    console.error("[AI Action] Error: Failed to get tiktoken encoding:", e);
    return Response.json({ success: false, error: "Internal server error: Failed to initialize token counter." }, { status: 500 });
  }

  const systemPromptTokens = encoding.encode(systemPrompt).length;
  const modelContextLimit = MODEL_CONTEXT_WINDOWS[modelToUse] || DEFAULT_CONTEXT_WINDOW;
  const TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER = Math.max(1500, Math.floor(modelContextLimit * 0.40));
  const availableTokensForUserPayload = modelContextLimit - systemPromptTokens - TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER;

  if (availableTokensForUserPayload <= 100) {
    encoding.free();
    const errorMsg = `Not enough tokens for user content (Available: ${availableTokensForUserPayload}) after system prompt (${systemPromptTokens} tokens) and reserving ${TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER} for response/TPM within model context of ${modelContextLimit}.`;
    console.error(`[AI Action] Error: ${errorMsg}`);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (encoding.encode(transcriptText).length + systemPromptTokens > modelContextLimit - TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER) {
        headers.set('X-Content-Truncated', 'true');
    }
    return Response.json({ success: false, error: errorMsg }, { status: 413, headers });
  }

  let transcriptSegmentForLlm: string;

  if (taskType === "custom_question") {
    const qaPreamble = "Based on the following transcript:\n\n---\n";
    const qaPostamble = `\n---\n\nPlease answer this question: ${customPrompt}`;
    const qaPreambleTokens = encoding.encode(qaPreamble).length;
    const qaPostambleTokens = encoding.encode(qaPostamble).length;
    const targetTokenLimitForTranscriptItself = availableTokensForUserPayload - qaPreambleTokens - qaPostambleTokens;

    if (targetTokenLimitForTranscriptItself <= 50) { 
        encoding.free(); 
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (encoding.encode(transcriptText).length > targetTokenLimitForTranscriptItself) headers.set('X-Content-Truncated', 'true');
        return Response.json({ success: false, error: "Not enough tokens for Q&A transcript part." }, { status: 413, headers }); 
    }

    const truncationResult = truncateStringToTokenLimit(transcriptText, targetTokenLimitForTranscriptItself, encoding);
    transcriptSegmentForLlm = truncationResult.truncatedText;
    userPayloadWasActuallyTruncated = truncationResult.wasTruncated;
    if(userPayloadWasActuallyTruncated) transcriptSegmentForLlm += "\n...[TRANSCRIPT SEGMENT TRUNCATED]";
    
    console.log(`[AI Action] Q&A: Original transcript tokens: ${encoding.encode(transcriptText).length}. Target for segment: ${targetTokenLimitForTranscriptItself}. Actual segment tokens (before marker): ${truncationResult.tokenCount}.`);
    finalUserMessageContentForLlm = `${qaPreamble}${transcriptSegmentForLlm}${qaPostamble}`;
  } else {
    const truncationResult = truncateStringToTokenLimit(transcriptText, availableTokensForUserPayload, encoding);
    transcriptSegmentForLlm = truncationResult.truncatedText;
    userPayloadWasActuallyTruncated = truncationResult.wasTruncated;
    if(userPayloadWasActuallyTruncated) transcriptSegmentForLlm += "\n...[TRANSCRIPT TRUNCATED]";
    
    console.log(`[AI Action] Task "${taskType}": Original transcript tokens: ${encoding.encode(transcriptText).length}. Target for segment: ${availableTokensForUserPayload}. Actual segment tokens (before marker): ${truncationResult.tokenCount}.`);
    finalUserMessageContentForLlm = transcriptSegmentForLlm;
  }
  
  if (userPayloadWasActuallyTruncated) { console.warn(`[AI Action] Input transcript was definitively truncated for task "${taskType}".`); }

  const finalUserMessageActualTokens = encoding.encode(finalUserMessageContentForLlm).length;
  const totalCalculatedInputTokens = systemPromptTokens + finalUserMessageActualTokens;
  
  console.log(`[AI Action] FINAL TOKEN CHECK - Total Input: ${totalCalculatedInputTokens} (System: ${systemPromptTokens}, User: ${finalUserMessageActualTokens}). Model: "${modelToUse}", Context Limit: ${modelContextLimit}, Reserved for Output/TPM: ${TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER}`);
  
  const OPERATIONAL_BUFFER = 50;
  if (totalCalculatedInputTokens >= modelContextLimit - OPERATIONAL_BUFFER) {
    encoding.free();
    const errorMsg = `The final message (${totalCalculatedInputTokens} tokens) is too large for model's context (${modelContextLimit} tokens) with buffer ${OPERATIONAL_BUFFER}. Available for user payload was ${availableTokensForUserPayload}.`;
    console.error(`[AI Action] Error: ${errorMsg}`);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (userPayloadWasActuallyTruncated) headers.set('X-Content-Truncated', 'true');
    return Response.json({ success: false, error: errorMsg }, { status: 413, headers });
  }
  
  encoding.free();

  // MODIFIED PART: Wrap the Groq API call with retryWithBackoff
  try {
    const operation = async () => {
      console.log(`[AI Action] Attempting Groq chat completion stream. Model: "${modelToUse}", Task: "${taskType}". User message tokens: ${finalUserMessageActualTokens}.`);
      const messagesForGroq: GroqMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserMessageContentForLlm },
      ];
      // Note: The groq client already has a timeout from its instantiation.
      return await groq.chat.completions.create({
        messages: messagesForGroq,
        model: modelToUse,
        stream: true,
      });
    };

    // Use the imported retryWithBackoff helper
    const groqStream = await retryWithBackoff({
        operationName: `GroqChatCompletion-${taskType}`, // Dynamic name for logging
        operation,
        // Default retry parameters from api-utils.ts will be used unless overridden here:
        // maxRetries: 2, 
        // initialBackoffMs: 1500,
    });
    
    const responseHeaders = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
    if (userPayloadWasActuallyTruncated) {
      responseHeaders.set('X-Content-Truncated', 'true');
      console.log("[AI Action] Setting X-Content-Truncated header to true for successful stream.");
    }

    const readableWebStream = new ReadableStream({ 
        async start(controller) {
            try { for await (const chunk of groqStream) { const content = chunk.choices[0]?.delta?.content; if (content) { controller.enqueue(new TextEncoder().encode(content)); } } }
            catch (streamError) { console.error("Stream processing error in ReadableStream:", streamError); controller.error(streamError); }
            finally { console.log("Closing stream controller."); controller.close(); }
        }
    });
    return new Response(readableWebStream, { headers: responseHeaders });

  } catch (error: unknown) { // This catch block now primarily handles errors if retryWithBackoff itself gives up
    console.error(`[AI Action] Error after all retries for task "${taskType}" with Groq:`, error);
    
    let errorMessage = `An unexpected error occurred during AI interaction: ${ (error as Error).message || String(error) }`;
    let statusCode = 500;
    const errorCode = (error as any).code || ((error as any).cause as any)?.code;

    if (error instanceof Groq.APIConnectionTimeoutError) {
        errorMessage = `Groq API Error: Connection timed out. The request might be too complex or the service is currently busy. Please try again shortly.`;
    } else if (error instanceof Groq.APIError) {
      if (error.status === 400 && error.message.includes("model_decommissioned")) {
        errorMessage = `The selected AI model (${modelToUse}) is currently unavailable or decommissioned. Please try a different model or check service status.`;
        statusCode = 400;
      } else if (error.status === 413) {
        errorMessage = `The request to the AI service was too large (Status 413), even after attempting to shorten it. Original error: ${error.message}`;
        statusCode = 413;
      } else if (error.status === 429) {
        errorMessage = `The AI service is experiencing high demand (Status 429). Please try again in a few moments.`;
        statusCode = 429;
      } else if (error.status && error.status >= 500) {
        errorMessage = `The AI service encountered a server error (Status ${error.status}). Please try again later. Original error: ${error.message}`;
        statusCode = error.status;
      } else if (errorCode === 'ECONNRESET') {
         errorMessage = `A connection error (ECONNRESET) occurred with the AI service. This can happen with large requests or network interruptions.`;
      } else {
        errorMessage = `Groq API Error (Status: ${error.status || 'N/A'}): ${error.message}`;
      }
      console.error("[AI Action] Full Groq.APIError object details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else if (errorCode === 'ECONNRESET') {
        errorMessage = `A direct connection error (ECONNRESET) occurred with the AI service. This often happens with large requests or network issues.`;
    }
    
    const errorResponseHeaders = new Headers({ 'Content-Type': 'application/json' });
    if (userPayloadWasActuallyTruncated) {
        errorResponseHeaders.set('X-Content-Truncated', 'true');
    }
    return Response.json({ success: false, error: errorMessage }, { status: statusCode, headers: errorResponseHeaders });
  }
}