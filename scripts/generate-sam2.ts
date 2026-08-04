/**
 * Segment / track objects with SAM 2 (imgly fallback).
 *
 *   npm run sam
 *   npm run sam -- ./public/presenter-photo.jpg
 *   npm run sam -- ./public/ai-clip.mp4 --track --max-frames 24
 */

import path from "path";
import fs from "fs";
import type { Sam2Point } from "../src/integrations/sam2";
import {
  sam2Available,
  segmentObject,
  trackObject,
} from "../src/integrations/sam2-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const flags = new Set([
    "--track",
    "--max-frames",
    "--out",
    "--cutout",
    "--x",
    "--y",
  ]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/presenter-photo.jpg";

  const x = Number.parseFloat(argValue("--x") ?? "0.5");
  const y = Number.parseFloat(argValue("--y") ?? "0.45");
  const points: Sam2Point[] = [{ x, y, label: 1 }];
  const track = hasFlag("--track") || /\.(mp4|mov|webm)$/i.test(fileArg);
  const maxFrames = Number.parseInt(argValue("--max-frames") ?? "24", 10) || 24;

  const metaPath = path.resolve(process.cwd(), "public/sam2-meta.json");

  if (track) {
    const result = await trackObject(fileArg, {
      points,
      normalized: true,
      maxFrames,
      outputDir: argValue("--out") ?? "./public/generated/sam2",
    });

    const previewRel = result.preview
      ? path.relative(path.resolve(process.cwd(), "public"), result.preview)
      : null;

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          mode: "track",
          sourceFile: path.basename(result.input),
          maskFile: "generated/sam2/masks/frame_00000001.png",
          previewFile: previewRel?.split(path.sep).join("/") ?? null,
          points: result.points,
          model: result.model,
          engine: result.engine,
          frameCount: result.frameCount,
          width: result.width,
          height: result.height,
          sam2Available: sam2Available(),
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(`Masks: ${result.maskDir} (${result.frameCount} frames)`);
    if (result.preview) console.log(`Preview: ${result.preview}`);
    console.log(`Engine: ${result.engine} · ${result.width}×${result.height}`);
  } else {
    const base = path.basename(fileArg, path.extname(fileArg));
    const result = await segmentObject(fileArg, {
      points,
      normalized: true,
      output: argValue("--out") ?? `./public/${base}-mask.png`,
      cutout: argValue("--cutout") ?? `./public/${base}-sam-cutout.png`,
    });

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          mode: "image",
          sourceFile: path.basename(result.input),
          maskFile: path.basename(result.mask),
          cutoutFile: result.cutout ? path.basename(result.cutout) : null,
          points: result.points,
          model: result.model,
          engine: result.engine,
          width: result.width,
          height: result.height,
          sam2Available: sam2Available(),
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(`Mask: ${result.mask}`);
    if (result.cutout) console.log(`Cutout: ${result.cutout}`);
    console.log(
      `${result.width}×${result.height} · ${result.engine} · ${result.bytes} bytes`,
    );
  }

  console.log(`Meta: ${metaPath}`);
  console.log("Open Remotion Studio → composition Sam2Demo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
