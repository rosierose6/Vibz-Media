/**
 * Node-only PySceneDetect wrapper. Do not import from Remotion scenes.
 */

import { execFile, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type {
  DetectScenesOptions,
  DetectScenesResult,
  SceneCut,
  SceneDetector,
} from "./pyscenedetect";

const execFileAsync = promisify(execFile);

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
  };
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
  throw new Error(`Video not found: ${url}`);
}

function publicRel(abs: string): string {
  const pub = path.resolve(process.cwd(), "public");
  const rel = path.relative(pub, abs);
  if (!rel.startsWith("..")) return rel.split(path.sep).join("/");
  return path.basename(abs);
}

function defaultOutputDir(): string {
  return path.resolve(process.cwd(), "public/generated/scenes");
}

function venvScenedetect(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "bin/scenedetect/venv/bin/scenedetect"),
    path.resolve(process.cwd(), "bin/scenedetect/venv/Scripts/scenedetect.exe"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function findSceneDetect(): string | null {
  const envBin = process.env.SCENEDETECT_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;

  const local = venvScenedetect();
  if (local) return local;

  const which = spawnSync("which", ["scenedetect"], {
    encoding: "utf8",
    env: ffmpegEnv(),
  });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();

  const py = spawnSync(
    "python3",
    ["-c", "import scenedetect; print('ok')"],
    { encoding: "utf8", env: ffmpegEnv() },
  );
  if (py.status === 0) return "python3-module";

  return null;
}

export function sceneDetectAvailable(): boolean {
  return findSceneDetect() !== null;
}

/**
 * Install scenedetect into a local venv under bin/scenedetect.
 */
export async function ensureSceneDetect(): Promise<string | null> {
  const existing = findSceneDetect();
  if (existing && existing !== "python3-module") return existing;
  if (existing === "python3-module") return existing;

  const venvDir = path.resolve(process.cwd(), "bin/scenedetect/venv");
  const bin =
    process.platform === "win32"
      ? path.join(venvDir, "Scripts", "scenedetect.exe")
      : path.join(venvDir, "bin", "scenedetect");

  if (fs.existsSync(bin)) return bin;

  console.log("Installing scenedetect into bin/scenedetect/venv…");
  fs.mkdirSync(path.dirname(venvDir), { recursive: true });
  try {
    await execFileAsync("python3", ["-m", "venv", venvDir], {
      env: ffmpegEnv(),
      maxBuffer: 16 * 1024 * 1024,
    });
    const pip =
      process.platform === "win32"
        ? path.join(venvDir, "Scripts", "pip")
        : path.join(venvDir, "bin", "pip");
    await execFileAsync(
      pip,
      ["install", "--upgrade", "pip", "scenedetect[opencv]"],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    console.warn(
      "scenedetect venv install failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  return fs.existsSync(bin) ? bin : null;
}

async function probeVideo(file: string): Promise<{
  durationSec?: number;
  fps?: number;
}> {
  const { stderr } = await execFileAsync(
    "ffmpeg",
    ["-i", file, "-f", "null", "-"],
    { env: ffmpegEnv() },
  ).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));

  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const durationSec = dur
    ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])
    : undefined;
  const fpsMatch = /(\d+(?:\.\d+)?)\s*fps/.exec(stderr);
  const fps = fpsMatch ? Number(fpsMatch[1]) : undefined;
  return { durationSec, fps };
}

function detectorCliFlag(detector: SceneDetector): string {
  switch (detector) {
    case "adaptive":
      return "detect-adaptive";
    case "threshold":
      return "detect-threshold";
    case "hash":
      return "detect-hash";
    case "histogram":
      return "detect-hist";
    case "content":
    default:
      return "detect-content";
  }
}

function parseCsvScenes(
  csvPath: string,
  fps: number,
): SceneCut[] {
  if (!fs.existsSync(csvPath)) return [];
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith("Timecode"));
  // Find header with Start Frame
  const headerIdx = text
    .split(/\r?\n/)
    .findIndex((l) => /Start Frame/i.test(l) || /Start Time/i.test(l));
  const dataLines = text
    .split(/\r?\n/)
    .slice(headerIdx >= 0 ? headerIdx + 1 : 0)
    .filter((l) => l && /^\d/.test(l.trim()));

  const scenes: SceneCut[] = [];
  for (const line of dataLines) {
    const cols = line.split(",").map((c) => c.trim());
    // Typical: Scene Number, Start Frame, Start Timecode, Start Time (seconds), End Frame, ...
    if (cols.length < 6) continue;
    const index = Number(cols[0]);
    const startFrame = Number(cols[1]);
    const start = Number(cols[3]);
    const endFrame = Number(cols[4]);
    const end = Number(cols[6] ?? cols[5]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    scenes.push({
      index: Number.isFinite(index) ? index : scenes.length + 1,
      start,
      end,
      startFrame: Number.isFinite(startFrame)
        ? startFrame
        : Math.round(start * fps),
      endFrame: Number.isFinite(endFrame) ? endFrame : Math.round(end * fps),
    });
  }
  void lines;
  return scenes;
}

