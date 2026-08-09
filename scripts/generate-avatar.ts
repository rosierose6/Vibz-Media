/**
 * Generate a talking-head avatar from a headshot + Kokoro voiceover.
 *
 * Prerequisites:
 *   1. npm run tts                 → public/voiceover.wav
 *   2. Place a headshot at public/headshot.jpg
 *      (falls back to public/presenter-photo.jpg if present)
 *   3. Avatar server on :8080      → MuseTalk / LatentSync / InfiniteTalk
 *      If the server is down, builds a still+audio ffmpeg stub so Remotion
 *      Studio stops erroring on missing public/avatar.mp4.
 *
 *   npm run avatar
 *   npm run avatar -- --image ./public/headshot.jpg --method musetalk
 */

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { createAvatar, type AvatarMethod } from "../src/integrations/ai-avatar";

const METHODS: AvatarMethod[] = [
  "musetalk",
  "latentsync",
  "infinitetalk",
  "echomimic",
];

function parseArgs(argv: string[]) {
  const publicDir = path.resolve(__dirname, "../public");
  const headshot = path.join(publicDir, "headshot.jpg");
  const presenter = path.join(publicDir, "presenter-photo.jpg");

  let imagePath = fs.existsSync(headshot)
    ? headshot
    : fs.existsSync(presenter)
      ? presenter
      : headshot;
  let audioPath = path.join(publicDir, "voiceover.wav");
  let serverUrl = process.env.AVATAR_SERVER_URL ?? "http://localhost:8080";
  let method: AvatarMethod = "musetalk";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--image" && argv[i + 1]) {
      imagePath = path.resolve(argv[++i]);
    } else if (arg === "--audio" && argv[i + 1]) {
      audioPath = path.resolve(argv[++i]);
    } else if (arg === "--server" && argv[i + 1]) {
      serverUrl = argv[++i];
    } else if (arg === "--method" && argv[i + 1]) {
      const value = argv[++i] as AvatarMethod;
      if (!METHODS.includes(value)) {
        throw new Error(`Unknown method "${value}". Use: ${METHODS.join(", ")}`);
      }
      method = value;
    }
  }

  return { imagePath, audioPath, serverUrl, method };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", ...args], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

/** Still image + voiceover when MuseTalk/LatentSync isn't running. */
async function ffmpegStillAvatar(
  imagePath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  await runFfmpeg([
    "-loop",
    "1",
    "-i",
    imagePath,
    "-i",
    audioPath,
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
    "-c:v",
    "libx264",
    "-tune",
    "stillimage",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-pix_fmt",
    "yuv420p",
    "-shortest",
    outputPath,
  ]);
}

async function main() {
  const { imagePath, audioPath, serverUrl, method } = parseArgs(
    process.argv.slice(2),
  );

  const outDir = path.resolve(__dirname, "../public");
  const outVideo = path.join(outDir, "avatar.mp4");
  const outMeta = path.join(outDir, "avatar-meta.json");
  const voiceMetaPath = path.join(outDir, "voiceover-meta.json");

  if (!fs.existsSync(audioPath)) {
    throw new Error(
      `Missing ${audioPath}\nRun \`npm run tts\` first to generate the Kokoro voiceover.`,
    );
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(
      `Missing headshot: ${imagePath}\n` +
        `Place a photo at public/headshot.jpg (or public/presenter-photo.jpg).`,
    );
  }

  let text = "Welcome to the future of video.";
  if (fs.existsSync(voiceMetaPath)) {
    try {
      const voiceMeta = JSON.parse(fs.readFileSync(voiceMetaPath, "utf8")) as {
        text?: string;
      };
      if (voiceMeta.text) text = voiceMeta.text;
    } catch {
      // keep default caption
    }
  }

  console.log(`Avatar server: ${serverUrl}`);
  console.log(`Method: ${method}`);
  console.log(`Image:  ${imagePath}`);
  console.log(`Audio:  ${audioPath}`);

  let sourceUrl = serverUrl;
  let usedFallback = false;

  try {
    const avatar = await createAvatar({ serverUrl, imagePath, method });
    const result = await avatar.speakToFile(audioPath, outVideo);
    sourceUrl = result.videoUrl;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`Avatar server unavailable — using ffmpeg still+audio.\n${detail}`);
    await ffmpegStillAvatar(imagePath, audioPath, outVideo);
    sourceUrl = `file://${outVideo}`;
    usedFallback = true;
  }

  const meta = {
    text,
    file: "avatar.mp4",
    audioFile: path.basename(audioPath),
    imagePath: path.basename(imagePath),
    method: usedFallback ? "ffmpeg-still" : method,
    sourceUrl,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${outVideo}`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition Avatar");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
