/**
 * Extract wavesurfer-style peaks for Remotion.
 *
 *   npm run waveform
 *   npm run waveform -- ./public/soundtrack.wav
 *   npm run waveform -- ./public/voiceover.wav --style neon --bars 72
 */

import path from "path";
import fs from "fs";
import {
  listWaveformStyles,
  serializeWaveform,
  WAVEFORM_STYLES,
} from "../src/integrations/wavesurfer";
import { createWaveform } from "../src/integrations/wavesurfer-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function resolveExisting(url: string): string {
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return url;
}

async function main() {
  const flags = new Set(["--style", "--bars"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/voiceover.wav";

  const styleName = argValue("--style") ?? "wavesurfer";
  const bars = Number.parseInt(argValue("--bars") ?? "64", 10) || 64;
  const style = WAVEFORM_STYLES[styleName] ?? WAVEFORM_STYLES.wavesurfer;

  const wavesurfer = await createWaveform({
    url: fileArg,
    waveColor: style.waveColor,
    progressColor: style.progressColor,
    cursorColor: style.cursorColor,
    bars,
  });

  const outDir = path.resolve(__dirname, "../public");
  const outJson = path.join(outDir, "waveform.json");
  const audioFile = path.basename(resolveExisting(fileArg));

  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    ...JSON.parse(serializeWaveform(wavesurfer)),
    audioFile,
    style: style.name,
    background: style.background,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outJson, JSON.stringify(payload, null, 2));

  console.log(`Wrote ${outJson}`);
  console.log(
    `Audio: ${audioFile} · ${wavesurfer.duration.toFixed(2)}s · bars: ${bars}`,
  );
  console.log(`Style: ${style.name} · peaks: ${wavesurfer.peaks.length}`);
  console.log(`Styles: ${listWaveformStyles().join(", ")}`);
  console.log("Open Remotion Studio → composition WaveformDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
