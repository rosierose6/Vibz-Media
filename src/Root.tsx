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
import { AiVideoDemo } from "./scenes/AiVideoDemo";
import { MusicDemo } from "./scenes/MusicDemo";
import { BgRemoveDemo } from "./scenes/BgRemoveDemo";
import { EditorDemo } from "./scenes/EditorDemo";
import { TimelineDemo } from "./scenes/TimelineDemo";
import type { CaptionWord } from "./integrations/auto-captions";
import type { CaptionPresetName } from "./integrations/animated-captions";
import type { RemotionEditorProps } from "./integrations/video-editor";
import type { RemotionSequenceData } from "./integrations/timeline";

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
  preset: "tiktok" as CaptionPresetName,
};

const AI_VIDEO_DEFAULTS = {
  prompt: "A sunset over the ocean, cinematic 4K",
  videoFile: "ai-clip.mp4",
};

const MUSIC_DEFAULTS = {
  prompt: "cinematic orchestral tension building",
  audioFile: "soundtrack.wav",
  bpm: 96,
};

const BG_REMOVE_DEFAULTS = {
  cutoutFile: "cutout.png",
  label: "imgly · background removal",
};

const EDITOR_DEFAULTS: RemotionEditorProps = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
  tracks: [],
  effects: [],
};

const TIMELINE_DEFAULTS = {
  sequences: [] as RemotionSequenceData[],
  fps: 30,
  durationInFrames: 300,
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

      {/* AI B-roll demo — run `npm run video` with a local Wan/LTX/FramePack server */}
      <Composition
        id="AiVideoDemo"
        component={AiVideoDemo}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={AI_VIDEO_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          let prompt = props.prompt;
          try {
            const response = await fetch(staticFile("ai-clip-meta.json"));
            if (response.ok) {
              const meta = (await response.json()) as { prompt?: string };
              if (meta.prompt?.trim()) prompt = meta.prompt.trim();
            }
          } catch {
            // meta missing until `npm run video`
          }

          try {
            const { durationInSeconds } = await getVideoMetadata(
              staticFile(props.videoFile),
            );
            return {
              props: { ...props, prompt },
              durationInFrames: Math.max(
                1,
                Math.ceil(durationInSeconds * 30) + 15,
              ),
            };
          } catch {
            return { props: { ...props, prompt }, durationInFrames: 180 };
          }
        }}
      />

      {/* Soundtrack demo — run `npm run music:server` then `npm run music` */}
      <Composition
        id="MusicDemo"
        component={MusicDemo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={MUSIC_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          let prompt = props.prompt;
          let bpm = props.bpm;
          try {
            const response = await fetch(staticFile("soundtrack-meta.json"));
            if (response.ok) {
              const meta = (await response.json()) as {
                prompt?: string;
                bpm?: number;
              };
              if (meta.prompt?.trim()) prompt = meta.prompt.trim();
              if (meta.bpm) bpm = meta.bpm;
            }
          } catch {
            // meta missing until `npm run music`
          }

          try {
            const seconds = await getAudioDurationInSeconds(
              staticFile(props.audioFile),
            );
            return {
              props: { ...props, prompt, bpm },
              durationInFrames: Math.max(1, Math.ceil(seconds * 30)),
            };
          } catch {
            return { props: { ...props, prompt, bpm }, durationInFrames: 900 };
          }
        }}
      />

      {/* Cutout demo — run `npm run cutout` after adding public/presenter-photo.jpg */}
      <Composition
        id="BgRemoveDemo"
        component={BgRemoveDemo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={BG_REMOVE_DEFAULTS}
      />

      {/* Programmatic editor project — run `npm run editor` */}
      <Composition
        id="EditorDemo"
        component={EditorDemo}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={EDITOR_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          try {
            const response = await fetch(staticFile("editor-project.json"));
            if (!response.ok) {
              return { durationInFrames: props.durationInFrames };
            }
            const payload = (await response.json()) as {
              remotionProps?: RemotionEditorProps;
            };
            const next = payload.remotionProps;
            if (!next) {
              return { durationInFrames: props.durationInFrames };
            }
            return {
              props: { ...props, ...next },
              durationInFrames: Math.max(1, next.durationInFrames),
            };
          } catch {
            return { durationInFrames: props.durationInFrames };
          }
        }}
      />

      {/* Timeline sequences — run `npm run timeline` */}
      <Composition
        id="TimelineDemo"
        component={TimelineDemo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={TIMELINE_DEFAULTS}
        calculateMetadata={async ({ props }) => {
          try {
            const response = await fetch(staticFile("timeline.json"));
            if (!response.ok) {
              return { durationInFrames: props.durationInFrames };
            }
            const payload = (await response.json()) as {
              sequences?: RemotionSequenceData[];
              fps?: number;
              durationInFrames?: number;
            };
            return {
              props: {
                ...props,
                sequences: payload.sequences ?? props.sequences,
                fps: payload.fps ?? props.fps,
                durationInFrames:
                  payload.durationInFrames ?? props.durationInFrames,
              },
              durationInFrames: Math.max(
                1,
                payload.durationInFrames ?? props.durationInFrames,
              ),
            };
          } catch {
            return { durationInFrames: props.durationInFrames };
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
