/**
 * Denoise speech with DeepFilterNet (ffmpeg afftdn fallback).
 *
 *   npm run denoise
 *   npm run denoise -- ./public/voiceover.wav
 *   npm run denoise -- ./public/voiceover.wav --noisy
 *   npm run denoise -- ./public/voiceover-noisy.wav --pf
 */

import path from "path";
import fs from "fs";
import { createWaveform } from "../src/integrations/wavesurfer-node";
import {
  deepFilterAvailable,
  denoiseAudio,
  makeNoisyDemo,
} from "../src/integrations/deepfilternet-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const flags = new Set(["--out", "--pf", "--noisy", "--fallback", "--delay"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/voiceover.wav";

  let inputPath = fileArg;
  let noisyFile: string | null = null;

  if (hasFlag("--noisy") || fileArg.includes("voiceover.wav")) {
    // Build a noisy companion so the before/after demo is visible.
    noisyFile = path.resolve(process.cwd(), "public/voiceover-noisy.wav");
    await makeNoisyDemo(fileArg, noisyFile);
    inputPath = noisyFile;
    console.log(`Noisy demo mix: ${noisyFile}`);
  }

  const base = path.basename(inputPath, path.extname(inputPath)).replace(/-noisy$/, "");
  const output =
    argValue("--out") ?? `./public/${base}-clean.wav`;

  const result = await denoiseAudio(inputPath, {
    output,
    postFilter: hasFlag("--pf"),
    compensateDelay: hasFlag("--delay"),
    fallback: hasFlag("--fallback"),
  });

  const beforePath = noisyFile ?? result.input;
  const peaks: { before: number[]; after: number[] } = {
    before: [],
    after: [],
  };
  try {
    peaks.before = (await createWaveform({ url: beforePath, bars: 96 })).peaks;
    peaks.after = (await createWaveform({ url: result.output, bars: 96 })).peaks;
  } catch {
    // peaks optional
  }

  const beforeRel = path.relative(
    path.resolve(process.cwd(), "public"),
    beforePath,
  );
  const metaPath = path.resolve(process.cwd(), "public/denoise-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        beforeFile: beforeRel.startsWith("..")
          ? path.basename(beforePath)
          : beforeRel.split(path.sep).join("/"),
        afterFile: result.file,
        playFile: result.file,
        peaks,
        engine: result.engine,
        sampleRate: result.sampleRate,
        durationSec: result.durationSec ?? null,
        deepFilterAvailable: deepFilterAvailable(),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Engine: ${result.engine} · ${result.sampleRate} Hz`);
  console.log(`Clean: ${result.output} (${result.bytes} bytes)`);
  if (result.durationSec) console.log(`Duration: ${result.durationSec.toFixed(2)}s`);
  console.log(`Meta: ${metaPath}`);
  console.log(`Available: ${deepFilterAvailable()}`);
  console.log("Open Remotion Studio → composition DenoiseDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
