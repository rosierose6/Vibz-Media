import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  deserializeWaveform,
  getBarsAtTime,
  getProgress,
  type WaveformData,
  WAVEFORM_STYLES,
} from "../integrations/wavesurfer";

export interface WaveformDemoProps {
  audioFile: string;
  label: string;
  waveform: WaveformData | null;
  background: string;
}

/**
 * wavesurfer.js peaks driving Remotion bars.
 *
 *   npm run waveform
 */
export const WaveformDemo: React.FC<WaveformDemoProps> = ({
  audioFile = "voiceover.wav",
  label = "wavesurfer.js",
  waveform = null,
  background = WAVEFORM_STYLES.wavesurfer.background,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const data =
    waveform && waveform.envelope?.length
      ? deserializeWaveform(waveform)
      : null;

  const bars = data
    ? getBarsAtTime(data, t)
    : Array.from({ length: 64 }, (_, i) => {
        const f1 = Math.sin(t * 3.2 + i * 0.25) * 0.4 + 0.4;
        const f2 = Math.sin(t * 5.8 + i * 0.12) * 0.25 + 0.25;
        return Math.min(1, (f1 + f2) / 1.1);
      });

  const progress = data ? getProgress(data, t) : frame / Math.max(1, durationInFrames - 1);
  const waveColor = data?.waveColor ?? WAVEFORM_STYLES.wavesurfer.waveColor;
  const progressColor =
    data?.progressColor ?? WAVEFORM_STYLES.wavesurfer.progressColor;

  const fadeIn = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 0.4 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const overview = data?.peaks ?? [];
  const overviewStep = Math.max(1, Math.floor(overview.length / 120));

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}

      <AbsoluteFill
        style={{
          opacity,
          justifyContent: "center",
          alignItems: "center",
          gap: 48,
        }}
      >
        {/* Live bars */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            height: 280,
          }}
        >
          {bars.map((amp, i) => {
            const played = i / Math.max(1, bars.length - 1) <= progress;
            const h = amp * 220 + 4;
            const entrance = interpolate(frame - i * 0.25, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  width: 10,
                  height: h * entrance,
                  borderRadius: 5,
                  background: played ? progressColor : waveColor,
                }}
              />
            );
          })}
        </div>

        {/* Static overview scrubber */}
        {overview.length > 0 ? (
          <div
            style={{
              width: 960,
              height: 48,
              display: "flex",
              alignItems: "center",
              gap: 1,
              position: "relative",
            }}
          >
            {overview
              .filter((_, i) => i % overviewStep === 0)
              .map((peak, i, arr) => {
                const played = i / Math.max(1, arr.length - 1) <= progress;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: Math.max(2, peak * 48),
                      background: played
                        ? progressColor
                        : "rgba(255,255,255,0.15)",
                      borderRadius: 1,
                    }}
                  />
                );
              })}
            <div
              style={{
                position: "absolute",
                left: `${progress * 100}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: data?.cursorColor ?? "#fff",
                transform: "translateX(-1px)",
              }}
            />
          </div>
        ) : null}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 64,
          opacity,
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
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
