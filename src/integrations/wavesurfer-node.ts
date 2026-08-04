/**
 * Node-only waveform analysis (ffmpeg). Do not import from Remotion scenes.
 */

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import {
  WAVEFORM_STYLES,
  type WaveformData,
  type WaveformOptions,
} from "./wavesurfer";

const execFileAsync = promisify(execFile);

function resolveAudioPath(url: string): string {
  if (path.isAbsolute(url)) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    throw new Error(
      "Remote audio URLs are not supported in createWaveform; download first.",
    );
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
  const sampleRate = 44100;

  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-i",
      filePath,
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-v",
      "error",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 256 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
      },
    },
  );

  const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const samples = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    Math.floor(buffer.byteLength / 4),
  );
  return { samples, sampleRate, duration: samples.length / sampleRate };
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
