import Groq from 'groq-sdk';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 30000;   // 30 seconds

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RetryConfig<T> {
  operationName: string;
  operation: () => Promise<T>; // The actual API call
  isRetryableError?: (error: unknown) => boolean; // Optional custom check
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export async function retryWithBackoff<T>({
  operationName,
  operation,
  isRetryableError,
  maxRetries = MAX_RETRIES,
  initialBackoffMs = INITIAL_BACKOFF_MS,
  maxBackoffMs = MAX_BACKOFF_MS,
}: RetryConfig<T>): Promise<T> {
  let attempts = 0;
  let currentBackoffMs = initialBackoffMs;

  while (true) {
    attempts++;
    try {
      console.log(`[RetryUtil] Attempt ${attempts}/${maxRetries + 1} for operation: "${operationName}"`);
      return await operation();
    } catch (error: unknown) {
      // TypeScript: error is unknown, so we need to safely access error.message
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[RetryUtil] Operation "${operationName}" attempt ${attempts} failed. Error:`, errorMessage);

      const defaultIsRetryable = (e: unknown): boolean => {
        if (e instanceof Groq.APIConnectionError) { // Covers network issues like ECONNRESET if SDK throws this
            console.log(`[RetryUtil] Retryable Groq.APIConnectionError for "${operationName}".`);
            return true;
        }
        if (e instanceof Groq.APIError) {
          if (e.status && (e.status === 429 || e.status === 408 || (e.status >= 500 && e.status < 600))) {
            console.log(`[RetryUtil] Retryable Groq.APIError status ${e.status} for "${operationName}".`);
            return true;
          }
        }
        // Add more generic network error checks if needed, e.g., by looking at error.code
        if (
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          typeof (e as { code?: unknown }).code === 'string' &&
          (
            (e as { code: string }).code === 'ECONNRESET' ||
            (e as { code: string }).code === 'ETIMEDOUT' ||
            (e as { code: string }).code === 'ENOTFOUND' ||
            (e as { code: string }).code === 'ECONNREFUSED'
          )
        ) {
            console.log(`[RetryUtil] Retryable generic network error code ${(e as { code: string }).code} for "${operationName}".`);
            return true;
        }
        return false;
      };

      const shouldRetry = isRetryableError ? isRetryableError(error) : defaultIsRetryable(error);

      if (attempts > maxRetries || !shouldRetry) {
        console.error(`[RetryUtil] Max retries reached or error not retryable for "${operationName}". Giving up.`);
        throw error; // Re-throw the last error
      }

      const jitter = Math.random() * (currentBackoffMs * 0.2); // Add up to 20% jitter
      const waitTime = Math.min(currentBackoffMs + jitter, maxBackoffMs);
      
      console.log(`[RetryUtil] Retrying operation "${operationName}" in ${waitTime.toFixed(0)}ms...`);
      await delay(waitTime);

      currentBackoffMs = Math.min(currentBackoffMs * 2, maxBackoffMs); // Exponential backoff
    }
  }
}