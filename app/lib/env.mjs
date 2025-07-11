// env.mjs
import {createEnv} from "@t3-oss/env-nextjs";
import {z} from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    VERCEL_URL: z.string().optional(),
    AUTH_SECRET: z.string().min(1),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    AUTH_GITHUB_ID: z.string().min(1),
    AUTH_GITHUB_SECRET: z.string().min(1),
    POSTGRES_PRISMA_URL: z.string().url(),
    GROQ_API_KEY: z.string().min(1),
    GROQ_TRANSCRIPTION_MODEL_CORE: z.string().default("whisper-large-v3"),
    GROQ_TRANSCRIPTION_MODEL_TURBO: z.string().default("whisper-large-v3-turbo"),
    GROQ_DEFAULT_LLM_MODEL: z.string().default("llama3-8b-8192"),
    AI_RESPONSE_TOKEN_RESERVATION_PERCENT: z
      .string()
      .transform(Number)
      .pipe(z.number().min(0.1).max(0.8))
      .default("0.4"),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // No public env vars needed for QuickScribe at the moment.
    // Example: NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().min(1),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_TRANSCRIPTION_MODEL_CORE: process.env.GROQ_TRANSCRIPTION_MODEL_CORE,
    GROQ_TRANSCRIPTION_MODEL_TURBO: process.env.GROQ_TRANSCRIPTION_MODEL_TURBO,
    GROQ_DEFAULT_LLM_MODEL: process.env.GROQ_DEFAULT_LLM_MODEL,
    AI_RESPONSE_TOKEN_RESERVATION_PERCENT: process.env.AI_RESPONSE_TOKEN_RESERVATION_PERCENT,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});