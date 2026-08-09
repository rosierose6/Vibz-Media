/**
 * Build a sample EditorProject from assets already in public/.
 *
 * Also writes an OpenCut-compatible export so CapCut-style timelines
 * round-trip through the same video editor pipeline.
 *
 *   npm run tts && npm run cutout && npm run video && npm run music
 *   npm run editor
 *   npm run editor -- --import ./my-edit.opencut.json
 *
 * Writes:
 *   public/editor-project.json
 *   public/opencut-project.json
 */

import path from "path";
import fs from "fs";
import {
  createEditor,
  projectToRemotionProps,
} from "../src/integrations/video-editor";
import {
  isOpenCutDocument,
  resolveEditorProps,
  type OpenCutDocument,
} from "../src/integrations/opencut";

const PUBLIC = path.resolve(__dirname, "../public");

function exists(name: string): boolean {
  return fs.existsSync(path.join(PUBLIC, name));
}

function parseArgs(argv: string[]) {
  let importPath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--import" && argv[i + 1]) {
      importPath = path.resolve(argv[++i]);
    }
  }
  return { importPath };
}

function buildSampleEditor() {
  const editor = createEditor({ width: 1920, height: 1080, fps: 30 });
  const fps = 30;

  if (exists("ai-clip.mp4")) {
    editor.addTrack({
      type: "video",
      src: "ai-clip.mp4",
      startFrame: 0,
      endFrame: 6 * fps,
      layer: 0,
      properties: { objectFit: "cover", opacity: 1 },
    });
  }

  if (exists("cutout.png")) {
    editor.addTrack({
      type: "image",
      src: "cutout.png",
      startFrame: 2 * fps,
      endFrame: 8 * fps,
      layer: 2,
      properties: { scale: 1, opacity: 1 },
    });
  }

  if (exists("voiceover.wav")) {
    editor.addTrack({
      type: "audio",
      src: "voiceover.wav",
      startFrame: 0,
      endFrame: 3 * fps,
      layer: 3,
      properties: { volume: 1 },
    });
  }

  if (exists("soundtrack.wav")) {
    editor.addTrack({
      type: "audio",
      src: "soundtrack.wav",
      startFrame: 0,
      endFrame: 8 * fps,
      layer: 4,
      properties: { volume: 0.35 },
    });
  }

  let title = "Welcome to the future of video.";
  const voiceMeta = path.join(PUBLIC, "voiceover-meta.json");
  if (fs.existsSync(voiceMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(voiceMeta, "utf8")) as {
        text?: string;
      };
      if (meta.text) title = meta.text;
    } catch {
      // keep default
    }
  }

  editor.addTrack({
    type: "text",
    text: title,
    startFrame: Math.round(0.5 * fps),
    endFrame: 8 * fps,
    layer: 5,
    properties: {
      fontSize: 52,
      color: "#f2ebe3",
      textAlign: "center",
    },
  });

  return editor;
}

async function main() {
  const { importPath } = parseArgs(process.argv.slice(2));
  const editor = createEditor({ width: 1920, height: 1080, fps: 30 });

  if (importPath) {
    if (!fs.existsSync(importPath)) {
      throw new Error(`Project file not found: ${importPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(importPath, "utf8")) as unknown;
    if (isOpenCutDocument(raw)) {
      editor.importOpenCut(raw);
      console.log(`Imported OpenCut project: ${importPath}`);
    } else {
      const props = resolveEditorProps(raw);
      if (!props) {
        throw new Error(
          `Unrecognized editor/OpenCut JSON: ${importPath}`,
        );
      }
      for (const track of props.tracks) {
        editor.addTrack(track);
      }
      for (const effect of props.effects) {
        editor.addEffect(effect);
      }
      console.log(`Imported editor project: ${importPath}`);
    }
  } else {
    const sample = buildSampleEditor();
    for (const track of sample.tracks) {
      editor.addTrack(track);
    }
    for (const effect of sample.effects) {
      editor.addEffect(effect);
    }
  }

  if (editor.tracks.length <= 1) {
    console.warn(
      "Few media assets found in public/. Run tts / cutout / video / music for a richer timeline.",
    );
  }

  const props = projectToRemotionProps(editor);
  const opencut: OpenCutDocument = editor.exportOpenCut({
    name: "Vibz Media Editor Project",
    source: "vibz-media/video-editor",
  });

  const projectPath = path.join(PUBLIC, "editor-project.json");
  const opencutPath = path.join(PUBLIC, "opencut-project.json");

  fs.writeFileSync(
    projectPath,
    JSON.stringify(
      {
        ...editor.toJSON(),
        remotionProps: props,
        opencut,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(opencutPath, JSON.stringify(opencut, null, 2));

  console.log(`Wrote ${projectPath}`);
  console.log(`Wrote ${opencutPath}`);
  console.log(
    `Tracks: ${props.tracks.length} · Duration: ${props.durationInFrames} frames @ ${props.fps}fps`,
  );
  console.log("Open Remotion Studio → composition Editor");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
