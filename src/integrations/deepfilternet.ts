/**
 * VIBZ MEDIA — Audio Denoise (DeepFilterNet)
 *
 * Studio-grade speech enhancement via the portable `deep-filter` Rust binary.
 * Falls back to ffmpeg spectral denoise when the binary isn't available.
 *
 * Usage:
 *   import { denoiseAudio } from "./integrations/deepfilternet-node";
 *
 *   const result = await denoiseAudio("./public/voiceover.wav", {
 *     output: "./public/voiceover-clean.wav",
 *     postFilter: true,
 *   });
 *   // <Audio src={staticFile("voiceover-clean.wav")} />
 *
 * Repos:
 *   - https://github.com/Rikorose/DeepFilterNet
 */

export type DeepFilterModel = "DeepFilterNet" | "DeepFilterNet2" | "DeepFilterNet3";

export interface DenoiseAudioOptions {
  /** Output wav path. Default: public/<base>-clean.wav */
  output?: string;
  /** Enable DeepFilterNet post-filter (--pf). */
  postFilter?: boolean;
  /** Compensate STFT/model delay (-D). */
  compensateDelay?: boolean;
  /** Optional path to a model tar.gz (-m). */
  modelPath?: string;
  /** Force ffmpeg fallback. */
  fallback?: boolean;
}

export interface DenoiseAudioResult {
  input: string;
  output: string;
  /** Path relative to public/ for staticFile() */
  file: string;
  engine: "deep-filter" | "ffmpeg";
  sampleRate: number;
  durationSec?: number;
  bytes: number;
}

export const DEEP_FILTER_VERSION = "0.5.6";
