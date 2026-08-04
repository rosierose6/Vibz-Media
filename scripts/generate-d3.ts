/**
 * Generate D3 chart geometry for Remotion.
 *
 *   npm run d3
 *   npm run d3 -- --type bar
 *   npm run d3 -- --type pie --preset categories
 */

import path from "path";
import fs from "fs";
import {
  createChart,
  estimatePathLength,
  SAMPLE_CATEGORIES,
  SAMPLE_SERIES,
  type ChartType,
  type Datum,
} from "../src/integrations/d3";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const type = (argValue("--type") as ChartType) ?? "line";
  const preset = argValue("--preset") ?? "series";
  const data: Datum[] =
    preset === "categories" ? SAMPLE_CATEGORIES : SAMPLE_SERIES;

  const chart = createChart({
    type,
    data,
    width: 1400,
    height: 720,
  });

  const metaPath = path.resolve(process.cwd(), "public/d3-meta.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        type: chart.type,
        data: chart.data,
        bars: chart.bars,
        slices: chart.slices,
        linePath: chart.linePath,
        areaPath: chart.areaPath,
        points: chart.points,
        ticks: chart.ticks,
        colors: chart.colors,
        width: chart.width,
        height: chart.height,
        margin: chart.margin,
        pathLength: estimatePathLength(chart.linePath),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Chart: ${type} · ${data.length} points`);
  console.log(`Path length ≈ ${estimatePathLength(chart.linePath).toFixed(0)}`);
  console.log(`Meta: ${metaPath}`);
  console.log("Open Remotion Studio → composition D3Demo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
