import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ChartBar, ChartSlice, ChartTick, Datum } from "../integrations/d3";

export interface D3DemoProps {
  type: "line" | "area" | "bar" | "pie";
  data: Datum[];
  bars: ChartBar[];
  slices: ChartSlice[];
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number; label: string; value: number }>;
  ticks: ChartTick[];
  colors: string[];
  width: number;
  height: number;
  pathLength: number;
  label: string;
}

/**
 * D3-powered Remotion chart (line / area / bar / pie).
 *
 *   npm run d3
 */
export const D3Demo: React.FC<D3DemoProps> = ({
  type = "line",
  data = [],
  bars = [],
  slices = [],
  linePath = "",
  areaPath = "",
  points = [],
  ticks = [],
  colors = ["#f59e0b"],
  width = 1400,
  height = 720,
  pathLength = 2000,
  label = "d3",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const draw = interpolate(frame, [0.2 * fps, durationInFrames - 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const offsetX = (1920 - width) / 2;
  const offsetY = (1080 - height) / 2 - 20;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, #121820 0%, #07090d 55%, #050608 100%)",
      }}
    >
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            {ticks.map((t) => (
              <g key={t.value}>
                <line
                  x1={70}
                  x2={width - 40}
                  y1={t.y}
                  y2={t.y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={58}
                  y={t.y + 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.35)"
                  fontFamily='"Courier New", Courier, monospace'
                  fontSize={12}
                >
                  {t.label}
                </text>
              </g>
            ))}

            {(type === "area" || type === "line") && areaPath ? (
              <path
                d={areaPath}
                fill={colors[0] ?? "#f59e0b"}
                opacity={0.12 * draw}
              />
            ) : null}

            {(type === "line" || type === "area") && linePath ? (
              <path
                d={linePath}
                fill="none"
                stroke={colors[0] ?? "#f59e0b"}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength * (1 - draw)}
              />
            ) : null}

            {(type === "line" || type === "area") &&
              points.map((p, i) => {
                const appear = interpolate(
                  draw,
                  [i / Math.max(1, points.length), (i + 1) / Math.max(1, points.length)],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                return (
                  <circle
                    key={p.label}
                    cx={p.x}
                    cy={p.y}
                    r={5 * appear}
                    fill="#0a0a0a"
                    stroke={colors[0] ?? "#f59e0b"}
                    strokeWidth={2}
                    opacity={appear}
                  />
                );
              })}

            {type === "bar" &&
              bars.map((b, i) => {
                const delay = i / Math.max(1, bars.length);
                const local = interpolate(draw, [delay * 0.6, 1], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const bh = b.height * local;
                return (
                  <g key={b.label}>
                    <rect
                      x={b.x}
                      y={b.y + b.height - bh}
                      width={b.width}
                      height={bh}
                      fill={b.color}
                      rx={2}
                    />
                    <text
                      x={b.x + b.width / 2}
                      y={height - 28}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.45)"
                      fontFamily='"Courier New", Courier, monospace'
                      fontSize={13}
                      letterSpacing="0.08em"
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

            {type === "pie" ? (
              <g transform={`translate(${width / 2}, ${height / 2})`}>
                {slices.map((s, i) => {
                  const local = interpolate(
                    draw,
                    [i / Math.max(1, slices.length), 1],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  return (
                    <path
                      key={s.label}
                      d={s.path}
                      fill={s.color}
                      opacity={0.35 + 0.65 * local}
                      stroke="#07090d"
                      strokeWidth={2}
                      transform={`scale(${0.85 + 0.15 * local})`}
                    />
                  );
                })}
              </g>
            ) : null}

            {(type === "line" || type === "area") &&
              data.map((d, i) => {
                const p = points[i];
                if (!p) return null;
                return (
                  <text
                    key={d.label}
                    x={p.x}
                    y={height - 28}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontFamily='"Courier New", Courier, monospace'
                    fontSize={13}
                    letterSpacing="0.08em"
                  >
                    {d.label}
                  </text>
                );
              })}
          </g>
        </svg>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: fadeIn,
          justifyContent: "flex-end",
          padding: 64,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          {label} · {type} · {data.length} points
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
