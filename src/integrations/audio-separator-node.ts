/**
 * Node-only stem separation. Do not import from Remotion scenes.
 */

import { execFile, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import {
  DEFAULT_STEM_MODEL,
  type SeparateStemsOptions,
  type SeparateStemsResult,
  type StemFile,
  type StemName,
} from "./audio-separator";

const execFileAsync = promisify(execFile);

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
  };
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

function defaultOutputDir(): string {
  return path.resolve(process.cwd(), "public/generated/stems");
}

function modelCacheDir(override?: string): string {
  return path.resolve(
    override ??
      process.env.AUDIO_SEPARATOR_MODEL_DIR ??
      path.join(process.cwd(), "bin/audio-separator/models"),
  );
}

function publicRel(abs: string): string {
  const pub = path.resolve(process.cwd(), "public");
  const rel = path.relative(pub, abs);
  if (!rel.startsWith("..")) return rel.split(path.sep).join("/");
  return path.basename(abs);
}

function classifyStem(filename: string): StemName {
  const lower = filename.toLowerCase();
  const names = [
    "vocals",
    "instrumental",
    "drums",
    "bass",
    "guitar",
    "piano",
    "other",
  ] as const;
  for (const n of names) {
    if (lower.includes(n)) return n;
  }
  if (lower.includes("karaoke") || lower.includes("no_vocals")) {
    return "instrumental";
  }
  return path.basename(filename, path.extname(filename)).toLowerCase();
}

function listStemFiles(dir: string, sinceMs: number): StemFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(wav|flac|mp3|m4a)$/i.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      return {
        name: classifyStem(f),
        path: p,
        file: publicRel(p),
        bytes: st.size,
        mtimeMs: st.mtimeMs,
      };
    })
    .filter((s) => s.mtimeMs >= sinceMs - 2000)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ mtimeMs: _ignored, ...rest }) => rest);
}

export function findAudioSeparator(): string | null {
  const envBin = process.env.AUDIO_SEPARATOR_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const which = spawnSync("which", ["audio-separator"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();

  const py = spawnSync(
    "python3",
    ["-c", "import shutil; print(shutil.which('audio-separator') or '')"],
    { encoding: "utf8" },
  );
  if (py.status === 0 && py.stdout.trim()) return py.stdout.trim();

  const moduleProbe = spawnSync(
    "python3",
    ["-c", "import audio_separator; print('ok')"],
    { encoding: "utf8" },
  );
  if (moduleProbe.status === 0) return "python3-module";

  return null;
}

export function audioSeparatorAvailable(): boolean {
  return findAudioSeparator() !== null;
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
    const h = Number(match[1]);
    const m = Number(match[2]);
    const s = Number(match[3]);
    return h * 3600 + m * 60 + s;
  } catch {
    return undefined;
  }
}

async function separateWithCli(
  input: string,
  outputDir: string,
  options: SeparateStemsOptions,
): Promise<SeparateStemsResult | null> {
  const bin = findAudioSeparator();
  if (!bin) return null;

  const model = options.model ?? DEFAULT_STEM_MODEL;
  const format = options.outputFormat ?? "wav";
  const modelDir = modelCacheDir(options.modelDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  const started = Date.now();
  const args = [
    input,
    "-m",
    model,
    "--output_dir",
    outputDir,
    "--output_format",
    format.toUpperCase(),
    "--model_file_dir",
    modelDir,
  ];
  if (options.singleStem) {
    args.push("--single_stem", options.singleStem);
  }

  try {
    if (bin === "python3-module") {
      await execFileAsync(
        "python3",
        [
          "-c",
          `
from audio_separator.separator import Separator
import sys
sep = Separator(
  output_dir=${JSON.stringify(outputDir)},
  output_format=${JSON.stringify(format.toUpperCase())},
  model_file_dir=${JSON.stringify(modelDir)},
)
sep.load_model(model_filename=${JSON.stringify(model)})
files = sep.separate(${JSON.stringify(input)})
print("\\n".join(files))
`,
        ],
        { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
      );
    } else {
      await execFileAsync(bin, args, {
        env: ffmpegEnv(),
        maxBuffer: 64 * 1024 * 1024,
      });
    }
  } catch (err) {
    console.warn(
      "audio-separator failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const stems = listStemFiles(outputDir, started);
  if (stems.length === 0) return null;

  // Normalize names to stable public paths (vocals.wav / instrumental.wav).
  const normalized: StemFile[] = [];
  for (const stem of stems) {
    const dest = path.join(outputDir, `${stem.name}.${format}`);
    if (path.resolve(stem.path) !== path.resolve(dest)) {
      fs.copyFileSync(stem.path, dest);
      if (path.dirname(stem.path) === outputDir && stem.path !== dest) {
        fs.rmSync(stem.path, { force: true });
      }
    }
    const st = fs.statSync(dest);
    normalized.push({
      name: stem.name,
      path: dest,
      file: publicRel(dest),
      bytes: st.size,
    });
  }

  return {
    input,
    outputDir,
    stems: normalized,
    model,
    engine: "audio-separator",
    durationSec: await probeDuration(input),
  };
}

/**
 * Mid-side approximation: center → vocals, sides → instrumental.
 * Useful when audio-separator isn't installed.
 */
async function separateWithFfmpegMs(
  input: string,
  outputDir: string,
  format: "wav" | "flac" | "mp3",
  model: string,
): Promise<SeparateStemsResult> {
  fs.mkdirSync(outputDir, { recursive: true });
  const vocals = path.join(outputDir, `vocals.${format}`);
  const instrumental = path.join(outputDir, `instrumental.${format}`);
  const codec =
    format === "mp3"
      ? ["-c:a", "libmp3lame", "-q:a", "2"]
      : format === "flac"
        ? ["-c:a", "flac"]
        : ["-c:a", "pcm_s16le"];

  // Mid (L+R)/2 ≈ centered vocals
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-af",
      "pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1",
      ...codec,
      vocals,
    ],
    { env: ffmpegEnv(), maxBuffer: 32 * 1024 * 1024 },
  );

  // Side (L-R)/2 ≈ instrumental / karaoke
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-af",
      "pan=stereo|c0=0.5*c0-0.5*c1|c1=0.5*c0-0.5*c1",
      ...codec,
      instrumental,
    ],
    { env: ffmpegEnv(), maxBuffer: 32 * 1024 * 1024 },
  );

  const stems: StemFile[] = [vocals, instrumental].map((p) => ({
    name: classifyStem(path.basename(p)),
    path: p,
    file: publicRel(p),
    bytes: fs.statSync(p).size,
  }));

  return {
    input,
    outputDir,
    stems,
    model,
    engine: "ffmpeg-ms",
    durationSec: await probeDuration(input),
  };
}

/**
 * Separate an audio mix into stems (vocals / instrumental / …).
 */
export async function separateStems(
  url: string,
  options: SeparateStemsOptions = {},
): Promise<SeparateStemsResult> {
  const input = resolveAudio(url);
  const outputDir = path.resolve(options.outputDir ?? defaultOutputDir());
  const model = options.model ?? DEFAULT_STEM_MODEL;
  const format = options.outputFormat ?? "wav";

  if (!options.fallback) {
    const viaCli = await separateWithCli(input, outputDir, options);
    if (viaCli) return viaCli;
    console.warn(
      "audio-separator not installed — using ffmpeg mid-side isolation. pip install \"audio-separator[cpu]\" for real UVR stems.",
    );
  }

  return separateWithFfmpegMs(input, outputDir, format, model);
}
