import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionWord } from "../integrations/auto-captions";
import {
  CAPTION_PRESETS,
  getActiveWordIndex,
  getVisibleWords,
  type CaptionStyle,
} from "../integrations/animated-captions";

export interface AnimatedCaptionProps {
  words: CaptionWord[];
  style?: CaptionStyle;
  maxWords?: number;
}

/**
 * Frame-accurate word captions for Remotion sequences.
 */
export const AnimatedCaption: React.FC<AnimatedCaptionProps> = ({
  words,
  style = "tiktok",
  maxWords = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const preset = CAPTION_PRESETS[style] ?? CAPTION_PRESETS.tiktok;
  const visible = getVisibleWords(words, currentTime, maxWords);
  const activeIndex = getActiveWordIndex(words, currentTime);

  if (visible.length === 0) return null;

  const positionStyle =
    preset.position === "top"
      ? { justifyContent: "flex-start" as const, paddingTop: 120 }
      : preset.position === "center"
        ? { justifyContent: "center" as const }
        : { justifyContent: "flex-end" as const, paddingBottom: 140 };

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
          const scale = isActive
            ? interpolate(enter, [0, 1], [0.92, 1.12], {
                extrapolateRight: "clamp",
              })
            : interpolate(enter, [0, 1], [0.85, 1], {
                extrapolateRight: "clamp",
              });

          return (
            <span
              key={`${word.word}-${word.start}`}
              style={{
                fontFamily:
                  '"Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: preset.fontSize ?? 64,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: isActive
                  ? (preset.activeColor ?? "#F2C94C")
                  : (preset.color ?? "#F2EBE3"),
                opacity: isActive ? 1 : 0.55,
                transform: `scale(${scale})`,
                display: "inline-block",
                textShadow: isActive
                  ? "0 2px 24px rgba(242,201,76,0.35)"
                  : "0 2px 18px rgba(0,0,0,0.55)",
                WebkitTextStroke: preset.outline
                  ? `${preset.outlineWidth ?? 2}px ${preset.outlineColor ?? "#0a0a0a"}`
                  : undefined,
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
