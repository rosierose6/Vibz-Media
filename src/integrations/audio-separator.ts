/**
 * VANTA — Stem Separation (python-audio-separator)
 *
 * Split mix audio into vocals / instrumental (and more) via UVR models.
 * Prefers the `audio-separator` CLI; falls back to ffmpeg mid-side isolation.
 *
 * Usage:
 *   import { separateStems } from "./integrations/audio-separator-node";
 *
 *   const result = await separateStems("./public/soundtrack.wav", {
 *     outputDir: "./public/generated/stems",
 *     outputFormat: "wav",
 *   });
 *   // <Audio src={staticFile("generated/stems/vocals.wav")} />
 *
 * Repos:
 *   - https://github.com/nomadkaraoke/python-audio-separator
 */

export type StemName =
  | "vocals"
  | "instrumental"
  | "drums"
  | "bass"
  | "guitar"
  | "piano"
  | "other"
  | string;

export interface SeparateStemsOptions {
  /** Model filename (auto-downloaded). Default: BS-Roformer Viperx. */
  model?: string;
  /** Directory for stem files. Default: public/generated/stems */
  outputDir?: string;
  /** wav | flac | mp3. Default wav (Remotion-friendly). */
  outputFormat?: "wav" | "flac" | "mp3";
  /** Model cache dir. Default: bin/audio-separator/models */
  modelDir?: string;
  /** Only emit one stem (e.g. "Vocals"). */
  singleStem?: string;
  /** Force ffmpeg mid-side fallback. */
  fallback?: boolean;
}

export interface StemFile {
  name: StemName;
  path: string;
  /** Path relative to public/ for staticFile() */
  file: string;
  bytes: number;
}

export interface SeparateStemsResult {
  input: string;
  outputDir: string;
  stems: StemFile[];
  model: string;
  engine: "audio-separator" | "ffmpeg-ms";
  durationSec?: number;
}

/** Default two-stem model (vocals + instrumental). */
export const DEFAULT_STEM_MODEL =
  "model_bs_roformer_ep_317_sdr_12.9755.ckpt";

/** Faster / smaller karaoke-oriented MDX model. */
export const FAST_STEM_MODEL = "UVR_MDXNET_KARA_2.onnx";

export const STEM_COLORS: Record<string, string> = {
  mix: "#94a3b8",
  vocals: "#f472b6",
  instrumental: "#38bdf8",
  drums: "#fb923c",
  bass: "#a78bfa",
  guitar: "#4ade80",
  piano: "#fbbf24",
  other: "#94a3b8",
};
