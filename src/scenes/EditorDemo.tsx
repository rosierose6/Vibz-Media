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
import type {
  EditorTrack,
  RemotionEditorProps,
} from "../integrations/video-editor";

function mediaSrc(src?: string): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  return staticFile(src.replace(/^\.?\/?public\//, ""));
}

const TrackLayer: React.FC<{ track: EditorTrack }> = ({ track }) => {
  const frame = useCurrentFrame();
  const duration = Math.max(1, track.endFrame - track.startFrame);
  const props = track.properties ?? {};
  const opacityBase = props.opacity ?? 1;

  const fade = interpolate(
    frame,
    [0, Math.min(8, duration / 4), Math.max(duration - 8, duration / 2), duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const opacity = opacityBase * fade;
  const scale = props.scale ?? 1;
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const src = mediaSrc(track.src);

  if (track.type === "audio") {
    if (!src) return null;
    return <Audio src={src} volume={props.volume ?? 1} />;
  }

  if (track.type === "video") {
    if (!src) return null;
    return (
      <AbsoluteFill
        style={{
          opacity,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      >
        <OffthreadVideo
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: props.objectFit ?? "cover",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (track.type === "image") {
    if (!src) return null;
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      >
        <Img
          src={src}
          style={{
            height: "75%",
            width: "auto",
            maxWidth: "50%",
            objectFit: props.objectFit ?? "contain",
          }}
        />
      </AbsoluteFill>
    );
  }

  if (track.type === "text" || track.type === "caption") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems:
            props.textAlign === "left"
              ? "flex-start"
              : props.textAlign === "right"
                ? "flex-end"
                : "center",
          padding: 96,
          opacity,
          transform: `translate(${x}px, ${y}px)`,
        }}
      >
        <div
          style={{
            fontSize: props.fontSize ?? 48,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: props.color ?? "#f2ebe3",
            textAlign: props.textAlign ?? "center",
            maxWidth: 1400,
            lineHeight: 1.25,
          }}
        >
          {track.text ?? ""}
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

/**
 * Renders an EditorProject as Remotion Sequences.
 *
 *   npm run editor
 */
export const EditorDemo: React.FC<RemotionEditorProps> = ({
  tracks = [],
  effects: _effects = [],
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      {[...tracks]
        .sort((a, b) => a.layer - b.layer)
        .map((track) => (
          <Sequence
            key={track.id}
            from={track.startFrame}
            durationInFrames={Math.max(1, track.endFrame - track.startFrame)}
            name={`${track.type}:${track.id}`}
            layout="none"
          >
            <TrackLayer track={track} />
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
          editor project · {tracks.length} tracks
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
