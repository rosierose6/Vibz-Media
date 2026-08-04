/**
 * Local AI-music stub server for Vanta.
 *
 * Implements /generate expected by src/integrations/ai-music.ts.
 * Uses ffmpeg synth tones until ACE-Step 1.5 (`uv run acestep-api`) is installed.
 *
 *   npm run music:server
 */

import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createHash } from "crypto";

const PORT = Number(process.env.MUSIC_SERVER_PORT ?? 8000);
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

async function readJson(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
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

function bpmFromPrompt(prompt: string, fallback?: number): number {
  if (fallback && Number.isFinite(fallback)) return fallback;
  const match = prompt.match(/(\d{2,3})\s*bpm/i);
  if (match) return Number(match[1]);
  const lower = prompt.toLowerCase();
  if (lower.includes("lo-fi") || lower.includes("lofi")) return 84;
  if (lower.includes("tension") || lower.includes("orchestral")) return 96;
  if (lower.includes("upbeat") || lower.includes("dance")) return 120;
  return 90;
}

async function makeTrack(opts: {
  prompt: string;
  duration: number;
  bpm: number;
}): Promise<{ outputPath: string; url: string }> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const name = `track-${slug(opts.prompt)}.wav`;
  const outputPath = path.join(OUT_DIR, name);

  // Layered sine pads + soft pulse as a stand-in soundtrack
  const beatHz = opts.bpm / 60;
  const root = 110 + (parseInt(slug(opts.prompt).slice(0, 2), 16) % 40);
  const fifth = root * 1.5;
  const octave = root * 2;

  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${root}:sample_rate=44100:duration=${opts.duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${fifth}:sample_rate=44100:duration=${opts.duration}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${octave}:sample_rate=44100:duration=${opts.duration}`,
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=0.12*sin(2*PI*${beatHz}*t)*sin(2*PI*55*t):s=44100:d=${opts.duration}`,
    "-filter_complex",
    "[0]volume=0.22[a0];[1]volume=0.16[a1];[2]volume=0.1[a2];[3]volume=0.18[a3];[a0][a1][a2][a3]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1.5,afade=t=out:st=" +
      Math.max(0, opts.duration - 2) +
      ":d=2",
    "-ac",
    "2",
    outputPath,
  ]);

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
      service: "vanta-music-server",
      mode: "ffmpeg-stub",
      endpoints: ["/generate", "/files/:name"],
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
    res.writeHead(200, { "Content-Type": "audio/wav" });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    try {
      const body = await readJson(req);
      const prompt = String(
        body.prompt ?? "cinematic orchestral tension building",
      );
      const duration = Number(body.duration) || 30;
      const bpm = bpmFromPrompt(prompt, Number(body.bpm) || undefined);
      const { outputPath, url: audioUrl } = await makeTrack({
        prompt,
        duration,
        bpm,
      });
      sendJson(res, 200, {
        url: audioUrl,
        audio_url: audioUrl,
        path: outputPath,
        duration,
        bpm,
        prompt,
        model: body.model ?? "ace-step",
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
  console.log(`Vanta music server (ffmpeg stub) on http://localhost:${PORT}`);
  console.log("POST /generate — text → soundtrack");
  console.log("Swap this for ACE-Step 1.5 (`uv run acestep-api`) when ready.");
});
