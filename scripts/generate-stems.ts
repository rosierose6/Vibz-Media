/**
 * Separate mix audio into stems (audio-separator / ffmpeg mid-side).
 *
 *   npm run stems
 *   npm run stems -- ./public/soundtrack.wav
 *   npm run stems -- ./public/soundtrack.wav --model UVR_MDXNET_KARA_2.onnx
 *   npm run stems -- ./public/voiceover.wav --fallback
 */

import path from "path";
import fs from "fs";
import { createWaveform } from "../src/integrations/wavesurfer-node";
import {
  DEFAULT_STEM_MODEL,
  FAST_STEM_MODEL,
  STEM_COLORS,
} from "../src/integrations/audio-separator";
import {
  audioSeparatorAvailable,
  separateStems,
} from "../src/integrations/audio-separator-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const flags = new Set(["--model", "--out", "--format", "--fallback", "--fast"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/soundtrack.wav";

  const model = hasFlag("--fast")
    ? FAST_STEM_MODEL
    : (argValue("--model") ?? DEFAULT_STEM_MODEL);
  const outputDir = argValue("--out") ?? "./public/generated/stems";
  const outputFormat = (argValue("--format") as "wav" | "flac" | "mp3") ?? "wav";

  const result = await separateStems(fileArg, {
    model,
    outputDir,
    outputFormat,
    fallback: hasFlag("--fallback"),
  });

  const peaks: Record<string, number[]> = {};
  const mixAbs = result.input;
  try {
    const mixWave = await createWaveform({ url: mixAbs, bars: 96 });
    peaks.mix = mixWave.peaks;
  } catch {
    peaks.mix = [];
  }

  for (const stem of result.stems) {
    try {
      const w = await createWaveform({ url: stem.path, bars: 96 });
      peaks[stem.name] = w.peaks;
    } catch {
      peaks[stem.name] = [];
    }
  }

  const sourceFile = path.relative(
    path.resolve(process.cwd(), "public"),
    result.input,
  );
  const playFile =
    result.stems.find((s) => s.name === "vocals")?.file ??
    result.stems[0]?.file ??
    path.basename(result.input);

  const metaPath = path.resolve(process.cwd(), "public/stems-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        sourceFile: sourceFile.startsWith("..")
          ? path.basename(result.input)
          : sourceFile.split(path.sep).join("/"),
        playFile,
        stems: result.stems.map((s) => ({
          name: s.name,
          file: s.file,
          bytes: s.bytes,
          color: STEM_COLORS[s.name] ?? STEM_COLORS.other,
        })),
        peaks,
        model: result.model,
        engine: result.engine,
        durationSec: result.durationSec ?? null,
        audioSeparatorAvailable: audioSeparatorAvailable(),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // Compact waveform envelope for Remotion (optional).
  const envelopePath = path.resolve(process.cwd(), "public/stems-waveforms.json");
  fs.writeFileSync(
    envelopePath,
    JSON.stringify(
      {
        peaks,
        durationSec: result.durationSec,
      },
      null,
      2,
    ),
  );

  console.log(`Engine: ${result.engine} · model: ${result.model}`);
  for (const s of result.stems) {
    console.log(`  ${s.name}: ${s.path} (${s.bytes} bytes)`);
  }
  console.log(`Meta: ${metaPath}`);
  console.log(`Available: ${audioSeparatorAvailable()}`);
  console.log("Open Remotion Studio → composition StemDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
