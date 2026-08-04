/**
 * Generate B-roll (T2V) or animate a still (I2V) into public/ for Remotion.
 *
 * Prerequisites: local Wan 2.2 / LTX / FramePack server (default :7860)
 *
 *   npm run video -- "A sunset over the ocean, cinematic 4K"
 *   npm run video -- --animate ./public/product.png "slow zoom with particles"
 *   npm run video -- --model ltx --server http://localhost:8188 "city aerial"
 */

import path from "path";
import fs from "fs";
import {
  animateImage,
  generateVideo,
  saveClipToFile,
  type VideoModel,
} from "../src/integrations/ai-video";

const MODELS: VideoModel[] = ["wan2.2", "ltx", "framepack"];

function parseArgs(argv: string[]) {
  let serverUrl = process.env.VIDEO_SERVER_URL ?? "http://localhost:7860";
  let model: VideoModel = "wan2.2";
  let imagePath: string | null = null;
  let motionPrompt: string | null = null;
  const promptParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--server" && argv[i + 1]) {
      serverUrl = argv[++i];
    } else if (arg === "--model" && argv[i + 1]) {
      const value = argv[++i] as VideoModel;
      if (!MODELS.includes(value)) {
        throw new Error(`Unknown model "${value}". Use: ${MODELS.join(", ")}`);
      }
      model = value;
    } else if (arg === "--animate" && argv[i + 1]) {
      imagePath = path.resolve(argv[++i]);
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        motionPrompt = argv[++i];
      }
    } else if (!arg.startsWith("--")) {
      promptParts.push(arg);
    }
  }

  const prompt =
    promptParts.join(" ").trim() ||
    motionPrompt ||
    "A sunset over the ocean, cinematic 4K";

  return { serverUrl, model, imagePath, motionPrompt, prompt };
}

async function main() {
  const { serverUrl, model, imagePath, motionPrompt, prompt } = parseArgs(
    process.argv.slice(2),
  );

  const outDir = path.resolve(__dirname, "../public");
  const outVideo = path.join(outDir, "ai-clip.mp4");
  const outMeta = path.join(outDir, "ai-clip-meta.json");

  console.log(`Video server: ${serverUrl}`);
  console.log(`Model: ${imagePath ? (model === "wan2.2" ? "framepack" : model) : model}`);

  let clip;
  let mode: "t2v" | "i2v";

  if (imagePath) {
    mode = "i2v";
    const motion = motionPrompt ?? prompt;
    console.log(`Image:  ${imagePath}`);
    console.log(`Motion: ${motion}`);
    clip = await animateImage(imagePath, motion, {
      serverUrl,
      model: model === "wan2.2" ? "framepack" : model,
    });
  } else {
    mode = "t2v";
    console.log(`Prompt: ${prompt}`);
    clip = await generateVideo(prompt, { serverUrl, model });
  }

  const saved = await saveClipToFile(clip, outVideo);

  const meta = {
    mode,
    prompt: saved.prompt,
    file: "ai-clip.mp4",
    sourceUrl: clip.url,
    duration: saved.duration,
    width: saved.width,
    height: saved.height,
    model: imagePath ? (model === "wan2.2" ? "framepack" : model) : model,
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${saved.url}`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition AiVideoDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
