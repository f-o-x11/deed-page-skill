#!/usr/bin/env node
/**
 * Publish a file or directory as one deed.page version.
 *
 * Hashes every file, POSTs the manifest to /v1/uploads, PUTs only the missing
 * blobs, then finalizes. Always PUT the raw bytes to upload.url with
 * upload.headers. Production returns a direct storage URL; the scoped client
 * token is already in those headers, so the bytes never pass through the
 * function. Do not import a Blob client SDK: people download this file on its
 * own (https://deed.page/cli/publish-large.mjs) and do not have one installed.
 * A single file over 100 MB is refused here instead of attempting multipart.
 *
 *   node publish-large.mjs ./site --slug my-page-7k --base-url https://deed.page
 *
 * Auth: $DEEDPAGE_TOKEN, else $DEEDPAGE_TOKEN_FILE, else ~/.config/deed-page/token.
 * A newly minted token is saved there (mode 600, directory 700) and never printed.
 * The live URL is the last line of stdout.
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;

const args = process.argv.slice(2);
const { flags, input } = readFlags(args);

if (!input || flags.help) {
  console.error(
    "usage: node publish-large.mjs <file-or-directory> [--slug name] [--base-url URL] [--origin URL] [--client NAME] [--ref REF] [--ttl SECONDS] [--spa] [--merge] [--token TOKEN]",
  );
  process.exit(flags.help ? 0 : 1);
}

const origin = (flags.origin || process.env.DEEDPAGE_URL || "https://deed.page").replace(/\/$/, "");
const client = flags.client ?? process.env.DEEDPAGE_CLIENT ?? "deed-page-skill";
const ref = flags.ref ?? "skill-script";
const tokenFile = process.env.DEEDPAGE_TOKEN_FILE || path.join(process.env.HOME || homedir(), ".config", "deed-page", "token");
const token = flags.token || process.env.DEEDPAGE_TOKEN || readSaved(tokenFile);

try {
  const root = path.resolve(input);
  const files = await collectInput(root);
  if (!files.length) {
    console.error(`no files under ${root}`);
    process.exit(1);
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      console.error(`${file.rel} is ${file.size} bytes; this script does not upload a single file over 100 MB.`);
      process.exit(1);
    }
  }

  const manifest = {
    files: files.map((file) => ({
      path: file.rel,
      sha256: file.sha256,
      size: file.size,
      content_type: file.type,
    })),
  };
  if (flags.slug) manifest.slug = flags.slug;
  if (flags.merge) manifest.merge = true;
  if (flags.spa) manifest.spa = true;
  if (flags.ttl) manifest.ttl_seconds = Number(flags.ttl);

  const query = new URLSearchParams();
  if (ref) query.set("ref", ref);
  const planUrl = `${origin}/v1/uploads${query.toString() ? `?${query}` : ""}`;
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (client) headers["x-client"] = client;

  const planRes = await fetch(planUrl, { method: "POST", headers, body: JSON.stringify(manifest) });
  const planText = await planRes.text();
  const plan = parseJson(planText);
  if (!planRes.ok) failResponse(planRes.status, planText, plan);

  const byPath = new Map(files.map((file) => [file.rel, file]));
  const pending = (plan.missing || []).filter((missing) => !missing.stored);
  await mapPool(pending, UPLOAD_CONCURRENCY, async (missing) => {
    const sample = byPath.get(missing.paths && missing.paths[0]);
    if (!sample) {
      console.error(`plan asked for ${missing.sha256} but that path is not local`);
      process.exit(1);
    }
    const body = sample.data ?? (await readFile(sample.abs));
    await uploadOne(missing, body);
  });

  const finHeaders = {};
  if (token) finHeaders.authorization = `Bearer ${token}`;
  const fin = await fetch(plan.finalize_url, { method: "POST", headers: finHeaders });
  const finText = await fin.text();
  const result = parseJson(finText);
  if (!fin.ok) failResponse(fin.status, finText, result);

  const minted = result && typeof result.token === "string" ? result.token : "";
  if (minted) saveMinted(tokenFile, minted);
  console.error(maskToken(JSON.stringify(result, null, 2)));
  const live = result && typeof result.url === "string" ? result.url : "";
  if (!live) {
    printUserMessage(result);
    console.error("publish failed");
    process.exit(1);
  }
  console.log(live);
} catch (err) {
  if (err && err.exitCode) process.exit(err.exitCode);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

function readFlags(list) {
  const out = {};
  let input = "";
  for (let i = 0; i < list.length; i++) {
    const arg = list[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--merge") out.merge = true;
    else if (arg === "--spa") out.spa = true;
    else if (arg === "--slug") out.slug = list[++i];
    else if (arg === "--origin" || arg === "--base-url") out.origin = list[++i];
    else if (arg === "--token") out.token = list[++i];
    else if (arg === "--client") out.client = list[++i];
    else if (arg === "--ref") out.ref = list[++i];
    else if (arg === "--ttl") out.ttl = list[++i];
    else if (!arg.startsWith("--") && !input) input = arg;
  }
  return { flags: out, input };
}

async function collectInput(root) {
  const info = await stat(root);
  if (info.isDirectory()) return collect(root);
  if (!info.isFile()) {
    console.error(`not a file or directory: ${root}`);
    process.exit(1);
  }
  if (info.size > MAX_FILE_BYTES) {
    const rel = sitePathForFile(path.basename(root));
    console.error(`${rel} is ${info.size} bytes; this script does not upload a single file over 100 MB.`);
    process.exit(1);
  }
  const data = await readFile(root);
  const rel = sitePathForFile(path.basename(root));
  return [
    {
      abs: root,
      rel,
      size: info.size,
      sha256: createHash("sha256").update(data).digest("hex"),
      type: typeFor(rel),
      data,
    },
  ];
}

function sitePathForFile(base) {
  return /\.html?$/i.test(base) ? "index.html" : base;
}

async function collect(base, rel = "") {
  const dirents = await readdir(path.join(base, rel), { withFileTypes: true });
  const out = [];
  for (const dirent of dirents) {
    if (dirent.name === ".git" || dirent.name === "node_modules") continue;
    const next = rel ? `${rel}/${dirent.name}` : dirent.name;
    const abs = path.join(base, next);
    if (dirent.isDirectory()) {
      out.push(...(await collect(base, next)));
      continue;
    }
    if (!dirent.isFile()) continue;
    const info = await stat(abs);
    const siteRel = next.split(path.sep).join("/");
    if (info.size > MAX_FILE_BYTES) {
      console.error(`${siteRel} is ${info.size} bytes; this script does not upload a single file over 100 MB.`);
      process.exit(1);
    }
    const data = await readFile(abs);
    out.push({
      abs,
      rel: siteRel,
      size: info.size,
      sha256: createHash("sha256").update(data).digest("hex"),
      type: typeFor(next),
      data,
    });
  }
  return out;
}

async function mapPool(items, limit, fn) {
  if (!items.length) return;
  let next = 0;
  let failed = null;
  async function worker() {
    while (failed == null) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        await fn(items[index]);
      } catch (err) {
        failed = err;
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  if (failed) throw failed;
}

async function uploadOne(missing, body) {
  const upload = missing.upload || {};
  let lastText = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(upload.url, { method: "PUT", headers: upload.headers || {}, body: Buffer.from(body) });
      if (res.ok) return;
      lastStatus = res.status;
      lastText = await res.text();
      if (res.status >= 500 && attempt === 0) continue;
      failResponse(res.status, lastText, parseJson(lastText));
    } catch (err) {
      if (attempt === 0) continue;
      console.error(`upload ${missing.sha256} failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }
  failResponse(lastStatus, lastText, parseJson(lastText));
}

function failResponse(status, text, parsed) {
  if (parsed) console.error(maskToken(JSON.stringify(parsed, null, 2)));
  else if (text) console.error(text);
  else console.error(`request failed (${status})`);
  printUserMessage(parsed);
  console.error("publish failed");
  process.exit(1);
}

function printUserMessage(parsed) {
  if (parsed && typeof parsed.user_message === "string" && parsed.user_message) {
    console.error(parsed.user_message);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function maskToken(json) {
  return json.replace(/"token"\s*:\s*"[^"]*"/g, '"token":"[saved]"');
}

function readSaved(file) {
  try {
    return readFileSync(file, "utf8").replace(/[ \r\n]/g, "");
  } catch {
    return "";
  }
}

function saveMinted(file, minted) {
  const existing = readSaved(file);
  const saveTo = existing && existing !== minted ? `${file}.new` : file;
  const dir = path.dirname(saveTo);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  writeFileSync(saveTo, `${minted}\n`, { mode: 0o600 });
  chmodSync(saveTo, 0o600);
  if (saveTo === file) {
    console.error(`token minted and saved to ${file} (mode 600). Later publishes reuse it. It is not returned again.`);
  } else {
    console.error(`token minted and saved to ${saveTo}; ${file} already holds a different token and was left as is.`);
  }
}

function typeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".pdf": "application/pdf",
    ".woff2": "font/woff2",
  };
  return types[ext] || "application/octet-stream";
}
