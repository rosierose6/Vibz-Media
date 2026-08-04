import { Input, ALL_FORMATS, FilePathSource, BufferSource } from "mediabunny";
import path from "path";
import fs from "fs";

async function main() {
  const p = path.resolve("public/ai-clip.mp4");
  console.log("exists", fs.existsSync(p), p);

  try {
    const input = new Input({
      source: new FilePathSource(p),
      formats: ALL_FORMATS,
    });
    console.log("duration via FilePathSource", await input.computeDuration());
    await input.dispose();
  } catch (e) {
    console.error("FilePathSource failed:", e);
  }

  try {
    const buf = fs.readFileSync(p);
    const input = new Input({
      source: new BufferSource(buf),
      formats: ALL_FORMATS,
    });
    console.log("duration via BufferSource", await input.computeDuration());
    const v = await input.getPrimaryVideoTrack();
    console.log("video", v?.displayWidth, v?.displayHeight, v?.codec);
    await input.dispose();
  } catch (e) {
    console.error("BufferSource failed:", e);
  }
}

main();
