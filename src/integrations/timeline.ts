/**
 * VIBZ MEDIA — Timeline Integration
 *
 * Multi-track timeline data model: add/remove/split clips, keyframes,
 * export to Remotion <Sequence> props via toRemotionSequences().
 *
 * Usage:
 *   import { createTimeline, addClip, toRemotionSequences } from "./integrations/timeline";
 *
 *   let timeline = createTimeline({ fps: 30, durationInFrames: 300 });
 *   timeline = addClip(timeline, {
 *     trackIndex: 0, type: "video", src: "clip.mp4",
 *     startFrame: 0, endFrame: 150,
 *   });
 *   const sequences = toRemotionSequences(timeline);
 *   // Each sequence maps to a Remotion <Sequence> component
 *
 * Repos:
 *   - https://github.com/xzdarcy/react-timeline-editor — MIT, drag-and-drop
 *   - https://github.com/OpenCut-app/OpenCut — MIT CapCut alternative
 */

export interface TimelineConfig {
  fps: number;
  durationInFrames: number;
  trackCount?: number;
}

export type TimelineClipType = "video" | "audio" | "image" | "text" | "effect";

export interface TimelineClip {
  id: string;
  trackIndex: number;
  type: TimelineClipType;
  src?: string;
  text?: string;
  startFrame: number;
  endFrame: number;
  trimStart?: number;
  trimEnd?: number;
  volume?: number;
  opacity?: number;
  label?: string;
}

export interface TimelineKeyframe {
  clipId: string;
  property: string;
  frame: number;
  value: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
}

export interface Timeline {
  config: Required<TimelineConfig>;
  clips: TimelineClip[];
  keyframes: TimelineKeyframe[];
  playheadFrame: number;
}

export interface RemotionSequenceData {
  id: string;
  from: number;
  durationInFrames: number;
  trackIndex: number;
  type: TimelineClipType;
  src?: string;
  text?: string;
  trimStart?: number;
  style: {
    opacity?: number;
    volume?: number;
    keyframes: Record<string, TimelineKeyframe[]>;
  };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTimeline(config: TimelineConfig): Timeline {
  return {
    config: {
      fps: config.fps,
      durationInFrames: Math.max(1, config.durationInFrames),
      trackCount: config.trackCount ?? 4,
    },
    clips: [],
    keyframes: [],
    playheadFrame: 0,
  };
}

export function addClip(
  timeline: Timeline,
  clip: Omit<TimelineClip, "id"> & { id?: string },
): Timeline {
  if (clip.endFrame <= clip.startFrame) {
    throw new Error(
      `Clip endFrame (${clip.endFrame}) must be > startFrame (${clip.startFrame})`,
    );
  }

  const next: TimelineClip = {
    ...clip,
    id: clip.id ?? newId("clip"),
  };

  const durationInFrames = Math.max(
    timeline.config.durationInFrames,
    next.endFrame,
  );

  return {
    ...timeline,
    config: { ...timeline.config, durationInFrames },
    clips: [...timeline.clips, next],
  };
}

export function removeClip(timeline: Timeline, clipId: string): Timeline {
  return {
    ...timeline,
    clips: timeline.clips.filter((c) => c.id !== clipId),
    keyframes: timeline.keyframes.filter((k) => k.clipId !== clipId),
  };
}

export function splitClip(
  timeline: Timeline,
  clipId: string,
  atFrame: number,
): Timeline {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip || atFrame <= clip.startFrame || atFrame >= clip.endFrame) {
    return timeline;
  }

  const firstHalf: TimelineClip = { ...clip, endFrame: atFrame };
  const secondHalf: TimelineClip = {
    ...clip,
    id: newId("clip"),
    startFrame: atFrame,
    trimStart: (clip.trimStart ?? 0) + (atFrame - clip.startFrame),
  };

  return {
    ...timeline,
    clips: timeline.clips
      .map((c) => (c.id === clipId ? firstHalf : c))
      .concat(secondHalf),
  };
}

export function addKeyframe(
  timeline: Timeline,
  keyframe: Omit<TimelineKeyframe, "easing"> & {
    easing?: TimelineKeyframe["easing"];
  },
): Timeline {
  return {
    ...timeline,
    keyframes: [
      ...timeline.keyframes,
      { easing: "ease-in-out", ...keyframe },
    ],
  };
}

export function setPlayhead(timeline: Timeline, frame: number): Timeline {
  return {
    ...timeline,
    playheadFrame: Math.max(
      0,
      Math.min(frame, timeline.config.durationInFrames),
    ),
  };
}

/**
 * Converts timeline clips + keyframes into Remotion <Sequence> data.
 */
export function toRemotionSequences(timeline: Timeline): RemotionSequenceData[] {
  return [...timeline.clips]
    .sort(
      (a, b) =>
        a.trackIndex - b.trackIndex || a.startFrame - b.startFrame,
    )
    .map((clip) => {
      const clipKeyframes = timeline.keyframes.filter(
        (k) => k.clipId === clip.id,
      );

      const keyframesByProp: Record<string, TimelineKeyframe[]> = {};
      for (const kf of clipKeyframes) {
        if (!keyframesByProp[kf.property]) keyframesByProp[kf.property] = [];
        keyframesByProp[kf.property].push(kf);
      }
      for (const prop of Object.keys(keyframesByProp)) {
        keyframesByProp[prop].sort((a, b) => a.frame - b.frame);
      }

      return {
        id: clip.id,
        from: clip.startFrame,
        durationInFrames: Math.max(1, clip.endFrame - clip.startFrame),
        trackIndex: clip.trackIndex,
        type: clip.type,
        src: clip.src,
        text: clip.text,
        trimStart: clip.trimStart,
        style: {
          opacity: clip.opacity,
          volume: clip.volume,
          keyframes: keyframesByProp,
        },
      };
    });
}

export function getTimelineDuration(timeline: Timeline): number {
  if (timeline.clips.length === 0) return timeline.config.durationInFrames;
  return Math.max(
    timeline.config.durationInFrames,
    ...timeline.clips.map((c) => c.endFrame),
  );
}
