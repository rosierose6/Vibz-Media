import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createVibzMark } from "../integrations/vector-graphics";

export interface VectorGraphicsDemoProps {
  label: string;
}

/**
 * Programmatic SVG mark from createSVG / addCircle / addText / exportSVG.
 *
 *   npm run svg
 */
export const VectorGraphicsDemo: React.FC<VectorGraphicsDemoProps> = ({
  label = "vector graphics · svg",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { svg } = createVibzMark();

  const fadeIn = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const scale = interpolate(frame, [0, fps], [0.92, 1], {
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <AbsoluteFill
        style={{
          opacity,
          transform: `scale(${scale})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{ width: "100%", height: "100%" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 64,
          opacity,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