async function detectWithCli(
  input: string,
  outputDir: string,
  options: DetectScenesOptions,
): Promise<DetectScenesResult | null> {
  let bin = findSceneDetect();
  if (!bin) {
    bin = await ensureSceneDetect();
  }
  if (!bin) return null;

  const detector = options.detector ?? "content";
  const threshold = options.threshold ?? 27;
  const fpsInfo = await probeVideo(input);
  const fps = fpsInfo.fps ?? 24;

  fs.mkdirSync(outputDir, { recursive: true });
  const absOut = path.resolve(outputDir);

  const detectCmd = detectorCliFlag(detector);
  const baseArgs = ["-i", input, "-o", absOut, detectCmd, "-t", String(threshold)];

  try {
    if (bin === "python3-module") {
      const script = `
from scenedetect import detect, ContentDetector, AdaptiveDetector, ThresholdDetector
from scenedetect.detectors import HashDetector, HistogramDetector
import json, sys
path = ${JSON.stringify(input)}
threshold = ${threshold}
det_name = ${JSON.stringify(detector)}
det = {
  "content": lambda: ContentDetector(threshold=threshold),
  "adaptive": lambda: AdaptiveDetector(),
  "threshold": lambda: ThresholdDetector(threshold=threshold),
  "hash": lambda: HashDetector(),
  "histogram": lambda: HistogramDetector(),
}[det_name]()
scenes = detect(path, det)
out = []
for i, (a, b) in enumerate(scenes, 1):
  out.append({
    "index": i,
    "start": a.get_seconds(),
    "end": b.get_seconds(),
    "startFrame": a.frame_num,
    "endFrame": b.frame_num,
  })
print(json.dumps(out))
`;
      const { stdout } = await execFileAsync("python3", ["-c", script], {
        env: ffmpegEnv(),
        maxBuffer: 32 * 1024 * 1024,
      });
      const scenes = JSON.parse(stdout) as SceneCut[];
      if (options.split) await splitScenes(input, absOut, scenes);
      if (options.saveImages) await saveThumbs(input, absOut, scenes);
      return {
        input,
        outputDir: absOut,
        scenes,
        detector,
        threshold,
        engine: "scenedetect",
        fps,
        durationSec: fpsInfo.durationSec,
      };
    }

    const args = [...baseArgs, "list-scenes", "-f", "scenes"];
    if (options.saveImages) args.push("save-images", "-o", absOut);
    if (options.split) args.push("split-video", "-o", absOut);

    await execFileAsync(bin, args, {
      env: ffmpegEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.warn(
      "scenedetect failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  // Find CSV
  const csv =
    fs
      .readdirSync(absOut)
      .filter((f) => f.endsWith(".csv") && f.includes("scenes"))
      .map((f) => path.join(absOut, f))[0] ?? path.join(absOut, "scenes.csv");

  let scenes = parseCsvScenes(csv, fps);
  if (scenes.length === 0) {
    // single scene fallback from duration
    const dur = fpsInfo.durationSec ?? 0;
    scenes = [
      {
        index: 1,
        start: 0,
        end: dur,
        startFrame: 0,
        endFrame: Math.round(dur * fps),
      },
    ];
  }

  // Attach split file paths if present
  const clips = fs
    .readdirSync(absOut)
    .filter((f) => /\.(mp4|mkv|webm)$/i.test(f))
    .sort();
  scenes = scenes.map((s, i) => {
    const clip = clips[i];
    if (!clip) return s;
    const p = path.join(absOut, clip);
    return { ...s, path: p, file: publicRel(p) };
  });

  if (options.split && clips.length === 0) {
    await splitScenes(input, absOut, scenes);
    scenes = scenes.map((s, i) => {
      const p = path.join(absOut, `scene_${String(i + 1).padStart(3, "0")}.mp4`);
      if (!fs.existsSync(p)) return s;
      return { ...s, path: p, file: publicRel(p) };
    });
  }

  if (options.saveImages) {
    const imgs = fs
      .readdirSync(absOut)
      .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
      .sort();
    if (imgs.length === 0) await saveThumbs(input, absOut, scenes);
  }

  return {
    input,
    outputDir: absOut,
    scenes,
    detector,
    threshold,
    engine: "scenedetect",
    fps,
    durationSec: fpsInfo.durationSec,
  };
}

async function splitScenes(
  input: string,
  outputDir: string,
  scenes: SceneCut[],
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]!;
    const out = path.join(
      outputDir,
      `scene_${String(i + 1).padStart(3, "0")}.mp4`,
    );
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(s.start),
        "-to",
        String(s.end),
        "-i",
        input,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-crf",
        "20",
        out,
      ],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
    s.path = out;
    s.file = publicRel(out);
  }
}

async function saveThumbs(
  input: string,
  outputDir: string,
  scenes: SceneCut[],
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]!;
    const out = path.join(
      outputDir,
      `scene_${String(i + 1).padStart(3, "0")}.jpg`,
    );
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(Math.max(0, s.start + 0.05)),
        "-i",
        input,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        out,
      ],
      { env: ffmpegEnv(), maxBuffer: 16 * 1024 * 1024 },
    );
  }
}

