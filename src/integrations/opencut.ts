/**
 * VIBZ MEDIA — OpenCut Integration
 *
 * Bridge between [OpenCut](https://github.com/OpenCut-app/OpenCut) (MIT CapCut
 * alternative) project JSON and the Vibz programmatic editor → Remotion.
 *
 * OpenCut itself is a standalone web/desktop editor (currently being rewritten).
 * We do not vendor the UI — we import/export a portable `.opencut.json` timeline
 * and render it with Remotion via `video-editor.ts`.
 *
 * Usage:
 *   import { importOpenCut, exportOpenCut, opencutToRemotionProps } from "./opencut";
 *   const project = importOpenCut(json);
 *   const props = opencutToRemotionProps(json);
 *
 * Run:
 *   npm run opencut
 *   npm run opencut -- --import ./my-edit.opencut.json
 *   npm run render:opencut
 *
 * Upstream:
 *   - https://github.com/OpenCut-app/OpenCut — MIT, CapCut alternative
 *   - Classic (runnable today): https://github.com/opencut-app/opencut-classic
 *   - Live: https://opencut.app
 */

import {
  createEditor,
  projectToRemotionProps,
  type EditorProject,
  type EditorTrack,
  type EditorTrackType,
  type RemotionEditorProps,
} from "./video-editor";

export const OPENCUT_REPO = "https://github.com/OpenCut-app/OpenCut";
export const OPENCUT_APP = "https://opencut.app";
export const OPENCUT_SCHEMA_VERSION = 1 as const;

export interface OpenCutMediaEntry {
  mediaId: string;
  filename: string;
  type: "video" | "audio" | "image" | "unknown" | string;
  size?: number;
  width?: number;
  height?: number;
  /** Duration in milliseconds when known. */
  duration?: number;
}

export interface OpenCutElement {
  id: string;
  type: EditorTrackType | string;
  mediaId?: string;
  src?: string;
  text?: string;
  /** Timeline start in milliseconds. */
  startMs: number;
  /** Timeline end in milliseconds. */
  endMs: number;
  layer?: number;
  properties?: EditorTrack["properties"];
}

export interface OpenCutTrack {
  id: string;
  type: EditorTrackType | string;
  name?: string;
  elements: OpenCutElement[];
}

export interface OpenCutProjectBody {
  name?: string;
  fps?: number;
  width?: number;
  height?: number;
  tracks: OpenCutTrack[];
}

/**
 * Portable OpenCut-style export (inspired by OpenCut JSON export/import).
 * Media binaries are not embedded — only filenames / mediaIds.
 */
export interface OpenCutDocument {
  schema_version: number;
  exported_at: string;
  source?: string;
  project: OpenCutProjectBody;
  media: OpenCutMediaEntry[];
}

function msToFrame(ms: number, fps: number): number {
  return Math.max(0, Math.round((ms / 1000) * fps));
}

function frameToMs(frame: number, fps: number): number {
  return Math.round((frame / fps) * 1000);
}

function asTrackType(value: string | undefined): EditorTrackType {
  switch (value) {
    case "video":
    case "audio":
    case "image":
    case "text":
    case "caption":
      return value;
    default:
      return "video";
  }
}

