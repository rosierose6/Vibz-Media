/**
 * VIBZ MEDIA — Background Removal Integration
 *
 * Local background removal via @imgly/background-removal-node (ONNX).
 * No cloud API — runs on your machine and writes a transparent PNG.
 *
 * Usage:
 *   const result = await removeBackground("./presenter-photo.jpg");
 *   // result.url is a transparent PNG — composite over any background
 *   // <Img src={result.url} /> layered over your Remotion scene
 *
 * Repo: https://github.com/imgly/background-removal-js
 */

import fs from "fs";
import path from "path";
import {
  removeBackground as imglyRemoveBackground,
  type Config,
} from "@imgly/background-removal-node";

export interface BackgroundRemovalResult {
  /** Absolute path or object URL of the transparent PNG */
  url: string;
  width: number;
  height: number;
}

export interface BackgroundRemovalOptions {
  /** Optional imgly config (model, output, etc.) */
  config?: Config;
  /**
   * When set, write the cutout PNG here instead of only returning a temp path.
   * Prefer this for Remotion (`public/cutout.png` → staticFile).
   */
  outputPath?: string;
}

function readPngSize(buffer: Buffer): { width: number; height: number } {
  if (
    buffer.length >= 24 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  return { width: 0, height: 0 };
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

/**
 * Remove the background from an image file or Blob.
 * Returns a transparent PNG path (and dimensions when available).
 */
export async function removeBackground(
  imageSource: string | Blob,
  options: BackgroundRemovalOptions = {},
): Promise<BackgroundRemovalResult> {
  const source =
    typeof imageSource === "string" ? path.resolve(imageSource) : imageSource;

  if (typeof source === "string" && !fs.existsSync(source)) {
    throw new Error(
      `Image not found: ${source}\nPlace a photo at public/presenter-photo.jpg`,
    );
  }

  const blob = await imglyRemoveBackground(source, options.config);
  const buffer = await blobToBuffer(blob);
  const { width, height } = readPngSize(buffer);

  const absoluteOut = path.resolve(
    options.outputPath ??
      path.join(
        process.cwd(),
        "public",
        `cutout-${Date.now()}.png`,
      ),
  );
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
  fs.writeFileSync(absoluteOut, buffer);

  return {
    url: absoluteOut,
    width,
    height,
  };
}
