import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GradientBackground } from "../components/GradientBackground";

export interface MusicDemoProps {
  prompt: string;
  audioFile: string;
  bpm: number;
}

/**
 * Soundtrack demo for ACE-Step (or local music stub).
 *
 *   npm run music:server
 *   npm run music -- "cinematic orchestral tension building"
 */
export const MusicDemo: React.FC<MusicDemoProps> = ({
  prompt = "cinematic orchestral tension building",
  audioFile = "soundtrack.wav",
  bpm = 96,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.8 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.8 * fps, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(
    Math.sin((frame / fps) * ((bpm / 60) * Math.PI * 2)),
    [-1, 1],
    [0.35, 1],
  );

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />
      <Audio src={staticFile(audioFile)} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity,
          padding: 120,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "#F2C94C",
            opacity: pulse,
            marginBottom: 40,
            boxShadow: `0 0 ${20 + pulse * 30}px rgba(242,201,76,${0.25 + pulse * 0.35})`,
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          ace-step · {bpm} bpm
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: "#f2ebe3",
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: 1200,
          }}
        >
          {prompt}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
