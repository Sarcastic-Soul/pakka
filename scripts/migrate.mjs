// Applies db/schema.sql to DATABASE_URL. Run: node --env-file=.env scripts/migrate.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { neon } from "@neondatabase/serverless";

// The 250 ms per-address default is too short when IPv6 is unreachable.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = await readFile(path.join(here, "..", "db", "schema.sql"), "utf8");

// The schema has no functions or quoted semicolons, so splitting on ";" is safe.
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = neon(url);
for (const stmt of statements) {
  await sql.query(stmt);
}
console.log(`migrate: applied ${statements.length} statements`);
