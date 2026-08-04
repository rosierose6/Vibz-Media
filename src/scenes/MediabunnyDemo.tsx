import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  formatDuration,
  formatResolution,
  type MediaInfo,
} from "../integrations/mediabunny";

export interface MediabunnyDemoProps {
  sourceFile: string;
  label: string;
  meta: MediaInfo | null;
}

/**
 * mediabunny metadata overlay on a source clip.
 *
 *   npm run media
 */
export const MediabunnyDemo: React.FC<MediabunnyDemoProps> = ({
  sourceFile = "ai-clip.mp4",
  label = "mediabunny",
  meta = null,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.4 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const rows = [
    ["duration", meta ? formatDuration(meta.duration) : "—"],
    ["resolution", formatResolution(meta?.video)],
    ["video codec", meta?.video?.codec ?? "—"],
    ["audio codec", meta?.audio?.codec ?? "none"],
    ["format", meta?.format ?? pathExt(sourceFile)],
    ["engine", meta?.engine ?? "mediabunny"],
  ] as const;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill style={{ opacity: opacity * 0.55 }}>
        <OffthreadVideo
          src={staticFile(sourceFile)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity,
          justifyContent: "center",
          paddingLeft: 120,
          paddingRight: 120,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 200,
            color: "#FFFFFF",
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            letterSpacing: "-0.02em",
            marginBottom: 40,
          }}
        >
          {sourceFile}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map(([key, value]) => (
            <div
              key={key}
              style={{
                display: "flex",
                gap: 32,
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 18,
              }}
            >
              <div
                style={{
                  width: 160,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  fontSize: 13,
                  paddingTop: 4,
                }}
              >
                {key}
              </div>
              <div style={{ color: "#FFD700" }}>{value}</div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function pathExt(file: string): string {
  const i = file.lastIndexOf(".");
  return i === -1 ? "—" : file.slice(i + 1);
}
