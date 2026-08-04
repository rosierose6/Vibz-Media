/**
 * List / snapshot the transition catalog.
 *
 *   npm run transitions
 */

import path from "path";
import fs from "fs";
import {
  applyTransition,
  listTransitionNames,
  listTransitions,
} from "../src/integrations/transitions";

async function main() {
  const all = listTransitions();
  const names = listTransitionNames();

  const cube = applyTransition("cube", { duration: 30 });
  const glitch = applyTransition("glitch", { duration: 15, intensity: 0.8 });

  const out = path.resolve(__dirname, "../public/transitions.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        categories: all,
        count: names.length,
        names,
        samples: {
          cube: { type: cube.type, config: cube.config },
          glitch: { type: glitch.type, config: glitch.config },
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Transitions: ${names.length}`);
  for (const [category, items] of Object.entries(all)) {
    console.log(`  ${category}: ${items.join(", ")}`);
  }
  console.log(`cube → ${cube.config.duration}f · glitch → ${glitch.config.duration}f`);
  console.log(`Wrote ${out}`);
  console.log("Open Remotion Studio → composition TransitionsDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
