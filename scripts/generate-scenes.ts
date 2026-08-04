/**
 * Detect scene cuts with PySceneDetect (ffmpeg fallback).
 *
 *   npm run scenes
 *   npm run scenes -- ./public/ai-clip.mp4
 *   npm run scenes -- ./public/generated/multi-scene.mp4 --threshold 20
 *   npm run scenes -- --multi
 */

import path from "path";
import fs from "fs";
import {
  detectScenes,
  makeMultiSceneDemo,
  sceneDetectAvailable,
} from "../src/integrations/pyscenedetect-node";
import type { SceneDetector } from "../src/integrations/pyscenedetect";

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
    "--out",
    "--threshold",
    "--detector",
    "--fallback",
    "--multi",
    "--no-split",
  ]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? null;

  let inputPath = fileArg ?? "./public/ai-clip.mp4";

  if (hasFlag("--multi") || !fileArg) {
    inputPath = await makeMultiSceneDemo(
      [
        "./public/ai-clip.mp4",
        "./public/generated/padded-talk.mp4",
        "./public/ai-clip.mp4",
      ].filter((p) => fs.existsSync(path.resolve(p.replace(/^\.\//, ""))) || fs.existsSync(path.resolve("public", path.basename(p)))),
      path.resolve(process.cwd(), "public/generated/multi-scene.mp4"),
    );
    console.log(`Multi-scene reel: ${inputPath}`);
  }

  const outputDir = argValue("--out") ?? "./public/generated/scenes";
  const threshold = Number.parseFloat(argValue("--threshold") ?? "27") || 27;
  const detector = (argValue("--detector") as SceneDetector) ?? "content";

  const result = await detectScenes(inputPath, {
    threshold,
    detector,
    outputDir,
    split: !hasFlag("--no-split"),
    saveImages: true,
    fallback: hasFlag("--fallback"),
  });

  const sourceRel = path.relative(
    path.resolve(process.cwd(), "public"),
    result.input,
  );
  const thumbs = fs.existsSync(result.outputDir)
    ? fs
        .readdirSync(result.outputDir)
        .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
        .sort()
        .map((f) =>
          path
            .relative(
              path.resolve(process.cwd(), "public"),
              path.join(result.outputDir, f),
            )
            .split(path.sep)
            .join("/"),
        )
    : [];

  const metaPath = path.resolve(process.cwd(), "public/scenes-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        sourceFile: sourceRel.startsWith("..")
          ? path.basename(result.input)
          : sourceRel.split(path.sep).join("/"),
        outputDir: path
          .relative(path.resolve(process.cwd(), "public"), result.outputDir)
          .split(path.sep)
          .join("/"),
        scenes: result.scenes.map((s) => ({
          index: s.index,
          start: s.start,
          end: s.end,
          startFrame: s.startFrame,
          endFrame: s.endFrame,
          file: s.file ?? null,
        })),
        thumbs,
        detector: result.detector,
        threshold: result.threshold,
        engine: result.engine,
        fps: result.fps ?? null,
        durationSec: result.durationSec ?? null,
        sceneCount: result.scenes.length,
        sceneDetectAvailable: sceneDetectAvailable(),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Engine: ${result.engine} · detector: ${result.detector} @ ${result.threshold}`);
  console.log(`Scenes: ${result.scenes.length}`);
  for (const s of result.scenes) {
    console.log(
      `  #${s.index}  ${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s` +
        (s.file ? `  ${s.file}` : ""),
    );
  }
  console.log(`Meta: ${metaPath}`);
  console.log(`Available: ${sceneDetectAvailable()}`);
  console.log("Open Remotion Studio → composition SceneDetectDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
