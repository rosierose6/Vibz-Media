/**
 * VANTA — Frame Interpolation (Practical-RIFE / RIFE ncnn Vulkan)
 *
 * 2×–4× FPS conversion and smooth slow-mo.
 * Node I/O lives in rife-node.ts.
 *
 * Usage:
 *   import { interpolateVideo } from "./integrations/rife-node";
 *
 *   const result = await interpolateVideo("./public/ai-clip.mp4", {
 *     multi: 2,
 *     output: "./public/generated/ai-clip-2x.mp4",
 *   });
 *   // <OffthreadVideo src={staticFile("generated/ai-clip-2x.mp4")} />
 *
 * Repos:
 *   - https://github.com/hzwer/Practical-RIFE
 *   - https://github.com/nihui/rife-ncnn-vulkan
 */

export type RifeMulti = 2 | 4 | 8;

export type RifeModel =
  | "rife-v4"
  | "rife-v2.3"
  | "rife-v2"
  | "rife-anime"
  | "rife-HD"
  | "rife-UHD";

export interface InterpolateOptions {
  /** Frame-rate multiplier (Practical-RIFE --multi). Default 2. */
  multi?: RifeMulti;
  /** Output path (.mp4). */
  output?: string;
  /** RIFE ncnn model folder name. Default rife-v4. */
  model?: RifeModel;
  /** Flow scale (Practical-RIFE --scale). 0.5 for 4K. */
  scale?: number;
  /** Force ffmpeg minterpolate even if RIFE binary is present. */
  fallback?: boolean;
}

export interface InterpolateResult {
  input: string;
  output: string;
  multi: RifeMulti;
  model: RifeModel;
  engine: "rife-ncnn-vulkan" | "practical-rife" | "ffmpeg";
  inputFps: number;
  outputFps: number;
  duration: number;
  bytes: number;
}

export const RIFE_MODELS: RifeModel[] = [
  "rife-v4",
  "rife-v2.3",
  "rife-v2",
  "rife-anime",
  "rife-HD",
  "rife-UHD",
];
