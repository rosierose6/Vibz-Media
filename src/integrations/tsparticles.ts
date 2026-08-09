/**
 * VIBZ MEDIA — Particle Effects Integration (tsparticles)
 *
 * Deterministic, frame-accurate particle systems for Remotion.
 * Presets mirror tsparticles (links, snow, confetti, fireworks, stars).
 *
 * Usage:
 *   import { createParticles, PRESETS } from "./integrations/tsparticles";
 *
 *   const system = createParticles(PRESETS.links({
 *     count: 60,
 *     colors: ["#ffffff"],
 *     background: "#0d1117",
 *   }));
 *
 *   // In Remotion:
 *   const { particles, links } = system.getStateAtFrame(frame, fps);
 *
 * Repos:
 *   - https://github.com/tsparticles/tsparticles — particle engine
 */

export type ParticlePresetName =
  | "links"
  | "snow"
  | "confetti"
  | "fireworks"
  | "stars"
  | "bubbles"
  | "firefly";

export interface ParticleOptions {
  preset: ParticlePresetName;
  width?: number;
  height?: number;
  count?: number;
  colors?: string[];
  background?: string;
  /** Max distance for link lines (links preset). */
  linkDistance?: number;
  /** Particle size range [min, max]. */
  size?: [number, number];
  /** Base drift / speed multiplier. */
  speed?: number;
  seed?: number;
}

export interface ParticleState {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  rotation: number;
}

export interface LinkState {
  from: number;
  to: number;
  opacity: number;
}

export interface FrameParticleState {
  particles: ParticleState[];
  links: LinkState[];
  background: string;
  preset: ParticlePresetName;
}

export interface ParticleSystem {
  options: Required<
    Pick<
      ParticleOptions,
      | "preset"
      | "width"
      | "height"
      | "count"
      | "colors"
      | "background"
      | "linkDistance"
      | "size"
      | "speed"
      | "seed"
    >
  >;
  getStateAtFrame: (frame: number, fps?: number) => FrameParticleState;
}

interface SeededParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  drift: number;
  phase: number;
  brightness: number;
  vx: number;
  vy: number;
  spin: number;
  delay: number;
  burst: number;
}

function hash(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function pickColor(colors: string[], i: number, seed: number): string {
  return colors[Math.floor(hash(seed + i * 17) * colors.length)] ?? colors[0];
}

function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

function defaults(options: ParticleOptions): ParticleSystem["options"] {
  const preset = options.preset;
  const presetCount =
    preset === "confetti" ? 80 : preset === "fireworks" ? 120 : 60;
  return {
    preset,
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    count: options.count ?? presetCount,
    colors: options.colors ?? defaultColors(preset),
    background: options.background ?? "#0d1117",
    linkDistance: options.linkDistance ?? 280,
    size: options.size ?? defaultSize(preset),
    speed: options.speed ?? defaultSpeed(preset),
    seed: options.seed ?? 42,
  };
}

function defaultColors(preset: ParticlePresetName): string[] {
  switch (preset) {
    case "confetti":
      return ["#FFD700", "#FF4444", "#44FF44", "#4488FF", "#FF88FF"];
    case "fireworks":
      return ["#FFD700", "#FF6B6B", "#4ECDC4", "#FFE66D", "#FFFFFF"];
    case "snow":
      return ["#FFFFFF", "#E8F1FF", "#C8D8F0"];
    case "stars":
      return ["#FFFFFF", "#FFE9A8", "#C8D8FF"];
    case "bubbles":
      return ["#7FDBFF", "#39CCCC", "#B10DC9", "#FFFFFF"];
    case "firefly":
      return ["#FFD700", "#FFAA33", "#FFF1A8"];
    case "links":
    default:
      return ["#FFFFFF"];
  }
}

function defaultSize(preset: ParticlePresetName): [number, number] {
  switch (preset) {
    case "snow":
      return [1.5, 5];
    case "confetti":
      return [3, 8];
    case "fireworks":
      return [1.5, 4];
    case "bubbles":
      return [8, 28];
    case "stars":
      return [0.8, 2.5];
    case "firefly":
      return [1.5, 3.5];
    default:
      return [1, 3];
  }
}

function defaultSpeed(preset: ParticlePresetName): number {
  switch (preset) {
    case "snow":
      return 0.55;
    case "confetti":
      return 1.2;
    case "fireworks":
      return 1.4;
    case "bubbles":
      return 0.35;
    case "stars":
      return 0.08;
    case "firefly":
      return 0.45;
    default:
      return 0.25;
  }
}

function seedParticles(opts: ParticleSystem["options"]): SeededParticle[] {
  const [minSize, maxSize] = opts.size;
  return Array.from({ length: opts.count }, (_, i) => {
    const h = (k: number) => hash(opts.seed + i * 13 + k);
    return {
      x: h(1) * opts.width,
      y: h(2) * opts.height,
      size: minSize + h(3) * (maxSize - minSize),
      color: pickColor(opts.colors, i, opts.seed),
      drift: h(4) * 0.5 + 0.1,
      phase: h(5) * Math.PI * 2,
      brightness: 0.2 + h(6) * 0.7,
      vx: (h(7) - 0.5) * 2,
      vy: (h(8) - 0.5) * 2,
      spin: (h(9) - 0.5) * 8,
      delay: h(10) * 2.5,
      burst: Math.floor(h(11) * 6),
    };
  });
}

function sampleLinks(
  particles: ParticleState[],
  linkDistance: number,
): LinkState[] {
  const links: LinkState[] = [];
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < Math.min(i + 5, particles.length); j++) {
      const b = particles[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > linkDistance) continue;
      links.push({
        from: a.id,
        to: b.id,
        opacity: (1 - dist / linkDistance) * 0.18,
      });
    }
  }
  return links;
}

