import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface RifeDemoProps {
  sourceFile: string;
  outputFile: string;
  multi: number;
  model: string;
  engine: string;
  inputFps: number;
  outputFps: number;
  label: string;
}

/**
 * Before / after RIFE frame interpolation.
 *
 *   npm run interpolate
 */
export const RifeDemo: React.FC<RifeDemoProps> = ({
  sourceFile = "ai-clip.mp4",
  outputFile = "generated/ai-clip-2x.mp4",
  multi = 2,
  model = "rife-v4",
  engine = "ffmpeg",
  inputFps = 30,
  outputFps = 60,
  label = "practical-rife",
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
          }}
        >
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
              original · {inputFps.toFixed(0)} fps
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
                color: "#FFD700",
              }}
            >
              {multi}× · {outputFps.toFixed(0)} fps
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: fadeIn,
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 48,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
          }}
        >
          {label} · {model} · {engine}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
