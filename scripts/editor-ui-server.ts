/**
 * Vibz Cut — drag-and-drop video editor UI + API.
 *
 *   npm run editor:ui
 *   → http://localhost:5174
 *
 * Saves to public/editor-project.json (+ OpenCut export) for Remotion
 * compositions Editor / VibzCut.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { createEditor, projectToRemotionProps } from "../src/integrations/video-editor";
import type { EditorTrack } from "../src/integrations/video-editor";

const PORT = Number(process.env.EDITOR_UI_PORT ?? 5174);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const UI_DIR = path.join(ROOT, "editor-ui");
const PROJECT_PATH = path.join(PUBLIC, "editor-project.json");
const OPENCUT_PATH = path.join(PUBLIC, "opencut-project.json");

const MEDIA_EXT: Record<string, "video" | "image" | "audio"> = {
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".mkv": "video",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".wav": "audio",
  ".mp3": "audio",
  ".m4a": "audio",
  ".aac": "audio",
};

function send(
  res: http.ServerResponse,
  status: number,
  body: string | Buffer,
  type: string,
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  send(res, status, JSON.stringify(body, null, 2), "application/json; charset=utf-8");
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

function listMedia() {
  if (!fs.existsSync(PUBLIC)) return [];
  return fs
    .readdirSync(PUBLIC)
    .filter((name) => {
      const full = path.join(PUBLIC, name);
      if (!fs.statSync(full).isFile()) return false;
      return Boolean(MEDIA_EXT[path.extname(name).toLowerCase()]);
    })
    .map((name) => {
      const full = path.join(PUBLIC, name);
      const type = MEDIA_EXT[path.extname(name).toLowerCase()];
      return {
        name,
        type,
        url: `/files/${encodeURIComponent(name)}`,
        size: fs.statSync(full).size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function safePublicFile(name: string): string | null {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) return null;
  const full = path.join(PUBLIC, base);
  if (!full.startsWith(PUBLIC)) return null;
  return full;
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sanitizeFilename(name: string): string {
  return path
    .basename(name)
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const { pathname } = url;

    if (req.method === "GET" && pathname === "/api/media") {
      sendJson(res, 200, { media: listMedia() });
      return;
    }

    if (req.method === "GET" && pathname === "/api/project") {
      if (!fs.existsSync(PROJECT_PATH)) {
        sendJson(res, 200, {
          config: { width: 1920, height: 1080, fps: 30, durationInFrames: 240 },
          tracks: [],
          effects: [],
        });
        return;
      }
      const raw = JSON.parse(fs.readFileSync(PROJECT_PATH, "utf8")) as {
        config?: unknown;
        tracks?: EditorTrack[];
        effects?: unknown[];
        remotionProps?: { tracks?: EditorTrack[] };
      };
      sendJson(res, 200, {
        config: raw.config ?? {
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 240,
        },
        tracks: raw.tracks ?? raw.remotionProps?.tracks ?? [],
        effects: raw.effects ?? [],
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/project") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as {
        config?: {
          width?: number;
          height?: number;
          fps?: number;
          durationInFrames?: number;
        };
        tracks?: EditorTrack[];
        effects?: Array<{
          type: "transition" | "filter" | "animation";
          trackId: string;
          startFrame: number;
          endFrame: number;
          params?: Record<string, unknown>;
          id?: string;
        }>;
      };

      const editor = createEditor({
        width: body.config?.width ?? 1920,
        height: body.config?.height ?? 1080,
        fps: body.config?.fps ?? 30,
        durationInFrames: body.config?.durationInFrames ?? 1,
      });

      for (const track of body.tracks ?? []) {
        editor.addTrack(track);
      }
      for (const effect of body.effects ?? []) {
        editor.addEffect(effect);
      }

      const props = projectToRemotionProps(editor);
      const opencut = editor.exportOpenCut({
        name: "Vibz Cut Project",
        source: "vibz-media/editor-ui",
      });

      fs.mkdirSync(PUBLIC, { recursive: true });
      fs.writeFileSync(
        PROJECT_PATH,
        JSON.stringify(
          { ...editor.toJSON(), remotionProps: props, opencut },
          null,
          2,
        ),
      );
      fs.writeFileSync(OPENCUT_PATH, JSON.stringify(opencut, null, 2));

      sendJson(res, 200, {
        ok: true,
        tracks: props.tracks.length,
        durationInFrames: props.durationInFrames,
        editorProject: "public/editor-project.json",
        opencutProject: "public/opencut-project.json",
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/upload") {
      const rawName = req.headers["x-filename"];
      const filename = sanitizeFilename(
        Array.isArray(rawName) ? rawName[0] : rawName || "upload.bin",
      );
      const ext = path.extname(filename).toLowerCase();
      const type = MEDIA_EXT[ext];
      if (!type) {
        sendJson(res, 400, {
          error: `Unsupported file type "${ext}". Use video, image, or audio.`,
        });
        return;
      }

      const dest = path.join(PUBLIC, filename);
      const data = await readBody(req);
      fs.mkdirSync(PUBLIC, { recursive: true });
      fs.writeFileSync(dest, data);

      sendJson(res, 200, {
        media: {
          name: filename,
          type,
          url: `/files/${encodeURIComponent(filename)}`,
          size: data.length,
        },
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/files/")) {
      const name = decodeURIComponent(pathname.slice("/files/".length));
      const full = safePublicFile(name);
      if (!full || !fs.existsSync(full)) {
        send(res, 404, "Not found", "text/plain");
        return;
      }
      const data = fs.readFileSync(full);
      send(res, 200, data, contentTypeFor(full));
      return;
    }

    // Static UI
    let filePath = path.join(UI_DIR, pathname === "/" ? "index.html" : pathname);
    if (!filePath.startsWith(UI_DIR)) {
      send(res, 403, "Forbidden", "text/plain");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      send(res, 404, "Not found", "text/plain");
      return;
    }
    send(res, 200, fs.readFileSync(filePath), contentTypeFor(filePath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Vibz Cut editor UI → http://localhost:${PORT}`);
  console.log(`Media folder: ${PUBLIC}`);
  console.log(`Save writes: public/editor-project.json + public/opencut-project.json`);
});
