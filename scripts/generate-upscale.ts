/**
 * Upscale an image with Real-ESRGAN ncnn Vulkan.
 *
 *   npm run upscale
 *   npm run upscale -- ./public/presenter-photo.jpg
 *   npm run upscale -- ./public/presenter-photo.jpg --scale 2 --model realesrgan-x4plus
 */

import path from "path";
import fs from "fs";
import {
  REAL_ESRGAN_MODELS,
  type RealEsrganModel,
  type UpscaleScale,
} from "../src/integrations/real-esrgan";
import {
  listRealEsrganModels,
  upscaleImage,
} from "../src/integrations/real-esrgan-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const flags = new Set(["--scale", "--model", "--out", "--format"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/presenter-photo.jpg";

  const scale = (Number.parseInt(argValue("--scale") ?? "4", 10) ||
    4) as UpscaleScale;
  const model = (argValue("--model") ??
    "realesrgan-x4plus") as RealEsrganModel;
  const format = (argValue("--format") ?? "png") as "png" | "jpg" | "webp";
  const out = argValue("--out");

  if (!REAL_ESRGAN_MODELS.includes(model)) {
    console.error(`Unknown model. Choose: ${listRealEsrganModels().join(", ")}`);
    process.exit(1);
  }

  const result = await upscaleImage(fileArg, {
    scale: ([2, 3, 4].includes(scale) ? scale : 4) as UpscaleScale,
    model,
    format,
    output: out,
  });

  const publicName = path.basename(result.output);
  const metaPath = path.resolve(process.cwd(), "public/upscale-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        beforeFile: path.basename(result.input),
        afterFile: publicName,
        scale: result.scale,
        model: result.model,
        engine: result.engine,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${result.output}`);
  console.log(
    `${result.width}×${result.height} · ${result.scale}× · ${result.model} · ${result.engine}`,
  );
  console.log(`Meta: ${metaPath}`);
  console.log("Open Remotion Studio → composition UpscaleDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
