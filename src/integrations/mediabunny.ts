/**
 * VIBZ MEDIA — Media Processing Integration (mediabunny)
 *
 * Pure-TypeScript mux/demux/convert helpers. Node I/O lives in
 * mediabunny-node.ts (do not import that from Remotion scenes).
 *
 * Usage:
 *   import { inspectMedia, convertMedia } from "./integrations/mediabunny-node";
 *
 *   const meta = await inspectMedia("./public/ai-clip.mp4");
 *   // { duration, video: { width, height, codec }, audio? }
 *
 *   const out = await convertMedia("./public/ai-clip.mp4", {
 *     format: "webm",
 *     outPath: "./public/generated/ai-clip.webm",
 *   });
 *
 * Repos:
 *   - https://github.com/Vanilagy/mediabunny — TS media toolkit
 */

export type MediaContainerFormat = "mp4" | "webm" | "mov" | "wav" | "mp3";

export interface MediaVideoTrackInfo {
  width: number;
  height: number;
  codedWidth: number;
  codedHeight: number;
  rotation: number;
  codec: string | null;
  canDecode: boolean;
}

export interface MediaAudioTrackInfo {
  sampleRate: number;
  channels: number;
  codec: string | null;
  canDecode: boolean;
}

export interface MediaInfo {
  url: string;
  duration: number;
  format: string | null;
  video: MediaVideoTrackInfo | null;
  audio: MediaAudioTrackInfo | null;
  tags: Record<string, string>;
  engine: "mediabunny";
}

export interface ConvertMediaOptions {
  format?: MediaContainerFormat;
  outPath?: string;
  /** Trim start (seconds). */
  start?: number;
  /** Trim end (seconds). */
  end?: number;
  /** Prefer transmux/copy when possible (ffmpeg fallback). */
  copy?: boolean;
}

export interface ConvertMediaResult {
  outPath: string;
  format: MediaContainerFormat;
  engine: "mediabunny" | "ffmpeg";
  bytes: number;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatResolution(
  video: MediaVideoTrackInfo | null | undefined,
): string {
  if (!video) return "—";
  return `${video.width}×${video.height}`;
}
