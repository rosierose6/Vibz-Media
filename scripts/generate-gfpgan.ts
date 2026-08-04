/**
 * Restore faces with GFPGAN.
 *
 *   npm run restore
 *   npm run restore -- ./public/presenter-photo.jpg
 *   npm run restore -- ./public/presenter-photo.jpg --version 1.4 --scale 2
 */

import path from "path";
import fs from "fs";
import {
  GFPGAN_VERSIONS,
  type GfpganVersion,
} from "../src/integrations/gfpgan";
import {
  gfpganAvailable,
  restoreFaces,
} from "../src/integrations/gfpgan-node";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const flags = new Set(["--version", "--scale", "--out"]);
  const fileArg =
    process.argv.slice(2).find((a, i, arr) => {
      if (a.startsWith("--")) return false;
      return !flags.has(arr[i - 1] ?? "");
    }) ?? "./public/presenter-photo.jpg";

  const version = (argValue("--version") ?? "1.4") as GfpganVersion;
  const scale = (Number.parseInt(argValue("--scale") ?? "2", 10) || 2) as
    | 1
    | 2
    | 4;
  const out = argValue("--out");

  if (!GFPGAN_VERSIONS.includes(version)) {
    console.error(`Unknown version. Choose: ${GFPGAN_VERSIONS.join(", ")}`);
    process.exit(1);
  }

  const result = await restoreFaces(fileArg, {
    version,
    scale: ([1, 2, 4].includes(scale) ? scale : 2) as 1 | 2 | 4,
    output: out,
  });

  const metaPath = path.resolve(process.cwd(), "public/gfpgan-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        beforeFile: path.basename(result.input),
        afterFile: path.basename(result.output),
        version: result.version,
        scale: result.scale,
        engine: result.engine,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        gfpganAvailable: gfpganAvailable(),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${result.output}`);
  console.log(
    `${result.width}×${result.height} · v${result.version} · ${result.scale}× · ${result.engine}`,
  );
  console.log(`Meta: ${metaPath}`);
  console.log("Open Remotion Studio → composition GfpganDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
