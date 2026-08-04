import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface SceneMeta {
  index: number;
  start: number;
  end: number;
  file: string | null;
}

export interface SceneDetectDemoProps {
  sourceFile: string;
  scenes: SceneMeta[];
  thumbs: string[];
  engine: string;
  detector: string;
  threshold: number;
  sceneCount: number;
  label: string;
}

/**
 * PySceneDetect scene cut demo — source + scene thumbs.
 *
 *   npm run scenes
 */
export const SceneDetectDemo: React.FC<SceneDetectDemoProps> = ({
  sourceFile = "generated/multi-scene.mp4",
  scenes = [],
  thumbs = [],
  engine = "ffmpeg",
  detector = "content",
  threshold = 27,
  sceneCount = 0,
  label = "pyscenedetect",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const progress = frame / Math.max(1, durationInFrames - 1);
  const activeIdx = Math.min(
    Math.max(0, thumbs.length - 1),
    Math.floor(progress * Math.max(1, thumbs.length)),
  );

  const thumbList =
    thumbs.length > 0
      ? thumbs
      : scenes
          .map((s) => s.file)
          .filter((f): f is string => Boolean(f));

  return (
    <AbsoluteFill style={{ backgroundColor: "#06070b" }}>
      <AbsoluteFill style={{ opacity: fadeIn, flexDirection: "row" }}>
        <div style={{ flex: 1.2, position: "relative", overflow: "hidden" }}>
          <OffthreadVideo
            src={staticFile(sourceFile)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 40,
              bottom: 40,
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: 14,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            source · {sceneCount || scenes.length} scenes
          </div>
        </div>

        <div
          style={{
            flex: 1,
            padding: "64px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
            background:
              "linear-gradient(180deg, #0b0f18 0%, #080a10 100%)",
          }}
        >
          {thumbList.slice(0, 6).map((thumb, i) => {
            const isVid = /\.(mp4|webm|mov)$/i.test(thumb);
            const active = i === activeIdx;
            return (
              <div
                key={thumb + i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  opacity: active ? 1 : 0.45,
                  transform: active ? "scale(1.02)" : "scale(1)",
                }}
              >
                <div
                  style={{
                    width: 180,
                    height: 100,
                    overflow: "hidden",
                    border: active
                      ? "2px solid #FFD700"
                      : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {isVid ? (
                    <OffthreadVideo
                      src={staticFile(thumb)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <Img
                      src={staticFile(thumb)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: 13,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: active ? "#FFD700" : "rgba(255,255,255,0.5)",
                  }}
                >
                  scene {String(i + 1).padStart(2, "0")}
                  {scenes[i]
                    ? ` · ${scenes[i]!.start.toFixed(1)}–${scenes[i]!.end.toFixed(1)}s`
                    : ""}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: fadeIn,
          justifyContent: "flex-start",
          padding: 48,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          {label} · {engine} · {detector}@{threshold}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
