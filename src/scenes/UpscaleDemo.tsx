import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface UpscaleDemoProps {
  beforeFile: string;
  afterFile: string;
  scale: number;
  model: string;
  engine: string;
  label: string;
}

/**
 * Before / after Real-ESRGAN upscale.
 *
 *   npm run upscale
 */
export const UpscaleDemo: React.FC<UpscaleDemoProps> = ({
  beforeFile = "presenter-photo.jpg",
  afterFile = "presenter-photo-upscaled-4x.png",
  scale = 4,
  model = "realesrgan-x4plus",
  engine = "sharp",
  label = "real-esrgan",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const wipe = interpolate(
    frame,
    [0.5 * fps, durationInFrames - 0.5 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const fadeIn = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill
        style={{
          opacity: fadeIn,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 960,
            height: 1200,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(beforeFile)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${wipe * 100}%`,
              overflow: "hidden",
            }}
          >
            <Img
              src={staticFile(afterFile)}
              style={{
                width: 960,
                height: 1200,
                objectFit: "cover",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${wipe * 100}%`,
              width: 2,
              background: "#FFD700",
              transform: "translateX(-1px)",
            }}
          />
        </div>
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
            marginBottom: 12,
          }}
        >
          {label} · {scale}× · {model} · {engine}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span>before</span>
          <span>after</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
