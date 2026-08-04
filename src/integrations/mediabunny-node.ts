/**
 * Node-only mediabunny inspect / convert. Do not import from Remotion scenes.
 */

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import {
  ALL_FORMATS,
  Conversion,
  FilePathSource,
  FilePathTarget,
  Input,
  MovOutputFormat,
  Mp3OutputFormat,
  Mp4OutputFormat,
  Output,
  WavOutputFormat,
  WebMOutputFormat,
} from "mediabunny";
import type {
  ConvertMediaOptions,
  ConvertMediaResult,
  MediaContainerFormat,
  MediaInfo,
} from "./mediabunny";

const execFileAsync = promisify(execFile);

function resolveMediaPath(url: string): string {
  if (path.isAbsolute(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
    path.resolve(process.cwd(), "out", path.basename(cleaned)),
    path.resolve(__dirname, "../../", cleaned),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Media not found: ${url}`);
}

function ffmpegEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
  };
}

function outputFormatFor(format: MediaContainerFormat) {
  switch (format) {
    case "webm":
      return new WebMOutputFormat();
    case "mov":
      return new MovOutputFormat();
    case "wav":
      return new WavOutputFormat();
    case "mp3":
      return new Mp3OutputFormat();
    case "mp4":
    default:
      return new Mp4OutputFormat();
  }
}

function defaultOutPath(src: string, format: MediaContainerFormat): string {
  const base = path.basename(src, path.extname(src));
  return path.resolve(
    process.cwd(),
    "public/generated",
    `${base}-mediabunny.${format}`,
  );
}

/**
 * Read container metadata via mediabunny (no decode required).
 */
export async function inspectMedia(url: string): Promise<MediaInfo> {
  const filePath = resolveMediaPath(url);
  const input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });

  try {
    const duration = await input.computeDuration();
    const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
    const format =
      (input as { format?: { name?: string } }).format?.name ?? (ext || null);
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const tagsRaw = (await input.getMetadataTags()) as {
      title?: string;
      artist?: string;
      album?: string;
      raw?: Record<string, unknown>;
    };

    const tags: Record<string, string> = {};
    for (const key of ["title", "artist", "album"] as const) {
      const value = tagsRaw?.[key];
      if (typeof value === "string" && value.trim()) tags[key] = value;
    }
    for (const [key, value] of Object.entries(tagsRaw?.raw ?? {})) {
      if (typeof value === "string" && value.trim()) tags[key] = value;
    }

    const video = videoTrack
      ? {
          width: videoTrack.displayWidth,
          height: videoTrack.displayHeight,
          codedWidth: videoTrack.codedWidth,
          codedHeight: videoTrack.codedHeight,
          rotation: videoTrack.rotation,
          codec: videoTrack.codec ?? null,
          canDecode: await videoTrack.canDecode(),
        }
      : null;

    const audio = audioTrack
      ? {
          sampleRate: audioTrack.sampleRate,
          channels: audioTrack.numberOfChannels,
          codec: audioTrack.codec ?? null,
          canDecode: await audioTrack.canDecode(),
        }
      : null;

    return {
      url,
      duration,
      format,
      video,
      audio,
      tags,
      engine: "mediabunny",
    };
  } finally {
    await input.dispose();
  }
}

async function convertWithMediabunny(
  filePath: string,
  outPath: string,
  format: MediaContainerFormat,
  options: ConvertMediaOptions,
): Promise<ConvertMediaResult | null> {
  const input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });
  const output = new Output({
    format: outputFormatFor(format),
    target: new FilePathTarget(outPath),
  });

  try {
    const init: {
      input: Input;
      output: Output;
      trim?: { start: number; end: number };
    } = { input, output };

    if (options.start !== undefined || options.end !== undefined) {
      const duration = await input.computeDuration();
      init.trim = {
        start: options.start ?? 0,
        end: options.end ?? duration,
      };
    }

    const conversion = await Conversion.init(init);
    if (!conversion.isValid) {
      return null;
    }

    await conversion.execute();
    const bytes = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
    return { outPath, format, engine: "mediabunny", bytes };
  } catch {
    return null;
  } finally {
    await input.dispose();
  }
}

async function convertWithFfmpeg(
  filePath: string,
  outPath: string,
  format: MediaContainerFormat,
  options: ConvertMediaOptions,
): Promise<ConvertMediaResult> {
  const args = ["-y", "-i", filePath];
  if (options.start !== undefined) args.push("-ss", String(options.start));
  if (options.end !== undefined) {
    const start = options.start ?? 0;
    args.push("-t", String(Math.max(0.01, options.end - start)));
  }

  if (options.copy && format !== "wav" && format !== "mp3") {
    args.push("-c", "copy");
  } else if (format === "webm") {
    args.push("-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus");
  } else if (format === "wav") {
    args.push("-vn", "-acodec", "pcm_s16le");
  } else if (format === "mp3") {
    args.push("-vn", "-acodec", "libmp3lame", "-q:a", "2");
  } else {
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac");
  }

  args.push(outPath);

  try {
    await execFileAsync("ffmpeg", args, {
      env: ffmpegEnv(),
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    // Retry without audio if source has no audio track.
    if (format === "webm" || format === "mp4" || format === "mov") {
      const retry = [
        "-y",
        "-i",
        filePath,
        "-an",
        ...(format === "webm"
          ? ["-c:v", "libvpx-vp9", "-b:v", "1M"]
          : ["-c:v", "libx264", "-pix_fmt", "yuv420p"]),
        outPath,
      ];
      if (options.start !== undefined) retry.splice(3, 0, "-ss", String(options.start));
      await execFileAsync("ffmpeg", retry, {
        env: ffmpegEnv(),
        maxBuffer: 16 * 1024 * 1024,
      });
    } else {
      throw err;
    }
  }

  return {
    outPath,
    format,
    engine: "ffmpeg",
    bytes: fs.statSync(outPath).size,
  };
}

/**
 * Convert / transmux a media file.
 * Tries mediabunny first; falls back to ffmpeg when WebCodecs aren't available.
 */
export async function convertMedia(
  url: string,
  options: ConvertMediaOptions = {},
): Promise<ConvertMediaResult> {
  const filePath = resolveMediaPath(url);
  const format = options.format ?? "webm";
  const outPath = path.resolve(
    options.outPath ?? defaultOutPath(filePath, format),
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const viaBunny = await convertWithMediabunny(
    filePath,
    outPath,
    format,
    options,
  );
  if (viaBunny) return viaBunny;

  return convertWithFfmpeg(filePath, outPath, format, options);
}

/** Alias matching README wording. */
export const readMediaMetadata = inspectMedia;
