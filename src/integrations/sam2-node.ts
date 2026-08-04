/**
 * Node-only SAM 2 segmentation / tracking. Do not import from Remotion scenes.
 */

import { execFile, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import { removeBackground } from "./background-removal";
import type {
  Sam2Model,
  Sam2Point,
  SegmentObjectOptions,
  SegmentObjectResult,
  TrackObjectOptions,
  TrackObjectResult,
} from "./sam2";

const execFileAsync = promisify(execFile);

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
  };
}

function resolveMedia(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
    path.resolve(process.cwd(), "out", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Media not found: ${url}`);
}

function defaultPoints(): Sam2Point[] {
  return [{ x: 0.5, y: 0.45, label: 1 }];
}

function toPixelPoints(
  points: Sam2Point[],
  width: number,
  height: number,
  normalized?: boolean,
): Sam2Point[] {
  const treatAsNorm =
    normalized ||
    points.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  if (!treatAsNorm) return points;
  return points.map((p) => ({
    ...p,
    x: Math.round(p.x * width),
    y: Math.round(p.y * height),
  }));
}

function findSam2Python(): { python: string; root: string } | null {
  const candidates = [
    process.env.SAM2_DIR,
    path.resolve(process.cwd(), "bin/sam2"),
    path.resolve(process.cwd(), "bin/SAM2"),
  ].filter(Boolean) as string[];

  for (const root of candidates) {
    const marker = path.join(root, "sam2", "build_sam.py");
    const markerAlt = path.join(root, "sam2", "__init__.py");
    if (fs.existsSync(marker) || fs.existsSync(markerAlt)) {
      return { python: "python3", root };
    }
  }

  const probe = spawnSync(
    "python3",
    ["-c", "import sam2; print(sam2.__file__)"],
    { encoding: "utf8" },
  );
  if (probe.status === 0 && probe.stdout?.trim()) {
    const file = probe.stdout.trim();
    return { python: "python3", root: path.resolve(path.dirname(file), "..") };
  }
  return null;
}

function writeSam2ImageScript(tmp: string): string {
  const script = path.join(tmp, "vanta_sam2_image.py");
  fs.writeFileSync(
    script,
    `#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
import numpy as np

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True)
    p.add_argument("--mask", required=True)
    p.add_argument("--points", required=True)
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--config", required=True)
    args = p.parse_args()

    try:
        import torch
        from PIL import Image
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
    except Exception as e:
        print(f"sam2 import failed: {e}", file=sys.stderr)
        sys.exit(2)

    points = json.loads(args.points)
    coords = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.float32)
    labels = np.array([pt["label"] for pt in points], dtype=np.int32)

    image = np.array(Image.open(args.image).convert("RGB"))
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    predictor = SAM2ImagePredictor(build_sam2(args.config, args.checkpoint, device=device))

    with torch.inference_mode():
        predictor.set_image(image)
        masks, scores, _ = predictor.predict(
            point_coords=coords,
            point_labels=labels,
            multimask_output=True,
        )
    best = int(np.argmax(scores))
    mask = (masks[best] * 255).astype(np.uint8)
    Image.fromarray(mask, mode="L").save(args.mask)
    print(args.mask)

if __name__ == "__main__":
    main()
