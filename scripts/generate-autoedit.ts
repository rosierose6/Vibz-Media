/**
 * Auto-cut silence / dead space (auto-editor / ffmpeg fallback).
 *
 *   npm run autoedit
 *   npm run autoedit -- ./public/ai-clip.mp4
 *   npm run autoedit -- ./public/ai-clip.mp4 --margin 0.3sec --edit audio:-19dB
 *   npm run autoedit -- ./public/generated/padded-talk.mp4 --pad
 */

import path from "path";
import fs from "fs";
import {
  DEFAULT_EDIT,
  DEFAULT_MARGIN,
} from "../src/integrations/auto-editor";
import {
  autoEdit,
  autoEditorAvailable,
  makePaddedDemo,
} from "../src/integrations/auto-editor-node";

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
    "--margin",
    "--edit",
    "--fallback",
    "--pad",
    "--export",
  ]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/ai-clip.mp4";

  let inputPath = fileArg;
  if (hasFlag("--pad") || fileArg.includes("ai-clip.mp4")) {
    inputPath = await makePaddedDemo(
      fileArg,
      path.resolve(process.cwd(), "public/generated/padded-talk.mp4"),
    );
    console.log(`Padded demo: ${inputPath}`);
  }

  const base = path.basename(inputPath, path.extname(inputPath));
  const output =
    argValue("--out") ?? `./public/generated/${base}-cut.mp4`;

  const result = await autoEdit(inputPath, {
    margin: argValue("--margin") ?? DEFAULT_MARGIN,
    edit: argValue("--edit") ?? DEFAULT_EDIT,
    output,
    exportTimeline: argValue("--export") as
      | "premiere"
      | "resolve"
      | "final-cut-pro"
      | "shotcut"
      | "kdenlive"
      | "clip-sequence"
      | undefined,
    fallback: hasFlag("--fallback"),
  });

  const sourceRel = path.relative(
    path.resolve(process.cwd(), "public"),
    result.input,
  );
  const metaPath = path.resolve(process.cwd(), "public/autoedit-meta.json");
  const savedPct =
    result.inputDurationSec && result.outputDurationSec
      ? Math.max(
          0,
          (1 - result.outputDurationSec / result.inputDurationSec) * 100,
        )
      : null;

  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        sourceFile: sourceRel.startsWith("..")
          ? path.basename(result.input)
          : sourceRel.split(path.sep).join("/"),
        outputFile: result.file,
        margin: result.margin,
        edit: result.edit,
        engine: result.engine,
        inputDurationSec: result.inputDurationSec ?? null,
        outputDurationSec: result.outputDurationSec ?? null,
        savedPct,
        keptSegments: result.keptSegments,
        autoEditorAvailable: autoEditorAvailable(),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Engine: ${result.engine}`);
  console.log(`Output: ${result.output} (${result.bytes} bytes)`);
  if (result.inputDurationSec != null && result.outputDurationSec != null) {
    console.log(
      `Duration: ${result.inputDurationSec.toFixed(2)}s → ${result.outputDurationSec.toFixed(2)}s` +
        (savedPct != null ? ` (−${savedPct.toFixed(0)}%)` : ""),
    );
  }
  console.log(`Kept segments: ${result.keptSegments.length}`);
  console.log(`Meta: ${metaPath}`);
  console.log(`Available: ${autoEditorAvailable()}`);
  console.log("Open Remotion Studio → composition AutoEditDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
