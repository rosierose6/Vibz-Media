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

export interface BgRemoveDemoProps {
  cutoutFile: string;
  label: string;
}

/**
 * Composite a transparent cutout over the Vanta backdrop.
 *
 *   npm run cutout
 */
export const BgRemoveDemo: React.FC<BgRemoveDemoProps> = ({
  cutoutFile = "cutout.png",
  label = "imgly · background removal",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

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
  const opacity = Math.min(fadeIn, fadeOut);
  const rise = interpolate(frame, [0, fps], [24, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity,
          transform: `translateY(${rise}px)`,
        }}
      >
        <Img
          src={staticFile(cutoutFile)}
          style={{
            height: "78%",
            width: "auto",
            maxWidth: "55%",
            objectFit: "contain",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 80,
          opacity,
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
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
