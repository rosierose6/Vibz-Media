import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface Sam2DemoProps {
  sourceFile: string;
  maskFile: string;
  cutoutFile: string;
  engine: string;
  label: string;
}

/**
 * SAM 2 click-to-mask demo (subject cutout + mask wipe).
 *
 *   npm run sam
 */
export const Sam2Demo: React.FC<Sam2DemoProps> = ({
  sourceFile = "presenter-photo.jpg",
  maskFile = "presenter-photo-mask.png",
  cutoutFile = "presenter-photo-sam-cutout.png",
  engine = "imgly",
  label = "sam2",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const wipe = interpolate(
    frame,
    [0.4 * fps, durationInFrames - 0.4 * fps],
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
          gap: 48,
          flexDirection: "row",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 720,
            height: 900,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(sourceFile)}
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
              mixBlendMode: "screen",
            }}
          >
            <Img
              src={staticFile(maskFile)}
              style={{
                width: 720,
                height: 900,
                objectFit: "cover",
                filter: "brightness(0) saturate(100%) invert(76%) sepia(61%) saturate(747%) hue-rotate(360deg)",
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

        <div
          style={{
            width: 720,
            height: 900,
            background:
              "linear-gradient(160deg, #1a1a2e 0%, #0d1117 50%, #16213e 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(cutoutFile)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
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
          }}
        >
          {label} · click → mask · {engine}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
