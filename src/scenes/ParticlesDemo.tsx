import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createParticles,
  PRESETS,
  type ParticlePresetName,
} from "../integrations/tsparticles";

export interface ParticlesDemoProps {
  preset: ParticlePresetName;
  label: string;
}

/**
 * Frame-accurate tsparticles presets for Remotion.
 *
 *   npm run particles
 */
export const ParticlesDemo: React.FC<ParticlesDemoProps> = ({
  preset = "links",
  label = "tsparticles · links",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const factory =
    PRESETS[preset] ?? PRESETS.links;
  const system = createParticles(
    factory({
      count: preset === "links" ? 60 : undefined,
      colors: preset === "links" ? ["#ffffff"] : undefined,
      background: preset === "links" ? "#0d1117" : undefined,
    }),
  );
  const { particles, links, background } = system.getStateAtFrame(frame, fps);

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

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <AbsoluteFill style={{ opacity }}>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080">
          {links.map((link) => {
            const a = particles[link.from];
            const b = particles[link.to];
            if (!a || !b) return null;
            return (
              <line
                key={`l-${link.from}-${link.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={`rgba(255,255,255,${link.opacity})`}
                strokeWidth={0.5}
              />
            );
          })}
          {particles.map((p) => (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`}
            >
              {preset === "confetti" ? (
                <rect
                  x={-p.size / 2}
                  y={-p.size / 4}
                  width={p.size}
                  height={p.size / 2}
                  fill={p.color}
                  opacity={p.opacity}
                />
              ) : (
                <circle
                  cx={0}
                  cy={0}
                  r={p.size}
                  fill={p.color}
                  opacity={p.opacity}
                />
              )}
            </g>
          ))}
        </svg>
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
