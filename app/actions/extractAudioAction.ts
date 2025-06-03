/* app/actions/extractAudioAction.ts */
"use server";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface ExtractOk {
  success: true;
  /** plain text → serialisable */
  audioBase64: string;
  fileName: string;
  sizeBytes: number;
}
interface ExtractFail { success: false; error: string; }
export type ExtractAudioResponse = ExtractOk | ExtractFail;

export async function extractAudioAction(
  formData: FormData
): Promise<ExtractAudioResponse> {
  const file = formData.get("videoFile") as File | null;
  if (!file) return { success: false, error: "No video file received." };

  /* save upload */
  const tmpVid = path.join(os.tmpdir(), `ul_${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`);
  await fs.writeFile(tmpVid, new Uint8Array(await file.arrayBuffer()));

  /* ffmpeg → opus */
  const tmpOpus = tmpVid + ".opus";
  const cmd = `ffmpeg -i "${tmpVid}" -y -vn -acodec libopus -b:a 64k -ar 16000 -ac 1 "${tmpOpus}"`;
  try { await execAsync(cmd, { timeout: 5 * 60_000 }); }
  catch (e: unknown) {
    await fs.unlink(tmpVid).catch(()=>{});
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `FFmpeg failed: ${errorMsg}` };
  }

  const buf   = await fs.readFile(tmpOpus);      // Buffer
  const stats = await fs.stat(tmpOpus);

  await fs.unlink(tmpVid).catch(()=>{});
  await fs.unlink(tmpOpus).catch(()=>{});

  return {
    success: true,
    audioBase64: buf.toString("base64"),          // 👈  plain text
    fileName: "audio.opus",
    sizeBytes: stats.size,
  };
}
