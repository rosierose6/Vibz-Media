/**
 * Node-only DeepFilterNet denoise. Do not import from Remotion scenes.
 */

import { execFile, execFileSync, spawnSync } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  DEEP_FILTER_VERSION,
  type DenoiseAudioOptions,
  type DenoiseAudioResult,
} from "./deepfilternet";

const execFileAsync = promisify(execFile);
const RELEASE_TAG = `v${DEEP_FILTER_VERSION}`;
const RELEASE_BASE =
  "https://github.com/Rikorose/DeepFilterNet/releases/download";

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
  };
}

function binRoot(): string {
  return path.resolve(process.cwd(), "bin/deep-filter");
}

function resolveAudio(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Audio not found: ${url}`);
}

function defaultOutput(input: string): string {
  const base = path.basename(input, path.extname(input));
  return path.resolve(process.cwd(), "public", `${base}-clean.wav`);
}

function publicRel(abs: string): string {
  const pub = path.resolve(process.cwd(), "public");
  const rel = path.relative(pub, abs);
  if (!rel.startsWith("..")) return rel.split(path.sep).join("/");
  return path.basename(abs);
}

function platformAsset(): string {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") {
    return `deep-filter-${DEEP_FILTER_VERSION}-aarch64-apple-darwin`;
  }
  if (platform === "darwin" && arch === "x64") {
    return `deep-filter-${DEEP_FILTER_VERSION}-x86_64-apple-darwin`;
  }
  if (platform === "linux" && arch === "arm64") {
    return `deep-filter-${DEEP_FILTER_VERSION}-aarch64-unknown-linux-gnu`;
  }
  if (platform === "linux") {
    return `deep-filter-${DEEP_FILTER_VERSION}-x86_64-unknown-linux-musl`;
  }
  if (platform === "win32") {
    return `deep-filter-${DEEP_FILTER_VERSION}-x86_64-pc-windows-msvc.exe`;
  }
  throw new Error(`Unsupported platform for deep-filter: ${platform}/${arch}`);
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const get = (u: string) => {
      https
        .get(u, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            get(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode} ${u}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        })
        .on("error", reject);
    };
    get(url);
  });
}

async function probeDuration(file: string): Promise<number | undefined> {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      ["-i", file, "-f", "null", "-"],
      { env: ffmpegEnv() },
    ).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));
    const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    if (!match) return undefined;
    return (
      Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    );
  } catch {
    return undefined;
  }
}

function findDeepFilter(): string | null {
  const envBin = process.env.DEEP_FILTER_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const local = path.join(binRoot(), process.platform === "win32" ? "deep-filter.exe" : "deep-filter");
  if (fs.existsSync(local)) return local;

  try {
    const stdout = execFileSync(
      process.platform === "win32" ? "where" : "which",
      ["deep-filter"],
      { encoding: "utf8", env: ffmpegEnv() },
    );
    const hit = stdout.trim().split(/\r?\n/)[0];
    if (hit && fs.existsSync(hit)) return hit;
  } catch {
    // not on PATH
  }
  return null;
}

export async function ensureDeepFilter(): Promise<string> {
  const existing = findDeepFilter();
  if (existing) return existing;

  const asset = platformAsset();
  const destName =
    process.platform === "win32" ? "deep-filter.exe" : "deep-filter";
  const dest = path.join(binRoot(), destName);
  const url = `${RELEASE_BASE}/${RELEASE_TAG}/${asset}`;

  console.log(`Downloading deep-filter ${DEEP_FILTER_VERSION}…`);
  await download(url, dest);
  if (process.platform !== "win32") {
    fs.chmodSync(dest, 0o755);
  }

  const probe = spawnSync(dest, ["--version"], {
    encoding: "utf8",
    env: ffmpegEnv(),
  });
  if (probe.status !== 0 && probe.status !== null) {
    // some builds print version to stderr with 0; tolerate
  }
  return dest;
}

export function deepFilterAvailable(): boolean {
  return findDeepFilter() !== null;
}

async function toWav48k(input: string): Promise<string> {
  const tmp = path.join(
    os.tmpdir(),
    `vibz-df-${Date.now()}-${path.basename(input, path.extname(input))}.wav`,
  );
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-ac",
      "1",
      "-ar",
      "48000",
      "-c:a",
      "pcm_s16le",
      tmp,
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );
  return tmp;
}

async function denoiseWithDeepFilter(
  input: string,
  output: string,
  options: DenoiseAudioOptions,
): Promise<DenoiseAudioResult | null> {
  let bin: string;
  try {
    bin = await ensureDeepFilter();
  } catch (err) {
    console.warn(
      "deep-filter download failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const work48 = await toWav48k(input);
  const tmpOutDir = path.join(os.tmpdir(), `vibz-df-out-${Date.now()}`);
  fs.mkdirSync(tmpOutDir, { recursive: true });

  const args = ["-o", tmpOutDir];
  if (options.postFilter) args.push("--pf");
  if (options.compensateDelay) args.push("-D");
  if (options.modelPath) args.push("-m", options.modelPath);
  args.push(work48);

  try {
    await execFileAsync(bin, args, {
      env: ffmpegEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.warn(
      "deep-filter failed:",
      err instanceof Error ? err.message : err,
    );
    fs.rmSync(work48, { force: true });
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
    return null;
  }

  const produced = fs
    .readdirSync(tmpOutDir)
    .filter((f) => f.toLowerCase().endsWith(".wav"))
    .map((f) => path.join(tmpOutDir, f));
  if (produced.length === 0) {
    fs.rmSync(work48, { force: true });
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
    return null;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Re-encode to a stable 48k wav at the requested path.
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", produced[0]!, "-ar", "48000", "-c:a", "pcm_s16le", output],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );

  fs.rmSync(work48, { force: true });
  fs.rmSync(tmpOutDir, { recursive: true, force: true });

  return {
    input,
    output,
    file: publicRel(output),
    engine: "deep-filter",
    sampleRate: 48000,
    durationSec: await probeDuration(output),
    bytes: fs.statSync(output).size,
  };
}

async function denoiseWithFfmpeg(
  input: string,
  output: string,
): Promise<DenoiseAudioResult> {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-af",
      "highpass=f=80,afftdn=nr=12:nf=-25,lowpass=f=14000",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      output,
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );

  return {
    input,
    output,
    file: publicRel(output),
    engine: "ffmpeg",
    sampleRate: 48000,
    durationSec: await probeDuration(output),
    bytes: fs.statSync(output).size,
  };
}

/**
 * Denoise / enhance speech audio (DeepFilterNet API shape).
 */
export async function denoiseAudio(
  url: string,
  options: DenoiseAudioOptions = {},
): Promise<DenoiseAudioResult> {
  const input = resolveAudio(url);
  const output = path.resolve(options.output ?? defaultOutput(input));

  if (!options.fallback) {
    const viaDf = await denoiseWithDeepFilter(input, output, options);
    if (viaDf) return viaDf;
    console.warn(
      "deep-filter unavailable — using ffmpeg afftdn. Binary will download from DeepFilterNet releases on next run if network allows.",
    );
  }

  return denoiseWithFfmpeg(input, output);
}

/**
 * Mix pink noise into audio for denoise demos.
 */
export async function makeNoisyDemo(
  url: string,
  output = path.resolve(process.cwd(), "public/voiceover-noisy.wav"),
  noiseAmp = 0.08,
): Promise<string> {
  const input = resolveAudio(url);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-filter_complex",
      `anoisesrc=c=pink:a=${noiseAmp}:d=0[n];[0:a][n]amix=inputs=2:duration=first:dropout_transition=0,volume=1.2`,
      "-ar",
      "48000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      output,
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );
  return output;
}
