import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const TIMEOUT_MS = 15_000;

let binary: Promise<string> | null = null;

// The bundled file may sit on a read-only or noexec mount, so run a copy from tmp.
async function prepareBinary(): Promise<string> {
  const src = path.join(process.cwd(), "bin", "deep-filter");
  const dst = path.join(os.tmpdir(), "pakka-deep-filter");
  const [a, b] = await Promise.all([stat(src), stat(dst).catch(() => null)]);
  if (!b || b.size !== a.size) {
    const tmp = `${dst}.${randomUUID()}`;
    await copyFile(src, tmp);
    await chmod(tmp, 0o755);
    await rename(tmp, dst);
  }
  return dst;
}

/** Runs DeepFilterNet on a 16-bit WAV. Returns the cleaned WAV or null if anything fails. */
export async function denoise(wav: Uint8Array): Promise<Uint8Array | null> {
  const dir = path.join(os.tmpdir(), `pakka-dn-${randomUUID()}`);
  const t0 = Date.now();
  try {
    binary ??= prepareBinary();
    let bin: string;
    try {
      bin = await binary;
    } catch (err) {
      binary = null;
      throw err;
    }
    const outDir = path.join(dir, "out");
    await mkdir(outDir, { recursive: true });
    const input = path.join(dir, "clip.wav");
    await writeFile(input, wav);
    await run(bin, ["-D", "-o", outDir, input], { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 });
    const out = new Uint8Array(await readFile(path.join(outDir, "clip.wav")));
    console.log(`pakka denoise: ok in ${Date.now() - t0} ms`);
    return out;
  } catch {
    console.error(`pakka denoise: failed after ${Date.now() - t0} ms`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
