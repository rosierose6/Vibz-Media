import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GradientBackground } from "../components/GradientBackground";

export interface ImageEditDemoProps {
  beforeFile: string;
  afterFile: string;
  recipe: string;
}

/**
 * Before/after cinematic grade via processImage + FILTER_RECIPES.
 *
 *   npm run grade
 */
export const ImageEditDemo: React.FC<ImageEditDemoProps> = ({
  beforeFile = "presenter-photo.jpg",
  afterFile = "photo-graded.jpg",
  recipe = "cinematic",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const wipe = interpolate(frame, [0.4 * fps, durationInFrames - 0.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: 900,
            height: 1120,
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
                width: 900,
                height: 1120,
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
              background: "rgba(242,235,227,0.85)",
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 72,
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
          sharp · {recipe} grade · before → after
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
