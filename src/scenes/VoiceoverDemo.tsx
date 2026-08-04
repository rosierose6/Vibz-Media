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

export interface VoiceoverDemoProps {
  text: string;
  audioFile: string;
}

/**
 * Minimal composition that plays a Kokoro-generated voiceover
 * over the cinematic Vanta background.
 *
 * Generate audio first: `npm run tts`
 */
export const VoiceoverDemo: React.FC<VoiceoverDemoProps> = ({
  text = "Welcome to the future of video.",
  audioFile = "voiceover.wav",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.6 * fps], [0, 1], {
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

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />
      <Audio src={staticFile(audioFile)} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 120,
          opacity: Math.min(fadeIn, fadeOut),
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          kokoro · in-process tts
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: "#f2ebe3",
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: 1400,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
