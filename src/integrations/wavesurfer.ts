/**
 * VANTA — Audio Visualization Integration (wavesurfer.js)
 *
 * Extract waveform peaks from any audio file and drive Remotion
 * visuals — bar heights, progress scrubbing, color styles.
 *
 * Usage:
 *   import { createWaveform, getBarsAtTime, WAVEFORM_STYLES } from "./integrations/wavesurfer";
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

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

function resolveAudioPath(url: string): string {
  if (path.isAbsolute(url)) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    throw new Error("Remote audio URLs are not supported in createWaveform; download first.");
  }
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
    path.resolve(__dirname, "../../", cleaned),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Audio not found: ${url}`);
}

async function decodeMonoF32(filePath: string): Promise<{
  samples: Float32Array;
  sampleRate: number;
  duration: number;
}> {
  const { stdout: probeOut } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=sample_rate",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const sampleRate = Number.parseInt(String(probeOut).trim(), 10) || 44100;

  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-i",
      filePath,
      "-ac",
      "1",
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-v",
      "error",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
  );

  const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const samples = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    Math.floor(buffer.byteLength / 4),
  );
  const duration = samples.length / sampleRate;
  return { samples, sampleRate, duration };
}

function downsamplePeaks(samples: Float32Array, count: number): number[] {
  if (samples.length === 0 || count <= 0) return [];
  const block = Math.max(1, Math.floor(samples.length / count));
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * block;
    const end = Math.min(samples.length, start + block);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j] ?? 0);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const peak = Math.max(...peaks, 1e-6);
  return peaks.map((p) => Math.min(1, p / peak));
}

function buildEnvelope(
  samples: Float32Array,
  sampleRate: number,
  hopMs = 10,
): { envelope: number[]; envelopeRate: number } {
  const hop = Math.max(1, Math.floor(sampleRate * (hopMs / 1000)));
  const envelope: number[] = [];
  for (let i = 0; i < samples.length; i += hop) {
    const end = Math.min(samples.length, i + hop);
    let sum = 0;
    for (let j = i; j < end; j++) {
      const v = samples[j] ?? 0;
      sum += v * v;
    }
    envelope.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  const peak = Math.max(...envelope, 1e-6);
  return {
    envelope: envelope.map((v) => Math.min(1, v / peak)),
    envelopeRate: sampleRate / hop,
  };
}

/**
 * Decode audio and build wavesurfer-style peak + envelope data.
 * Mirrors WaveSurfer.create({ url, waveColor, progressColor }).
 */
export async function createWaveform(
  options: WaveformOptions,
): Promise<WaveformData> {
  const style = WAVEFORM_STYLES.wavesurfer;
  const filePath = resolveAudioPath(options.url);
  const bars = options.bars ?? 64;
  const peakCount = options.peaks ?? 800;

  const { samples, sampleRate, duration } = await decodeMonoF32(filePath);
  const peaks = downsamplePeaks(samples, peakCount);
  const { envelope, envelopeRate } = buildEnvelope(samples, sampleRate);

  return {
    url: options.url,
    duration,
    sampleRate,
    bars,
    waveColor: options.waveColor ?? style.waveColor,
    progressColor: options.progressColor ?? style.progressColor,
    cursorColor: options.cursorColor ?? style.cursorColor,
    peaks,
    envelope,
    envelopeRate,
  };
}

/** Alias matching README wording. */
export const analyzeWaveform = createWaveform;

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
    // Mild frequency tilt so outer bars feel lower like a spectrum.
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
