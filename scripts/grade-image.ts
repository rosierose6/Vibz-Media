/**
 * Color-grade a photo with Sharp + FILTER_RECIPES.
 *
 *   npm run grade
 *   npm run grade -- ./public/presenter-photo.jpg cinematic
 *   npm run grade -- ./public/presenter-photo.jpg noir ./public/photo-graded.jpg
 */

import path from "path";
import fs from "fs";
import {
  FILTER_RECIPES,
  processImage,
  type FilterPreset,
} from "../src/integrations/image-editor";

async function main() {
  const input =
    process.argv[2] ??
    path.resolve(__dirname, "../public/presenter-photo.jpg");
  const recipeName = (process.argv[3] ?? "cinematic") as FilterPreset;
  const output =
    process.argv[4] ??
    path.resolve(__dirname, "../public/photo-graded.jpg");

  if (!fs.existsSync(input)) {
    throw new Error(`Missing ${input}`);
  }
  if (!(recipeName in FILTER_RECIPES)) {
    throw new Error(
      `Unknown recipe "${recipeName}". Use: ${Object.keys(FILTER_RECIPES).join(", ")}`,
    );
  }

  console.log(`Input:  ${input}`);
  console.log(`Recipe: ${recipeName}`);
  console.log(`Output: ${output}`);

  const result = await processImage(input, {
    resize: { width: 1920 },
    colorCorrect: FILTER_RECIPES[recipeName],
    sharpen: true,
    format: "jpeg",
    quality: 90,
    output,
  });

  const metaPath = path.resolve(__dirname, "../public/photo-graded-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        source: path.basename(input),
        file: path.basename(output),
        recipe: recipeName,
        width: result.width,
        height: result.height,
        size: result.size,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `Wrote ${result.path} (${result.width}×${result.height}, ${(result.size / 1024).toFixed(1)} KB)`,
  );
  console.log("Open Remotion Studio → composition ImageEditDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
