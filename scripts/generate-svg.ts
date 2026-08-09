/**
 * Generate the VIBZ MEDIA vector mark for Remotion.
 *
 *   npm run svg
 */

import path from "path";
import fs from "fs";
import { createVibzMark } from "../src/integrations/vector-graphics";

async function main() {
  const { doc, svg } = createVibzMark();
  const outDir = path.resolve(__dirname, "../public");
  const outSvg = path.join(outDir, "vibz-mark.svg");
  const outMeta = path.join(outDir, "vibz-mark-meta.json");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outSvg, svg);
  fs.writeFileSync(
    outMeta,
    JSON.stringify(
      {
        file: "vibz-mark.svg",
        width: doc.width,
        height: doc.height,
        elements: doc.elements.length,
        defs: doc.defs.length,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${outSvg}`);
  console.log(`Elements: ${doc.elements.length} · Defs: ${doc.defs.length}`);
  console.log("Open Remotion Studio → composition VectorGraphicsDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
