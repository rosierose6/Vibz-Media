/**
 * Snapshot tsparticles presets for Remotion.
 *
 *   npm run particles
 *   npm run particles -- fireworks
 */

import path from "path";
import fs from "fs";
import {
  createParticles,
  listPresets,
  PRESETS,
  type ParticlePresetName,
} from "../src/integrations/tsparticles";

async function main() {
  const arg = (process.argv[2] ?? "links").toLowerCase();
  const presets = listPresets();
  const preset = (
    presets.includes(arg as ParticlePresetName) ? arg : "links"
  ) as ParticlePresetName;

  const factory = PRESETS[preset];
  const system = createParticles(
    factory(
      preset === "links"
        ? {
            count: 60,
            colors: ["#ffffff"],
            background: "#0d1117",
          }
        : {},
    ),
  );

  const sample = system.getStateAtFrame(30, 30);
  const out = path.resolve(__dirname, "../public/particles.json");

  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        preset,
        presets,
        options: system.options,
        sample: {
          frame: 30,
          particleCount: sample.particles.length,
          linkCount: sample.links.length,
          background: sample.background,
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${out}`);
  console.log(`Preset: ${preset} · particles: ${sample.particles.length}`);
  console.log(`Available: ${presets.join(", ")}`);
  console.log("Open Remotion Studio → composition ParticlesDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
