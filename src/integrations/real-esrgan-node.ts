/**
 * Node-only Real-ESRGAN upscaler. Do not import from Remotion scenes.
 */

import { execFile, execFileSync } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import type {
  RealEsrganModel,
  UpscaleOptions,
  UpscaleResult,
  UpscaleScale,
} from "./real-esrgan";

const execFileAsync = promisify(execFile);

// Full portable builds (binary + models) ship from the Real-ESRGAN repo.
const RELEASE_TAG = "v0.2.5.0";
const RELEASE_BASE =
  "https://github.com/xinntao/Real-ESRGAN/releases/download";

function binRoot(): string {
  return path.resolve(process.cwd(), "bin/realesrgan-ncnn-vulkan");
}

function binaryName(): string {
  return process.platform === "win32"
    ? "realesrgan-ncnn-vulkan.exe"
    : "realesrgan-ncnn-vulkan";
}

function resolveInput(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Image not found: ${url}`);
}

function defaultOutput(
  input: string,
  scale: UpscaleScale,
  format: "png" | "jpg" | "webp",
): string {
  const base = path.basename(input, path.extname(input));
  return path.resolve(
    process.cwd(),
    "public",
    `${base}-upscaled-${scale}x.${format === "jpg" ? "jpg" : format}`,
  );
}

function platformZip(): string {
  switch (process.platform) {
    case "darwin":
      return "realesrgan-ncnn-vulkan-20220424-macos.zip";
    case "linux":
      return "realesrgan-ncnn-vulkan-20220424-ubuntu.zip";
    case "win32":
      return "realesrgan-ncnn-vulkan-20220424-windows.zip";
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

/** Download + extract the portable binary into bin/ if missing. */
export async function ensureRealEsrganBinary(): Promise<string> {
  const existing = findBinary();
  if (existing) return existing;

  const zip = platformZip();
  const root = binRoot();
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const zipPath = path.join(os.tmpdir(), zip);
  const url = `${RELEASE_BASE}/${RELEASE_TAG}/${zip}`;

  console.log(`Downloading Real-ESRGAN ${RELEASE_TAG} (${zip})…`);
  await download(url, zipPath);

  const extractDir = path.join(os.tmpdir(), `realesrgan-${RELEASE_TAG}`);
  fs.rmSync(extractDir, { recursive: true, force: true });
  await unzip(zipPath, extractDir);

  // Zip layout varies; hunt for the binary + models folder.
  const stack = [extractDir];
  let foundBin: string | null = null;
  let foundModels: string | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (entry === "models") foundModels = full;
        stack.push(full);
      } else if (entry === binaryName() || entry === "realesrgan-ncnn-vulkan.exe") {
        foundBin = full;
      }
    }
  }

  if (!foundBin) {
    throw new Error(`Could not find ${binaryName()} in ${zip}`);
  }

  fs.copyFileSync(foundBin, path.join(root, binaryName()));
  fs.chmodSync(path.join(root, binaryName()), 0o755);

  if (foundModels) {
    const modelsDest = path.join(root, "models");
    fs.mkdirSync(modelsDest, { recursive: true });
    for (const f of fs.readdirSync(foundModels)) {
      fs.copyFileSync(path.join(foundModels, f), path.join(modelsDest, f));
    }
  } else {
    throw new Error(`No models/ folder in ${zip}`);
  }

  // Copy sibling dylibs / dlls next to binary if present.
  const binDir = path.dirname(foundBin);
  for (const f of fs.readdirSync(binDir)) {
    if (/\.(dylib|so|dll)$/i.test(f)) {
      fs.copyFileSync(path.join(binDir, f), path.join(root, f));
    }
  }

  return path.join(root, binaryName());
}

async function upscaleWithBinary(
  input: string,
  output: string,
  scale: UpscaleScale,
  model: RealEsrganModel,
  format: "png" | "jpg" | "webp",
): Promise<UpscaleResult | null> {
  let bin: string;
  try {
    bin = await ensureRealEsrganBinary();
  } catch (err) {
    console.warn(
      `Real-ESRGAN binary unavailable: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  const modelPath = path.join(path.dirname(bin), "models");
  const args = [
    "-i",
    input,
    "-o",
    output,
    "-s",
    String(scale),
    "-n",
    model,
    "-f",
    format === "jpg" ? "jpg" : format,
  ];
  if (fs.existsSync(modelPath)) {
    args.push("-m", modelPath);
  }

  try {
    const { stderr } = await execFileAsync(bin, args, {
      maxBuffer: 32 * 1024 * 1024,
      env: process.env,
    });
    if (stderr && String(stderr).trim()) {
      console.warn(String(stderr).trim());
    }
  } catch (err) {
    const detail =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: Buffer | string }).stderr)
        : err instanceof Error
          ? err.message
          : String(err);
    console.warn(
      `realesrgan-ncnn-vulkan failed, falling back to sharp: ${detail.trim()}`,
    );
    return null;
  }

  if (!fs.existsSync(output)) return null;
  const meta = await sharp(output).metadata();
  return {
    input,
    output,
    scale,
    model,
    engine: "realesrgan-ncnn-vulkan",
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    bytes: fs.statSync(output).size,
  };
}

async function upscaleWithSharp(
  input: string,
  output: string,
  scale: UpscaleScale,
  model: RealEsrganModel,
  format: "png" | "jpg" | "webp",
): Promise<UpscaleResult> {
  const image = sharp(input);
  const meta = await image.metadata();
  const width = Math.round((meta.width ?? 1) * scale);
  const height = Math.round((meta.height ?? 1) * scale);

  let pipeline = image.resize({
    width,
    height,
    kernel: "lanczos3",
    fit: "fill",
  });

  if (format === "jpg") {
    pipeline = pipeline.jpeg({ quality: 92 });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality: 92 });
  } else {
    pipeline = pipeline.png();
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await pipeline.toFile(output);

  return {
    input,
    output,
    scale,
    model,
    engine: "sharp",
    width,
    height,
    bytes: fs.statSync(output).size,
  };
}

/**
 * Upscale an image with Real-ESRGAN (GPU binary) or sharp Lanczos fallback.
 */
export async function upscaleImage(
  url: string,
  options: UpscaleOptions = {},
): Promise<UpscaleResult> {
  const scale = options.scale ?? 4;
  const model = options.model ?? "realesrgan-x4plus";
  const format = options.format ?? "png";
  const input = resolveInput(url);
  const output = path.resolve(
    options.output ?? defaultOutput(input, scale, format),
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (!options.fallback) {
    const viaGpu = await upscaleWithBinary(input, output, scale, model, format);
    if (viaGpu) return viaGpu;
  }

  return upscaleWithSharp(input, output, scale, model, format);
}

/** Alias for README / Topaz-replacement wording. */
export const upscale = upscaleImage;

export function listRealEsrganModels(): RealEsrganModel[] {
  return [
    "realesr-animevideov3",
    "realesrgan-x4plus",
    "realesrgan-x4plus-anime",
    "realesrnet-x4plus",
  ];
}
