/**
 * Inspect / convert media with mediabunny (+ ffmpeg fallback).
 *
 *   npm run media
 *   npm run media -- ./public/ai-clip.mp4
 *   npm run media -- ./public/ai-clip.mp4 --convert webm
 *   npm run media -- ./public/ai-clip.mp4 --convert mp4 --end 3
 */

import path from "path";
import fs from "fs";
import {
  formatDuration,
  formatResolution,
  type MediaContainerFormat,
} from "../src/integrations/mediabunny";
import {
  convertMedia,
  inspectMedia,
} from "../src/integrations/mediabunny-node";

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
    path.resolve(process.cwd(), "out", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return url;
}

async function main() {
  const flags = new Set(["--convert", "--end", "--start", "--out"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/ai-clip.mp4";

  const convertTo = argValue("--convert") as MediaContainerFormat | undefined;
  const start = argValue("--start")
    ? Number.parseFloat(argValue("--start")!)
    : undefined;
  const end = argValue("--end")
    ? Number.parseFloat(argValue("--end")!)
    : undefined;
  const outOpt = argValue("--out");

  const meta = await inspectMedia(fileArg);
  let conversion = null as Awaited<ReturnType<typeof convertMedia>> | null;

  if (convertTo) {
    conversion = await convertMedia(fileArg, {
      format: convertTo,
      outPath: outOpt,
      start,
      end,
    });
  }

  const audioFile = path.basename(resolveExisting(fileArg));
  const outDir = path.resolve(__dirname, "../public");
  const outJson = path.join(outDir, "mediabunny.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        sourceFile: audioFile,
        meta,
        conversion,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${outJson}`);
  console.log(
    `Source: ${audioFile} · ${formatDuration(meta.duration)} · ${formatResolution(meta.video)} · codec ${meta.video?.codec ?? meta.audio?.codec ?? "—"}`,
  );
  if (conversion) {
    console.log(
      `Converted → ${conversion.outPath} (${conversion.engine}, ${(conversion.bytes / 1024).toFixed(1)} KB)`,
    );
  }
  console.log("Open Remotion Studio → composition MediabunnyDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
