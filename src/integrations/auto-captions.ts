/**
 * VANTA — Auto-Captions Integration
 *
 * WhisperX-powered transcription with word-level timestamps,
 * rendered as animated captions in Remotion.
 *
 * Usage:
 *   const result = await transcribe("./public/voiceover.wav", { model: "large" });
 *   const words = flattenWords(result);
 *   // [{ word: "Hello", start: 0.0, end: 0.5, confidence: 0.98 }, ...]
 *
 * Repos (commercial-safe):
 *   - https://github.com/m-bain/whisperX — BSD-2, forced-alignment word timestamps
 *   - https://github.com/SYSTRAN/faster-whisper — MIT, CTranslate2 engine
 *   - https://github.com/ggml-org/whisper.cpp — MIT, CPU/Metal, no Python
 *   - https://github.com/k2-fsa/sherpa-onnx — Apache-2.0, native Node bindings
 */

import fs from "fs";
import path from "path";

export interface CaptionWord {
  word: string;
  start: number; // seconds
  end: number;
  confidence: number;
}

export interface CaptionSegment {
  text: string;
  start: number;
  end: number;
  words: CaptionWord[];
}

export interface TranscriptionResult {
  segments: CaptionSegment[];
  language: string;
  duration: number;
  words: CaptionWord[];
}

export type WhisperModel = "tiny" | "base" | "small" | "medium" | "large";

export interface TranscribeOptions {
  language?: string;
  model?: WhisperModel;
  /** WhisperX / faster-whisper / whisper.cpp HTTP server. Default :8000 */
  serverUrl?: string;
}

/** Flatten all segment words (matches the README example shape). */
export function flattenWords(result: TranscriptionResult): CaptionWord[] {
  if (result.words?.length) return result.words;
  return result.segments.flatMap((segment) => segment.words);
}

/**
 * Approximate word timings from known script + audio duration.
 * Useful when Kokoro already produced the text and no ASR server is running.
 */
export function alignTextToDuration(
  text: string,
  durationSeconds: number,
): CaptionWord[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (tokens.length === 0 || durationSeconds <= 0) return [];

  const weights = tokens.map((word) => Math.max(1, word.replace(/\W/g, "").length));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const gap = Math.min(0.04, durationSeconds / tokens.length / 8);

  let cursor = 0;
  return tokens.map((word, index) => {
    const share = (weights[index] / totalWeight) * durationSeconds;
    const start = cursor;
    const end =
      index === tokens.length - 1
        ? durationSeconds
        : Math.min(durationSeconds, start + Math.max(0.08, share - gap));
    cursor = end + gap;
    return { word, start, end, confidence: 0.5 };
  });
}

function normalizeWord(raw: Record<string, unknown>): CaptionWord | null {
  const word = String(raw.word ?? raw.text ?? "").trim();
  if (!word) return null;
  const start = Number(raw.start ?? raw.begin ?? 0);
  const end = Number(raw.end ?? raw.finish ?? start);
  const confidence = Number(raw.confidence ?? raw.score ?? 1);
  return {
    word,
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : start,
    confidence: Number.isFinite(confidence) ? confidence : 1,
  };
}

function wordsToSegments(words: CaptionWord[]): CaptionSegment[] {
  if (words.length === 0) return [];

  const segments: CaptionSegment[] = [];
  const chunkSize = 8;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    segments.push({
      text: chunk.map((w) => w.word).join(" "),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      words: chunk,
    });
  }

  return segments;
}

function normalizeResult(payload: unknown, fallbackLanguage: string): TranscriptionResult {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Unexpected transcription payload: ${JSON.stringify(payload)}`);
  }

  const data = payload as Record<string, unknown>;

  // Already in Vanta shape
  if (Array.isArray(data.segments) || Array.isArray(data.words)) {
    const segmentWords = Array.isArray(data.segments)
      ? (data.segments as Record<string, unknown>[]).flatMap((segment) => {
          const words = Array.isArray(segment.words)
            ? (segment.words as Record<string, unknown>[])
                .map(normalizeWord)
                .filter((w): w is CaptionWord => w !== null)
            : [];
          return words;
        })
      : [];

    const topWords = Array.isArray(data.words)
      ? (data.words as Record<string, unknown>[])
          .map(normalizeWord)
          .filter((w): w is CaptionWord => w !== null)
      : [];

    const words = topWords.length ? topWords : segmentWords;
    const duration =
      Number(data.duration) ||
      (words.length ? words[words.length - 1].end : 0);

    const segments =
      Array.isArray(data.segments) && data.segments.length
        ? (data.segments as Record<string, unknown>[]).map((segment) => {
            const wordsInSeg = Array.isArray(segment.words)
              ? (segment.words as Record<string, unknown>[])
                  .map(normalizeWord)
                  .filter((w): w is CaptionWord => w !== null)
              : [];
            return {
              text: String(segment.text ?? wordsInSeg.map((w) => w.word).join(" ")),
              start: Number(segment.start ?? wordsInSeg[0]?.start ?? 0),
              end: Number(
                segment.end ?? wordsInSeg[wordsInSeg.length - 1]?.end ?? 0,
              ),
              words: wordsInSeg,
            };
          })
        : wordsToSegments(words);

    return {
      segments,
      language: String(data.language ?? fallbackLanguage),
      duration,
      words: words.length ? words : flattenWords({ segments, language: fallbackLanguage, duration, words: [] }),
    };
  }

  // WhisperX-style: [{ start, end, text, words: [...] }, ...]
  if (Array.isArray(payload)) {
    const segments = (payload as Record<string, unknown>[]).map((segment) => {
      const words = Array.isArray(segment.words)
        ? (segment.words as Record<string, unknown>[])
            .map(normalizeWord)
            .filter((w): w is CaptionWord => w !== null)
        : [];
      return {
        text: String(segment.text ?? words.map((w) => w.word).join(" ")),
        start: Number(segment.start ?? words[0]?.start ?? 0),
        end: Number(segment.end ?? words[words.length - 1]?.end ?? 0),
        words,
      };
    });
    const words = segments.flatMap((s) => s.words);
    return {
      segments,
      language: fallbackLanguage,
      duration: words[words.length - 1]?.end ?? 0,
      words,
    };
  }

  throw new Error(`Unrecognized transcription response: ${JSON.stringify(payload)}`);
}

export async function transcribe(
  audioPath: string,
  options: TranscribeOptions = {},
): Promise<TranscriptionResult> {
  const {
    language = "en",
    model = "base",
    serverUrl = process.env.CAPTIONS_SERVER_URL ?? "http://localhost:8000",
  } = options;

  const absoluteAudio = path.resolve(audioPath);
  if (!fs.existsSync(absoluteAudio)) {
    throw new Error(
      `Audio not found: ${absoluteAudio}\nRun \`npm run tts\` first to generate public/voiceover.wav`,
    );
  }

  const baseUrl = serverUrl.replace(/\/$/, "");

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio: absoluteAudio,
        language,
        model,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot reach captions server at ${baseUrl} (${detail}).\n` +
        `Start WhisperX / faster-whisper locally, or run \`npm run captions -- --offline\`.`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Captions server error ${response.status}: ${body || response.statusText}`,
    );
  }

  const payload = await response.json();
  return normalizeResult(payload, language);
}

/**
 * Convert transcription to SRT format
 */
export function toSRT(result: TranscriptionResult): string {
  return result.segments
    .map((seg, i) => {
      const startTime = formatSRTTime(seg.start);
      const endTime = formatSRTTime(seg.end);
      return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    })
    .join("\n");
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}
