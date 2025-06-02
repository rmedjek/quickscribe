/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { TranscriptionMode } from "@/components/ConfirmationView";

const execAsync = promisify(exec);

interface ExtractOk {
  success: true;
  audioBuffer: ArrayBuffer;   // 👈  sent back to browser
  fileName: string;
  durationSec?: number;
  sizeBytes: number;
}
interface ExtractFail {
  success: false;
  error: string;
}
export type ExtractAudioResponse = ExtractOk | ExtractFail;

/** 1️⃣  receives FormData("videoFile") —> returns Opus in ArrayBuffer  */
export async function extractAudioAction(
  formData: FormData,
  mode?: TranscriptionMode      // mode not used here but you may log it
): Promise<ExtractAudioResponse> {
  const videoFile = formData.get("videoFile") as File | null;
  if (!videoFile) {
    return { success: false, error: "No video file received." };
  }

  /* ── 1. save upload to /tmp ─────────────────────────────────────── */
  const tmpVideo = path.join(
    os.tmpdir(),
    `ul_${Date.now()}_${videoFile.name.replace(/[^\w.-]/g, "_")}`
  );
  await fs.writeFile(tmpVideo, Buffer.from(await videoFile.arrayBuffer()));

  /* ── 2. run FFmpeg → mono Opus @16 kHz ──────────────────────────── */
  const tmpOpus = tmpVideo + ".opus";
  const cmd = `ffmpeg -i "${tmpVideo}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tmpOpus}"`;
  try {
    await execAsync(cmd, { timeout: 5 * 60_000 }); // 5 min guard
  } catch (e: any) {
    await fs.unlink(tmpVideo).catch(() => {});
    return {
      success: false,
      error: `FFmpeg failed: ${e?.message ?? e}`,
    };
  }
  const buf = await fs.readFile(tmpOpus);
  const stats = await fs.stat(tmpOpus);

  /* optional: probe duration (ffprobe) – skipped for brevity */

  /* ── 3. cleanup temp files ──────────────────────────────────────── */
  await fs.unlink(tmpVideo).catch(() => {});
  await fs.unlink(tmpOpus).catch(() => {});

  return {
    success: true,
    audioBuffer: buf.buffer,             // ArrayBuffer serialises fine
    fileName: "audio.opus",
    sizeBytes: stats.size,
  };
}
