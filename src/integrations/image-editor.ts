/**
 * VANTA — Image Editor Integration
 *
 * Programmatic image editing via Sharp (libvips).
 *
 * Usage:
 *   import { processImage, FILTER_RECIPES } from "./integrations/image-editor";
 *
 *   await processImage("./photo.jpg", {
 *     resize: { width: 1920 },
 *     colorCorrect: FILTER_RECIPES.cinematic,
 *     sharpen: true,
 *     output: "./photo-graded.jpg",
 *   });
 *
 *   // Use in Remotion: <Img src={staticFile("photo-graded.jpg")} />
 *
 * Repo: https://github.com/lovell/sharp
 */

import fs from "fs";
import path from "path";
import sharp, { type OverlayOptions, type Sharp } from "sharp";

export interface ColorCorrection {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  temperature?: number;
  tint?: number;
  exposure?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  vibrance?: number;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  position?: "center" | "top" | "right" | "bottom" | "left";
}

export interface ProcessOptions {
  resize?: ResizeOptions;
  colorCorrect?: ColorCorrection;
  sharpen?: boolean | { sigma?: number; flat?: number; jagged?: number };
  blur?: number;
  grayscale?: boolean;
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  crop?: { left: number; top: number; width: number; height: number };
  overlay?: {
    src: string;
    position:
      | "center"
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right";
    opacity?: number;
  };
  format?: "jpeg" | "png" | "webp" | "avif" | "tiff";
  quality?: number;
  output?: string;
}

export interface ProcessResult {
  width: number;
  height: number;
  format: string;
  size: number;
  path?: string;
  buffer?: Buffer;
}

export type FilterPreset =
  | "none"
  | "clarendon"
  | "gingham"
  | "moon"
  | "lark"
  | "reyes"
  | "juno"
  | "slumber"
  | "aden"
  | "perpetua"
  | "ludwig"
  | "cinematic"
  | "noir"
  | "chrome"
  | "fade"
  | "warm-vintage"
  | "cool-blue"
  | "sepia";

export const FILTER_RECIPES: Record<FilterPreset, ColorCorrection> = {
  none: {},
  clarendon: {
    brightness: 1.15,
    contrast: 1.2,
    saturation: 1.35,
    vibrance: 1.3,
  },
  gingham: {
    brightness: 1.1,
    contrast: 0.9,
    saturation: 0.85,
    temperature: 15,
  },
  moon: {
    brightness: 1.1,
    saturation: 0,
    contrast: 1.1,
    temperature: -20,
    tint: -10,
  },
  lark: { brightness: 1.2, contrast: 0.95, saturation: 0.8 },
  reyes: {
    brightness: 1.1,
    contrast: 0.85,
    saturation: 0.75,
    temperature: 10,
  },
  juno: {
    brightness: 1.05,
    contrast: 1.1,
    saturation: 1.2,
    temperature: 20,
  },
  slumber: {
    brightness: 0.95,
    contrast: 1.05,
    saturation: 0.7,
    temperature: -5,
  },
  aden: {
    brightness: 1.2,
    contrast: 0.9,
    saturation: 0.85,
    temperature: 15,
    tint: 5,
  },
  perpetua: {
    brightness: 1.05,
    contrast: 0.95,
    saturation: 0.9,
    temperature: -15,
  },
  ludwig: {
    brightness: 1.05,
    contrast: 1.05,
    saturation: 0.9,
    temperature: 10,
  },
  cinematic: {
    brightness: 0.95,
    contrast: 1.25,
    saturation: 0.85,
    temperature: -10,
    tint: -5,
    shadows: 20,
    highlights: -15,
  },
  noir: { brightness: 1.0, contrast: 1.4, saturation: 0, vibrance: 0 },
  chrome: {
    brightness: 1.1,
    contrast: 1.15,
    saturation: 0.8,
    temperature: -25,
  },
  fade: {
    brightness: 1.15,
    contrast: 0.85,
    saturation: 0.7,
    blacks: 20,
  },
  "warm-vintage": {
    brightness: 1.05,
    contrast: 1.1,
    saturation: 0.9,
    temperature: 30,
    tint: 5,
  },
  "cool-blue": {
    brightness: 1.05,
    contrast: 1.1,
    saturation: 0.9,
    temperature: -30,
  },
  sepia: {
    brightness: 1.05,
    contrast: 1.1,
    saturation: 0.3,
    temperature: 40,
    tint: 10,
  },
};

function applyColorCorrection(pipeline: Sharp, cc: ColorCorrection): Sharp {
  let next = pipeline;

  const brightness =
    (cc.brightness ?? 1) * Math.pow(2, (cc.exposure ?? 0) * 0.35);
  const saturation = (cc.saturation ?? 1) * (cc.vibrance ?? 1);
  const hue = (cc.hue ?? 0) + (cc.temperature ?? 0) * 0.35 + (cc.tint ?? 0) * 0.2;

  next = next.modulate({
    brightness: Math.max(0.1, brightness),
    saturation: Math.max(0, saturation),
    hue,
  });

  if (cc.contrast !== undefined && cc.contrast !== 1) {
    next = next.linear(cc.contrast, -(128 * cc.contrast) + 128);
  }

  // Approximate shadow/highlight lift with mild gamma
  if (cc.shadows || cc.highlights || cc.blacks || cc.whites) {
    const shadows = (cc.shadows ?? 0) / 100;
    const highlights = (cc.highlights ?? 0) / 100;
    const blacks = (cc.blacks ?? 0) / 100;
    const gamma = Math.max(
      0.5,
      Math.min(3, 1 - shadows * 0.25 + highlights * 0.15 - blacks * 0.1),
    );
    next = next.gamma(gamma);
  }

  return next;
}

