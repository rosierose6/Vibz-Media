import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface DenoiseDemoProps {
  beforeFile: string;
  afterFile: string;
  playFile: string;
  peaks: { before: number[]; after: number[] };
  engine: string;
  label: string;
}

function PeakRow({
  label,
  color,
  peaks,
  progress,
}: {
  label: string;
  color: string;
  peaks: number[];
  progress: number;
}) {
  const bars = peaks.length > 0 ? peaks : Array.from({ length: 64 }, () => 0.12);
  const active = Math.floor(progress * (bars.length - 1));

  return (
    <div style={{ width: "100%", marginBottom: 48 }}>
      <div
        style={{
          fontSize: 13,
          fontFamily: '"Courier New", Courier, monospace',
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          marginBottom: 12,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <span style={{ color }}>{label}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 100,
          gap: 2,
        }}
      >
        {bars.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(6, v * 100)}%`,
              background:
                i <= active ? color : "rgba(255,255,255,0.1)",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * DeepFilterNet before / after denoise demo.
 *
 *   npm run denoise
 */
export const DenoiseDemo: React.FC<DenoiseDemoProps> = ({
  beforeFile = "voiceover-noisy.wav",
  afterFile = "voiceover-clean.wav",
  playFile = "voiceover-clean.wav",
  peaks = { before: [], after: [] },
  engine = "ffmpeg",
  label = "deepfilternet",
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

  // Crossfade playback label
  const showingClean = progress > 0.45;

  return (
    <AbsoluteFill style={{ backgroundColor: "#06080c" }}>
      {playFile ? <Audio src={staticFile(playFile)} /> : null}

      <AbsoluteFill
        style={{
          opacity,
          padding: "100px 140px",
          justifyContent: "center",
        }}
      >
        <PeakRow
          label={`noisy · ${beforeFile}`}
          color="#f87171"
          peaks={peaks.before ?? []}
          progress={progress}
        />
        <PeakRow
          label={`clean · ${afterFile}`}
          color="#34d399"
          peaks={peaks.after ?? []}
          progress={progress}
        />
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
          {label} · {engine} · {showingClean ? "enhanced" : "noisy in"}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