function stateAtFrame(
  opts: ParticleSystem["options"],
  seeded: SeededParticle[],
  frame: number,
  fps: number,
): FrameParticleState {
  const t = frame / fps;
  const { width: w, height: h, preset, speed } = opts;

  const particles: ParticleState[] = seeded.map((p, i) => {
    switch (preset) {
      case "snow": {
        const y = wrap(p.y + t * (40 + p.drift * 80) * speed, h + 40) - 20;
        const x = wrap(p.x + Math.sin(p.phase + t * p.drift) * 40, w);
        return {
          id: i,
          x,
          y,
          size: p.size,
          color: p.color,
          opacity: 0.35 + p.brightness * 0.5,
          rotation: 0,
        };
      }
      case "confetti": {
        const fall = ((t * 120 * speed + p.y) % (h + 80)) - 40;
        const x = wrap(p.x + Math.sin(p.phase + t * 2) * 60 + p.vx * t * 20, w);
        return {
          id: i,
          x,
          y: fall,
          size: p.size,
          color: p.color,
          opacity: 0.85,
          rotation: t * p.spin * 40 + p.phase,
        };
      }
      case "fireworks": {
        const cycle = 2.2;
        const local = (t + p.delay) % cycle;
        const explode = 0.55;
        const cx = ((p.burst * 317 + p.x) % (w * 0.7)) + w * 0.15;
        const cy = ((p.burst * 211 + p.y) % (h * 0.45)) + h * 0.15;
        if (local < explode * 0.35) {
          const rise = local / (explode * 0.35);
          return {
            id: i,
            x: cx,
            y: h * 0.85 - rise * (h * 0.85 - cy),
            size: p.size * 0.6,
            color: p.color,
            opacity: 0.9,
            rotation: 0,
          };
        }
        const age = (local - explode * 0.35) / (cycle - explode * 0.35);
        const radius = age * (80 + p.drift * 140) * speed;
        const angle = p.phase + i * 0.4;
        return {
          id: i,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius + age * age * 90,
          size: p.size * (1 - age * 0.6),
          color: p.color,
          opacity: Math.max(0, 1 - age) * p.brightness,
          rotation: angle,
        };
      }
      case "stars": {
        const twinkle =
          0.25 +
          0.75 *
            (0.5 + 0.5 * Math.sin(p.phase + t * (1.5 + p.drift * 3)));
        return {
          id: i,
          x: p.x + Math.sin(p.phase + t * speed) * 4,
          y: p.y + Math.cos(p.phase + t * speed * 0.7) * 3,
          size: p.size * (0.7 + twinkle * 0.5),
          color: p.color,
          opacity: twinkle * p.brightness,
          rotation: 0,
        };
      }
      case "bubbles": {
        const y = wrap(p.y - t * (20 + p.drift * 50) * speed, h + 60) - 30;
        const x = wrap(p.x + Math.sin(p.phase + t * p.drift) * 50, w);
        return {
          id: i,
          x,
          y,
          size: p.size,
          color: p.color,
          opacity: 0.15 + p.brightness * 0.35,
          rotation: 0,
        };
      }
      case "firefly": {
        const x = wrap(
          p.x + Math.sin(p.phase + t * p.drift * 2) * 120 * speed,
          w,
        );
        const y = wrap(
          p.y + Math.cos(p.phase * 1.3 + t * p.drift * 1.5) * 80 * speed,
          h,
        );
        const pulse =
          0.2 + 0.8 * (0.5 + 0.5 * Math.sin(p.phase * 2 + t * 4));
        return {
          id: i,
          x,
          y,
          size: p.size * (0.8 + pulse * 0.6),
          color: p.color,
          opacity: pulse * p.brightness,
          rotation: 0,
        };
      }
      case "links":
      default: {
        const x = p.x + Math.sin(p.phase + t * p.drift * speed * 4) * 30;
        const y = p.y + Math.cos(p.phase + t * p.drift * speed * 2.8) * 20;
        return {
          id: i,
          x,
          y,
          size: p.size,
          color: p.color,
          opacity: 0.15 + p.brightness * 0.55,
          rotation: 0,
        };
      }
    }
  });

  const links =
    preset === "links" ? sampleLinks(particles, opts.linkDistance) : [];

  return {
    particles,
    links,
    background: opts.background,
    preset,
  };
}

export function createParticles(options: ParticleOptions): ParticleSystem {
  const opts = defaults(options);
  const seeded = seedParticles(opts);

  return {
    options: opts,
    getStateAtFrame: (frame, fps = 30) => stateAtFrame(opts, seeded, frame, fps),
  };
}

export const PRESETS = {
  links: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "links",
    count: 60,
    colors: ["#ffffff"],
    background: "#0d1117",
    linkDistance: 280,
    ...overrides,
  }),
  snow: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "snow",
    count: 100,
    background: "#0a1220",
    ...overrides,
  }),
  confetti: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "confetti",
    count: 90,
    background: "#111111",
    ...overrides,
  }),
  fireworks: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "fireworks",
    count: 140,
    background: "#050508",
    ...overrides,
  }),
  stars: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "stars",
    count: 120,
    background: "#02040a",
    ...overrides,
  }),
  bubbles: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "bubbles",
    count: 40,
    background: "#041525",
    ...overrides,
  }),
  firefly: (overrides: Partial<ParticleOptions> = {}): ParticleOptions => ({
    preset: "firefly",
    count: 50,
    background: "#0a0a12",
    ...overrides,
  }),
} as const;

export function listPresets(): ParticlePresetName[] {
  return [
    "links",
    "snow",
    "confetti",
    "fireworks",
    "stars",
    "bubbles",
    "firefly",
  ];
}
