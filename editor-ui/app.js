const FPS = 30;
const PX_PER_FRAME = 4;
const LABEL_WIDTH = 72;
const DEFAULT_CLIP_FRAMES = 90;

/** @typedef {{ id: string, type: string, src?: string, text?: string, startFrame: number, endFrame: number, layer: number, properties?: Record<string, unknown> }} Track */
/** @typedef {{ name: string, type: 'video'|'image'|'audio', url: string, size: number }} MediaItem */

const state = {
  /** @type {MediaItem[]} */
  media: [],
  /** @type {Track[]} */
  tracks: [],
  width: 1920,
  height: 1080,
  fps: FPS,
  playhead: 0,
  selectedId: null,
  playing: false,
  raf: 0,
  lastTick: 0,
};

const els = {
  mediaList: document.getElementById("media-list"),
  dropLibrary: document.getElementById("drop-library"),
  fileInput: document.getElementById("file-input"),
  tracks: document.getElementById("tracks"),
  timelineDrop: document.getElementById("timeline-drop"),
  ruler: document.getElementById("ruler"),
  preview: document.getElementById("preview"),
  playhead: document.getElementById("playhead"),
  playheadLine: document.getElementById("playhead-line"),
  timecode: document.getElementById("timecode"),
  projectMeta: document.getElementById("project-meta"),
  toast: document.getElementById("toast"),
  btnPlay: document.getElementById("btn-play"),
  btnSave: document.getElementById("btn-save"),
  btnReload: document.getElementById("btn-reload"),
};

