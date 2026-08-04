/**
 * VANTA — Motion Graphics Integration
 *
 * Frame-based shape animation, bursts, and motion templates for Remotion.
 *
 * Usage:
 *   import { animateShape, createBurst, TEMPLATES } from "./integrations/motion-graphics";
 *
 *   const circle = animateShape("circle", {
 *     from: { scale: 0, opacity: 0, x: 0, y: 0 },
 *     to: { scale: 1, opacity: 1, x: 200, y: 100 },
 *     duration: 30, easing: "spring",
 *   });
 *
 *   const confetti = TEMPLATES.confetti(["#FFD700", "#FF4444", "#44FF44"]);
 *   const title = TEMPLATES.lowerThird("John Smith — CEO", "#FFD700");
 *
 * Repos:
 *   - https://github.com/motiondivision/motion — React animation
 *   - https://github.com/juliangarnier/anime — Lightweight engine
 *   - https://github.com/mojs/mojs — Motion graphics primitives
 *   - @remotion/shapes — Remotion SVG shapes
 */

export type ShapeType =
  | "circle"
  | "rect"
  | "triangle"
  | "polygon"
  | "star"
  | "burst"
  | "cross"
  | "line"
  | "arc"
  | "ring"
  | "blob";

export type EasingType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "bounce"
  | "elastic"
  | "back";

export interface ShapeProps {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number;
}

export interface AnimationConfig {
  from: Partial<ShapeProps>;
  to: Partial<ShapeProps>;
  duration: number;
  delay?: number;
  easing?: EasingType;
  loop?: boolean;
  yoyo?: boolean;
}

export interface AnimatedShape {
  type: ShapeType;
  animation: AnimationConfig;
  getPropsAtFrame: (frame: number) => ShapeProps;
}

export interface LowerThirdTemplate {
  kind: "lower-third";
  text: string;
  color: string;
  shapes: AnimatedShape[];
}

function applyEasing(t: number, easing: EasingType = "linear"): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case "ease-in":
      return x * x;
    case "ease-out":
      return 1 - (1 - x) * (1 - x);
    case "ease-in-out":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "spring": {
      // Underdamped spring approximation toward 1
      const decay = Math.exp(-6 * x);
      return 1 - decay * Math.cos(x * Math.PI * 2.5);
    }
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) {
        const t = x - 1.5 / d1;
        return n1 * t * t + 0.75;
      }
      if (x < 2.5 / d1) {
        const t = x - 2.25 / d1;
        return n1 * t * t + 0.9375;
      }
      const t = x - 2.625 / d1;
      return n1 * t * t + 0.984375;
    }
    case "elastic":
      return x === 0 || x === 1
        ? x
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case "back": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    default:
      return x;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function animateShape(
  type: ShapeType,
  animation: AnimationConfig,
): AnimatedShape {
  const getPropsAtFrame = (frame: number): ShapeProps => {
    const delay = animation.delay ?? 0;
    let local = frame - delay;
    if (local < 0) {
      return { ...animation.from };
    }

    let t = local / Math.max(1, animation.duration);

    if (animation.loop) {
      t = t % 1;
      if (animation.yoyo) {
        const cycle = Math.floor(local / animation.duration) % 2;
        if (cycle === 1) t = 1 - t;
      }
    } else {
      t = Math.max(0, Math.min(1, t));
    }

    const progress = applyEasing(t, animation.easing ?? "linear");
    const keys = new Set([
      ...Object.keys(animation.from),
      ...Object.keys(animation.to),
    ]) as Set<keyof ShapeProps>;

    const result: ShapeProps = {};
    for (const key of keys) {
      const fromVal = animation.from[key];
      const toVal = animation.to[key];
      if (typeof fromVal === "number" && typeof toVal === "number") {
        (result as Record<string, number>)[key] = lerp(fromVal, toVal, progress);
      } else if (typeof toVal === "number") {
        (result as Record<string, number>)[key] = toVal;
      } else if (typeof fromVal === "number") {
        (result as Record<string, number>)[key] = fromVal;
      } else {
        (result as Record<string, unknown>)[key] =
          progress < 0.5 ? fromVal : toVal;
      }
    }
    return result;
  };

  return { type, animation, getPropsAtFrame };
}

