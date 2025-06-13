/* eslint-disable @typescript-eslint/no-explicit-any */
// app/lib/api-utils.ts
import Groq from 'groq-sdk';

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_BACKOFF_MS = 5000; // Increased slightly to give servers more breathing room
const DEFAULT_MAX_BACKOFF_MS = 60000;   // 45 seconds

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RetryConfig<T> {
  operationName: string;
  operation: () => Promise<T>;
  isRetryableError?: (error: any) => boolean;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

// --- Helper functions for error classification ---

function isRetryableNetworkError(error: any): boolean {
  const errorCode = error?.code || (error?.cause as any)?.code;
  const retryableErrorCodes = [
    'ECONNRESET',    // Connection forcibly closed
    'ETIMEDOUT',     // Connection timed out
    'ENOTFOUND',     // DNS lookup failed
    'ECONNREFUSED',  // Connection refused
    'EAI_AGAIN',     // DNS lookup timed out
  ];
  if (retryableErrorCodes.includes(errorCode)) {
    console.log(`[RetryUtil] Detected retryable network error code: ${errorCode}`);
    return true;
  }
  return false;
}

function isRetryableGroqError(error: any): boolean {
  if (error instanceof Groq.APIConnectionError) {
      console.log(`[RetryUtil] Detected retryable Groq.APIConnectionError.`);
      return true;
  }
  if (error instanceof Groq.APIError) {
    // Retry on 429 (Too Many Requests), 408 (Request Timeout), and all 5xx server errors
    const retryableStatusCodes = [408, 429];
    if (error.status && (retryableStatusCodes.includes(error.status) || error.status >= 500)) {
      console.log(`[RetryUtil] Detected retryable Groq.APIError status code: ${error.status}`);
      return true;
    }
  }
  return false;
}
// --- End Helper functions ---

export async function retryWithBackoff<T>({
  operationName,
  operation,
  isRetryableError,
  maxRetries = DEFAULT_MAX_RETRIES,
  initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
}: RetryConfig<T>): Promise<T> {
  let attempts = 0;
  let currentBackoffMs = initialBackoffMs;
  let lastError: any;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      console.log(`[RetryUtil] Attempt ${attempts}/${maxRetries + 1} for operation: "${operationName}"`);
      return await operation();
    } catch (error: any) {
      lastError = error; // Store the last error
      console.warn(`[RetryUtil] Operation "${operationName}" attempt ${attempts} failed. Error: ${error.message || String(error)}`);

      const shouldRetry = isRetryableError 
        ? isRetryableError(error) 
        : (isRetryableGroqError(error) || isRetryableNetworkError(error));

      if (attempts > maxRetries || !shouldRetry) {
        console.error(`[RetryUtil] Max retries (${maxRetries}) reached or error is not retryable for "${operationName}". Giving up.`);
        throw lastError; // Re-throw the last encountered error
      }

      // Calculate wait time with jitter (randomness to prevent thundering herd)
      const jitter = Math.random() * currentBackoffMs * 0.5; // Jitter of up to 50% of the backoff
      const waitTime = Math.min(Math.round(currentBackoffMs + jitter), maxBackoffMs);
      
      console.log(`[RetryUtil] Retrying operation "${operationName}" in ${waitTime}ms... (Backoff: ${Math.round(currentBackoffMs)}ms, Jitter: ${Math.round(jitter)}ms)`);
      await delay(waitTime);

      // Increase backoff for next potential retry (exponential)
      currentBackoffMs *= 2;
    }
  }

  // This should not be reached due to the throw in the loop, but as a fallback:
  console.error(`[RetryUtil] Exited retry loop unexpectedly for "${operationName}".`);
  throw lastError;
}