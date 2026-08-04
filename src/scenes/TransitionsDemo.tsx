import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { GradientBackground } from "../components/GradientBackground";
import {
  applyTransition,
  type TransitionType,
} from "../integrations/transitions";

export interface TransitionsDemoProps {
  firstTransition: TransitionType;
  secondTransition: TransitionType;
  sceneDuration: number;
}

const SceneCard: React.FC<{
  label: string;
  accent: string;
}> = ({ label, accent }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: `radial-gradient(circle at 30% 30%, ${accent}22, transparent 55%)`,
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
          transition demo
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: "#f2ebe3",
            letterSpacing: "-0.03em",
          }}
        >
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Named transitions via applyTransition() → Remotion TransitionSeries.
 *
 *   const cube = applyTransition("cube", { duration: 30 });
 *   const glitch = applyTransition("glitch", { duration: 15, intensity: 0.8 });
 */
export const TransitionsDemo: React.FC<TransitionsDemoProps> = ({
  firstTransition = "cube",
  secondTransition = "glitch",
  sceneDuration = 75,
}) => {
  const cube = applyTransition(firstTransition, { duration: 30 });
  const glitch = applyTransition(secondTransition, {
    duration: 15,
    intensity: 0.8,
  });

  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <SceneCard label="Scene A" accent="#F2C94C" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={cube.presentation}
          timing={cube.timing}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <SceneCard label="Scene B" accent="#E85D4C" />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={glitch.presentation}
          timing={glitch.timing}
        />

        <TransitionSeries.Sequence durationInFrames={sceneDuration}>
          <SceneCard label="Scene C" accent="#7DCFB6" />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