function toast(message) {
  els.toast.hidden = false;
  els.toast.textContent = message;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

function uid(prefix = "track") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function durationFrames() {
  if (!state.tracks.length) return 240;
  return Math.max(240, ...state.tracks.map((t) => t.endFrame));
}

function framesToTimecode(frame) {
  const totalSec = Math.max(0, frame) / state.fps;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const f = Math.floor(frame % state.fps);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

function mediaUrl(name) {
  return `/files/${encodeURIComponent(name)}`;
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function loadMedia() {
  const data = await api("/api/media");
  state.media = data.media ?? [];
  renderMedia();
}

async function loadProject() {
  try {
    const data = await api("/api/project");
    if (data.tracks?.length) {
      state.tracks = data.tracks;
      state.width = data.config?.width ?? 1920;
      state.height = data.config?.height ?? 1080;
      state.fps = data.config?.fps ?? FPS;
    }
  } catch {
    // fresh project
  }
  renderAll();
}

function nextLayer() {
  if (!state.tracks.length) return 0;
  return Math.max(...state.tracks.map((t) => t.layer)) + 1;
}

function renderMedia() {
  els.mediaList.innerHTML = "";
  for (const item of state.media) {
    const el = document.createElement("div");
    el.className = "media-item";
    el.draggable = true;
    el.title = "Click to add to timeline, or drag onto the timeline";
    el.dataset.name = item.name;
    el.dataset.type = item.type;

    const thumb = document.createElement("div");
    thumb.className = "media-thumb";
    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "";
      img.draggable = false;
      thumb.appendChild(img);
    } else if (item.type === "video") {
      const video = document.createElement("video");
      video.src = `${item.url}#t=0.1`;
      video.muted = true;
      video.preload = "metadata";
      video.draggable = false;
      thumb.appendChild(video);
    } else {
      thumb.textContent = "AUDIO";
    }

    const meta = document.createElement("div");
    meta.className = "media-meta";
    meta.innerHTML = `<div class="media-name">${item.name}</div><div class="media-type">${item.type} · click to add</div>`;

    el.append(thumb, meta);
    el.addEventListener("dragstart", (e) => {
      const payload = JSON.stringify({ name: item.name, type: item.type });
      e.dataTransfer.setData("application/vibz-media", payload);
      e.dataTransfer.setData("text/plain", payload);
      e.dataTransfer.effectAllowed = "copy";
    });
    el.addEventListener("click", () => {
      addMediaAt(item.name, item.type, state.playhead, nextLayer());
    });
    els.mediaList.appendChild(el);
  }
}

function renderRuler() {
  const frames = durationFrames();
  const width = LABEL_WIDTH + frames * PX_PER_FRAME + 80;
  els.ruler.style.width = `${width}px`;
  els.ruler.innerHTML = "";
  for (let f = 0; f <= frames; f += state.fps) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${LABEL_WIDTH + f * PX_PER_FRAME}px`;
    tick.textContent = `${f / state.fps}s`;
    els.ruler.appendChild(tick);
  }
  els.tracks.style.width = `${width}px`;
  els.playhead.max = String(frames);
}

function renderTracks() {
  els.tracks.innerHTML = "";
  const sorted = [...state.tracks].sort((a, b) => a.layer - b.layer);
  const layers = sorted.length
    ? [...new Set(sorted.map((t) => t.layer))].sort((a, b) => a - b)
    : [0, 1, 2];

  for (const layer of layers) {
    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.layer = String(layer);

    const label = document.createElement("div");
    label.className = "track-label";
    label.textContent = `L${layer}`;
    row.appendChild(label);

    for (const track of sorted.filter((t) => t.layer === layer)) {
      row.appendChild(createClipEl(track));
    }
    els.tracks.appendChild(row);
  }
}

function createClipEl(track) {
  const clip = document.createElement("div");
  clip.className = `clip ${track.type}${state.selectedId === track.id ? " selected" : ""}`;
  clip.style.left = `${LABEL_WIDTH + track.startFrame * PX_PER_FRAME}px`;
  clip.style.width = `${Math.max(16, (track.endFrame - track.startFrame) * PX_PER_FRAME)}px`;
  clip.dataset.id = track.id;

  const name = document.createElement("span");
  name.className = "clip-name";
  name.textContent = track.src || track.text || track.type;
  clip.appendChild(name);

  const handle = document.createElement("div");
  handle.className = "clip-handle";
  clip.appendChild(handle);

  clip.addEventListener("mousedown", (e) => {
    if (e.target === handle) return;
    state.selectedId = track.id;
    renderTracks();
    beginMove(track, e);
  });

  handle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    state.selectedId = track.id;
    beginResize(track, e);
  });

  return clip;
}

function beginMove(track, event) {
  event.preventDefault();
  const startX = event.clientX;
  const origin = track.startFrame;
  const span = track.endFrame - track.startFrame;

  function onMove(e) {
    const dx = e.clientX - startX;
    const deltaFrames = Math.round(dx / PX_PER_FRAME);
    const nextStart = Math.max(0, origin + deltaFrames);
    track.startFrame = nextStart;
    track.endFrame = nextStart + span;
    renderTracks();
    renderRuler();
    updatePlayheadUi();
    renderPreview();
  }

  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function beginResize(track, event) {
  event.preventDefault();
  const startX = event.clientX;
  const originEnd = track.endFrame;

  function onMove(e) {
    const dx = e.clientX - startX;
    const deltaFrames = Math.round(dx / PX_PER_FRAME);
    track.endFrame = Math.max(track.startFrame + 8, originEnd + deltaFrames);
    renderTracks();
    renderRuler();
    updatePlayheadUi();
    renderPreview();
  }

  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function addMediaAt(name, type, startFrame, layer) {
  const track = {
    id: uid(),
    type,
    src: name,
    startFrame,
    endFrame: startFrame + DEFAULT_CLIP_FRAMES,
    layer,
    properties:
      type === "audio"
        ? { volume: 1 }
        : type === "image"
          ? { scale: 1, opacity: 1 }
          : { objectFit: "cover", opacity: 1 },
  };
  state.tracks.push(track);
  state.selectedId = track.id;
  renderAll();
  toast(`Added ${name}`);
}

function frameFromClientX(clientX) {
  const rect = els.tracks.getBoundingClientRect();
  const x = clientX - rect.left + els.timelineDrop.scrollLeft - LABEL_WIDTH;
  return Math.max(0, Math.round(x / PX_PER_FRAME));
}

function layerFromClientY(clientY) {
  const rows = [...els.tracks.querySelectorAll(".track-row")];
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return Number(row.dataset.layer) || 0;
    }
  }
  return state.tracks.length;
}

function bindDropTargets() {
  for (const zone of [els.dropLibrary, els.timelineDrop]) {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  }

  els.dropLibrary.addEventListener("drop", async (e) => {
    e.preventDefault();
    els.dropLibrary.classList.remove("dragover");
    if (e.dataTransfer.files?.length) {
      await uploadFiles(e.dataTransfer.files);
    }
  });

  els.timelineDrop.addEventListener("drop", async (e) => {
    e.preventDefault();
    els.timelineDrop.classList.remove("dragover");

    if (e.dataTransfer.files?.length) {
      const uploaded = await uploadFiles(e.dataTransfer.files);
      const start = frameFromClientX(e.clientX);
      const layer = layerFromClientY(e.clientY);
      for (const item of uploaded) {
        addMediaAt(item.name, item.type, start, layer);
      }
      return;
    }

    const raw =
      e.dataTransfer.getData("application/vibz-media") ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (!payload?.name || !payload?.type) return;
      addMediaAt(
        payload.name,
        payload.type,
        frameFromClientX(e.clientX),
        layerFromClientY(e.clientY),
      );
    } catch {
      toast("Could not read dropped media");
    }
  });
}

async function uploadFiles(fileList) {
  const uploaded = [];
  for (const file of fileList) {
    const data = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-filename": file.name,
      },
      body: file,
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed for ${file.name}`);
      }
      return r.json();
    });
    uploaded.push(data.media);
  }
  await loadMedia();
  toast(`Uploaded ${uploaded.length} file(s)`);
  return uploaded;
}

