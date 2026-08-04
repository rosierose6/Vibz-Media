import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { VantaShowcase } from "./scenes/VantaShowcase";
import { ParticleScene } from "./scenes/ParticleScene";
import { KineticText } from "./scenes/KineticText";
import { DataVizScene } from "./scenes/DataVizScene";
import { WaveformScene } from "./scenes/WaveformScene";
import { VoiceoverDemo } from "./scenes/VoiceoverDemo";

const VOICEOVER_DEFAULTS = {
  text: "Welcome to the future of video.",
  audioFile: "voiceover.wav",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main showcase — the hero video */}
      <Composition
        id="VantaShowcase"
        component={VantaShowcase}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Kokoro in-process TTS demo — run `npm run tts` first */}
      <Composition
        id="VoiceoverDemo"
        component={VoiceoverDemo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={VOICEOVER_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          try {
            const seconds = await getAudioDurationInSeconds(
              staticFile(props.audioFile),
            );
            return {
              durationInFrames: Math.max(1, Math.ceil(seconds * 30) + 15),
            };
          } catch {
            // Audio missing until `npm run tts` — keep a short placeholder length
            return { durationInFrames: 150 };
          }
        }}
      />

      {/* Individual scenes for testing */}
      <Composition
        id="Particles"
        component={ParticleScene}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="KineticText"
        component={KineticText}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ text: "CREATE VIDEOS", subtitle: "with code, AI, and imagination" }}
      />
      <Composition
        id="DataViz"
        component={DataVizScene}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Waveform"
        component={WaveformScene}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
