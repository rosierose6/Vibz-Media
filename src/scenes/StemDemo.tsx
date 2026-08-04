import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { STEM_COLORS } from "../integrations/audio-separator";

export interface StemLane {
  name: string;
  file: string;
  color: string;
}

export interface StemDemoProps {
  sourceFile: string;
  playFile: string;
  stems: StemLane[];
  peaks: Record<string, number[]>;
  engine: string;
  model: string;
  label: string;
}

function PeakRow({
  label,
  color,
  peaks,
  progress,
  height = 72,
}: {
  label: string;
  color: string;
  peaks: number[];
  progress: number;
  height?: number;
}) {
  const bars = peaks.length > 0 ? peaks : Array.from({ length: 64 }, () => 0.15);
  const active = Math.floor(progress * (bars.length - 1));

  return (
    <div style={{ width: "100%", marginBottom: 28 }}>
      <div
        style={{
          fontSize: 13,
          fontFamily: '"Courier New", Courier, monospace',
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        <span style={{ color }}>{label}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height,
          gap: 2,
        }}
      >
        {bars.map((v, i) => {
          const on = i <= active;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(8, v * 100)}%`,
                background: on ? color : "rgba(255,255,255,0.12)",
                borderRadius: 1,
                opacity: on ? 1 : 0.55,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Stem separation demo — mix / vocals / instrumental lanes.
 *
 *   npm run stems
 */
export const StemDemo: React.FC<StemDemoProps> = ({
  sourceFile = "soundtrack.wav",
  playFile = "generated/stems/vocals.wav",
  stems = [
    { name: "vocals", file: "generated/stems/vocals.wav", color: STEM_COLORS.vocals },
    {
      name: "instrumental",
      file: "generated/stems/instrumental.wav",
      color: STEM_COLORS.instrumental,
    },
  ],
  peaks = {},
  engine = "ffmpeg-ms",
  model = "mid-side",
  label = "audio-separator",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);

  const fadeIn = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.4 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const lanes: Array<{ name: string; color: string; peaks: number[] }> = [
    {
      name: "mix",
      color: STEM_COLORS.mix,
      peaks: peaks.mix ?? [],
    },
    ...stems.map((s) => ({
      name: s.name,
      color: s.color || STEM_COLORS[s.name] || STEM_COLORS.other,
      peaks: peaks[s.name] ?? [],
    })),
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#07090d" }}>
      {playFile ? <Audio src={staticFile(playFile)} /> : null}

      <AbsoluteFill
        style={{
          opacity,
          padding: "80px 120px",
          justifyContent: "center",
        }}
      >
        {lanes.map((lane) => (
          <PeakRow
            key={lane.name}
            label={lane.name}
            color={lane.color}
            peaks={lane.peaks}
            progress={progress}
          />
        ))}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity,
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
          {label} · {engine} · {sourceFile}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.08em",
            maxWidth: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {model}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