function activeTracksAt(frame) {
  return [...state.tracks]
    .filter((t) => frame >= t.startFrame && frame < t.endFrame)
    .sort((a, b) => a.layer - b.layer);
}

function renderPreview() {
  const active = activeTracksAt(state.playhead);
  els.preview.innerHTML = "";

  if (!active.length) {
    els.preview.innerHTML =
      '<div class="preview-empty">Drop media onto the timeline to start</div>';
    return;
  }

  for (const track of active) {
    if (track.type === "video" && track.src) {
      const video = document.createElement("video");
      video.className = "preview-layer";
      video.src = mediaUrl(track.src);
      video.muted = true;
      const local = (state.playhead - track.startFrame) / state.fps;
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = Math.min(local, Math.max(0, video.duration - 0.05));
        },
        { once: true },
      );
      if (state.playing) video.play().catch(() => {});
      else video.pause();
      els.preview.appendChild(video);
    } else if (track.type === "image" && track.src) {
      const img = document.createElement("img");
      img.className = "preview-layer";
      img.src = mediaUrl(track.src);
      els.preview.appendChild(img);
    } else if ((track.type === "text" || track.type === "caption") && track.text) {
      const caption = document.createElement("div");
      caption.className = "preview-caption";
      caption.textContent = track.text;
      els.preview.appendChild(caption);
    }
  }
}

function updatePlayheadUi() {
  const frames = durationFrames();
  els.playhead.max = String(frames);
  els.playhead.value = String(state.playhead);
  els.timecode.textContent = framesToTimecode(state.playhead);
  els.playheadLine.style.left = `${LABEL_WIDTH + state.playhead * PX_PER_FRAME}px`;
  els.projectMeta.textContent = `${state.width}×${state.height} · ${state.fps}fps · ${state.tracks.length} clips`;
}

function renderAll() {
  renderMedia();
  renderRuler();
  renderTracks();
  updatePlayheadUi();
  renderPreview();
}

function tick(now) {
  if (!state.playing) return;
  if (!state.lastTick) state.lastTick = now;
  const elapsed = (now - state.lastTick) / 1000;
  state.lastTick = now;
  state.playhead = Math.min(
    durationFrames(),
    state.playhead + elapsed * state.fps,
  );
  if (state.playhead >= durationFrames()) {
    state.playing = false;
    els.btnPlay.textContent = "Play";
  }
  updatePlayheadUi();
  renderPreview();
  state.raf = requestAnimationFrame(tick);
}

async function saveProject() {
  const payload = {
    config: {
      width: state.width,
      height: state.height,
      fps: state.fps,
      durationInFrames: durationFrames(),
    },
    tracks: state.tracks,
    effects: [],
  };
  await api("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  toast("Saved editor-project.json + opencut-project.json");
}

function bindUi() {
  els.btnReload.addEventListener("click", () => loadMedia().then(() => toast("Media reloaded")));
  els.btnSave.addEventListener("click", () => saveProject().catch((e) => toast(e.message)));
  els.fileInput.addEventListener("change", async () => {
    if (els.fileInput.files?.length) {
      await uploadFiles(els.fileInput.files);
      els.fileInput.value = "";
    }
  });

  els.playhead.addEventListener("input", () => {
    state.playhead = Number(els.playhead.value);
    updatePlayheadUi();
    renderPreview();
  });

  els.btnPlay.addEventListener("click", () => {
    state.playing = !state.playing;
    els.btnPlay.textContent = state.playing ? "Pause" : "Play";
    state.lastTick = 0;
    if (state.playing) state.raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(state.raf);
    renderPreview();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      if (!state.selectedId) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      state.tracks = state.tracks.filter((t) => t.id !== state.selectedId);
      state.selectedId = null;
      renderAll();
    }
    if (e.key === " ") {
      e.preventDefault();
      els.btnPlay.click();
    }
  });

  bindDropTargets();
}

bindUi();
await loadMedia();
await loadProject();
renderAll();
