/**
 * VIBZ MEDIA — Scene Detection (PySceneDetect)
 *
 * Detect hard cuts / scene boundaries. Prefers the `scenedetect` CLI;
 * falls back to ffmpeg content-aware scene scoring.
 *
 * Usage:
 *   import { detectScenes } from "./integrations/pyscenedetect-node";
 *
 *   const result = await detectScenes("./public/ai-clip.mp4", {
 *     threshold: 27,
 *     split: true,
 *     outputDir: "./public/generated/scenes",
 *   });
 *   // result.scenes → [{ start, end, startFrame, endFrame }, ...]
 *
 * Repos:
 *   - https://github.com/Breakthrough/PySceneDetect
 */

export type SceneDetector =
  | "content"
  | "adaptive"
  | "threshold"
  | "hash"
  | "histogram";

export interface SceneCut {
  index: number;
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
  /** Path relative to public/ when split=true */
  file?: string;
  path?: string;
}

export interface DetectScenesOptions {
  /** ContentDetector threshold (default 27). Lower = more cuts. */
  threshold?: number;
  detector?: SceneDetector;
  /** Directory for split clips + thumbs. Default public/generated/scenes */
  outputDir?: string;
  /** Split video into per-scene clips via ffmpeg. */
  split?: boolean;
  /** Save a JPEG thumb for each scene start. */
  saveImages?: boolean;
  /** Min scene length in seconds (ffmpeg fallback). Default 0.4 */
  minSceneLen?: number;
  /** Force ffmpeg fallback. */
  fallback?: boolean;
}

export interface DetectScenesResult {
  input: string;
  outputDir: string;
  scenes: SceneCut[];
  detector: SceneDetector;
  threshold: number;
  engine: "scenedetect" | "ffmpeg";
  fps?: number;
  durationSec?: number;
}
