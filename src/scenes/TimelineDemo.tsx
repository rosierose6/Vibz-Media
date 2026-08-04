import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { GradientBackground } from "../components/GradientBackground";
import type { RemotionSequenceData } from "../integrations/timeline";

export interface TimelineDemoProps {
  sequences: RemotionSequenceData[];
  fps: number;
  durationInFrames: number;
}

function mediaSrc(src?: string): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  return staticFile(src.replace(/^\.?\/?public\//, ""));
}

const SequenceLayer: React.FC<{ seq: RemotionSequenceData }> = ({ seq }) => {
  const frame = useCurrentFrame();
  const src = mediaSrc(seq.src);
  const opacity = seq.style.opacity ?? 1;
  const fade = interpolate(
    frame,
    [0, 6, Math.max(7, seq.durationInFrames - 6), seq.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (seq.type === "audio") {
    if (!src) return null;
    return <Audio src={src} volume={seq.style.volume ?? 1} />;
  }

  if (seq.type === "video") {
    if (!src) return null;
    return (
      <AbsoluteFill style={{ opacity: opacity * fade }}>
        <OffthreadVideo
          src={src}
          startFrom={seq.trimStart ?? 0}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    );
  }

  if (seq.type === "image") {
    if (!src) return null;
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: opacity * fade,
        }}
      >
        <Img
          src={src}
          style={{ height: "70%", width: "auto", maxWidth: "45%", objectFit: "contain" }}
        />
      </AbsoluteFill>
    );
  }

  if (seq.type === "text") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 100,
          opacity: opacity * fade,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: "#f2ebe3",
            textAlign: "center",
            maxWidth: 1200,
          }}
        >
          {seq.text ?? ""}
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

/**
 * Renders timeline sequences as Remotion <Sequence> components.
 *
 *   npm run timeline
 */
export const TimelineDemo: React.FC<TimelineDemoProps> = ({
  sequences = [],
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      {sequences.map((seq) => (
        <Sequence
          key={seq.id}
          from={seq.from}
          durationInFrames={seq.durationInFrames}
          name={`${seq.type}:t${seq.trackIndex}`}
          layout="none"
        >
          <SequenceLayer seq={seq} />
        </Sequence>
      ))}

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
          timeline · {sequences.length} sequences
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