`,
  );
  return script;
}

async function alphaToMask(
  cutoutPath: string,
  maskPath: string,
): Promise<{ width: number; height: number }> {
  const { data, info } = await sharp(cutoutPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
    mask[p] = data[i + 3] ?? 0;
  }

  await sharp(mask, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toFile(maskPath);

  return { width: info.width, height: info.height };
}

async function applyMaskCutout(
  input: string,
  maskPath: string,
  cutoutPath: string,
): Promise<void> {
  const image = sharp(input).ensureAlpha();
  const meta = await image.metadata();
  const mask = await sharp(maskPath)
    .resize(meta.width, meta.height, { fit: "fill" })
    .ensureAlpha()
    .toBuffer();

  // Use mask as alpha channel.
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const maskData = await sharp(mask)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, p = 0, m = 0; i < out.length; i += 4, p += info.channels, m++) {
    out[i] = data[p] ?? 0;
    out[i + 1] = data[p + 1] ?? 0;
    out[i + 2] = data[p + 2] ?? 0;
    out[i + 3] = maskData.data[m] ?? 0;
  }

  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(cutoutPath);
}

async function segmentWithSam2(
  input: string,
  maskPath: string,
  points: Sam2Point[],
  model: Sam2Model,
): Promise<SegmentObjectResult | null> {
  const py = findSam2Python();
  if (!py) return null;

  const checkpoint =
    process.env.SAM2_CHECKPOINT ||
    path.join(py.root, "checkpoints", `${model}.pt`);
  const configMap: Record<Sam2Model, string> = {
    "sam2.1_hiera_tiny": "configs/sam2.1/sam2.1_hiera_t.yaml",
    "sam2.1_hiera_small": "configs/sam2.1/sam2.1_hiera_s.yaml",
    "sam2.1_hiera_base_plus": "configs/sam2.1/sam2.1_hiera_b+.yaml",
    "sam2.1_hiera_large": "configs/sam2.1/sam2.1_hiera_l.yaml",
  };
  const config = path.join(py.root, configMap[model]);
  if (!fs.existsSync(checkpoint) || !fs.existsSync(config)) {
    console.warn(
      `SAM2 checkpoint/config missing (${checkpoint}). Set SAM2_DIR + download checkpoints.`,
    );
    return null;
  }

  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const pixelPoints = toPixelPoints(points, width, height, true);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-sam2-"));
  try {
    const script = writeSam2ImageScript(tmp);
    await execFileAsync(
      py.python,
      [
        script,
        "--image",
        input,
        "--mask",
        maskPath,
        "--points",
        JSON.stringify(pixelPoints),
        "--checkpoint",
        checkpoint,
        "--config",
        config,
      ],
      {
        cwd: py.root,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PYTHONPATH: py.root },
      },
    );
  } catch (err) {
    console.warn(
      `SAM2 inference failed: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (!fs.existsSync(maskPath)) return null;
  return {
    input,
    mask: maskPath,
    points: pixelPoints,
    model,
    engine: "sam2",
    width,
    height,
    bytes: fs.statSync(maskPath).size,
  };
}

async function segmentWithImgly(
  input: string,
  maskPath: string,
  cutoutPath: string | undefined,
  points: Sam2Point[],
  model: Sam2Model,
): Promise<SegmentObjectResult> {
  const tmpCutout =
    cutoutPath ??
    path.join(os.tmpdir(), `vanta-sam2-cutout-${Date.now()}.png`);
  await removeBackground(input, { outputPath: tmpCutout });
  const size = await alphaToMask(tmpCutout, maskPath);
  if (cutoutPath) {
    // already written by removeBackground
  } else {
    fs.rmSync(tmpCutout, { force: true });
  }

  const meta = await sharp(input).metadata();
  const pixelPoints = toPixelPoints(
    points,
    meta.width ?? size.width,
    meta.height ?? size.height,
  );

  return {
    input,
    mask: maskPath,
    cutout: cutoutPath,
    points: pixelPoints,
    model,
    engine: "imgly",
    width: size.width,
    height: size.height,
    bytes: fs.statSync(maskPath).size,
  };
}

/**
 * Segment an object in a still image from click points (SAM 2 API shape).
 */