/**
 * ffmpeg content-aware scene detection fallback.
 * Threshold ~0.3–0.5 maps roughly to PySceneDetect's content score.
 */
async function detectWithFfmpeg(
  input: string,
  outputDir: string,
  options: DetectScenesOptions,
): Promise<DetectScenesResult> {
  const detector = options.detector ?? "content";
  // Map PySceneDetect 0–100ish threshold to ffmpeg 0–1 scene score.
  const threshold = options.threshold ?? 27;
  const sceneScore = Math.min(0.9, Math.max(0.15, threshold / 100));
  const minSceneLen = options.minSceneLen ?? 0.4;
  const info = await probeVideo(input);
  const fps = info.fps ?? 24;
  const duration = info.durationSec ?? 0;

  const { stderr } = await execFileAsync(
    "ffmpeg",
    [
      "-i",
      input,
      "-vf",
      `select='gt(scene,${sceneScore})',metadata=print`,
      "-an",
      "-f",
      "null",
      "-",
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  ).catch((err: { stderr?: string }) => ({ stderr: err.stderr ?? "" }));

  const cuts: number[] = [0];
  for (const line of stderr.split(/\r?\n/)) {
    const pts = /pts_time:([\d.]+)/.exec(line);
    if (pts) {
      const t = Number(pts[1]);
      if (Number.isFinite(t) && t - (cuts[cuts.length - 1] ?? 0) >= minSceneLen) {
        cuts.push(t);
      }
    }
  }

  const scenes: SceneCut[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i]!;
    const end = i + 1 < cuts.length ? cuts[i + 1]! : duration;
    if (end - start < 0.05) continue;
    scenes.push({
      index: scenes.length + 1,
      start,
      end,
      startFrame: Math.round(start * fps),
      endFrame: Math.round(end * fps),
    });
  }
  if (scenes.length === 0 && duration > 0) {
    scenes.push({
      index: 1,
      start: 0,
      end: duration,
      startFrame: 0,
      endFrame: Math.round(duration * fps),
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  if (options.split !== false) await splitScenes(input, outputDir, scenes);
  if (options.saveImages !== false) await saveThumbs(input, outputDir, scenes);

  return {
    input,
    outputDir,
    scenes,
    detector,
    threshold,
    engine: "ffmpeg",
    fps,
    durationSec: duration,
  };
}

/**
 * Detect scene cuts in a video (PySceneDetect API shape).
 */
export async function detectScenes(
  url: string,
  options: DetectScenesOptions = {},
): Promise<DetectScenesResult> {
  const input = resolveMedia(url);
  const outputDir = path.resolve(options.outputDir ?? defaultOutputDir());

  if (!options.fallback) {
    const viaCli = await detectWithCli(input, outputDir, {
      split: true,
      saveImages: true,
      ...options,
    });
    if (viaCli) return viaCli;
    console.warn(
      "scenedetect not installed — using ffmpeg scene filter. pip install scenedetect (or rely on bin/scenedetect/venv).",
    );
  }

  return detectWithFfmpeg(input, outputDir, {
    split: true,
    saveImages: true,
    ...options,
  });
}

/**
 * Build a multi-scene demo reel by concatenating clips with hard cuts.
 */
export async function makeMultiSceneDemo(
  sources: string[],
  output = path.resolve(process.cwd(), "public/generated/multi-scene.mp4"),
): Promise<string> {
  const resolved = sources.map(resolveMedia);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const listPath = path.join(path.dirname(output), "concat-scenes.txt");
  const parts: string[] = [];

  for (let i = 0; i < resolved.length; i++) {
    const part = path.join(
      path.dirname(output),
      `_part_${String(i).padStart(2, "0")}.mp4`,
    );
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        resolved[i]!,
        "-t",
        "2.5",
        "-vf",
        "scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p",
        "-an",
        "-c:v",
        "libx264",
        "-crf",
        "20",
        part,
      ],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
    parts.push(part);
  }

  fs.writeFileSync(
    listPath,
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  await execFileAsync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", output],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );

  for (const p of parts) fs.rmSync(p, { force: true });
  fs.rmSync(listPath, { force: true });
  return output;
}
