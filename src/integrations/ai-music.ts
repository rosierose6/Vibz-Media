/**
 * VANTA — AI Music Generation Integration
 *
 * Generate custom soundtracks via a local ACE-Step 1.5 server.
 * Free, local, unlimited — no Suno subscription needed.
 *
 * Usage:
 *   const track = await generateMusic("cinematic orchestral tension building", {
 *     serverUrl: "http://localhost:8000",
 *   });
 *   // <Audio src={track.url} /> — custom soundtrack for your video
 *
 * Repos (commercial-safe):
 *   - https://github.com/ace-step/ACE-Step-1.5 — MIT, first-party REST API
 *   - https://github.com/hkchengrex/MMAudio — MIT, video-to-audio foley
 *   - https://github.com/multimodal-art-projection/YuE — Apache-2.0, full songs
 */

import fs from "fs";
import path from "path";

export type MusicModel = "ace-step" | "mmaudio" | "yue";

export interface MusicConfig {
  serverUrl: string;
  model?: MusicModel;
  duration?: number;
  bpm?: number;
}

export interface GeneratedTrack {
  url: string;
  duration: number;
  bpm: number;
  prompt: string;
}

interface ServerTrackPayload {
  url?: string;
  audio_url?: string;
  audioUrl?: string;
  path?: string;
  duration?: number;
  bpm?: number;
  prompt?: string;
  error?: string;
}

function resolveTrackUrl(payload: ServerTrackPayload): string {
  const url =
    payload.url ?? payload.audio_url ?? payload.audioUrl ?? payload.path;
  if (!url) {
    throw new Error(
      `Music server returned no track URL: ${JSON.stringify(payload)}`,
    );
  }
  return url;
}

async function downloadOrCopy(source: string, outputPath: string): Promise<void> {
  const absoluteOut = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to download track (${response.status}): ${source}`,
      );
    }
    fs.writeFileSync(absoluteOut, Buffer.from(await response.arrayBuffer()));
    return;
  }

  const absoluteSource = source.startsWith("file://")
    ? source.slice("file://".length)
    : path.resolve(source);

  if (!fs.existsSync(absoluteSource)) {
    throw new Error(`Generated track not found at ${absoluteSource}`);
  }
  fs.copyFileSync(absoluteSource, absoluteOut);
}

/** Save a generated track into public/ for Remotion staticFile(). */
export async function saveTrackToFile(
  track: GeneratedTrack,
  outputPath: string,
): Promise<GeneratedTrack> {
  const absoluteOut = path.resolve(outputPath);
  await downloadOrCopy(track.url, absoluteOut);
  return { ...track, url: absoluteOut };
}

export async function generateMusic(
  prompt: string,
  config: MusicConfig,
): Promise<GeneratedTrack> {
  const {
    serverUrl,
    model = "ace-step",
    duration = 30,
    bpm,
  } = config;

  const baseUrl = serverUrl.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, duration, bpm }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot reach music server at ${baseUrl} (${detail}).\n` +
        `Start ACE-Step (\`uv run acestep-api\`) or \`npm run music:server\`.`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Music server error ${response.status}: ${body || response.statusText}`,
    );
  }

  const payload = (await response.json()) as ServerTrackPayload;
  if (payload.error) {
    throw new Error(`Music server error: ${payload.error}`);
  }

  return {
    url: resolveTrackUrl(payload),
    duration: Number(payload.duration) || duration,
    bpm: Number(payload.bpm) || bpm || 90,
    prompt: String(payload.prompt ?? prompt),
  };
}
