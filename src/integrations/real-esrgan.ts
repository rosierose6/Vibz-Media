/**
 * VIBZ MEDIA — Video / Image Upscaling (Real-ESRGAN ncnn Vulkan)
 *
 * 2×–4× super-resolution via the portable GPU binary.
 * Node I/O lives in real-esrgan-node.ts.
 *
 * Usage:
 *   import { upscaleImage } from "./integrations/real-esrgan-node";
 *
 *   const result = await upscaleImage("./public/presenter-photo.jpg", {
 *     scale: 4,
 *     model: "realesrgan-x4plus",
 *     output: "./public/presenter-upscaled.png",
 *   });
 *   // <Img src={staticFile("presenter-upscaled.png")} />
 *
 * Repos:
 *   - https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan
 *   - https://github.com/xinntao/Real-ESRGAN
 */

export type RealEsrganModel =
  | "realesr-animevideov3"
  | "realesrgan-x4plus"
  | "realesrgan-x4plus-anime"
  | "realesrnet-x4plus";

export type UpscaleScale = 2 | 3 | 4;

export interface UpscaleOptions {
  scale?: UpscaleScale;
  model?: RealEsrganModel;
  output?: string;
  /** Output format for the binary / sharp fallback. */
  format?: "png" | "jpg" | "webp";
  /** Force sharp Lanczos fallback even if the binary is present. */
  fallback?: boolean;
}

export interface UpscaleResult {
  input: string;
  output: string;
  scale: UpscaleScale;
  model: RealEsrganModel;
  engine: "realesrgan-ncnn-vulkan" | "sharp";
  width: number;
  height: number;
  bytes: number;
}

export const REAL_ESRGAN_MODELS: RealEsrganModel[] = [
  "realesr-animevideov3",
  "realesrgan-x4plus",
  "realesrgan-x4plus-anime",
  "realesrnet-x4plus",
];
