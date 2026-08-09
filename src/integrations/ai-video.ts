/**
 * VIBZ MEDIA — AI Video Generation Integration
 *
 * Text-to-video and image-to-video via a local Wan 2.2 / LTX-Video /
 * FramePack server (Gradio :7860 or ComfyUI :8188).
 *
 * Usage:
 *   const clip = await generateVideo("A sunset over the ocean, cinematic 4K", {
 *     serverUrl: "http://localhost:7860",
 *   });
 *   // <OffthreadVideo src={clip.url} />
 *
 *   const animated = await animateImage("./product.png", "slow zoom with particles", {
 *     serverUrl: "http://localhost:7860",
 *   });
 *
 * Repos (commercial-safe):
 *   - https://github.com/Wan-Video/Wan2.2 — Apache-2.0 code + weights
 *   - https://github.com/Lightricks/LTX-Video — real-time-class generation
 *   - https://github.com/lllyasviel/FramePack — Apache-2.0, long I2V on 6GB VRAM
 *   - https://github.com/comfyanonymous/ComfyUI — unified localhost API
 */

import fs from "fs";
import path from "path";

export type VideoModel = "wan2.2" | "ltx" | "framepack";

export interface VideoGenerationConfig {
  serverUrl: string;
  model?: VideoModel;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface GeneratedClip {
  url: string;
  duration: number;
  width: number;
  height: number;
  prompt: string;
}

interface ServerClipPayload {
  url?: string;
  video_url?: string;
  videoUrl?: string;
  path?: string;
  duration?: number;
  width?: number;
  height?: number;
  prompt?: string;
  error?: string;
}

function resolveClipUrl(payload: ServerClipPayload): string {
  const url =
    payload.url ?? payload.video_url ?? payload.videoUrl ?? payload.path;
  if (!url) {
    throw new Error(
      `Video server returned no clip URL: ${JSON.stringify(payload)}`,
    );
  }
  return url;
}

function normalizeClip(
  payload: ServerClipPayload,
  defaults: {
    prompt: string;
    duration: number;
    width: number;
    height: number;
  },
): GeneratedClip {
  if (payload.error) {
    throw new Error(`Video server error: ${payload.error}`);
  }

  return {
    url: resolveClipUrl(payload),
    duration: Number(payload.duration) || defaults.duration,
    width: Number(payload.width) || defaults.width,
    height: Number(payload.height) || defaults.height,
    prompt: String(payload.prompt ?? defaults.prompt),
  };
}

async function postJson(
  serverUrl: string,
  route: string,
  body: Record<string, unknown>,
): Promise<ServerClipPayload> {
  const baseUrl = serverUrl.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot reach video server at ${baseUrl} (${detail}).\n` +
        `Start Wan 2.2 / LTX / FramePack (Gradio :7860 or ComfyUI :8188).`,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Video server error ${response.status}: ${text || response.statusText}`,
    );
  }

  return (await response.json()) as ServerClipPayload;
}

async function downloadOrCopy(source: string, outputPath: string): Promise<void> {
  const absoluteOut = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to download clip (${response.status}): ${source}`,
      );
    }
    fs.writeFileSync(absoluteOut, Buffer.from(await response.arrayBuffer()));
    return;
  }

  const absoluteSource = source.startsWith("file://")
    ? source.slice("file://".length)
    : path.resolve(source);

  if (!fs.existsSync(absoluteSource)) {
    throw new Error(`Generated clip not found at ${absoluteSource}`);
  }
  fs.copyFileSync(absoluteSource, absoluteOut);
}

/** Save a generated clip into public/ for Remotion staticFile(). */
export async function saveClipToFile(
  clip: GeneratedClip,
  outputPath: string,
): Promise<GeneratedClip> {
  const absoluteOut = path.resolve(outputPath);
  await downloadOrCopy(clip.url, absoluteOut);
  return { ...clip, url: absoluteOut };
}

export async function generateVideo(
  prompt: string,
  config: VideoGenerationConfig,
): Promise<GeneratedClip> {
  const {
    serverUrl,
    model = "wan2.2",
    duration = 6,
    width = 1280,
    height = 720,
    fps = 24,
  } = config;

  const payload = await postJson(serverUrl, "/generate", {
    prompt,
    model,
    duration,
    width,
    height,
    fps,
  });

  return normalizeClip(payload, { prompt, duration, width, height });
}

export async function animateImage(
  imagePath: string,
  motionPrompt: string,
  config: VideoGenerationConfig,
): Promise<GeneratedClip> {
  const {
    serverUrl,
    model = "framepack",
    duration = 6,
    width = 1280,
    height = 720,
    fps = 24,
  } = config;

  const absoluteImage = path.resolve(imagePath);
  if (!fs.existsSync(absoluteImage)) {
    throw new Error(`Image not found: ${absoluteImage}`);
  }

  const payload = await postJson(serverUrl, "/animate", {
    image: absoluteImage,
    prompt: motionPrompt,
    model,
    duration,
    width,
    height,
    fps,
  });

  return normalizeClip(payload, {
    prompt: motionPrompt,
    duration,
    width,
    height,
  });
}
