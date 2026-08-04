import { Composition, staticFile } from "remotion";
import {
  getAudioDurationInSeconds,
  getVideoMetadata,
} from "@remotion/media-utils";
import { VantaShowcase } from "./scenes/VantaShowcase";
import { ParticleScene } from "./scenes/ParticleScene";
import { KineticText } from "./scenes/KineticText";
import { DataVizScene } from "./scenes/DataVizScene";
import { WaveformScene } from "./scenes/WaveformScene";
import { VoiceoverDemo } from "./scenes/VoiceoverDemo";
import { AvatarDemo } from "./scenes/AvatarDemo";
import { CaptionsDemo } from "./scenes/CaptionsDemo";
import type { CaptionWord } from "./integrations/auto-captions";

const VOICEOVER_DEFAULTS = {
  text: "Welcome to the future of video.",
  audioFile: "voiceover.wav",
};

const AVATAR_DEFAULTS = {
  text: "Welcome to the future of video.",
  videoFile: "avatar.mp4",
};

const CAPTIONS_DEFAULTS = {
  audioFile: "voiceover.wav",
  words: [] as CaptionWord[],
};

async function readMetaText(
  metaFile: string,
  fallback: string,
): Promise<string> {
  try {
    const response = await fetch(staticFile(metaFile));
    if (!response.ok) return fallback;
    const meta = (await response.json()) as { text?: string };
    return meta.text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

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
          const text = await readMetaText("voiceover-meta.json", props.text);
          try {
            const seconds = await getAudioDurationInSeconds(
              staticFile(props.audioFile),
            );
            return {
              props: { ...props, text },
              durationInFrames: Math.max(1, Math.ceil(seconds * 30) + 15),
            };
          } catch {
            // Audio missing until `npm run tts` — keep a short placeholder length
            return { props: { ...props, text }, durationInFrames: 150 };
          }
        }}
      />

      {/* Talking-head demo — run `npm run tts` then `npm run avatar` */}
      <Composition
        id="AvatarDemo"
        component={AvatarDemo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={AVATAR_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          const text = await readMetaText("avatar-meta.json", props.text);
          try {
            const { durationInSeconds } = await getVideoMetadata(
              staticFile(props.videoFile),
            );
            return {
              props: { ...props, text },
              durationInFrames: Math.max(
                1,
                Math.ceil(durationInSeconds * 30) + 15,
              ),
            };
          } catch {
            try {
              const seconds = await getAudioDurationInSeconds(
                staticFile("voiceover.wav"),
              );
              return {
                props: { ...props, text },
                durationInFrames: Math.max(1, Math.ceil(seconds * 30) + 15),
              };
            } catch {
              return { props: { ...props, text }, durationInFrames: 150 };
            }
          }
        }}
      />

      {/* Word captions demo — run `npm run tts` then `npm run captions` */}
      <Composition
        id="CaptionsDemo"
        component={CaptionsDemo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={CAPTIONS_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          let words = props.words;
          try {
            const response = await fetch(staticFile("captions.json"));
            if (response.ok) {
              const payload = (await response.json()) as {
                words?: CaptionWord[];
              };
              if (payload.words?.length) words = payload.words;
            }
          } catch {
            // captions.json missing until `npm run captions`
          }

          try {
            const seconds = await getAudioDurationInSeconds(
              staticFile(props.audioFile),
            );
            return {
              props: { ...props, words },
              durationInFrames: Math.max(1, Math.ceil(seconds * 30) + 15),
            };
          } catch {
            return { props: { ...props, words }, durationInFrames: 150 };
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
