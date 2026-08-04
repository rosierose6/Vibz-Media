/**
 * Build a sample EditorProject from assets already in public/.
 *
 *   npm run tts && npm run cutout && npm run video && npm run music
 *   npm run editor
 *
 * Writes public/editor-project.json for the EditorDemo composition.
 */

import path from "path";
import fs from "fs";
import {
  createEditor,
  projectToRemotionProps,
} from "../src/integrations/video-editor";

const PUBLIC = path.resolve(__dirname, "../public");

function exists(name: string): boolean {
  return fs.existsSync(path.join(PUBLIC, name));
}

async function main() {
  const editor = createEditor({ width: 1920, height: 1080, fps: 30 });
  const fps = 30;

  // ~8s timeline composed from whatever assets exist
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

  if (editor.tracks.length === 1) {
    // Only the text track — still a valid project
    console.warn(
      "Few media assets found in public/. Run tts / cutout / video / music for a richer timeline.",
    );
  }

  const props = projectToRemotionProps(editor);
  const projectPath = path.join(PUBLIC, "editor-project.json");
  fs.writeFileSync(
    projectPath,
    JSON.stringify({ ...editor.toJSON(), remotionProps: props }, null, 2),
  );

  console.log(`Wrote ${projectPath}`);
  console.log(
    `Tracks: ${props.tracks.length} · Duration: ${props.durationInFrames} frames @ ${props.fps}fps`,
  );
  console.log("Open Remotion Studio → composition EditorDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
