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
import {
  CAPTION_PRESETS,
  getActiveWordIndex,
  type CaptionPresetName,
} from "../integrations/animated-captions";

export interface CaptionsDemoProps {
  audioFile: string;
  words: CaptionWord[];
  preset: CaptionPresetName;
}

/**
 * Word-level animated captions over Kokoro voiceover.
 *
 *   npm run tts
 *   npm run captions
 *
 *   const captions = await transcribe("./audio.wav");
 *   const currentTime = frame / fps;
 *   const activeWord = getActiveWordIndex(captions, currentTime);
 *   const style = CAPTION_PRESETS.tiktok;
 */
export const CaptionsDemo: React.FC<CaptionsDemoProps> = ({
  audioFile = "voiceover.wav",
  words = [],
  preset = "tiktok",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const activeWord = getActiveWordIndex(words, currentTime);
  const style = CAPTION_PRESETS[preset];

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
          {preset} ·{" "}
          {activeWord >= 0 ? words[activeWord]?.word : "—"} ·{" "}
          {currentTime.toFixed(1)}s
        </div>
      </AbsoluteFill>

      <AnimatedCaption
        words={words}
        preset={preset}
        maxWords={style.maxWordsPerLine}
      />
    </AbsoluteFill>
  );
};
