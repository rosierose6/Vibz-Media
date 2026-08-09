/**
 * Local AI-video stub server for Vibz Media.
 *
 * Implements the /generate and /animate contract expected by
 * src/integrations/ai-video.ts. Uses ffmpeg for placeholder clips
 * until a real Wan 2.2 / LTX / FramePack / ComfyUI backend is installed.
 *
 *   npm run video:server
 */

import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createHash } from "crypto";

const PORT = Number(process.env.VIDEO_SERVER_PORT ?? 7860);
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "generated");

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", ...args], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function slug(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 10);
}

function colorFromPrompt(prompt: string): string {
  const hex = createHash("sha1").update(prompt).digest("hex").slice(0, 6);
  return `0x${hex}`;
}

async function makeClip(opts: {
  prompt: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  imagePath?: string;
}): Promise<{ outputPath: string; url: string }> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const name = `clip-${slug(opts.prompt + (opts.imagePath ?? ""))}.mp4`;
  const outputPath = path.join(OUT_DIR, name);
  const color = colorFromPrompt(opts.prompt);

  if (opts.imagePath && fs.existsSync(opts.imagePath)) {
    // Slow zoom Ken Burns–style from a still
    await runFfmpeg([
      "-loop",
      "1",
      "-i",
      opts.imagePath,
      "-vf",
      `scale=${opts.width}:${opts.height}:force_original_aspect_ratio=increase,crop=${opts.width}:${opts.height},zoompan=z='min(zoom+0.0015,1.2)':d=${opts.duration * opts.fps}:s=${opts.width}x${opts.height}:fps=${opts.fps}`,
      "-t",
      String(opts.duration),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);
  } else {
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=${opts.width}x${opts.height}:d=${opts.duration}:r=${opts.fps}`,
      "-f",
      "lavfi",
      "-i",
      `gradients=s=${opts.width}x${opts.height}:d=${opts.duration}:r=${opts.fps}:c0=${color}:c1=0x0a0a0a:x0=0:y0=0:x1=${opts.width}:y1=${opts.height}`,
      "-filter_complex",
      "[0][1]blend=all_mode=screen:all_opacity=0.55,format=yuv420p",
      "-t",
      String(opts.duration),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);
  }

  return {
    outputPath,
    url: `http://localhost:${PORT}/files/${name}`,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    sendJson(res, 200, {
      ok: true,
      service: "vibz-video-server",
      mode: "ffmpeg-stub",
      endpoints: ["/generate", "/animate", "/files/:name"],
    });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/files/")) {
    const name = path.basename(url.pathname);
    const filePath = path.join(OUT_DIR, name);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }
    res.writeHead(200, { "Content-Type": "video/mp4" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    try {
      const body = await readJson(req);
      const prompt = String(body.prompt ?? "cinematic b-roll");
      const duration = Number(body.duration) || 6;
      const width = Number(body.width) || 1280;
      const height = Number(body.height) || 720;
      const fps = Number(body.fps) || 24;
      const { outputPath, url: videoUrl } = await makeClip({
        prompt,
        duration,
        width,
        height,
        fps,
      });
      sendJson(res, 200, {
        url: videoUrl,
        video_url: videoUrl,
        path: outputPath,
        duration,
        width,
        height,
        prompt,
        model: body.model ?? "wan2.2",
        stub: true,
      });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/animate") {
    try {
      const body = await readJson(req);
      const image = String(body.image ?? "");
      const prompt = String(body.prompt ?? "slow zoom");
      const duration = Number(body.duration) || 6;
      const width = Number(body.width) || 1280;
      const height = Number(body.height) || 720;
      const fps = Number(body.fps) || 24;
      const { outputPath, url: videoUrl } = await makeClip({
        prompt,
        duration,
        width,
        height,
        fps,
        imagePath: image || undefined,
      });
      sendJson(res, 200, {
        url: videoUrl,
        video_url: videoUrl,
        path: outputPath,
        duration,
        width,
        height,
        prompt,
        model: body.model ?? "framepack",
        stub: true,
      });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Vibz Media video server (ffmpeg stub) on http://localhost:${PORT}`);
  console.log("POST /generate  — text → video");
  console.log("POST /animate   — image → video");
  console.log("Swap this for ComfyUI/Wan when GPU models are installed.");
});
