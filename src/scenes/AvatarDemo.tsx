import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GradientBackground } from "../components/GradientBackground";

export interface AvatarDemoProps {
  text: string;
  videoFile: string;
  /** False when public/avatar.mp4 is missing — avoids OffthreadVideo crash. */
  hasVideo?: boolean;
}

/**
 * Talking-head composition: MuseTalk/LatentSync video over the Vibz Media backdrop.
 *
 * Pipeline:
 *   npm run tts
 *   # place public/headshot.jpg (or use presenter-photo.jpg), start avatar server on :8080
 *   npm run avatar   # falls back to ffmpeg still+audio if server is down
 */
export const AvatarDemo: React.FC<AvatarDemoProps> = ({
  text = "Welcome to the future of video.",
  videoFile = "avatar.mp4",
  hasVideo = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.5 * fps], [0, 1], {
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
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill>
      <GradientBackground frame={frame} />

      {hasVideo ? (
        <AbsoluteFill style={{ opacity }}>
          <OffthreadVideo
            src={staticFile(videoFile)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            opacity,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontFamily: '"Courier New", Courier, monospace',
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.8,
              padding: "0 80px",
            }}
          >
            Missing public/{videoFile}
            <br />
            Run npm run avatar
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(10,10,10,0.72) 0%, transparent 42%)",
          opacity,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 96,
          opacity,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          {hasVideo ? "musetalk · kokoro voiceover" : "avatar pending"}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 300,
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            color: "#f2ebe3",
            textAlign: "center",
            lineHeight: 1.3,
            maxWidth: 1100,
            padding: "0 80px",
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
