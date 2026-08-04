/**
 * Build a sample timeline from public/ assets.
 *
 *   npm run timeline
 *
 * Writes public/timeline.json for the TimelineDemo composition.
 */

import path from "path";
import fs from "fs";
import {
  addClip,
  createTimeline,
  getTimelineDuration,
  toRemotionSequences,
} from "../src/integrations/timeline";

const PUBLIC = path.resolve(__dirname, "../public");

function exists(name: string): boolean {
  return fs.existsSync(path.join(PUBLIC, name));
}

async function main() {
  let timeline = createTimeline({ fps: 30, durationInFrames: 300 });

  // Match the README example shape, using ai-clip when present
  const videoSrc = exists("ai-clip.mp4") ? "ai-clip.mp4" : "clip.mp4";
  if (exists(videoSrc)) {
    timeline = addClip(timeline, {
      trackIndex: 0,
      type: "video",
      src: videoSrc,
      startFrame: 0,
      endFrame: 150,
    });
  }

  if (exists("cutout.png")) {
    timeline = addClip(timeline, {
      trackIndex: 1,
      type: "image",
      src: "cutout.png",
      startFrame: 60,
      endFrame: 240,
      opacity: 1,
    });
  }

  if (exists("soundtrack.wav")) {
    timeline = addClip(timeline, {
      trackIndex: 2,
      type: "audio",
      src: "soundtrack.wav",
      startFrame: 0,
      endFrame: 300,
      volume: 0.4,
    });
  }

  if (exists("voiceover.wav")) {
    timeline = addClip(timeline, {
      trackIndex: 3,
      type: "audio",
      src: "voiceover.wav",
      startFrame: 0,
      endFrame: 90,
      volume: 1,
    });
  }

  timeline = addClip(timeline, {
    trackIndex: 4,
    type: "text",
    text: "Timeline → Remotion Sequences",
    startFrame: 15,
    endFrame: 300,
  });

  const sequences = toRemotionSequences(timeline);
  const durationInFrames = getTimelineDuration(timeline);
  const out = path.join(PUBLIC, "timeline.json");

  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        timeline,
        sequences,
        fps: timeline.config.fps,
        durationInFrames,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${out}`);
  console.log(
    `Clips: ${timeline.clips.length} · Sequences: ${sequences.length} · Duration: ${durationInFrames} frames`,
  );
  console.log("Open Remotion Studio → composition TimelineDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
