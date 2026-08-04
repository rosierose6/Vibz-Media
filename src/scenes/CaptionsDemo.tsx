import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GradientBackground } from "../components/GradientBackground";
import { AnimatedCaption } from "../components/AnimatedCaption";
import type { CaptionWord } from "../integrations/auto-captions";

export interface CaptionsDemoProps {
  audioFile: string;
  words: CaptionWord[];
}

/**
 * Word-level animated captions over Kokoro voiceover.
 *
 *   npm run tts
 *   npm run captions
 */
export const CaptionsDemo: React.FC<CaptionsDemoProps> = ({
  audioFile = "voiceover.wav",
  words = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />
      <Audio src={staticFile(audioFile)} />

      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 96,
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
          whisperx · word captions · {Math.floor(frame / fps)}s
        </div>
      </AbsoluteFill>

      <AnimatedCaption words={words} style="tiktok" maxWords={4} />
    </AbsoluteFill>
  );
};
