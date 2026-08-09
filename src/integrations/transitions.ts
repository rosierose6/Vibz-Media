/**
 * VIBZ MEDIA — Transitions Integration
 *
 * Named transition catalog + bridge to @remotion/transitions.
 * GL-transitions shaders documented for GPU paths; Remotion presentations
 * power the live TransitionSeries demo.
 *
 * Usage:
 *   import { applyTransition, listTransitions } from "./integrations/transitions";
 *
 *   const cube = applyTransition("cube", { duration: 30 });
 *   const glitch = applyTransition("glitch", { duration: 15, intensity: 0.8 });
 *   const all = listTransitions();
 *   // { geometric: [...], "3d": [...], creative: [...], film: [...], ... }
 *
 * Repos:
 *   - https://github.com/gl-transitions/gl-transitions — 100+ WebGL shaders
 *   - @remotion/transitions — TransitionSeries presentations
 */

import type {
  TransitionPresentation,
  TransitionTiming,
} from "@remotion/transitions";
import { linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";

export type TransitionType =
  | "crossfade"
  | "fade"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "cube"
  | "flip"
  | "rotate"
  | "swap"
  | "pixelate"
  | "morph"
  | "kaleidoscope"
  | "glitch"
  | "burn"
  | "ripple"
  | "dissolve"
  | "dip-to-black"
  | "dip-to-white"
  | "film-burn"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "circle-reveal"
  | "diamond-reveal"
  | "heart-reveal"
  | "star-reveal";

export interface TransitionConfig {
  duration: number;
  direction?: "left" | "right" | "up" | "down";
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  color?: string;
  intensity?: number;
  customGLSL?: string;
}

export interface TransitionResult {
  type: TransitionType;
  config: TransitionConfig;
  glslShader?: string;
  /** Remotion presentation used by TransitionSeries */
  presentation: TransitionPresentation<Record<string, unknown>>;
  /** Remotion timing for TransitionSeries.Transition */
  timing: TransitionTiming;
}

const GL_TRANSITION_SHADERS: Partial<Record<TransitionType, string>> = {
  cube: `// gl-transitions.com/editor/cube`,
  pixelate: `// gl-transitions.com/editor/pixelize`,
  morph: `// gl-transitions.com/editor/morph`,
  glitch: `// gl-transitions.com/editor/GlitchDisplace`,
  burn: `// gl-transitions.com/editor/burn`,
  ripple: `// gl-transitions.com/editor/ripple`,
};

const CATEGORIES: Record<string, TransitionType[]> = {
  geometric: [
    "crossfade",
    "fade",
    "wipe-left",
    "wipe-right",
    "wipe-up",
    "wipe-down",
  ],
  "3d": ["cube", "flip", "rotate", "swap"],
  creative: ["pixelate", "morph", "kaleidoscope", "glitch", "burn", "ripple"],
  film: ["dissolve", "dip-to-black", "dip-to-white", "film-burn"],
  directional: [
    "slide-left",
    "slide-right",
    "slide-up",
    "slide-down",
    "zoom-in",
    "zoom-out",
  ],
  pattern: ["circle-reveal", "diamond-reveal", "heart-reveal", "star-reveal"],
};

function asPresentation(
  presentation: TransitionPresentation<any>,
): TransitionPresentation<Record<string, unknown>> {
  return presentation as unknown as TransitionPresentation<Record<string, unknown>>;
}

function presentationFor(
  type: TransitionType,
  config: TransitionConfig,
): TransitionPresentation<Record<string, unknown>> {
  const dir = config.direction ?? "left";

  switch (type) {
    case "crossfade":
    case "fade":
    case "dissolve":
    case "dip-to-black":
    case "dip-to-white":
    case "film-burn":
    case "burn":
    case "morph":
      return asPresentation(fade());
    case "wipe-left":
      return asPresentation(wipe({ direction: "from-left" }));
    case "wipe-right":
      return asPresentation(wipe({ direction: "from-right" }));
    case "wipe-up":
      return asPresentation(wipe({ direction: "from-top" }));
    case "wipe-down":
      return asPresentation(wipe({ direction: "from-bottom" }));
    case "slide-left":
      return asPresentation(slide({ direction: "from-left" }));
    case "slide-right":
      return asPresentation(slide({ direction: "from-right" }));
    case "slide-up":
      return asPresentation(slide({ direction: "from-top" }));
    case "slide-down":
      return asPresentation(slide({ direction: "from-bottom" }));
    case "cube":
    case "flip":
    case "rotate":
    case "swap":
      return asPresentation(
        flip({
          direction: dir === "up" || dir === "down" ? "from-top" : "from-left",
        }),
      );
    case "glitch":
    case "pixelate":
    case "kaleidoscope":
    case "ripple":
      return asPresentation(
        wipe({
          direction:
            dir === "right"
              ? "from-right"
              : dir === "up"
                ? "from-top"
                : dir === "down"
                  ? "from-bottom"
                  : "from-left",
        }),
      );
    case "circle-reveal":
    case "diamond-reveal":
    case "heart-reveal":
    case "star-reveal":
    case "zoom-in":
    case "zoom-out":
      return asPresentation(iris({ width: 1920, height: 1080 }));
    default:
      return asPresentation(fade());
  }
}

function timingFor(config: TransitionConfig): TransitionTiming {
  const durationInFrames = Math.max(1, Math.round(config.duration));
  if (config.easing === "ease-in-out" || config.easing === "ease-out") {
    return springTiming({
      config: { damping: 200 },
      durationInFrames,
    });
  }
  return linearTiming({ durationInFrames });
}

export function applyTransition(
  type: TransitionType,
  config: Partial<TransitionConfig> = {},
): TransitionResult {
  if (!(Object.values(CATEGORIES).flat() as TransitionType[]).includes(type)) {
    throw new Error(`Unknown transition: ${type}`);
  }

  const fullConfig: TransitionConfig = {
    duration: config.duration ?? 30,
    direction: config.direction ?? "left",
    easing: config.easing ?? "ease-in-out",
    intensity: config.intensity ?? 0.5,
    ...config,
  };

  // Intensity shortens aggressive effects like glitch
  if (type === "glitch" && fullConfig.intensity !== undefined) {
    fullConfig.duration = Math.max(
      6,
      Math.round(fullConfig.duration * (0.5 + fullConfig.intensity * 0.5)),
    );
  }

  return {
    type,
    config: fullConfig,
    glslShader: config.customGLSL ?? GL_TRANSITION_SHADERS[type],
    presentation: presentationFor(type, fullConfig),
    timing: timingFor(fullConfig),
  };
}

/** List all available transitions grouped by category */
export function listTransitions(): Record<string, TransitionType[]> {
  return { ...CATEGORIES };
}

/** Flat list of every named transition */
export function listTransitionNames(): TransitionType[] {
  return Object.values(CATEGORIES).flat();
}
