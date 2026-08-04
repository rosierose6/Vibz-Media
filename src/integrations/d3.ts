/**
 * VANTA — D3 Data Visualization
 *
 * Remotion-safe D3 helpers: scales + shape generators only (no DOM timers).
 * Animate with Remotion's frame / interpolate; D3 computes geometry.
 *
 * Usage:
 *   import { createChart } from "./integrations/d3";
 *
 *   const chart = createChart({
 *     type: "line",
 *     data: [
 *       { label: "Mon", value: 12 },
 *       { label: "Tue", value: 19 },
 *       { label: "Wed", value: 15 },
 *     ],
 *     width: 1400,
 *     height: 700,
 *   });
 *   // <path d={chart.linePath} />  + Remotion strokeDashoffset reveal
 *
 * Repos:
 *   - https://github.com/d3/d3
 */

import {
  max,
  scaleBand,
  scaleLinear,
  scaleOrdinal,
  line as d3Line,
  area as d3Area,
  arc as d3Arc,
  pie as d3Pie,
  curveCatmullRom,
  curveLinear,
} from "d3";

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

export type ChartType = "line" | "area" | "bar" | "pie";

export interface CreateChartOptions {
  type?: ChartType;
  data: Datum[];
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  colors?: string[];
  curve?: boolean;
}

export interface ChartBar {
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface ChartSlice {
  label: string;
  value: number;
  path: string;
  color: string;
  centroid: [number, number];
  startAngle: number;
  endAngle: number;
}

export interface ChartTick {
  value: number;
  y: number;
  label: string;
}

export interface ChartResult {
  type: ChartType;
  width: number;
  height: number;
  data: Datum[];
  bars: ChartBar[];
  slices: ChartSlice[];
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number; label: string; value: number }>;
  ticks: ChartTick[];
  colors: string[];
  innerWidth: number;
  innerHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

export const D3_PALETTE = [
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#94a3b8",
];

export const SAMPLE_SERIES: Datum[] = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 58 },
  { label: "Wed", value: 51 },
  { label: "Thu", value: 73 },
  { label: "Fri", value: 66 },
  { label: "Sat", value: 88 },
  { label: "Sun", value: 79 },
];

export const SAMPLE_CATEGORIES: Datum[] = [
  { label: "voice", value: 92 },
  { label: "avatar", value: 87 },
  { label: "captions", value: 95 },
  { label: "edit", value: 91 },
  { label: "gen", value: 78 },
  { label: "fx", value: 88 },
];

/**
 * Build chart geometry with D3 scales/shapes for Remotion SVG rendering.
 */
export function createChart(options: CreateChartOptions): ChartResult {
  const type = options.type ?? "line";
  const data = options.data.length ? options.data : SAMPLE_SERIES;
  const width = options.width ?? 1400;
  const height = options.height ?? 700;
  const margin = options.margin ?? {
    top: 40,
    right: 40,
    bottom: 60,
    left: 70,
  };
  const colors = options.colors ?? D3_PALETTE;
  const color = scaleOrdinal<string, string>()
    .domain(data.map((d) => d.label))
    .range(colors);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = scaleBand()
    .domain(data.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.22);

  const yMax = max(data, (d) => d.value) ?? 1;
  const y = scaleLinear()
    .domain([0, yMax * 1.12])
    .nice()
    .range([innerHeight, 0]);

  const bars: ChartBar[] = data.map((d) => ({
    label: d.label,
    value: d.value,
    x: margin.left + (x(d.label) ?? 0),
    y: margin.top + y(d.value),
    width: x.bandwidth(),
    height: innerHeight - y(d.value),
    color: d.color ?? color(d.label),
  }));

  const points = data.map((d) => ({
    x: margin.left + (x(d.label) ?? 0) + x.bandwidth() / 2,
    y: margin.top + y(d.value),
    label: d.label,
    value: d.value,
  }));

  const curve = options.curve === false ? curveLinear : curveCatmullRom.alpha(0.5);

  const lineGen = d3Line<(typeof points)[number]>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curve);

  const areaGen = d3Area<(typeof points)[number]>()
    .x((d) => d.x)
    .y0(margin.top + innerHeight)
    .y1((d) => d.y)
    .curve(curve);

  const linePath = lineGen(points) ?? "";
  const areaPath = areaGen(points) ?? "";

  const ticks: ChartTick[] = y.ticks(5).map((v) => ({
    value: v,
    y: margin.top + y(v),
    label: String(v),
  }));

  const radius = Math.min(innerWidth, innerHeight) / 2;
  const pieGen = d3Pie<Datum>()
    .value((d) => d.value)
    .sort(null);
  const arcGen = d3Arc<ReturnType<typeof pieGen>[number]>()
    .innerRadius(radius * 0.55)
    .outerRadius(radius);

  const slices: ChartSlice[] = pieGen(data).map((s) => {
    const path = arcGen(s) ?? "";
    const c = arcGen.centroid(s);
    return {
      label: s.data.label,
      value: s.data.value,
      path,
      color: s.data.color ?? color(s.data.label),
      centroid: [
        margin.left + innerWidth / 2 + c[0],
        margin.top + innerHeight / 2 + c[1],
      ],
      startAngle: s.startAngle,
      endAngle: s.endAngle,
    };
  });

  return {
    type,
    width,
    height,
    data,
    bars,
    slices,
    linePath,
    areaPath,
    points,
    ticks,
    colors,
    innerWidth,
    innerHeight,
    margin,
  };
}

/** Approximate path length for stroke-dashoffset reveals. */
export function estimatePathLength(path: string): number {
  // Cheap heuristic from coordinate pairs — good enough for dash reveal.
  const nums = path.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  let len = 0;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    const dx = (nums[i] ?? 0) - (nums[i - 2] ?? 0);
    const dy = (nums[i + 1] ?? 0) - (nums[i - 1] ?? 0);
    len += Math.hypot(dx, dy);
  }
  return Math.max(len, 1);
}
