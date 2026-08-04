/**
 * Remove background from a photo for Remotion compositing.
 *
 *   # place public/presenter-photo.jpg first
 *   npm run cutout
 *   npm run cutout -- ./public/presenter-photo.jpg
 */

import path from "path";
import fs from "fs";
import { removeBackground } from "../src/integrations/background-removal";

async function main() {
  const input =
    process.argv[2] ??
    path.resolve(__dirname, "../public/presenter-photo.jpg");
  const outDir = path.resolve(__dirname, "../public");
  const outPng = path.join(outDir, "cutout.png");
  const outMeta = path.join(outDir, "cutout-meta.json");

  if (!fs.existsSync(input)) {
    throw new Error(
      `Missing ${input}\nAdd a headshot/photo as public/presenter-photo.jpg`,
    );
  }

  console.log(`Removing background: ${input}`);
  console.log("(first run downloads the ONNX model…)");

  const result = await removeBackground(input, { outputPath: outPng });

  const meta = {
    source: path.basename(input),
    file: "cutout.png",
    width: result.width,
    height: result.height,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${result.url} (${result.width}×${result.height})`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition BgRemoveDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
