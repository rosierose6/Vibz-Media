import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface AutoEditDemoProps {
  sourceFile: string;
  outputFile: string;
  engine: string;
  margin: string;
  edit: string;
  inputDurationSec: number;
  outputDurationSec: number;
  savedPct: number;
  label: string;
}

/**
 * Before / after auto-editor silence cut.
 *
 *   npm run autoedit
 */
export const AutoEditDemo: React.FC<AutoEditDemoProps> = ({
  sourceFile = "generated/padded-talk.mp4",
  outputFile = "generated/padded-talk-cut.mp4",
  engine = "ffmpeg",
  margin = "0.2sec",
  edit = "audio",
  inputDurationSec = 0,
  outputDurationSec = 0,
  savedPct = 0,
  label = "auto-editor",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const wipe = interpolate(
    frame,
    [0.4 * fps, durationInFrames - 0.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#050508" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <OffthreadVideo
              src={staticFile(sourceFile)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 40,
                bottom: 40,
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 14,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              original
              {inputDurationSec
                ? ` · ${inputDurationSec.toFixed(1)}s`
                : ""}
            </div>
          </div>
          <div
            style={{
              width: `${wipe * 50}%`,
              overflow: "hidden",
              position: "relative",
              borderLeft: "2px solid #FFD700",
            }}
          >
            <div style={{ width: "100vw", height: "100%", marginLeft: "-50vw" }}>
              <OffthreadVideo
                src={staticFile(outputFile)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: 40,
                bottom: 40,
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 14,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              cut
              {outputDurationSec
                ? ` · ${outputDurationSec.toFixed(1)}s`
                : ""}
              {savedPct > 0 ? ` · −${savedPct.toFixed(0)}%` : ""}
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: fadeIn,
          justifyContent: "flex-start",
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
          {label} · {engine} · margin {margin}
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
          {edit}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
