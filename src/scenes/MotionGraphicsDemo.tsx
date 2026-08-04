import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GradientBackground } from "../components/GradientBackground";
import { MotionShape } from "../components/MotionShape";
import {
  animateShape,
  TEMPLATES,
} from "../integrations/motion-graphics";

export interface MotionGraphicsDemoProps {
  lowerThirdText: string;
  accent: string;
}

/**
 * Motion graphics from animateShape / createBurst / TEMPLATES.
 *
 *   const circle = animateShape("circle", { ... });
 *   const confetti = TEMPLATES.confetti([...]);
 *   const title = TEMPLATES.lowerThird("John Smith — CEO", "#FFD700");
 */
export const MotionGraphicsDemo: React.FC<MotionGraphicsDemoProps> = ({
  lowerThirdText = "John Smith — CEO",
  accent = "#FFD700",
}) => {
  const frame = useCurrentFrame();

  const circle = animateShape("circle", {
    from: { scale: 0, opacity: 0, x: 0, y: 0, radius: 70, fill: accent },
    to: { scale: 1, opacity: 1, x: 200, y: 100, radius: 70, fill: accent },
    duration: 30,
    easing: "spring",
  });

  const confetti = TEMPLATES.confetti(["#FFD700", "#FF4444", "#44FF44"]);
  const title = TEMPLATES.lowerThird(lowerThirdText, accent);

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      {/* Centered stage for circle + confetti */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <svg width={900} height={700} viewBox="-450 -350 900 700">
          <MotionShape shape={circle} frame={frame} />
          {confetti.map((shape, i) => (
            <MotionShape key={`c-${i}`} shape={shape} frame={frame - 20} />
          ))}
        </svg>
      </AbsoluteFill>

      {/* Lower third */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: "0 0 120px 120px",
        }}
      >
        <div style={{ position: "relative", width: 520, height: 90 }}>
          <svg width={520} height={90} viewBox="0 0 520 90">
            {title.shapes.map((shape, i) => (
              <MotionShape key={`lt-${i}`} shape={shape} frame={frame - 10} />
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 18,
              fontSize: 28,
              fontWeight: 500,
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              color: "#0a0a0a",
              opacity: title.shapes[0].getPropsAtFrame(frame - 10).opacity ?? 0,
            }}
          >
            {title.text}
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "flex-start",
          padding: 48,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          motion graphics · shapes · bursts · templates
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