function overlayGravity(
  position: NonNullable<ProcessOptions["overlay"]>["position"],
): NonNullable<OverlayOptions["gravity"]> {
  switch (position) {
    case "top-left":
      return "northwest";
    case "top-right":
      return "northeast";
    case "bottom-left":
      return "southwest";
    case "bottom-right":
      return "southeast";
    default:
      return "centre";
  }
}

export async function processImage(
  input: string,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const absoluteInput = path.resolve(input);
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Image not found: ${absoluteInput}`);
  }

  let pipeline = sharp(absoluteInput).rotate(); // auto-orient

  if (options.crop) {
    pipeline = pipeline.extract(options.crop);
  }

  if (options.resize) {
    pipeline = pipeline.resize(options.resize.width, options.resize.height, {
      fit: options.resize.fit ?? "inside",
      position: options.resize.position ?? "center",
      withoutEnlargement: false,
    });
  }

  if (options.rotate) pipeline = pipeline.rotate(options.rotate);
  if (options.flip) pipeline = pipeline.flip();
  if (options.flop) pipeline = pipeline.flop();
  if (options.grayscale) pipeline = pipeline.grayscale();

  if (options.colorCorrect) {
    pipeline = applyColorCorrection(pipeline, options.colorCorrect);
  }

  if (options.blur && options.blur > 0) {
    pipeline = pipeline.blur(options.blur);
  }

  if (options.sharpen) {
    if (options.sharpen === true) {
      pipeline = pipeline.sharpen();
    } else {
      pipeline = pipeline.sharpen(options.sharpen);
    }
  }

  if (options.overlay) {
    const overlayPath = path.resolve(options.overlay.src);
    if (!fs.existsSync(overlayPath)) {
      throw new Error(`Overlay image not found: ${overlayPath}`);
    }
    let overlayInput: Buffer | string = overlayPath;
    if (options.overlay.opacity !== undefined && options.overlay.opacity < 1) {
      overlayInput = await sharp(overlayPath)
        .ensureAlpha()
        .linear(1, 0)
        .composite([
          {
            input: Buffer.from([
              0,
              0,
              0,
              Math.round(255 * Math.max(0, Math.min(1, options.overlay.opacity))),
            ]),
            raw: { width: 1, height: 1, channels: 4 },
            tile: true,
            blend: "dest-in",
          },
        ])
        .toBuffer();
    }
    pipeline = pipeline.composite([
      {
        input: overlayInput,
        gravity: overlayGravity(options.overlay.position),
      },
    ]);
  }

  const format = options.format ?? "jpeg";
  const quality = options.quality ?? 90;

  if (format === "jpeg") pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  else if (format === "png") pipeline = pipeline.png();
  else if (format === "webp") pipeline = pipeline.webp({ quality });
  else if (format === "avif") pipeline = pipeline.avif({ quality });
  else if (format === "tiff") pipeline = pipeline.tiff({ quality });

  if (options.output) {
    const absoluteOut = path.resolve(options.output);
    fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
    const info = await pipeline.toFile(absoluteOut);
    return {
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
      path: absoluteOut,
    };
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
    buffer: data,
  };
}

export async function batchProcess(
  inputDir: string,
  outputDir: string,
  options: Omit<ProcessOptions, "output">,
): Promise<{ processed: number; failed: number; totalSize: number }> {
  const absoluteIn = path.resolve(inputDir);
  const absoluteOut = path.resolve(outputDir);
  fs.mkdirSync(absoluteOut, { recursive: true });

  const files = fs
    .readdirSync(absoluteIn)
    .filter((f) => /\.(jpe?g|png|webp|tiff?|avif)$/i.test(f));

  let processed = 0;
  let failed = 0;
  let totalSize = 0;
  const ext = options.format ?? "jpeg";
  const extName = ext === "jpeg" ? "jpg" : ext;

  for (const file of files) {
    try {
      const input = path.join(absoluteIn, file);
      const output = path.join(
        absoluteOut,
        file.replace(/\.\w+$/, `.${extName}`),
      );
      const result = await processImage(input, { ...options, output });
      processed += 1;
      totalSize += result.size;
    } catch {
      failed += 1;
    }
  }

  return { processed, failed, totalSize };
}

// --- Lightweight composition helpers (project model) ---

export interface Layer {
  id: string;
  type: "image" | "text" | "shape" | "adjustment";
  src?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  name: string;
}

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export interface Composition {
  width: number;
  height: number;
  layers: Layer[];
  background: string;
}

export function createComposition(width: number, height: number): Composition {
  return {
    width,
    height,
    layers: [],
    background: "transparent",
  };
}

export function addLayer(
  composition: Composition,
  layer: Omit<Layer, "id">,
): Composition {
  const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...composition,
    layers: [...composition.layers, { ...layer, id }],
  };
}

export async function flattenToImage(
  composition: Composition,
  output?: string,
): Promise<ProcessResult> {
  const bg =
    composition.background === "transparent"
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : composition.background;

  let pipeline = sharp({
    create: {
      width: composition.width,
      height: composition.height,
      channels: 4,
      background: bg as sharp.Color,
    },
  });

  const overlays: OverlayOptions[] = [];
  for (const layer of composition.layers.filter((l) => l.visible && l.src)) {
    overlays.push({
      input: path.resolve(layer.src!),
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      blend: layer.blendMode === "normal" ? "over" : "over",
    });
  }

  if (overlays.length) {
    pipeline = pipeline.composite(overlays);
  }

  if (output) {
    const absoluteOut = path.resolve(output);
    fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
    const info = await pipeline.png().toFile(absoluteOut);
    return {
      width: info.width,
      height: info.height,
      format: info.format,
      size: info.size,
      path: absoluteOut,
    };
  }

  const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
    buffer: data,
  };
}
