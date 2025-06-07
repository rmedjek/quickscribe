// app/actions/interactWithTranscriptAction.ts
"use server";

import Groq from 'groq-sdk';
import { get_encoding, Tiktoken } from "tiktoken";

if (!process.env.GROQ_API_KEY) { throw new Error("GROQ_API_KEY environment variable is not set. This is a server configuration issue."); }
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//const DEFAULT_LLM_MODEL = "llama3-8b-8192";
const DEFAULT_LLM_MODEL = "llama3-70b-8192";

export type AIInteractionTaskType = "summarize" | "extract_key_points" | "custom_question" | "extract_action_items";
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
  const charsPerTokenEstimate = 2; // Average chars per token can vary; this is a heuristic
  while (tokens.length > limit) {
    wasTruncated = true; const tokensOver = tokens.length - limit;
    // Estimate characters to remove; ensure at least 1 char is removed to make progress
    const charsToRemove = Math.max(1, Math.floor(tokensOver * charsPerTokenEstimate * 0.5));
    if (currentText.length <= charsToRemove) { currentText = ""; break; } // Avoid infinite loop if charsToRemove is 0 or too large
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
  let userPayloadWasActuallyTruncated = false; // Initialize here

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
    // For errors before API call, set header if we know original was too long conceptually
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (encoding.encode(transcriptText).length + systemPromptTokens > modelContextLimit - TOKENS_RESERVED_FOR_OUTPUT_AND_TPM_BUFFER) { // Simple check if original would have been too long
        headers.set('X-Content-Truncated', 'true'); // Indicate original content was too large
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
    userPayloadWasActuallyTruncated = truncationResult.wasTruncated; // Capture if truncation happened
    if(userPayloadWasActuallyTruncated) transcriptSegmentForLlm += "\n...[TRANSCRIPT SEGMENT TRUNCATED]";
    
    console.log(`[AI Action] Q&A: Original transcript tokens: ${encoding.encode(transcriptText).length}. Target for segment: ${targetTokenLimitForTranscriptItself}. Actual segment tokens (before marker): ${truncationResult.tokenCount}.`);
    finalUserMessageContentForLlm = `${qaPreamble}${transcriptSegmentForLlm}${qaPostamble}`;
  } else {
    const truncationResult = truncateStringToTokenLimit(transcriptText, availableTokensForUserPayload, encoding);
    transcriptSegmentForLlm = truncationResult.truncatedText;
    userPayloadWasActuallyTruncated = truncationResult.wasTruncated; // Capture if truncation happened
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

  try {
    console.log(`[AI Action] Creating stream to Groq. User message tokens: ${finalUserMessageActualTokens}.`);
    const messagesForGroq: GroqMessage[] = [ { role: "system", content: systemPrompt }, { role: "user", content: finalUserMessageContentForLlm }];
    const groqStream = await groq.chat.completions.create({ messages: messagesForGroq, model: modelToUse, stream: true });
    
    const responseHeaders = new Headers({ 'Content-Type': 'text/plain; charset=utf-8' });
    if (userPayloadWasActuallyTruncated) {
      responseHeaders.set('X-Content-Truncated', 'true');
      console.log("[AI Action] Setting X-Content-Truncated header to true for successful stream.");
    }

    const readableWebStream = new ReadableStream({ 
        async start(controller) {
            try { for await (const chunk of groqStream) { const content = chunk.choices[0]?.delta?.content; if (content) { controller.enqueue(new TextEncoder().encode(content)); } } }
            catch (streamError) { console.error("Stream processing error:", streamError); controller.error(streamError); }
            finally { console.log("Closing stream controller."); controller.close(); }
        }
    });
    return new Response(readableWebStream, { headers: responseHeaders });

  } catch (error: unknown) { 
    let errorMessage = "Groq API Error"; let statusCode = 500;
    if (error instanceof Groq.APIError) { errorMessage = `Groq API Error (${error.status || 'N/A'}): ${error.message}`; if (error.status) statusCode = error.status;}
    else if (error instanceof Error) { errorMessage = error.message;}
    console.error(`[AI Action] Groq API call failed for task "${taskType}": ${errorMessage}`);
    
    const errorResponseHeaders = new Headers({ 'Content-Type': 'application/json' });
    if (userPayloadWasActuallyTruncated) { // Indicate truncation even if API call itself failed later
        errorResponseHeaders.set('X-Content-Truncated', 'true');
    }
    return Response.json({ success: false, error: errorMessage }, { status: statusCode, headers: errorResponseHeaders });
  }
}