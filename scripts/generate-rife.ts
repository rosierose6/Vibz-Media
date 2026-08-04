/**
 * Interpolate video FPS with Practical-RIFE / rife-ncnn-vulkan.
 *
 *   npm run interpolate
 *   npm run interpolate -- ./public/ai-clip.mp4 --multi 2
 *   npm run interpolate -- ./public/ai-clip.mp4 --multi 4 --model rife-v4
 */

import path from "path";
import fs from "fs";
import {
  RIFE_MODELS,
  type RifeModel,
  type RifeMulti,
} from "../src/integrations/rife";
import { interpolateVideo } from "../src/integrations/rife-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const flags = new Set(["--multi", "--model", "--out", "--scale"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/ai-clip.mp4";

  const multi = (Number.parseInt(argValue("--multi") ?? "2", 10) ||
    2) as RifeMulti;
  const model = (argValue("--model") ?? "rife-v4") as RifeModel;
  const scale = Number.parseFloat(argValue("--scale") ?? "1") || 1;
  const out = argValue("--out");

  if (!RIFE_MODELS.includes(model)) {
    console.error(`Unknown model. Choose: ${RIFE_MODELS.join(", ")}`);
    process.exit(1);
  }

  const result = await interpolateVideo(fileArg, {
    multi: ([2, 4, 8].includes(multi) ? multi : 2) as RifeMulti,
    model,
    scale,
    output: out,
  });

  // Copy into public/ root alias for Remotion if under generated/
  const publicRel = path.relative(
    path.resolve(process.cwd(), "public"),
    result.output,
  );
  const metaPath = path.resolve(process.cwd(), "public/rife-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        sourceFile: path.basename(result.input),
        outputFile: publicRel.split(path.sep).join("/"),
        multi: result.multi,
        model: result.model,
        engine: result.engine,
        inputFps: result.inputFps,
        outputFps: result.outputFps,
        duration: result.duration,
        bytes: result.bytes,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${result.output}`);
  console.log(
    `${result.inputFps.toFixed(2)} → ${result.outputFps.toFixed(2)} fps · ${result.multi}× · ${result.model} · ${result.engine}`,
  );
  console.log(`Meta: ${metaPath}`);
  console.log("Open Remotion Studio → composition RifeDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
