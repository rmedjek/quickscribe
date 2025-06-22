// File: app/lib/hash-utils.ts

/**
 * Calculates the SHA-256 hash of a file in the browser.
 * @param file The file to hash.
 * @returns A promise that resolves to the hex-encoded hash string.
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}
