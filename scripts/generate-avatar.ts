/**
 * Generate a talking-head avatar from a headshot + Kokoro voiceover.
 *
 * Prerequisites:
 *   1. npm run tts                 → public/voiceover.wav
 *   2. Place a headshot at public/headshot.jpg
 *   3. Avatar server on :8080      → MuseTalk / LatentSync / InfiniteTalk
 *
 *   npm run avatar
 *   npm run avatar -- --image ./public/headshot.jpg --method musetalk
 */

import path from "path";
import fs from "fs";
import { createAvatar, type AvatarMethod } from "../src/integrations/ai-avatar";

const METHODS: AvatarMethod[] = [
  "musetalk",
  "latentsync",
  "infinitetalk",
  "echomimic",
];

function parseArgs(argv: string[]) {
  let imagePath = path.resolve(__dirname, "../public/headshot.jpg");
  let audioPath = path.resolve(__dirname, "../public/voiceover.wav");
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

  const avatar = await createAvatar({ serverUrl, imagePath, method });
  const { outputPath, videoUrl } = await avatar.speakToFile(audioPath, outVideo);

  const meta = {
    text,
    file: "avatar.mp4",
    audioFile: path.basename(audioPath),
    imagePath: path.basename(imagePath),
    method,
    sourceUrl: videoUrl,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${outputPath}`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition AvatarDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
