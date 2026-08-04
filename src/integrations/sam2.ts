/**
 * VANTA — Rotoscoping / Object Masks (SAM 2)
 *
 * Click an object, get a mask (and track it across video frames).
 * Prefers Meta SAM 2 when installed; falls back to local subject
 * segmentation via @imgly/background-removal-node.
 *
 * Usage:
 *   import { segmentObject, trackObject } from "./integrations/sam2-node";
 *
 *   const mask = await segmentObject("./public/presenter-photo.jpg", {
 *     points: [{ x: 512, y: 640, label: 1 }],
 *     output: "./public/presenter-mask.png",
 *   });
 *
 *   const tracked = await trackObject("./public/ai-clip.mp4", {
 *     points: [{ x: 640, y: 360, label: 1 }],
 *     frame: 0,
 *     outputDir: "./public/generated/sam2",
 *   });
 *
 * Repos:
 *   - https://github.com/facebookresearch/sam2
 */

export type Sam2PointLabel = 0 | 1; // 0 = background, 1 = foreground

export interface Sam2Point {
  /** Pixel x (or 0–1 if normalized=true). */
  x: number;
  /** Pixel y (or 0–1 if normalized=true). */
  y: number;
  label: Sam2PointLabel;
}

export type Sam2Model =
  | "sam2.1_hiera_tiny"
  | "sam2.1_hiera_small"
  | "sam2.1_hiera_base_plus"
  | "sam2.1_hiera_large";

export interface SegmentObjectOptions {
  points?: Sam2Point[];
  /** Treat point coords as 0–1 fractions of width/height. */
  normalized?: boolean;
  output?: string;
  /** Also write a cutout PNG (RGB + alpha). */
  cutout?: string;
  model?: Sam2Model;
  fallback?: boolean;
}

export interface SegmentObjectResult {
  input: string;
  mask: string;
  cutout?: string;
  points: Sam2Point[];
  model: Sam2Model;
  engine: "sam2" | "imgly";
  width: number;
  height: number;
  bytes: number;
}

export interface TrackObjectOptions {
  points?: Sam2Point[];
  normalized?: boolean;
  /** Frame index to place the initial click (default 0). */
  frame?: number;
  outputDir?: string;
  model?: Sam2Model;
  /** Cap frames processed (fallback speed). Default 48. */
  maxFrames?: number;
  fallback?: boolean;
}

export interface TrackObjectResult {
  input: string;
  outputDir: string;
  maskDir: string;
  preview?: string;
  points: Sam2Point[];
  frame: number;
  model: Sam2Model;
  engine: "sam2" | "imgly";
  frameCount: number;
  width: number;
  height: number;
}

export const SAM2_MODELS: Sam2Model[] = [
  "sam2.1_hiera_tiny",
  "sam2.1_hiera_small",
  "sam2.1_hiera_base_plus",
  "sam2.1_hiera_large",
];