export interface BurstConfig {
  count: number;
  radius: number;
  color: string;
  particleSize?: number;
  duration?: number;
  spread?: number;
  stagger?: number;
  decay?: number;
}

export function createBurst(config: BurstConfig): AnimatedShape[] {
  const shapes: AnimatedShape[] = [];
  const angleStep = (config.spread ?? 360) / config.count;
  const stagger = config.stagger ?? 2;
  const duration = config.duration ?? 30;

  for (let i = 0; i < config.count; i++) {
    const angle = (angleStep * i * Math.PI) / 180;
    const targetX = Math.cos(angle) * config.radius;
    const targetY = Math.sin(angle) * config.radius;

    shapes.push(
      animateShape("circle", {
        from: {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          radius: config.particleSize ?? 8,
          fill: config.color,
        },
        to: {
          x: targetX,
          y: targetY,
          scale: 0.2,
          opacity: config.decay ?? 0,
          radius: config.particleSize ?? 8,
          fill: config.color,
        },
        duration,
        delay: i * stagger,
        easing: "ease-out",
      }),
    );
  }

  return shapes;
}

export interface PathAnimationConfig {
  path: string;
  duration: number;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  drawStyle?: "draw" | "fill" | "morph";
}

export function animatePath(config: PathAnimationConfig): {
  getStrokeDashAtFrame: (frame: number) => {
    dasharray: string;
    dashoffset: number;
  };
} {
  return {
    getStrokeDashAtFrame: (frame: number) => {
      const progress = Math.max(0, Math.min(1, frame / config.duration));
      const totalLength = 1000;
      return {
        dasharray: `${totalLength}`,
        dashoffset: totalLength * (1 - progress),
      };
    },
  };
}

/**
 * Pre-built motion graphic templates
 */
export const TEMPLATES = {
  lowerThird: (
    text: string,
    color: string = "#FFD700",
  ): LowerThirdTemplate => ({
    kind: "lower-third",
    text,
    color,
    shapes: [
      animateShape("rect", {
        from: { x: -420, y: 0, width: 0, height: 72, opacity: 0, fill: color },
        to: { x: 0, y: 0, width: 520, height: 72, opacity: 1, fill: color },
        duration: 20,
        easing: "ease-out",
      }),
      animateShape("rect", {
        from: {
          x: -420,
          y: 72,
          width: 0,
          height: 4,
          opacity: 0,
          fill: "#f2ebe3",
        },
        to: {
          x: 0,
          y: 72,
          width: 520,
          height: 4,
          opacity: 1,
          fill: "#f2ebe3",
        },
        duration: 24,
        delay: 4,
        easing: "ease-out",
      }),
    ],
  }),

  countdown: (from: number = 3, color: string = "#FFFFFF") => {
    const shapes: AnimatedShape[] = [];
    for (let i = from; i >= 1; i--) {
      shapes.push(
        animateShape("circle", {
          from: { scale: 2, opacity: 1, fill: color, radius: 80 },
          to: { scale: 0, opacity: 0, fill: color, radius: 80 },
          duration: 30,
          delay: (from - i) * 30,
          easing: "ease-in",
        }),
      );
    }
    return shapes;
  },

  confetti: (
    colors: string[] = ["#FFD700", "#FF4444", "#44FF44", "#4444FF"],
  ) =>
    colors.flatMap((color, i) =>
      createBurst({
        count: 15,
        radius: 300 + i * 50,
        color,
        particleSize: 6,
        duration: 45,
        stagger: 1,
        decay: 0,
      }),
    ),

  progressBar: (percent: number, color: string = "#00FF88") => [
    animateShape("rect", {
      from: { width: 0, height: 8, fill: color, opacity: 1 },
      to: { width: Math.max(0, Math.min(100, percent)) * 8, height: 8, fill: color, opacity: 1 },
      duration: 60,
      easing: "ease-in-out",
    }),
  ],
};