function resolveSrc(
  element: OpenCutElement,
  mediaById: Map<string, OpenCutMediaEntry>,
): string | undefined {
  if (element.src) return element.src.replace(/^\.?\/?public\//, "");
  if (element.mediaId) {
    const entry = mediaById.get(element.mediaId);
    if (entry?.filename) return entry.filename.replace(/^\.?\/?public\//, "");
  }
  return undefined;
}

/** Convert an OpenCut document into a Vibz EditorProject. */
export function importOpenCut(doc: OpenCutDocument): EditorProject {
  if (!doc?.project?.tracks) {
    throw new Error("Invalid OpenCut document: missing project.tracks");
  }

  const fps = doc.project.fps ?? 30;
  const width = doc.project.width ?? 1920;
  const height = doc.project.height ?? 1080;
  const editor = createEditor({ width, height, fps });
  const mediaById = new Map(
    (doc.media ?? []).map((m) => [m.mediaId, m] as const),
  );

  let layer = 0;
  for (const track of doc.project.tracks) {
    for (const el of track.elements ?? []) {
      const startFrame = msToFrame(el.startMs, fps);
      const endFrame = Math.max(startFrame + 1, msToFrame(el.endMs, fps));
      const type = asTrackType(el.type || track.type);
      const src = resolveSrc(el, mediaById);

      editor.addTrack({
        id: el.id,
        type,
        src,
        text: el.text,
        startFrame,
        endFrame,
        layer: el.layer ?? layer,
        properties: el.properties ?? {},
      });
      layer += 1;
    }
  }

  return editor.toJSON();
}

/** EditorProject / Remotion props from an OpenCut document. */
export function opencutToRemotionProps(doc: OpenCutDocument): RemotionEditorProps {
  return projectToRemotionProps(importOpenCut(doc));
}

/** Export a Vibz EditorProject as portable OpenCut JSON. */
export function exportOpenCut(
  project: EditorProject,
  options?: { name?: string; source?: string },
): OpenCutDocument {
  const fps = project.config.fps;
  const media: OpenCutMediaEntry[] = [];
  const mediaIds = new Map<string, string>();

  for (const track of project.tracks) {
    if (!track.src) continue;
    if (mediaIds.has(track.src)) continue;
    const mediaId = `media_${mediaIds.size + 1}`;
    mediaIds.set(track.src, mediaId);
    media.push({
      mediaId,
      filename: track.src,
      type: track.type === "text" || track.type === "caption" ? "unknown" : track.type,
      duration: frameToMs(track.endFrame - track.startFrame, fps),
    });
  }

  const tracks: OpenCutTrack[] = project.tracks.map((track, index) => ({
    id: `track_${index + 1}`,
    type: track.type,
    name: track.type,
    elements: [
      {
        id: track.id,
        type: track.type,
        mediaId: track.src ? mediaIds.get(track.src) : undefined,
        src: track.src,
        text: track.text,
        startMs: frameToMs(track.startFrame, fps),
        endMs: frameToMs(track.endFrame, fps),
        layer: track.layer,
        properties: track.properties,
      },
    ],
  }));

  return {
    schema_version: OPENCUT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    source: options?.source ?? "vibz-media",
    project: {
      name: options?.name ?? "Vibz Media OpenCut Project",
      fps: project.config.fps,
      width: project.config.width,
      height: project.config.height,
      tracks,
    },
    media,
  };
}

/** Type guard for OpenCut JSON payloads. */
export function isOpenCutDocument(value: unknown): value is OpenCutDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as OpenCutDocument;
  return (
    typeof doc.schema_version === "number" &&
    !!doc.project &&
    Array.isArray(doc.project.tracks)
  );
}

/**
 * Load Remotion editor props from Vibz editor JSON or OpenCut JSON.
 * Prefers embedded `remotionProps`, then OpenCut schema, then raw EditorProject.
 */
export function resolveEditorProps(
  payload: unknown,
): RemotionEditorProps | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as {
    remotionProps?: RemotionEditorProps;
    config?: EditorProject["config"];
    tracks?: EditorProject["tracks"];
    effects?: EditorProject["effects"];
  };

  if (data.remotionProps?.tracks) {
    return data.remotionProps;
  }

  if (isOpenCutDocument(payload)) {
    return opencutToRemotionProps(payload);
  }

  if (data.config && Array.isArray(data.tracks)) {
    return projectToRemotionProps({
      config: {
        width: data.config.width,
        height: data.config.height,
        fps: data.config.fps ?? 30,
        durationInFrames: data.config.durationInFrames ?? 1,
      },
      tracks: data.tracks,
      effects: data.effects ?? [],
    });
  }

  return null;
}
