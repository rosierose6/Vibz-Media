/**
 * Generate a soundtrack via ACE-Step (or the local ffmpeg stub) into public/.
 *
 *   npm run music:server
 *   npm run music -- "cinematic orchestral tension building"
 *   npm run music -- --server http://localhost:8001 --bpm 100 "lo-fi hip hop"
 */

import path from "path";
import fs from "fs";
import {
  generateMusic,
  saveTrackToFile,
  type MusicModel,
} from "../src/integrations/ai-music";

const MODELS: MusicModel[] = ["ace-step", "mmaudio", "yue"];

function parseArgs(argv: string[]) {
  let serverUrl = process.env.MUSIC_SERVER_URL ?? "http://localhost:8000";
  let model: MusicModel = "ace-step";
  let bpm: number | undefined;
  let duration = 30;
  const promptParts: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--server" && argv[i + 1]) {
      serverUrl = argv[++i];
    } else if (arg === "--model" && argv[i + 1]) {
      const value = argv[++i] as MusicModel;
      if (!MODELS.includes(value)) {
        throw new Error(`Unknown model "${value}". Use: ${MODELS.join(", ")}`);
      }
      model = value;
    } else if (arg === "--bpm" && argv[i + 1]) {
      bpm = Number(argv[++i]);
    } else if (arg === "--duration" && argv[i + 1]) {
      duration = Number(argv[++i]);
    } else if (!arg.startsWith("--")) {
      promptParts.push(arg);
    }
  }

  const prompt =
    promptParts.join(" ").trim() || "cinematic orchestral tension building";

  return { serverUrl, model, bpm, duration, prompt };
}

async function main() {
  const { serverUrl, model, bpm, duration, prompt } = parseArgs(
    process.argv.slice(2),
  );

  const outDir = path.resolve(__dirname, "../public");
  const outAudio = path.join(outDir, "soundtrack.wav");
  const outMeta = path.join(outDir, "soundtrack-meta.json");

  console.log(`Music server: ${serverUrl}`);
  console.log(`Model: ${model}`);
  console.log(`Prompt: ${prompt}`);

  const track = await generateMusic(prompt, {
    serverUrl,
    model,
    duration,
    bpm,
  });
  const saved = await saveTrackToFile(track, outAudio);

  const meta = {
    prompt: saved.prompt,
    file: "soundtrack.wav",
    sourceUrl: track.url,
    duration: saved.duration,
    bpm: saved.bpm,
    model,
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${saved.url}`);
  console.log(`BPM: ${saved.bpm} · Duration: ${saved.duration}s`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition MusicDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