export async function segmentObject(
  url: string,
  options: SegmentObjectOptions = {},
): Promise<SegmentObjectResult> {
  const input = resolveMedia(url);
  const model = options.model ?? "sam2.1_hiera_tiny";
  const points = options.points?.length ? options.points : defaultPoints();
  const maskPath = path.resolve(
    options.output ??
      path.join(
        process.cwd(),
        "public",
        `${path.basename(input, path.extname(input))}-mask.png`,
      ),
  );
  const cutoutPath = options.cutout
    ? path.resolve(options.cutout)
    : undefined;
  fs.mkdirSync(path.dirname(maskPath), { recursive: true });
  if (cutoutPath) fs.mkdirSync(path.dirname(cutoutPath), { recursive: true });

  if (!options.fallback) {
    const viaSam = await segmentWithSam2(input, maskPath, points, model);
    if (viaSam) {
      if (cutoutPath) {
        await applyMaskCutout(input, maskPath, cutoutPath);
        viaSam.cutout = cutoutPath;
      }
      return viaSam;
    }
    console.warn(
      "SAM2 not installed — using imgly subject mask. Set SAM2_DIR + checkpoints for real SAM 2.",
    );
  }

  return segmentWithImgly(input, maskPath, cutoutPath, points, model);
}

/**
 * Track a clicked object across video frames (roto-brush style).
 */
export async function trackObject(
  url: string,
  options: TrackObjectOptions = {},
): Promise<TrackObjectResult> {
  const input = resolveMedia(url);
  const model = options.model ?? "sam2.1_hiera_tiny";
  const points = options.points?.length ? options.points : defaultPoints();
  const frame = options.frame ?? 0;
  const maxFrames = options.maxFrames ?? 48;
  const outputDir = path.resolve(
    options.outputDir ?? path.join(process.cwd(), "public/generated/sam2"),
  );
  const maskDir = path.join(outputDir, "masks");
  const frameDir = path.join(outputDir, "frames");
  fs.mkdirSync(maskDir, { recursive: true });
  fs.mkdirSync(frameDir, { recursive: true });

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      input,
      "-vf",
      "scale='min(iw,960)':-2",
      "-frames:v",
      String(maxFrames),
      path.join(frameDir, "frame_%08d.png"),
    ],
    { env: ffmpegEnv(), maxBuffer: 64 * 1024 * 1024 },
  );

  const frames = fs
    .readdirSync(frameDir)
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (frames.length === 0) {
    throw new Error("No frames extracted for tracking");
  }

  let engine: "sam2" | "imgly" = "imgly";
  let width = 0;
  let height = 0;
  const useSam = !options.fallback && sam2Available();

  if (!useSam && !options.fallback) {
    console.warn(
      "SAM2 not installed — tracking with imgly per-frame subject masks. Set SAM2_DIR + checkpoints for real SAM 2 video tracking.",
    );
  }

  for (let i = 0; i < frames.length; i++) {
    const framePath = path.join(frameDir, frames[i]!);
    const maskPath = path.join(maskDir, frames[i]!);
    const result = useSam
      ? await segmentObject(framePath, {
          points,
          normalized: options.normalized ?? true,
          output: maskPath,
          model,
        })
      : await segmentWithImgly(framePath, maskPath, undefined, points, model);
    engine = result.engine;
    width = result.width;
    height = result.height;
    if ((i + 1) % 8 === 0 || i === frames.length - 1) {
      process.stdout.write(`\rMasked ${i + 1}/${frames.length}`);
    }
  }
  process.stdout.write("\n");

  // Build a simple masked preview (white silhouette on dark).
  const preview = path.join(outputDir, "preview.mp4");
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "12",
      "-i",
      path.join(maskDir, "frame_%08d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      preview,
    ],
    { env: ffmpegEnv(), maxBuffer: 32 * 1024 * 1024 },
  ).catch(() => undefined);

  return {
    input,
    outputDir,
    maskDir,
    preview: fs.existsSync(preview) ? preview : undefined,
    points: toPixelPoints(
      points,
      width || 1,
      height || 1,
      options.normalized,
    ),
    frame,
    model,
    engine,
    frameCount: frames.length,
    width,
    height,
  };
}

export function sam2Available(): boolean {
  return findSam2Python() !== null;
}
