/**
 * Node-only GFPGAN face restoration. Do not import from Remotion scenes.
 */

import { execFile, spawnSync } from "child_process";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import type {
  GfpganVersion,
  RestoreFacesOptions,
  RestoreFacesResult,
} from "./gfpgan";

const execFileAsync = promisify(execFile);

const WEIGHT_URLS: Record<GfpganVersion, string> = {
  "1.2":
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.2.pth",
  "1.3":
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth",
  "1.4":
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth",
};

function binRoot(): string {
  return path.resolve(process.cwd(), "bin/gfpgan");
}

function weightsDir(): string {
  return path.join(binRoot(), "weights");
}

function resolveInput(url: string): string {
  if (path.isAbsolute(url) && fs.existsSync(url)) return url;
  const cleaned = url.replace(/^\.\//, "");
  const candidates = [
    path.resolve(process.cwd(), cleaned),
    path.resolve(process.cwd(), "public", path.basename(cleaned)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Image not found: ${url}`);
}

function defaultOutput(input: string, version: GfpganVersion): string {
  const base = path.basename(input, path.extname(input));
  return path.resolve(
    process.cwd(),
    "public",
    `${base}-restored-v${version}.png`,
  );
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const get = (u: string) => {
      https
        .get(u, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            get(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode} ${u}`));
            return;
          }
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        })
        .on("error", reject);
    };
    get(url);
  });
}

export async function ensureGfpganWeights(
  version: GfpganVersion = "1.4",
): Promise<string> {
  const dest = path.join(weightsDir(), `GFPGANv${version}.pth`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1_000_000) return dest;
  console.log(`Downloading GFPGANv${version}.pth…`);
  await download(WEIGHT_URLS[version], dest);
  return dest;
}

