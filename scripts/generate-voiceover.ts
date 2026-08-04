/**
 * Generate a Remotion-ready voiceover WAV with Kokoro (in-process).
 *
 *   npm run tts
 *   npm run tts -- "Your custom line here."
 */

import path from "path";
import fs from "fs";
import { createKokoroTTS } from "../src/integrations/kokoro-tts";

const text =
  process.argv.slice(2).join(" ").trim() ||
  "Welcome to the future of video.";

const outDir = path.resolve(__dirname, "../public");
const outWav = path.join(outDir, "voiceover.wav");
const outMeta = path.join(outDir, "voiceover-meta.json");

async function main() {
  console.log("Loading Kokoro TTS (first run downloads the ONNX model)...");
  const tts = await createKokoroTTS({
    device: "cpu",
    dtype: "q8",
    voice: "af_heart",
  });

  console.log(`Generating: "${text}"`);
  const { outputPath, durationInSeconds } = await tts.speakToFile(text, outWav);

  const meta = {
    text,
    file: "voiceover.wav",
    durationInSeconds,
    voice: "af_heart",
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));

  console.log(`Wrote ${outputPath}`);
  console.log(`Duration: ${durationInSeconds.toFixed(2)}s`);
  console.log(`Meta: ${outMeta}`);
  console.log("Open Remotion Studio → composition VoiceoverDemo");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
