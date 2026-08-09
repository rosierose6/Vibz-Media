/**
 * VIBZ MEDIA — Video Editor Integration
 *
 * Programmatic project format that bridges an editor timeline and
 * Remotion rendering. Build tracks in code (or import OpenCut JSON)
 * → projectToRemotionProps() → <Composition>.
 *
 * Usage:
 *   const editor = createEditor({ width: 1920, height: 1080, fps: 30 });
 *   editor.addTrack({ type: "video", src: "clip.mp4", startFrame: 0, endFrame: 90, layer: 0 });
 *   // OpenCut CapCut-style project:
 *   editor.importOpenCut(opencutDoc);
 *   const opencutJson = editor.exportOpenCut();
 *   const props = projectToRemotionProps(editor);
 *
 * Pattern references (not vendored — check licenses before embedding UI):
 *   - https://github.com/OpenCut-app/OpenCut — MIT CapCut alternative (primary)
 *   - https://github.com/openvideodev/react-video-editor — Remotion-based
 *   - https://github.com/omni-media/omniclip — MIT WebCodecs editor
 *
 * CLI: npm run editor | npm run editor:ui | npm run opencut | npm run render:editor
 *
 * Drag-and-drop UI: npm run editor:ui → http://localhost:5174
 */

import type { OpenCutDocument } from "./opencut";

export type { OpenCutDocument } from "./opencut";

export interface EditorConfig {
  width: number;
  height: number;
  fps?: number;
  durationInFrames?: number;
}

export type EditorTrackType = "video" | "audio" | "image" | "text" | "caption";

export interface EditorTrack {
  id: string;
  type: EditorTrackType;
  src?: string;
  text?: string;
  startFrame: number;
  endFrame: number;
  layer: number;
  properties?: {
    volume?: number;
    opacity?: number;
    x?: number;
    y?: number;
    scale?: number;
    fontSize?: number;
    color?: string;
    textAlign?: "left" | "center" | "right";
    objectFit?: "cover" | "contain" | "fill";
    [key: string]: unknown;
  };
}

export interface EditorEffect {
  id: string;
  type: "transition" | "filter" | "animation";
  trackId: string;
  startFrame: number;
  endFrame: number;
  params: Record<string, unknown>;
}

export interface EditorProject {
  config: Required<EditorConfig>;
  tracks: EditorTrack[];
  effects: EditorEffect[];
}

export interface RemotionEditorProps {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  tracks: EditorTrack[];
  effects: EditorEffect[];
}

export interface Editor extends EditorProject {
  addTrack: (
    track: Omit<EditorTrack, "id"> & { id?: string },
  ) => EditorTrack;
  addEffect: (
    effect: Omit<EditorEffect, "id"> & { id?: string },
  ) => EditorEffect;
  removeTrack: (trackId: string) => void;
  getDurationInFrames: () => number;
  toJSON: () => EditorProject;
  /** Replace timeline contents from an OpenCut `.opencut.json` document. */
  importOpenCut: (doc: OpenCutDocument) => void;
  /** Serialize the current timeline as portable OpenCut JSON. */
  exportOpenCut: (options?: {
    name?: string;
    source?: string;
  }) => OpenCutDocument;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Date.now().toString(36)}`;
}

function normalizeConfig(config: EditorConfig): Required<EditorConfig> {
  return {
    width: config.width,
    height: config.height,
    fps: config.fps ?? 30,
    // Grows as tracks are added; override explicitly when you need a fixed length.
    durationInFrames: config.durationInFrames ?? 1,
  };
}

/** Lazy load to avoid a circular import with `./opencut`. */
function openCutBridge(): typeof import("./opencut") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./opencut") as typeof import("./opencut");
}

export function createEditor(config: EditorConfig): Editor {
  const project: EditorProject = {
    config: normalizeConfig(config),
    tracks: [],
    effects: [],
  };

  const editor: Editor = {
    get config() {
      return project.config;
    },
    get tracks() {
      return project.tracks;
    },
    get effects() {
      return project.effects;
    },

    addTrack(trackInput) {
      if (trackInput.endFrame <= trackInput.startFrame) {
        throw new Error(
          `Track endFrame (${trackInput.endFrame}) must be > startFrame (${trackInput.startFrame})`,
        );
      }

      const track: EditorTrack = {
        ...trackInput,
        id: trackInput.id ?? nextId("track"),
        layer: trackInput.layer ?? project.tracks.length,
        properties: trackInput.properties ?? {},
      };
      project.tracks.push(track);

      const span = track.endFrame;
      if (span > project.config.durationInFrames) {
        project.config.durationInFrames = span;
      }

      return track;
    },

    addEffect(effectInput) {
      const effect: EditorEffect = {
        ...effectInput,
        id: effectInput.id ?? nextId("fx"),
        params: effectInput.params ?? {},
      };
      project.effects.push(effect);
      return effect;
    },

    removeTrack(trackId) {
      project.tracks = project.tracks.filter((t) => t.id !== trackId);
      project.effects = project.effects.filter((e) => e.trackId !== trackId);
    },

    getDurationInFrames() {
      if (project.tracks.length === 0) {
        return Math.max(1, project.config.durationInFrames);
      }
      const fromTracks = Math.max(...project.tracks.map((t) => t.endFrame));
      return Math.max(1, fromTracks, project.config.durationInFrames);
    },

    toJSON() {
      return {
        config: {
          ...project.config,
          durationInFrames: editor.getDurationInFrames(),
        },
        tracks: [...project.tracks],
        effects: [...project.effects],
      };
    },

    importOpenCut(doc) {
      const {
        importOpenCut: parseOpenCut,
        isOpenCutDocument,
      } = openCutBridge();
      if (!isOpenCutDocument(doc)) {
        throw new Error(
          "Invalid OpenCut document (need schema_version + project.tracks)",
        );
      }
      const imported = parseOpenCut(doc);
      project.config = imported.config;
      project.tracks = [...imported.tracks];
      project.effects = [...imported.effects];
    },

    exportOpenCut(options) {
      const { exportOpenCut: toOpenCut } = openCutBridge();
      return toOpenCut(editor.toJSON(), options);
    },
  };

  return editor;
}

/** Load a serialized EditorProject (e.g. from public/editor-project.json). */
export function loadEditorProject(data: EditorProject): Editor {
  const editor = createEditor(data.config);
  for (const track of data.tracks) {
    editor.addTrack(track);
  }
  for (const effect of data.effects) {
    editor.addEffect(effect);
  }
  return editor;
}

/**
 * Converts an EditorProject / Editor into props for a Remotion Composition.
 */
export function projectToRemotionProps(
  project: EditorProject | Editor,
): RemotionEditorProps {
  const json = "toJSON" in project ? project.toJSON() : project;
  const durationInFrames = Math.max(
    json.config.durationInFrames,
    ...json.tracks.map((t) => t.endFrame),
    1,
  );

  return {
    width: json.config.width,
    height: json.config.height,
    fps: json.config.fps,
    durationInFrames,
    tracks: [...json.tracks].sort((a, b) => a.layer - b.layer),
    effects: json.effects,
  };
}
