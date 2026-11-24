# Codevember 2026 / 14 / Tension

Steel chains connect massive floating rocks in colored fog. The rocks drift apart, loading the interlocked links until two to four paths break in succession. A warm warning light marks each failure site; recoil travels through both sides of the chain. The camera eases toward the breaking links and stays with the assembly until its final path fails.

[Live experiment](https://mrdoob.github.io/codevember-2026/14/) · [Gallery](https://mrdoob.github.io/codevember-2026/)

## Run

```sh
npm start
```

Open **http://localhost:8014/** in a WebGPU-capable browser. Python 3 is required. There is no build step or runtime npm installation; dependencies load from jsDelivr. To use another port:

```sh
python3 scripts/serve.py --port 8024
```

For static hosting, serve `index.html`, `style.css`, the root JavaScript modules and `assets/` over HTTPS or localhost. This experiment is independent of the other day folders. Tests, development scripts, `node_modules/` and ignored `exports/` are not runtime assets.

## Controls

| Control         | Action                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| Hold the canvas | Switch to manual pulling; release to relax                                  |
| A               | Toggle automatic pulling                                                    |
| Space           | Pause or resume                                                             |
| H               | Hide or show the interface                                                  |
| Settings        | Adjust pulling, materials, lighting, depth of field, dust and color grading |

Playback starts automatically. Reduced motion starts paused; hidden tabs stop advancing, and losing focus releases a held pull. Resolution defaults to native DPR, including DPR 2 and DPR 3, subject to the GPU's texture-size limit. Settings → Light & lens offers lower resolution overrides.

The chosen defaults use restrained corrosion (0.18), surface relief 0.65, fracture light 4 and no ambient dust. Color grading starts at exposure 1, contrast 1.5, saturation 1.5, temperature 0.75 and tint 1. Vibrance, tonal adjustments and split-toning amounts start at zero. Reset grading restores these values.

## Scene and simulation

- Assemblies have a 13-link main span and six-link branches threaded through ordinary links. Junctions remain intact so two to four distinct loaded paths can fail. Fractures snap, tear through a temporary hinge or split into four pieces. Broken pieces retain their surface pattern, serial engraving and momentum.
- Pulling rocks are dynamic bodies attached through bolted steel clevises. End links swing around the visible pin within ±85° limits. Each pulling rock also connects to a secondary rock through a permanent five-link tether. These tethers remain attached after the central chains break.
- Failure sites stay near the center of the view. The camera eases in X/Y and gently pushes forward in Z, holding its closest position until every loaded path breaks. Its position and velocity remain continuous through handoffs. Incoming chains begin simulating during the retreat, but wait until they are in focus to fracture.
- Steel has sparse rust, pitting and brushing; fracture faces have coarse grain and fine bump. Every fourth link carries a recessed six-digit serial number. Mounting plates, pins and bolts have textured steel and rounded or chamfered edges.
- Ten background rocks rotate through blue fog with muted green and red variation. Their positions stay in world space, and they recycle only when fully hidden. Three overlapping noise sheets shrink and fade with camera Z; depth-dependent X/Y parallax keeps them aligned with camera movement. Detailed wisps occupy drifting pockets with smoother areas between them.

## Implementation

Three.js **WebGPURenderer and TSL** are pinned to commit `a70ee1ad92a681b7b8c42d23b6ede4febb28b25c` (`188dev`). **Box3D 0.1.1** supplies capsule contacts, fixed 120 Hz steps, four solver substeps and continuous collision detection. Links interlock through contact; rock mounts and permanent tethers use joints. Fracture cuts are predefined, and corrosion affects appearance independently of strength.

| Modules                                                          | Responsibility                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `main.js`, `settings.js`                                         | Startup, rendering, interaction, settings and disposal           |
| `tension-simulation.js`, `link-shape.js`                         | Physics, clevis limits, loading, fracture and recoil             |
| `journey.js`                                                     | Layouts, visible failure selection, camera motion and retirement |
| `breaking-chain.js`, `corrosion.js`, `serial-stamps.js`          | Instanced links, jagged caps, steel and engraving                |
| `rock-assets.js`, `rock-anchors.js`, `mount-steel.js`            | Scanned rocks, surface mounts and steel hardware                 |
| `floating-rocks.js`, `rock-field.js`                             | Rotating background field and fog-hidden recycling               |
| `atmosphere.js`, `mist.js`                                       | Lighting, reflections, sky and depth-dependent fog               |
| `post-processing.js`, `color-grading.js`, `render-resolution.js` | GTAO, depth of field, bloom, SMAA, grading and DPR               |
| `dust.js`, `debris.js`                                           | Optional GPU dust, fracture glints and tumbling chips            |

Fog noise and sky color are evaluated once per frame into shared half-resolution textures. Surfaces sample them while applying fog at their actual depth at native resolution, including transparent distant rocks. Dust skips wake collection, GPU compute and drawing when disabled.

## Validation and profiling

```sh
npm ci
npm test
```

The 24 physics and utility checks cover release, branching, fracture modes, fragment mass, recoil on both sides, deterministic stepping, camera framing and transitions, clevis limits, permanent tethers, background recycling and native DPR.

Run the GPU checks in a separate preview tab's console:

```js
await (await import("./tests/rendering.browser.js")).checkRendering();
```

These inspect rendered pixels and GPU buffers for materials, engraving, fracture light, particles, fog, grading and successive breaks. Fog checks compare the cached output to its procedural reference and verify camera motion, continuity, recycling and depth attenuation. Dust checks include disabling and re-enabling compute. The suite resets the sequence and restores settings afterward.

To profile three repeatable scene states:

```js
await (await import("./tests/performance.browser.js")).profileFrames();
```

The profiler uses seed 2, five warmup renders and 18 measured renders per state. It reports median and p95 CPU submission and queue-drained render time, plus draw calls, passes and triangles. Physics is frozen during measurement: these timings are not animation FPS or pure GPU timestamps. In the development comparison at 2220 × 1566 (native DPR 2), shared atmosphere textures reduced the same frame's median render time from 73.8 ms to 24.5 ms. Results depend on hardware and settings.

`window.tension` exposes settings and scene components, plus `inspect()`, `pause()`, `setPull(value)`, `setAuto(value)`, `reset(seed)`, `advance(dt)`, `render()` and `dispose()`. Set `manual = true` for deterministic stepping, and wait for a new animation frame between manual renders.

## Assets

The rocks use CC0 photogrammetry scans from Poly Haven: **Boulder 01** by Rico Cilliers and **Rock 07** by Jenelle van Heerden. Geometry and 2K diffuse, normal and packed AO/roughness/metalness maps are served locally; textures use WebP. Source and license links are in [`assets/rocks/CREDITS.txt`](assets/rocks/CREDITS.txt).

## Video capture

The 60-second loop uses the other days' silent 1024 × 1024 H.264 MP4 format at 30 fps. Frames render at 1536 × 1536 before downsampling; the title and collapsed Settings label use √2 UI scale. The recording follows the existing automatic experiment with its current materials, lights and camera movement.

The capture uses seed 2 and starts 8.7 simulation seconds into the sequence. Playback runs at 1973/1800 of normal speed so two matching retreats after completed fractures land exactly 60 video seconds apart. A 36-frame circular dissolve joins those retreats through the mist. The 61.2-second source becomes an exact 60-second loop; the final frame leads into the following source frame at the start, without a repeated endpoint or a hard reset. This edit is confined to the capture scripts.

Keep the local server running and start a separate receiver:

```sh
python3 scripts/capture-server.py exports/tension-source.mp4 --previews
```

In a separate local preview tab with a 1024 × 1024 viewport at device scale 1:

```js
await (await import("./scripts/capture-video.js")).captureVideo();
```

Capture advances a fixed timeline and sends ordered lossless PNGs with encoder backpressure. It preserves the current appearance settings, disables interaction during recording and restores settings and the interface afterward. Keep the tab visible and its viewport fixed. `window.captureProgress` reports progress and exposes `cancel()`. The receiver verifies dimensions, frame count, frame rate and duration; selected PNG previews and metadata are saved beside the source video.

Finish the loop with:

```sh
python3 scripts/loop-video.py exports/tension-source.mp4 exports/tension-loop-60s.mp4
```

FFmpeg and FFprobe must be on PATH. Existing video outputs are never overwritten, and all generated files stay under ignored `exports/`.
