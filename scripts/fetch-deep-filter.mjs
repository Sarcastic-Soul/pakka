// Puts the pinned DeepFilterNet CLI at bin/deep-filter (sha256 checked).
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const URL =
  "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl";
const SHA256 = "70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "bin", "deep-filter");
const local = path.join(root, "pipeline", ".tools", "deep-filter");

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function validAt(p) {
  try {
    return sha(await readFile(p)) === SHA256;
  } catch {
    return false;
  }
}

async function install(buf) {
  const tmp = `${dest}.tmp`;
  await writeFile(tmp, buf);
  await chmod(tmp, 0o755);
  await rename(tmp, dest);
}

await mkdir(path.dirname(dest), { recursive: true });

if (await validAt(dest)) {
  await chmod(dest, 0o755);
  console.log("deep-filter: already present");
} else if (await validAt(local)) {
  await copyFile(local, dest);
  await chmod(dest, 0o755);
  console.log("deep-filter: copied from pipeline/.tools");
} else {
  console.log("deep-filter: downloading v0.5.6");
  const res = await fetch(URL, { redirect: "follow" });
  if (!res.ok) {
    console.error(`deep-filter: download failed with status ${res.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha(buf) !== SHA256) {
    await rm(`${dest}.tmp`, { force: true });
    console.error("deep-filter: sha256 mismatch, refusing to install");
    process.exit(1);
  }
  await install(buf);
  console.log("deep-filter: installed");
}
