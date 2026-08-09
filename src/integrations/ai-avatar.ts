/**
 * VIBZ MEDIA — AI Avatar Integration
 *
 * Turns a headshot + audio into a talking-head video via a local
 * MuseTalk / LatentSync / InfiniteTalk server. Returns a video URL
 * for Remotion's <OffthreadVideo>.
 *
 * Usage:
 *   const avatar = await createAvatar({
 *     serverUrl: "http://localhost:8080",
 *     imagePath: "./public/headshot.jpg",
 *   });
 *   const videoUrl = await avatar.speak("./public/voiceover.wav");
 *   // or: await avatar.speakToFile(audio, "./public/avatar.mp4");
 *
 * Repos (commercial-safe):
 *   - https://github.com/TMElyralab/MuseTalk — MIT, real-time lip sync
 *   - https://github.com/bytedance/LatentSync — Apache-2.0, diffusion lip sync
 *   - https://github.com/MeiGen-AI/InfiniteTalk — Apache-2.0, unlimited length
 *   - https://github.com/antgroup/echomimic_v3 — Apache-2.0, full/half-body
 */

import fs from "fs";
import path from "path";

export type AvatarMethod =
  | "musetalk"
  | "latentsync"
  | "infinitetalk"
  | "echomimic";

export interface AvatarConfig {
  serverUrl: string;
  imagePath: string;
  method?: AvatarMethod;
}

export interface Avatar {
  /** Returns the server video URL (may be remote or local path). */
  speak: (audioPath: string) => Promise<string>;
  /** Generate and write a Remotion-ready file under public/. */
  speakToFile: (
    audioPath: string,
    outputPath: string,
  ) => Promise<{ outputPath: string; videoUrl: string }>;
}

interface GenerateResponse {
  video_url?: string;
  videoUrl?: string;
  url?: string;
  error?: string;
}

function resolveVideoUrl(payload: GenerateResponse): string {
  const url = payload.video_url ?? payload.videoUrl ?? payload.url;
  if (!url) {
    throw new Error(
      `Avatar server returned no video URL: ${JSON.stringify(payload)}`,
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
        `Failed to download avatar video (${response.status}): ${source}`,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(absoluteOut, buffer);
    return;
  }

  const absoluteSource = source.startsWith("file://")
    ? source.slice("file://".length)
    : path.resolve(source);

  if (!fs.existsSync(absoluteSource)) {
    throw new Error(`Avatar video not found at ${absoluteSource}`);
  }
  fs.copyFileSync(absoluteSource, absoluteOut);
}

export async function createAvatar(config: AvatarConfig): Promise<Avatar> {
  const { serverUrl, imagePath, method = "musetalk" } = config;
  const baseUrl = serverUrl.replace(/\/$/, "");
  const absoluteImage = path.resolve(imagePath);

  if (!fs.existsSync(absoluteImage)) {
    throw new Error(
      `Headshot not found: ${absoluteImage}\nPlace a photo at public/headshot.jpg`,
    );
  }

  const generate = async (audioPath: string): Promise<string> => {
    const absoluteAudio = path.resolve(audioPath);
    if (!fs.existsSync(absoluteAudio)) {
      throw new Error(
        `Audio not found: ${absoluteAudio}\nRun \`npm run tts\` first to generate public/voiceover.wav`,
      );
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: absoluteImage,
          audio: absoluteAudio,
          method,
        }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot reach avatar server at ${baseUrl} (${detail}).\n` +
          `Start MuseTalk / LatentSync locally, then retry.`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Avatar server error ${response.status}: ${body || response.statusText}`,
      );
    }

    const payload = (await response.json()) as GenerateResponse;
    if (payload.error) {
      throw new Error(`Avatar server error: ${payload.error}`);
    }
    return resolveVideoUrl(payload);
  };

  return {
    speak: generate,
    speakToFile: async (audioPath, outputPath) => {
      const videoUrl = await generate(audioPath);
      const absoluteOut = path.resolve(outputPath);
      await downloadOrCopy(videoUrl, absoluteOut);
      return { outputPath: absoluteOut, videoUrl };
    },
  };
}
