/**
 * VANTA — Face Restoration (GFPGAN)
 *
 * Fix AI-garbled / degraded faces. Prefers official GFPGAN (Python);
 * falls back to a sharp face-friendly enhance when GFPGAN isn't installed.
 *
 * Usage:
 *   import { restoreFaces } from "./integrations/gfpgan-node";
 *
 *   const result = await restoreFaces("./public/presenter-photo.jpg", {
 *     version: "1.4",
 *     scale: 2,
 *     output: "./public/presenter-restored.png",
 *   });
 *   // <Img src={staticFile("presenter-restored.png")} />
 *
 * Repos:
 *   - https://github.com/TencentARC/GFPGAN
 */

export type GfpganVersion = "1.2" | "1.3" | "1.4";

export interface RestoreFacesOptions {
  /** GFPGAN model version. Default "1.4". */
  version?: GfpganVersion;
  /** Upsample scale after restore (GFPGAN -s). Default 2. */
  scale?: 1 | 2 | 4;
  output?: string;
  /** Only process the face (cropped) vs whole image. Default whole. */
  onlyCenterFace?: boolean;
  /** Force sharp fallback even if GFPGAN is available. */
  fallback?: boolean;
}

export interface RestoreFacesResult {
  input: string;
  output: string;
  version: GfpganVersion;
  scale: number;
  engine: "gfpgan" | "sharp";
  width: number;
  height: number;
  bytes: number;
}

export const GFPGAN_VERSIONS: GfpganVersion[] = ["1.2", "1.3", "1.4"];
