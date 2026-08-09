/**
 * VIBZ MEDIA — Auto rough-cut (auto-editor)
 *
 * Cut silence / dead space from video or audio. Prefers the official
 * `auto-editor` binary; falls back to ffmpeg silence detection + trim.
 *
 * Usage:
 *   import { autoEdit } from "./integrations/auto-editor-node";
 *
 *   const result = await autoEdit("./public/ai-clip.mp4", {
 *     margin: "0.2sec",
 *     edit: "audio",
 *     output: "./public/generated/ai-clip-cut.mp4",
 *   });
 *   // <OffthreadVideo src={staticFile("generated/ai-clip-cut.mp4")} />
 *
 * Repos:
 *   - https://github.com/WyattBlue/auto-editor
 */

export interface CutSegment {
  start: number;
  end: number;
}

export interface AutoEditOptions {
  /** Padding around kept clips. Default "0.2sec". */
  margin?: string;
  /** Edit method. Default "audio:threshold=0.04". */
  edit?: string;
  /** Output media path. */
  output?: string;
  /** Export NLE timeline alongside the media (premiere, resolve, …). */
  exportTimeline?:
    | "premiere"
    | "resolve"
    | "final-cut-pro"
    | "shotcut"
    | "kdenlive"
    | "clip-sequence";
  /** Silence threshold in dB for ffmpeg fallback (e.g. -30). */
  silenceDb?: number;
  /** Min silence duration (sec) for ffmpeg fallback. Default 0.35. */
  minSilenceSec?: number;
  /** Force ffmpeg fallback. */
  fallback?: boolean;
}

export interface AutoEditResult {
  input: string;
  output: string;
  /** Path relative to public/ for staticFile() */
  file: string;
  engine: "auto-editor" | "ffmpeg";
  margin: string;
  edit: string;
  inputDurationSec?: number;
  outputDurationSec?: number;
  keptSegments: CutSegment[];
  timelinePath?: string;
  bytes: number;
}

export const AUTO_EDITOR_VERSION = "31.4.2";
export const DEFAULT_EDIT = "audio";
export const DEFAULT_MARGIN = "0.2sec";
