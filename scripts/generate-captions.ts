/**
 * Transcribe Kokoro voiceover into word-level captions for Remotion.
 *
 *   npm run tts
 *   npm run captions                 # WhisperX on :8000, offline fallback
 *   npm run captions -- --offline    # align from voiceover-meta text only
 *   npm run captions -- --model large
 */

import path from "path";
import fs from "fs";
import {
  alignTextToDuration,
  flattenWords,
  toSRT,
  transcribe,
  type CaptionWord,
  type TranscriptionResult,
  type WhisperModel,
} from "../src/integrations/auto-captions";
const MODELS: WhisperModel[] = ["tiny", "base", "small", "medium", "large"];

async function resolveDurationSeconds(audioPath: string): Promise<number> {
  const metaPath = path.resolve(__dirname, "../public/voiceover-meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
        durationInSeconds?: number;
      };
      if (meta.durationInSeconds && meta.durationInSeconds > 0) {
        return meta.durationInSeconds;
      }
    } catch {
      // fall through
    }
  }

  try {
    const { getAudioDurationInSeconds } = await import("@remotion/media-utils");
    return await getAudioDurationInSeconds(audioPath);
  } catch {
    // Last resort: rough WAV header size estimate is avoided — require meta.
    throw new Error(
      "Could not determine audio duration. Re-run `npm run tts` so voiceover-meta.json exists.",
    );
  }
}

function parseArgs(argv: string[]) {
  let audioPath = path.resolve(__dirname, "../public/voiceover.wav");
  let serverUrl = process.env.CAPTIONS_SERVER_URL ?? "http://localhost:8000";
  let model: WhisperModel = "base";
  let offline = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--audio" && argv[i + 1]) {
      audioPath = path.resolve(argv[++i]);
    } else if (arg === "--server" && argv[i + 1]) {
      serverUrl = argv[++i];
    } else if (arg === "--model" && argv[i + 1]) {
      const value = argv[++i] as WhisperModel;
      if (!MODELS.includes(value)) {
        throw new Error(`Unknown model "${value}". Use: ${MODELS.join(", ")}`);
      }
      model = value;
    } else if (arg === "--offline") {
      offline = true;
    }
  }

  return { audioPath, serverUrl, model, offline };
}

function offlineFromMeta(
  audioPath: string,
  durationSeconds: number,
): TranscriptionResult {
  const metaPath = path.resolve(__dirname, "../public/voiceover-meta.json");
  let text = "Welcome to the future of video.";

  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
        text?: string;
        durationInSeconds?: number;
      };
      if (meta.text) text = meta.text;
      if (meta.durationInSeconds && durationSeconds <= 0) {
        durationSeconds = meta.durationInSeconds;
      }
    } catch {
      // keep defaults
    }
  }

  const words = alignTextToDuration(text, durationSeconds);
  const segments = [
    {
      text,
      start: 0,
      end: durationSeconds,
      words,
    },
  ];

  return {
    segments,
    language: "en",
    duration: durationSeconds,
    words,
  };
}

async function main() {
  const { audioPath, serverUrl, model, offline } = parseArgs(
    process.argv.slice(2),
  );

  if (!fs.existsSync(audioPath)) {
    throw new Error(
      `Missing ${audioPath}\nRun \`npm run tts\` first to generate the Kokoro voiceover.`,
    );
  }

  const outDir = path.resolve(__dirname, "../public");
  const outJson = path.join(outDir, "captions.json");
  const outSrt = path.join(outDir, "captions.srt");

  let result: TranscriptionResult;
  let source: "whisperx" | "offline";

  if (offline) {
    console.log("Offline mode: aligning voiceover-meta text to audio duration");
    const duration = await resolveDurationSeconds(audioPath);
    result = offlineFromMeta(audioPath, duration);
    source = "offline";
  } else {
    console.log(`Captions server: ${serverUrl}`);
    console.log(`Model: ${model}`);
    console.log(`Audio: ${audioPath}`);
    try {
      result = await transcribe(audioPath, { serverUrl, model });
      source = "whisperx";
    } catch (err) {
      console.warn(err instanceof Error ? err.message : err);
      console.warn("Falling back to offline text alignment…");
      const duration = await resolveDurationSeconds(audioPath);
      result = offlineFromMeta(audioPath, duration);
      source = "offline";
    }
  }

  const words: CaptionWord[] = flattenWords(result);
  const payload = {
    ...result,
    words,
    audioFile: path.basename(audioPath),
    source,
    generatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(payload, null, 2));
  fs.writeFileSync(outSrt, toSRT(result));

  console.log(`Wrote ${outJson} (${words.length} words, source=${source})`);
  console.log(`Wrote ${outSrt}`);
  console.log("Open Remotion Studio → composition CaptionsDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
