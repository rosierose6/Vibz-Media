/**
 * VANTA — Kokoro TTS Integration
 *
 * In-process text-to-speech via kokoro-js (ONNX). No Python server,
 * no API keys — runs locally and writes a WAV for Remotion.
 *
 * Usage (Node script / CLI):
 *   const tts = await createKokoroTTS();
 *   await tts.speakToFile("Welcome to the future of video.", "./public/voiceover.wav");
 *
 * Then in a Remotion composition:
 *   <Audio src={staticFile("voiceover.wav")} />
 *
 * Repo: https://github.com/hexgrad/kokoro (Apache-2.0)
 */

import { KokoroTTS } from "kokoro-js";
import path from "path";
import fs from "fs";

const DEFAULT_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Voice ids from kokoro-js — call listVoices() for the full set. */
export type KokoroVoice = string;

export interface KokoroTTSConfig {
  modelId?: string;
  /** Node: "cpu". Browser: "wasm" | "webgpu". */
  device?: "cpu" | "wasm" | "webgpu";
  dtype?: "fp32" | "fp16" | "q8" | "q4" | "q4f16";
  voice?: KokoroVoice;
  speed?: number;
}

export interface KokoroVoiceEngine {
  speakToFile: (
    text: string,
    outputPath: string,
    options?: { voice?: KokoroVoice; speed?: number },
  ) => Promise<{ outputPath: string; durationInSeconds: number }>;
  listVoices: () => string[];
}

export async function createKokoroTTS(
  config: KokoroTTSConfig = {},
): Promise<KokoroVoiceEngine> {
  const {
    modelId = DEFAULT_MODEL,
    device = "cpu",
    dtype = "q8",
    voice: defaultVoice = "af_heart",
    speed: defaultSpeed = 1,
  } = config;

  const tts = await KokoroTTS.from_pretrained(modelId, { dtype, device });

  return {
    listVoices: () => Object.keys(tts.voices),
    speakToFile: async (text, outputPath, options = {}) => {
      const voice = options.voice ?? defaultVoice;
      const speed = options.speed ?? defaultSpeed;

      const audio = await tts.generate(text, { voice, speed });
      const absolutePath = path.resolve(outputPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      await audio.save(absolutePath);

      const durationInSeconds = audio.audio.length / audio.sampling_rate;

      return { outputPath: absolutePath, durationInSeconds };
    },
  };
}
