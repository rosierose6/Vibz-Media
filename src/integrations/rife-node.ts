/**
 * Node-only RIFE frame interpolation. Do not import from Remotion scenes.
 */

import { execFile, execFileSync } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";
import type {
  InterpolateOptions,
  InterpolateResult,
  RifeModel,
  RifeMulti,
} from "./rife";

const execFileAsync = promisify(execFile);

const RELEASE_TAG = "20221029";
const RELEASE_BASE =
  "https://github.com/nihui/rife-ncnn-vulkan/releases/download";

function binRoot(): string {
  return path.resolve(process.cwd(), "bin/rife-ncnn-vulkan");
}

function binaryName(): string {
  return process.platform === "win32"
    ? "rife-ncnn-vulkan.exe"
    : "rife-ncnn-vulkan";
}

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
  };
}

function resolveVideo(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
    path.resolve(process.cwd(), "out", path.basename(cleaned)),
    path.resolve(process.cwd(), "public/generated", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Video not found: ${url}`);
}

function defaultOutput(input: string, multi: RifeMulti): string {
  const base = path.basename(input, path.extname(input));
  return path.resolve(
    process.cwd(),
    "public/generated",
    `${base}-${multi}x.mp4`,
  );
}

function platformZip(): string {
  switch (process.platform) {
    case "darwin":
      return `rife-ncnn-vulkan-${RELEASE_TAG}-macos.zip`;
    case "linux":
      return `rife-ncnn-vulkan-${RELEASE_TAG}-ubuntu.zip`;
    case "win32":
      return `rife-ncnn-vulkan-${RELEASE_TAG}-windows.zip`;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function findBinary(): string | null {
  const local = path.join(binRoot(), binaryName());
  if (fs.existsSync(local)) return local;
  const whichCmd = process.platform === "win32" ? "where" : "which";
  try {
    const stdout = execFileSync(whichCmd, [binaryName()], {
      encoding: "utf8",
    });
    const hit = stdout.trim().split(/\r?\n/)[0];
    if (hit && fs.existsSync(hit)) return hit;
  } catch {
    // not on PATH
  }
  return null;
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
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

async function unzip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === "win32") {
    await execFileAsync("powershell", [
      "-Command",
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
    ]);
    return;
  }
  await execFileAsync("unzip", ["-o", zipPath, "-d", destDir]);
}

export async function ensureRifeBinary(): Promise<string> {
  const existing = findBinary();
  if (existing) return existing;

  const zip = platformZip();
  const root = binRoot();
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const zipPath = path.join(os.tmpdir(), zip);
  const url = `${RELEASE_BASE}/${RELEASE_TAG}/${zip}`;

  console.log(`Downloading RIFE ncnn Vulkan ${RELEASE_TAG}…`);
  await download(url, zipPath);

  const extractDir = path.join(os.tmpdir(), `rife-${RELEASE_TAG}`);
  fs.rmSync(extractDir, { recursive: true, force: true });
  await unzip(zipPath, extractDir);

  const stack = [extractDir];
  let foundBin: string | null = null;
  const modelDirs: string[] = [];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (entry.startsWith("rife")) modelDirs.push(full);
        stack.push(full);
      } else if (entry === binaryName() || entry === "rife-ncnn-vulkan.exe") {
        foundBin = full;
      }
    }
  }

  if (!foundBin) throw new Error(`Could not find ${binaryName()} in ${zip}`);

  fs.copyFileSync(foundBin, path.join(root, binaryName()));
  fs.chmodSync(path.join(root, binaryName()), 0o755);

  for (const modelDir of modelDirs) {
    const name = path.basename(modelDir);
    const dest = path.join(root, name);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(modelDir)) {
      const src = path.join(modelDir, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(dest, f));
      }
    }
  }

  return path.join(root, binaryName());
}

async function probeVideo(filePath: string): Promise<{
  fps: number;
  duration: number;
  frames: number;
}> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=r_frame_rate,nb_frames,duration",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath,
    ],
    { env: ffmpegEnv() },
  ).catch(async () => {
    // No ffprobe — derive via ffmpeg null muxer.
    const { stderr } = await execFileAsync(
      "ffmpeg",
      ["-i", filePath, "-f", "null", "-"],
      { env: ffmpegEnv() },
    ).catch((err: { stderr?: Buffer | string }) => ({
      stderr: err.stderr ?? "",
    }));
    const text = String(stderr);
    const fpsMatch = text.match(/(\d+(?:\.\d+)?)\s*fps/);
    const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    let duration = 0;
    if (durMatch) {
      duration =
        Number(durMatch[1]) * 3600 +
        Number(durMatch[2]) * 60 +
        Number(durMatch[3]);
    }
    const fps = fpsMatch ? Number(fpsMatch[1]) : 30;
    return {
      stdout: JSON.stringify({
        streams: [{ r_frame_rate: `${fps}/1`, duration: String(duration) }],
        format: { duration: String(duration) },
      }),
    };
  });

  const data = JSON.parse(String(stdout)) as {
    streams?: Array<{
      r_frame_rate?: string;
      nb_frames?: string;
      duration?: string;
    }>;
    format?: { duration?: string };
  };
  const stream = data.streams?.[0] ?? {};
  const rate = stream.r_frame_rate ?? "30/1";
  const [num, den] = rate.split("/").map(Number);
  const fps = den ? num / den : Number(rate) || 30;
  const duration =
    Number(stream.duration) ||
    Number(data.format?.duration) ||
    0;
  const frames =
    Number(stream.nb_frames) ||
    (duration > 0 ? Math.round(duration * fps) : 0);
  return { fps, duration, frames };
}

async function interpolateWithNcnn(
  input: string,
  output: string,
  multi: RifeMulti,
  model: RifeModel,
): Promise<InterpolateResult | null> {
  let bin: string;
  try {
    bin = await ensureRifeBinary();
  } catch (err) {
    console.warn(
      `RIFE binary unavailable: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vibz-rife-"));
  const inDir = path.join(work, "in");
  const outDir = path.join(work, "out");
  const audioPath = path.join(work, "audio.m4a");
  fs.mkdirSync(inDir);
  fs.mkdirSync(outDir);

  try {
    const meta = await probeVideo(input);

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input, path.join(inDir, "frame_%08d.png")],
      { env: ffmpegEnv(), maxBuffer: 32 * 1024 * 1024 },
    );

    // Best-effort audio extract (may fail for silent clips).
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", input, "-vn", "-acodec", "aac", "-b:a", "192k", audioPath],
      { env: ffmpegEnv() },
    ).catch(() => undefined);

    const inputFrames = fs
      .readdirSync(inDir)
      .filter((f) => f.endsWith(".png")).length;
    if (inputFrames < 2) {
      throw new Error("Need at least 2 frames to interpolate");
    }

    const targetFrames = inputFrames * multi;
    const modelPath = path.join(path.dirname(bin), model);
    const args = [
      "-i",
      inDir,
      "-o",
      outDir,
      "-n",
      String(targetFrames),
      "-f",
      "%08d.png",
    ];
    if (fs.existsSync(modelPath)) {
      args.push("-m", modelPath);
    }

    try {
      await execFileAsync(bin, args, {
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      });
    } catch (err) {
      const detail =
        err && typeof err === "object" && "stderr" in err
          ? String((err as { stderr: Buffer | string }).stderr)
          : err instanceof Error
            ? err.message
            : String(err);
      console.warn(`rife-ncnn-vulkan failed: ${detail.trim()}`);
      return null;
    }

    const outFps = meta.fps * multi;
    const encodeArgs = [
      "-y",
      "-framerate",
      String(outFps),
      "-i",
      path.join(outDir, "%08d.png"),
    ];
    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
      encodeArgs.push("-i", audioPath, "-c:a", "aac", "-shortest");
    }
    encodeArgs.push(
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "18",
      output,
    );

    await execFileAsync("ffmpeg", encodeArgs, {
      env: ffmpegEnv(),
      maxBuffer: 64 * 1024 * 1024,
    });

    return {
      input,
      output,
      multi,
      model,
      engine: "rife-ncnn-vulkan",
      inputFps: meta.fps,
      outputFps: outFps,
      duration: meta.duration,
      bytes: fs.statSync(output).size,
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function interpolateWithPracticalRife(
  input: string,
  output: string,
  multi: RifeMulti,
  model: RifeModel,
  scale: number,
): Promise<InterpolateResult | null> {
  const rifeDir =
    process.env.PRACTICAL_RIFE_DIR ||
    path.resolve(process.cwd(), "bin/practical-rife");
  const script = path.join(rifeDir, "inference_video.py");
  if (!fs.existsSync(script)) return null;

  const meta = await probeVideo(input);
  try {
    await execFileAsync(
      "python3",
      [
        script,
        `--multi=${multi}`,
        `--video=${input}`,
        `--output=${output}`,
        `--scale=${scale}`,
      ],
      {
        cwd: rifeDir,
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      },
    );
  } catch (err) {
    console.warn(
      `Practical-RIFE failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  if (!fs.existsSync(output)) return null;
  return {
    input,
    output,
    multi,
    model,
    engine: "practical-rife",
    inputFps: meta.fps,
    outputFps: meta.fps * multi,
    duration: meta.duration,
    bytes: fs.statSync(output).size,
  };
}

async function interpolateWithFfmpeg(
  input: string,
  output: string,
  multi: RifeMulti,
  model: RifeModel,
): Promise<InterpolateResult> {
  const meta = await probeVideo(input);
  const outFps = meta.fps * multi;
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-filter:v",
      `minterpolate=fps=${outFps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
      "-c:a",
      "copy",
      output,
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  ).catch(async () => {
    // Simpler fps filter if minterpolate isn't built in.
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-filter:v",
        `fps=${outFps}`,
        "-c:a",
        "copy",
        output,
      ],
      { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
    );
  });

  return {
    input,
    output,
    multi,
    model,
    engine: "ffmpeg",
    inputFps: meta.fps,
    outputFps: outFps,
    duration: meta.duration,
    bytes: fs.statSync(output).size,
  };
}

/**
 * Interpolate a video (Practical-RIFE --multi semantics).
 * Prefers rife-ncnn-vulkan, then Practical-RIFE python, then ffmpeg.
 */
export async function interpolateVideo(
  url: string,
  options: InterpolateOptions = {},
): Promise<InterpolateResult> {
  const multi = ([2, 4, 8].includes(options.multi ?? 2)
    ? options.multi
    : 2) as RifeMulti;
  const model = options.model ?? "rife-v4";
  const scale = options.scale ?? 1;
  const input = resolveVideo(url);
  const output = path.resolve(options.output ?? defaultOutput(input, multi));
  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (!options.fallback) {
    const viaNcnn = await interpolateWithNcnn(input, output, multi, model);
    if (viaNcnn) return viaNcnn;

    const viaPy = await interpolateWithPracticalRife(
      input,
      output,
      multi,
      model,
      scale,
    );
    if (viaPy) return viaPy;
  }

  return interpolateWithFfmpeg(input, output, multi, model);
}

/** Alias matching README wording. */
export const interpolate = interpolateVideo;
