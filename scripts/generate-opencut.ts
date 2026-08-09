/**
 * OpenCut entrypoint for the video editor pipeline.
 *
 * Delegates to `generate-editor-project.ts` so OpenCut JSON and
 * Remotion editor props always stay in sync.
 *
 *   npm run opencut
 *   npm run opencut -- --import ./path/to/project.opencut.json
 *
 * Upstream CapCut UI (not vendored): https://github.com/OpenCut-app/OpenCut
 */

import { spawnSync } from "child_process";
import path from "path";

const script = path.resolve(__dirname, "generate-editor-project.ts");
const result = spawnSync(
  process.execPath,
  [
    path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs"),
    script,
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
