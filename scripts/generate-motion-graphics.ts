/**
 * Snapshot the motion-graphics demo recipe.
 *
 *   npm run motion
 */

import path from "path";
import fs from "fs";
import {
  animateShape,
  TEMPLATES,
} from "../src/integrations/motion-graphics";

async function main() {
  const circle = animateShape("circle", {
    from: { scale: 0, opacity: 0, x: 0, y: 0 },
    to: { scale: 1, opacity: 1, x: 200, y: 100 },
    duration: 30,
    easing: "spring",
  });

  const confetti = TEMPLATES.confetti(["#FFD700", "#FF4444", "#44FF44"]);
  const title = TEMPLATES.lowerThird("John Smith — CEO", "#FFD700");

  const out = path.resolve(__dirname, "../public/motion-graphics.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        circle: {
          type: circle.type,
          animation: circle.animation,
          sampleFrame15: circle.getPropsAtFrame(15),
        },
        confettiParticles: confetti.length,
        lowerThird: {
          text: title.text,
          color: title.color,
          shapes: title.shapes.length,
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Circle @15f → ${JSON.stringify(circle.getPropsAtFrame(15))}`);
  console.log(`Confetti particles: ${confetti.length}`);
  console.log(`Lower third: "${title.text}"`);
  console.log(`Wrote ${out}`);
  console.log("Open Remotion Studio → composition MotionGraphicsDemo");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