function findGfpganPython(): {
  python: string;
  script: string | null;
  module: boolean;
} | null {
  const envDir = process.env.GFPGAN_DIR;
  const candidates = [
    envDir,
    path.resolve(process.cwd(), "bin/gfpgan/repo"),
    path.resolve(process.cwd(), "bin/GFPGAN"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    const script = path.join(dir, "inference_gfpgan.py");
    if (fs.existsSync(script)) {
      return { python: "python3", script, module: false };
    }
  }

  // Detect installed gfpgan package.
  const probe = spawnSync(
    "python3",
    ["-c", "import gfpgan; print(gfpgan.__file__)"],
    { encoding: "utf8" },
  );
  if (probe.status === 0) {
    return { python: "python3", script: null, module: true };
  }

  return null;
}

function writeInlineInferScript(tmpDir: string): string {
  const script = path.join(tmpDir, "vibz_gfpgan_infer.py");
  fs.writeFileSync(
    script,
    `#!/usr/bin/env python3
import argparse, os, sys
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("-i", required=True)
    p.add_argument("-o", required=True)
    p.add_argument("-v", default="1.4")
    p.add_argument("-s", type=int, default=2)
    p.add_argument("--weight", default="")
    p.add_argument("--only-center-face", action="store_true")
    args = p.parse_args()

    try:
        from gfpgan import GFPGANer
    except Exception as e:
        print(f"gfpgan import failed: {e}", file=sys.stderr)
        sys.exit(2)

    import cv2
    weight = args.weight
    if not weight:
        weight = str(Path(os.environ.get("GFPGAN_WEIGHTS", "")) / f"GFPGANv{args.v}.pth")
    if not os.path.isfile(weight):
        print(f"missing weight: {weight}", file=sys.stderr)
        sys.exit(3)

    restorer = GFPGANer(
        model_path=weight,
        upscale=args.s,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=None,
    )
    img = cv2.imread(args.i, cv2.IMREAD_COLOR)
    if img is None:
        print(f"cannot read {args.i}", file=sys.stderr)
        sys.exit(4)
    _, _, restored = restorer.enhance(
        img,
        has_aligned=False,
        only_center_face=args.only_center_face,
        paste_back=True,
        weight=0.5,
    )
    os.makedirs(os.path.dirname(args.o) or ".", exist_ok=True)
    cv2.imwrite(args.o, restored)
    print(args.o)

if __name__ == "__main__":
    main()
`,
  );
  return script;
}

async function restoreWithGfpgan(
  input: string,
  output: string,
  version: GfpganVersion,
  scale: number,
  onlyCenterFace: boolean,
): Promise<RestoreFacesResult | null> {
  const py = findGfpganPython();
  if (!py) return null;

  let weight: string;
  try {
    weight = await ensureGfpganWeights(version);
  } catch (err) {
    console.warn(
      `GFPGAN weights unavailable: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vibz-gfpgan-"));
  try {
    if (py.script) {
      // Official inference_gfpgan.py writes into an output directory.
      const outDir = path.join(tmp, "results");
      fs.mkdirSync(outDir, { recursive: true });
      const args = [
        py.script,
        "-i",
        input,
        "-o",
        outDir,
        "-v",
        version,
        "-s",
        String(scale),
      ];
      if (onlyCenterFace) args.push("-only_center_face");
      try {
        await execFileAsync(py.python, args, {
          maxBuffer: 64 * 1024 * 1024,
          env: {
            ...process.env,
            GFPGAN_WEIGHTS: weightsDir(),
          },
          cwd: path.dirname(py.script),
        });
      } catch (err) {
        console.warn(
          `GFPGAN inference failed: ${err instanceof Error ? err.message : err}`,
        );
        return null;
      }

      // Pick restored image from results/restored_imgs or similar.
      const stack = [outDir];
      let found: string | null = null;
      while (stack.length && !found) {
        const dir = stack.pop()!;
        for (const entry of fs.readdirSync(dir)) {
          const full = path.join(dir, entry);
          if (fs.statSync(full).isDirectory()) stack.push(full);
          else if (/\.(png|jpg|jpeg|webp)$/i.test(entry)) found = full;
        }
      }
      if (!found) return null;
      fs.copyFileSync(found, output);
    } else {
      const script = writeInlineInferScript(tmp);
      try {
        await execFileAsync(
          py.python,
          [
            script,
            "-i",
            input,
            "-o",
            output,
            "-v",
            version,
            "-s",
            String(scale),
            "--weight",
            weight,
            ...(onlyCenterFace ? ["--only-center-face"] : []),
          ],
          {
            maxBuffer: 64 * 1024 * 1024,
            env: { ...process.env, GFPGAN_WEIGHTS: weightsDir() },
          },
        );
      } catch (err) {
        console.warn(
          `GFPGAN module inference failed: ${
            err instanceof Error ? err.message : err
          }`,
        );
        return null;
      }
    }

    if (!fs.existsSync(output)) return null;
    const meta = await sharp(output).metadata();
    return {
      input,
      output,
      version,
      scale,
      engine: "gfpgan",
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      bytes: fs.statSync(output).size,
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function restoreWithSharp(
  input: string,
  output: string,
  version: GfpganVersion,
  scale: number,
): Promise<RestoreFacesResult> {
  const image = sharp(input);
  const meta = await image.metadata();
  const width = Math.round((meta.width ?? 1) * scale);
  const height = Math.round((meta.height ?? 1) * scale);

  // Soft “restore” look when GFPGAN isn't installed — not a substitute
  // for StyleGAN priors, but keeps the Remotion pipeline green.
  await image
    .resize({ width, height, kernel: "lanczos3" })
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .sharpen({ sigma: 1.1, m1: 0.8, m2: 0.4 })
    .png()
    .toFile(output);

  return {
    input,
    output,
    version,
    scale,
    engine: "sharp",
    width,
    height,
    bytes: fs.statSync(output).size,
  };
}

/**
 * Restore faces in an image (GFPGAN API shape).
 */
export async function restoreFaces(
  url: string,
  options: RestoreFacesOptions = {},
): Promise<RestoreFacesResult> {
  const version = options.version ?? "1.4";
  const scale = options.scale ?? 2;
  const input = resolveInput(url);
  const output = path.resolve(
    options.output ?? defaultOutput(input, version),
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (!options.fallback) {
    const viaGfpgan = await restoreWithGfpgan(
      input,
      output,
      version,
      scale,
      options.onlyCenterFace ?? false,
    );
    if (viaGfpgan) return viaGfpgan;
    console.warn(
      "GFPGAN not installed — using sharp fallback. Set GFPGAN_DIR or `pip install gfpgan` for real face restoration.",
    );
  }

  return restoreWithSharp(input, output, version, scale);
}

/** Alias matching README wording. */
export const restoreFace = restoreFaces;

export function gfpganAvailable(): boolean {
  return findGfpganPython() !== null;
}
