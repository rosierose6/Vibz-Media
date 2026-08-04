import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CaptionWord } from "../integrations/auto-captions";
import {
  CAPTION_PRESETS,
  getActiveWordIndex,
  getCaptionStyleCSS,
  getVisibleWords,
  type CaptionPresetName,
  type CaptionStyleConfig,
} from "../integrations/animated-captions";

export interface AnimatedCaptionProps {
  words: CaptionWord[];
  /** Named preset: tiktok | youtube | reels | karaoke */
  preset?: CaptionPresetName;
  /** Optional overrides merged onto the preset */
  styleConfig?: Partial<CaptionStyleConfig>;
  maxWords?: number;
}

/**
 * Frame-accurate word captions for Remotion sequences.
 *
 *   const captions = await transcribe("./audio.wav");
 *   const currentTime = frame / fps;
 *   const activeWord = getActiveWordIndex(captions, currentTime);
 *   const style = CAPTION_PRESETS.tiktok;
 */
export const AnimatedCaption: React.FC<AnimatedCaptionProps> = ({
  words,
  preset = "tiktok",
  styleConfig,
  maxWords,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const style: CaptionStyleConfig = {
    ...CAPTION_PRESETS[preset],
    ...styleConfig,
  };
  const windowSize = maxWords ?? style.maxWordsPerLine ?? 4;
  const visible = getVisibleWords(words, currentTime, windowSize);
  const activeIndex = getActiveWordIndex(words, currentTime);

  if (visible.length === 0) return null;

  const positionStyle =
    style.position === "top"
      ? { justifyContent: "flex-start" as const, paddingTop: 120 }
      : style.position === "center"
        ? { justifyContent: "center" as const }
        : { justifyContent: "flex-end" as const, paddingBottom: 140 };

  const youtubeBar =
    style.style === "subtitle" && style.backgroundColor
      ? {
          backgroundColor: style.backgroundColor,
          padding: style.padding ?? 12,
          borderRadius: 4,
        }
      : null;

  return (
    <AbsoluteFill
      style={{
        ...positionStyle,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 14,
          maxWidth: 1400,
          padding: "0 80px",
          ...youtubeBar,
        }}
      >
        {visible.map((word) => {
          const globalIndex = words.indexOf(word);
          const isActive = globalIndex === activeIndex;
          const wordStartFrame = Math.round(word.start * fps);
          const enter = spring({
            frame: frame - wordStartFrame,
            fps,
            config: { damping: 14, stiffness: 160, mass: 0.6 },
          });
          const css = getCaptionStyleCSS(style, isActive);
          const scaleBoost =
            style.style === "pop" || style.style === "tiktok"
              ? interpolate(enter, [0, 1], [0.88, isActive ? 1.12 : 1], {
                  extrapolateRight: "clamp",
                })
              : 1;

          return (
            <span
              key={`${word.word}-${word.start}`}
              style={{
                ...css,
                fontFamily:
                  style.fontFamily ??
                  '"Helvetica Neue", Helvetica, Arial, sans-serif',
                transform: `scale(${scaleBoost})`,
                opacity: isActive ? 1 : style.style === "karaoke" ? 0.45 : 0.55,
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
