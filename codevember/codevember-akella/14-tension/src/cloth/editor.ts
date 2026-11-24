// A small editor for the recording's notes (dev only; `e` shows and hides it). One row per drum, the loop
// across, each note a bar as long as its drum stays up, over the recording's waveform, with the playhead.
// Click a note: mute it (or bring it back). Drag its right end: hold it longer or shorter. Shift-click:
// back to as read off the recording. Edits apply at once; "save" writes them to public/waltz-edits.json
// (through the dev server), which the page reads at start.
import { PERIOD, setWaltzEdits, sync, waltzNotes, type BuiltNote, type NoteEdits } from "./show.ts";

const NAMES = ["D", "E", "F#", "G", "G#", "A", "B", "C#"];
const OCT_COLOR: Record<number, string> = { 4: "#7fb2ff", 5: "#ffd27a", 6: "#ff8a78" };
const GUTTER = 34;
const H = 210;

export function noteEditor(getTime: () => number, edits: NoteEdits, audioUrl: string) {
  const root = document.createElement("div");
  root.id = "cloth-editor";
  root.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${H}px;background:#0b0c0fd9;color:#ddd;font:11px/1.4 ui-monospace,monospace;z-index:1002;display:flex;flex-direction:column;user-select:none`;
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;align-items:center;padding:4px 8px;border-bottom:1px solid #fff2";
  const button = (label: string, on: () => void) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "font:inherit;color:#eee;background:#ffffff14;border:1px solid #fff3;border-radius:4px;padding:1px 8px;cursor:pointer";
    b.onclick = on;
    bar.appendChild(b);
    return b;
  };
  const status = document.createElement("span");
  status.style.cssText = "margin-left:auto;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  const help = "click: mute · drag right end: length · shift-click: reset · e: hide";
  status.textContent = help;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "flex:1;width:100%;min-height:0;cursor:default";
  root.append(bar, canvas);
  document.body.appendChild(root);
  const ctx = canvas.getContext("2d")!;

  let dirty = false;
  const apply = () => {
    setWaltzEdits(edits);
    dirty = true;
    title.textContent = "notes ●";
  };
  const title = document.createElement("strong");
  title.textContent = "notes";
  bar.appendChild(title);
  button("save", async () => {
    const r = await fetch("/__waltz-edits", { method: "POST", body: JSON.stringify(edits) }).catch(() => null);
    if (r?.ok) {
      dirty = false;
      title.textContent = "notes";
      status.textContent = `saved ${Object.keys(edits).length} edits to public/waltz-edits.json`;
    } else status.textContent = "save failed (dev server only)";
  });
  button("copy", () => {
    void navigator.clipboard?.writeText(JSON.stringify(edits));
    status.textContent = "edits copied";
  });
  button("reset all", () => {
    for (const id of Object.keys(edits)) delete edits[id];
    apply();
  });
  bar.appendChild(status);

  // the waveform, for finding one's way: loudest sample per column
  let wave: Float32Array | undefined;
  void fetch(audioUrl)
    .then((r) => r.arrayBuffer())
    .then((a) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(a))
    .then((b) => {
      const d = b.getChannelData(0);
      const cols = 2000;
      wave = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        let m = 0;
        for (let i = Math.floor((c * d.length) / cols); i < Math.floor(((c + 1) * d.length) / cols); i++) m = Math.max(m, Math.abs(d[i]));
        wave[c] = m;
      }
    });

  // layout
  let W = 0;
  let CH = 0;
  const xOf = (t: number) => GUTTER + (t / PERIOD) * (W - GUTTER - 8);
  const tOf = (x: number) => ((x - GUTTER) / (W - GUTTER - 8)) * PERIOD;
  const rowH = () => CH / NAMES.length;
  const rect = (n: BuiltNote) => {
    const y = n.drum * rowH();
    const x0 = xOf(n.t);
    return { x0, x1: Math.max(x0 + 6, xOf(n.t + n.hold)), y0: y + 3, y1: y + rowH() - 3 };
  };
  const hit = (x: number, y: number) => {
    let best: { n: BuiltNote; edge: boolean } | undefined;
    for (const n of waltzNotes()) {
      const r = rect(n);
      if (y < r.y0 - 2 || y > r.y1 + 2 || x < r.x0 - 3 || x > r.x1 + 6) continue;
      const edge = Math.abs(x - r.x1) < 7;
      if (!best || edge) best = { n, edge };
    }
    return best;
  };
  const label = (n: BuiltNote) =>
    `${NAMES[n.drum]}${n.oct}${n.chord ? " (chord)" : ""} at ${n.t.toFixed(2)} s, up ${n.hold.toFixed(2)} s${n.muted ? ", muted" : ""}${n.edited ? ", edited" : ""}`;

  // pointer: click to mute, drag the right end to hold
  let drag: { n: BuiltNote; x: number; moved: boolean; edge: boolean } | undefined;
  canvas.addEventListener("pointerdown", (e) => {
    const h = hit(e.offsetX, e.offsetY);
    if (!h) return;
    if (e.shiftKey) {
      for (const id of h.n.ids) delete edits[id];
      apply();
      return;
    }
    drag = { n: h.n, x: e.offsetX, moved: false, edge: h.edge };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) {
      const h = hit(e.offsetX, e.offsetY);
      canvas.style.cursor = h ? (h.edge ? "ew-resize" : "pointer") : "default";
      status.textContent = h ? label(h.n) : help;
      return;
    }
    if (Math.abs(e.offsetX - drag.x) > 3) drag.moved = true;
    if (drag.edge && drag.moved) {
      const hold = Math.max(0.05, Math.round((tOf(e.offsetX) - drag.n.t) * 100) / 100);
      for (const id of drag.n.ids) edits[id] = { ...edits[id], hold };
      apply();
      const now = waltzNotes().find((n) => n.ids[0] === drag!.n.ids[0]);
      status.textContent = now ? label(now) : "";
    }
  });
  canvas.addEventListener("pointerup", () => {
    if (drag && !drag.moved) {
      const mute = !drag.n.muted;
      for (const id of drag.n.ids) {
        const { hold } = edits[id] ?? {};
        if (mute) edits[id] = { ...edits[id], mute: true };
        else if (hold !== undefined) edits[id] = { hold };
        else delete edits[id];
      }
      apply();
    }
    drag = undefined;
  });

  // the controls panel stops short of it while it shows
  const fit = () => {
    const gui = document.querySelector<HTMLElement>(".lil-gui.root");
    if (gui) gui.style.maxHeight = root.style.display === "none" ? "" : `calc(100vh - ${H}px)`;
  };
  fit();
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "e" || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
    root.style.display = root.style.display === "none" ? "flex" : "none";
    fit();
  };
  window.addEventListener("keydown", onKey);
  const onLeave = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener("beforeunload", onLeave);

  let raf = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (root.style.display === "none") return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const chh = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(chh * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(chh * dpr);
    }
    W = cw;
    CH = chh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, CH);
    // waveform
    if (wave) {
      ctx.fillStyle = "#ffffff12";
      for (let c = 0; c < wave.length; c++) {
        const x = xOf((c / wave.length) * PERIOD);
        const h = wave[c] * CH * 0.9;
        ctx.fillRect(x, CH / 2 - h / 2, Math.max(1, (W - GUTTER) / wave.length + 0.5), h);
      }
    }
    // rows and seconds
    ctx.font = "11px ui-monospace, monospace";
    for (let r = 0; r < NAMES.length; r++) {
      ctx.fillStyle = r % 2 ? "#ffffff05" : "#ffffff0b";
      ctx.fillRect(GUTTER, r * rowH(), W - GUTTER, rowH());
      ctx.fillStyle = "#aaa";
      ctx.fillText(NAMES[r], 6, r * rowH() + rowH() / 2 + 4);
    }
    ctx.fillStyle = "#ffffff30";
    for (let s = 0; s <= PERIOD; s++) ctx.fillRect(xOf(s), 0, 1, CH);
    // notes
    for (const n of waltzNotes()) {
      const r = rect(n);
      const c = OCT_COLOR[n.oct] ?? "#ccc";
      if (n.muted) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#888";
        ctx.strokeRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0 - 1, r.y1 - r.y0 - 1);
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = c + (n.chord ? "aa" : "dd");
      ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      if (n.chord) {
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0 - 1, r.y1 - r.y0 - 1);
      }
      // the end one drags
      ctx.fillStyle = "#0008";
      ctx.fillRect(r.x1 - 3, r.y0 + 2, 2, r.y1 - r.y0 - 4);
      if (n.edited) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(r.x0 + 4, r.y0 + 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // playheads: the sound, and (dimmer) where the shapes are, `lag` behind
    const t = getTime();
    const u = ((t % PERIOD) + PERIOD) % PERIOD;
    const v = (((t - sync.lag) % PERIOD) + PERIOD) % PERIOD;
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(xOf(v), 0, 1, CH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(xOf(u) - 0.5, 0, 2, CH);
  };
  draw();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("beforeunload", onLeave);
    root.remove();
    root.style.display = "none";
    fit();
  };
}
