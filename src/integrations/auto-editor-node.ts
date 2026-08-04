/**
 * Node-only auto-editor wrapper. Do not import from Remotion scenes.
 */

import { execFile, execFileSync, spawnSync } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  AUTO_EDITOR_VERSION,
  DEFAULT_EDIT,
  DEFAULT_MARGIN,
  type AutoEditOptions,
  type AutoEditResult,
  type CutSegment,
} from "./auto-editor";

const execFileAsync = promisify(execFile);
const RELEASE_BASE =
  "https://github.com/WyattBlue/auto-editor/releases/download";

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
  };
}

function binRoot(): string {
  return path.resolve(process.cwd(), "bin/auto-editor");
}

function resolveMedia(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Media not found: ${url}`);
}

function publicRel(abs: string): string {
  const pub = path.resolve(process.cwd(), "public");
  const rel = path.relative(pub, abs);
  if (!rel.startsWith("..")) return rel.split(path.sep).join("/");
  return path.basename(abs);
}

function defaultOutput(input: string): string {
  const base = path.basename(input, path.extname(input));
  const ext = path.extname(input) || ".mp4";
  return path.resolve(
    process.cwd(),
    "public/generated",
    `${base}-cut${ext}`,
  );
}

function platformAsset(): string {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") {
    return "auto-editor-macos-arm64";
  }
  if (platform === "darwin") return "auto-editor-macos-x86_64";
  if (platform === "linux" && arch === "arm64") {
    return "auto-editor-linux-aarch64";
  }
  if (platform === "linux") return "auto-editor-linux-x86_64";
  if (platform === "win32" && arch === "arm64") {
    return "auto-editor-windows-aarch64.exe";
  }
  if (platform === "win32") return "auto-editor-windows-x86_64.exe";
  throw new Error(`Unsupported platform for auto-editor: ${platform}/${arch}`);
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
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  } catch {
    return undefined;
  }
}

function findAutoEditor(): string | null {
  const envBin = process.env.AUTO_EDITOR_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const local = path.join(
    binRoot(),
    process.platform === "win32" ? "auto-editor.exe" : "auto-editor",
  );
  if (fs.existsSync(local)) return local;

  try {
    const stdout = execFileSync(
      process.platform === "win32" ? "where" : "which",
      ["auto-editor"],
      { encoding: "utf8", env: ffmpegEnv() },
    );
    const hit = stdout.trim().split(/\r?\n/)[0];
    if (hit && fs.existsSync(hit)) return hit;
  } catch {
    // not on PATH
  }
  return null;
}

export async function ensureAutoEditor(): Promise<string> {
  const existing = findAutoEditor();
  if (existing) return existing;

  const asset = platformAsset();
  const destName =
    process.platform === "win32" ? "auto-editor.exe" : "auto-editor";
  const dest = path.join(binRoot(), destName);
  const url = `${RELEASE_BASE}/${AUTO_EDITOR_VERSION}/${asset}`;

  console.log(`Downloading auto-editor ${AUTO_EDITOR_VERSION}…`);
  await download(url, dest);
  if (process.platform !== "win32") fs.chmodSync(dest, 0o755);

  // macOS may quarantine unsigned binaries — clear if present.
  if (process.platform === "darwin") {
    spawnSync("xattr", ["-d", "com.apple.quarantine", dest], {
      encoding: "utf8",
    });
  }

  return dest;
}

export function autoEditorAvailable(): boolean {
  return findAutoEditor() !== null;
}

function parseMarginSec(margin: string): number {
  const m = /(\d+(?:\.\d+)?)\s*s/.exec(margin);
  return m ? Number(m[1]) : 0.2;
}

async function detectSilenceSegments(
  input: string,
  silenceDb: number,
  minSilenceSec: number,
): Promise<Array<{ start: number; end: number }>> {
  const { stderr } = await execFileAsync(
    "ffmpeg",
    [
      "-i",
      input,
      "-af",
      `silencedetect=noise=${silenceDb}dB:d=${minSilenceSec}`,
      "-f",
      "null",
      "-",
    ],
    { env: ffmpegEnv(), maxBuffer: 32 * 1024 * 1024 },
  ).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));

  const silences: Array<{ start: number; end: number }> = [];
  let pendingStart: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*([\d.]+)/.exec(line);
    if (start) {
      pendingStart = Number(start[1]);
      continue;
    }
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && pendingStart !== null) {
      silences.push({ start: pendingStart, end: Number(end[1]) });
      pendingStart = null;
    }
  }
  return silences;
}

function invertSilences(
  silences: Array<{ start: number; end: number }>,
  duration: number,
  padSec: number,
): CutSegment[] {
  if (duration <= 0) return [];
  const kept: CutSegment[] = [];
  let cursor = 0;
  for (const s of silences) {
    const start = Math.max(0, cursor);
    const end = Math.max(start, s.start);
    if (end - start > 0.05) {
      kept.push({
        start: Math.max(0, start - (kept.length ? padSec : 0)),
        end: Math.min(duration, end + padSec),
      });
    }
    cursor = s.end;
  }
  if (duration - cursor > 0.05) {
    kept.push({
      start: Math.max(0, cursor - (kept.length ? padSec : 0)),
      end: duration,
    });
  }

  // Merge overlaps
  kept.sort((a, b) => a.start - b.start);
  const merged: CutSegment[] = [];
  for (const seg of kept) {
    const last = merged[merged.length - 1];
    if (!last || seg.start > last.end + 0.01) {
      merged.push({ ...seg });
    } else {
      last.end = Math.max(last.end, seg.end);
    }
  }
  return merged.length > 0 ? merged : [{ start: 0, end: duration }];
}

async function cutWithFfmpeg(
  input: string,
  output: string,
  segments: CutSegment[],
): Promise<void> {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const hasVideo = await probeHasVideo(input);
  const hasAudio = await probeHasAudio(input);

  if (segments.length === 1 && segments[0]!.start <= 0.01) {
    // Single near-full clip — still re-encode for a stable demo artifact.
  }

  if (segments.length === 0) {
    fs.copyFileSync(input, output);
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `vanta-ae-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const parts: string[] = [];

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const part = path.join(tmpDir, `part_${String(i).padStart(4, "0")}.mp4`);
      const args = ["-y", "-ss", String(seg.start), "-to", String(seg.end), "-i", input];
      if (hasVideo) {
        args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20");
      } else {
        args.push("-vn");
      }
      if (hasAudio) {
        args.push("-c:a", "aac", "-b:a", "192k");
      } else {
        args.push("-an");
      }
      args.push(part);
      await execFileAsync("ffmpeg", args, {
        env: ffmpegEnv(),
        maxBuffer: 64 * 1024 * 1024,
      });
      parts.push(part);
    }

    if (parts.length === 1) {
      fs.copyFileSync(parts[0]!, output);
      return;
    }

    const listPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(
      listPath,
      parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    );
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function probeHasVideo(file: string): Promise<boolean> {
  const { stderr } = await execFileAsync("ffmpeg", ["-i", file, "-f", "null", "-"], {
    env: ffmpegEnv(),
  }).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));
  return /Video:/.test(stderr);
}

