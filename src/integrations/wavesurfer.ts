/**
 * VANTA — Audio Visualization Integration (wavesurfer.js)
 *
 * Waveform peaks + envelope helpers for Remotion (browser-safe).
 * Use createWaveform() from wavesurfer-node.ts in CLI scripts.
 *
 * Usage:
 *   import { createWaveform } from "./integrations/wavesurfer-node";
 *   import { getBarsAtTime, WAVEFORM_STYLES } from "./integrations/wavesurfer";
 *
 *   const wavesurfer = await createWaveform({
 *     url: "./public/voiceover.wav",
 *     waveColor: "#4F4A85",
 *     progressColor: "#383351",
 *     bars: 64,
 *   });
 *
 *   // In Remotion:
 *   const bars = getBarsAtTime(wavesurfer, frame / fps);
 *
 * Repos:
 *   - https://github.com/katspaugh/wavesurfer.js — waveform player / peaks
 */

export interface WaveformOptions {
  url: string;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  bars?: number;
  /** Peaks resolution for the full-file overview (default 800). */
  peaks?: number;
  /** Window length (seconds) for live bar sampling (default 0.05). */
  window?: number;
}

export interface WaveformData {
  url: string;
  duration: number;
  sampleRate: number;
  bars: number;
  waveColor: string;
  progressColor: string;
  cursorColor: string;
  /** Normalized 0–1 peaks for static overview rendering. */
  peaks: number[];
  /** Downsampled envelope (0–1) for time-based bar sampling. */
  envelope: number[];
  envelopeRate: number;
}

export interface WaveformStyle {
  name: string;
  waveColor: string;
  progressColor: string;
  cursorColor: string;
  background: string;
}

export const WAVEFORM_STYLES: Record<string, WaveformStyle> = {
  wavesurfer: {
    name: "wavesurfer",
    waveColor: "#4F4A85",
    progressColor: "#383351",
    cursorColor: "#ffffff",
    background: "#0d1117",
  },
  vanta: {
    name: "vanta",
    waveColor: "rgba(255,255,255,0.25)",
    progressColor: "#FFD700",
    cursorColor: "#FFD700",
    background: "#0a0a0a",
  },
  neon: {
    name: "neon",
    waveColor: "#39CCCC",
    progressColor: "#FF6B6B",
    cursorColor: "#FFFFFF",
    background: "#050510",
  },
  mono: {
    name: "mono",
    waveColor: "rgba(255,255,255,0.35)",
    progressColor: "#FFFFFF",
    cursorColor: "#FFFFFF",
    background: "#111111",
  },
};

/**
 * Sample `bars` amplitudes around `time` seconds (audio-reactive bars).
 */
export function getBarsAtTime(
  data: WaveformData,
  time: number,
  windowSec?: number,
): number[] {
  const bars = data.bars;
  if (data.envelope.length === 0 || bars <= 0) {
    return Array.from({ length: bars }, () => 0);
  }

  const window = windowSec ?? Math.max(0.03, bars / data.envelopeRate);
  const center = Math.max(0, Math.min(data.duration, time));
  const start = Math.max(0, center - window / 2);
  const end = Math.min(data.duration, start + window);
  const i0 = Math.floor(start * data.envelopeRate);
  const i1 = Math.max(i0 + 1, Math.ceil(end * data.envelopeRate));
  const slice = data.envelope.slice(i0, i1);
  if (slice.length === 0) return Array.from({ length: bars }, () => 0);

  const block = Math.max(1, Math.floor(slice.length / bars));
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = i * block;
    const b = Math.min(slice.length, a + block);
    let max = 0;
    for (let j = a; j < b; j++) {
      max = Math.max(max, slice[j] ?? 0);
    }
    const tilt = 0.55 + 0.45 * Math.sin((i / Math.max(1, bars - 1)) * Math.PI);
    out.push(Math.min(1, max * tilt));
  }
  return out;
}

/** Progress 0–1 through the clip at `time`. */
export function getProgress(data: WaveformData, time: number): number {
  if (data.duration <= 0) return 0;
  return Math.max(0, Math.min(1, time / data.duration));
}

/** Serialize for public/*.json (envelope kept; peaks kept). */
export function serializeWaveform(data: WaveformData): string {
  return JSON.stringify(
    {
      ...data,
      envelope: Array.from(data.envelope),
      peaks: Array.from(data.peaks),
    },
    null,
    2,
  );
}

export function deserializeWaveform(json: unknown): WaveformData {
  const raw = json as WaveformData;
  return {
    ...raw,
    peaks: Array.from(raw.peaks ?? []),
    envelope: Array.from(raw.envelope ?? []),
  };
}

export function listWaveformStyles(): string[] {
  return Object.keys(WAVEFORM_STYLES);
}