async function probeHasAudio(file: string): Promise<boolean> {
  const { stderr } = await execFileAsync("ffmpeg", ["-i", file, "-f", "null", "-"], {
    env: ffmpegEnv(),
  }).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));
  return /Audio:/.test(stderr);
}

async function autoEditWithBinary(
  input: string,
  output: string,
  options: AutoEditOptions,
): Promise<AutoEditResult | null> {
  let bin: string;
  try {
    bin = await ensureAutoEditor();
  } catch (err) {
    console.warn(
      "auto-editor download failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const margin = options.margin ?? DEFAULT_MARGIN;
  const edit = options.edit ?? DEFAULT_EDIT;
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const args = [
    input,
    "--margin",
    margin,
    "--edit",
    edit,
    "--output",
    output,
  ];
  if (options.exportTimeline) {
    args.push("--export", options.exportTimeline);
  }

  try {
    await execFileAsync(bin, args, {
      env: ffmpegEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Silent video sources: retry with motion edit.
    if (/audio stream|channel 'all'/i.test(msg) && !edit.startsWith("motion")) {
      try {
        await execFileAsync(
          bin,
          [
            input,
            "--margin",
            margin,
            "--edit",
            "motion:threshold=0.02",
            "--output",
            output,
          ],
          { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
        );
      } catch (err2) {
        console.warn(
          "auto-editor failed:",
          err2 instanceof Error ? err2.message : err2,
        );
        return null;
      }
    } else {
      console.warn("auto-editor failed:", msg);
      return null;
    }
  }

  if (!fs.existsSync(output)) {
    // Older naming: *_ALTERED.ext next to input
    const altered = path.join(
      path.dirname(input),
      `${path.basename(input, path.extname(input))}_ALTERED${path.extname(input)}`,
    );
    if (fs.existsSync(altered)) {
      fs.renameSync(altered, output);
    } else {
      return null;
    }
  }

  const inputDurationSec = await probeDuration(input);
  const outputDurationSec = await probeDuration(output);
  const silenceDb = options.silenceDb ?? -30;
  const minSilenceSec = options.minSilenceSec ?? 0.35;
  const silences = await detectSilenceSegments(input, silenceDb, minSilenceSec);
  const keptSegments = invertSilences(
    silences,
    inputDurationSec ?? 0,
    parseMarginSec(margin),
  );

  return {
    input,
    output,
    file: publicRel(output),
    engine: "auto-editor",
    margin,
    edit,
    inputDurationSec,
    outputDurationSec,
    keptSegments,
    bytes: fs.statSync(output).size,
  };
}

async function autoEditWithFfmpeg(
  input: string,
  output: string,
  options: AutoEditOptions,
): Promise<AutoEditResult> {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const edit = options.edit ?? DEFAULT_EDIT;
  const silenceDb = options.silenceDb ?? -30;
  const minSilenceSec = options.minSilenceSec ?? 0.35;
  const inputDurationSec = await probeDuration(input);
  const silences = await detectSilenceSegments(input, silenceDb, minSilenceSec);
  const keptSegments = invertSilences(
    silences,
    inputDurationSec ?? 0,
    parseMarginSec(margin),
  );

  await cutWithFfmpeg(input, output, keptSegments);
  const outputDurationSec = await probeDuration(output);

  return {
    input,
    output,
    file: publicRel(output),
    engine: "ffmpeg",
    margin,
    edit,
    inputDurationSec,
    outputDurationSec,
    keptSegments,
    bytes: fs.statSync(output).size,
  };
}

/**
 * Automatically cut silence / dead space from video or audio.
 */
export async function autoEdit(
  url: string,
  options: AutoEditOptions = {},
): Promise<AutoEditResult> {
  const input = resolveMedia(url);
  const output = path.resolve(options.output ?? defaultOutput(input));

  if (!options.fallback) {
    const viaAe = await autoEditWithBinary(input, output, options);
    if (viaAe) return viaAe;
    console.warn(
      "auto-editor unavailable — using ffmpeg silencedetect + trim. Binary downloads from GitHub releases when network allows.",
    );
  }

  return autoEditWithFfmpeg(input, output, options);
}

/**
 * Build a demo clip with intentional silence + speech audio for before/after demos.
 * Source video may be silent (e.g. ai-clip); we mux voiceover with lead/trail silence.
 */
export async function makePaddedDemo(
  url: string,
  output = path.resolve(process.cwd(), "public/generated/padded-talk.mp4"),
  padSec = 1.5,
  voiceover = path.resolve(process.cwd(), "public/voiceover.wav"),
): Promise<string> {
  const input = resolveMedia(url);
  const vo = fs.existsSync(voiceover)
    ? voiceover
    : resolveMedia("./public/voiceover.wav");
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const hasAudio = await probeHasAudio(input);
  if (hasAudio) {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-vf",
        `tpad=start_duration=${padSec}:stop_duration=${padSec}:color=black`,
        "-af",
        `adelay=${Math.round(padSec * 1000)}|${Math.round(padSec * 1000)},apad=pad_dur=${padSec}`,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        output,
      ],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
  } else {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-i",
        vo,
        "-filter_complex",
        [
          `[0:v]tpad=start_duration=${padSec}:stop_duration=${padSec}:color=black,fps=24,scale=960:540[v]`,
          `anullsrc=r=48000:cl=mono,atrim=0:${padSec}[a0]`,
          `[1:a]aformat=sample_rates=48000:channel_layouts=mono,apad=pad_dur=${padSec}[a1]`,
          `[a0][a1]concat=n=2:v=0:a=1[a]`,
        ].join(";"),
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        output,
      ],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
  }
  return output;
}
