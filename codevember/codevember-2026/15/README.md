# Codevember 2026 / 15 / Mirage

A rover crosses a sandstone desert toward a sanctuary reflected in the hot air. Rocks, dunes, architecture, textures, dust and the doorway's rotating light pattern are generated in JavaScript; no scanned models or image assets are required.

[Open the experiment](https://mrdoob.github.io/codevember-2026/15/).

## Run

```sh
npm start
```

Open **http://localhost:8015/** in a WebGPU-capable browser. Python 3 is required. There is no build step or runtime npm installation: pinned dependencies load from jsDelivr. Use `python3 scripts/serve.py --port 8025` for another port. Keep local preview servers running after testing.

For static hosting, publish `index.html`, `style.css`, the root JavaScript modules **and `vendor/`**, over HTTPS. Other day folders are not required. `exports/`, `node_modules/` and Python caches are development-only and excluded from Git.

## Controls

The experiment starts in Rover view with a settled suspension and a curved 70 m approach trail.

| Control | Action |
| --- | --- |
| Touch and drag on the scene | Floating joystick: up/down drives forward/reverse, left/right steers |
| W / S or ↑ / ↓ | Drive forward / reverse |
| A / D or ← / → | Steer the front wheels |
| Shift | Boost |
| Mouse drag / wheel | Orbit / change camera distance |
| Settings → View | Rover, Overlook, Dunes, Sanctuary, Outcrop or Stone |
| Dawn / Day / Sunset | Animate time of day over two seconds |
| Space | Pause clouds, dust, shimmer and camera drift |
| R | Reset the camera to its opening view |
| H | Hide or show the interface |

The mobile joystick follows Day 13's floating control, with a dead zone and analogue response. Releasing or cancelling a touch releases the throttle and steering; extra fingers do not take over. Other views retain touch orbiting and pinch zoom. Keyboard and camera interaction remain available while scene animation is paused. Canvas focus never draws an outline.

Settings expose lighting, GI, clouds, dust, heat distortion, surface relief, rendering resolution, LOD transitions and meshlet visualization. Reduced motion starts with scene animation paused and camera drift disabled; hidden tabs stop advancing. The default rendering resolution is 1.25× CSS pixels. This is a GPU-intensive experiment; mobile controls do not imply support or a fixed frame rate on every mobile GPU.

## Rendering

Three.js WebGPURenderer and TSL are pinned to [commit 4f5d6bc](https://github.com/mrdoob/three.js/commit/4f5d6bc0c7ec777e06703b56c7b7089e99be11d5). Local extensions add meshlet LOD dithering, bounded GPU queue allocations, shared cloud transmission and cascade-scaled shadow bias.

- **Geology:** 32 seeded rock variants, fractured faces, irregular sediment beds, subtractive weathering and multiscale erosion. Baked signed curvature reveals exposed edges and sheltered hollows. Triplanar mineral textures, strata, altitude and correlated instance colors produce orange/brown sandstone variation. Sanctuary foundations interlock with smaller rock clusters and rubble.
- **Landscape:** detailed nearby dunes join progressively coarser terrain rings extending 200 km in every direction. Distant ranges use connected ridges and saddles. A seeded heightfield redistributes steep deposits into neighboring slopes, with bicubic reconstruction for continuous gradients. This is a procedural talus approximation, not a geological simulation. Tessellation is concentrated in the background ranges instead of empty plains. Terrain rings explicitly stitch every boundary vertex, including when tessellation decreases; collision queries follow those same triangles. Filtered world-space sand gradients avoid grazing-angle bump bands.
- **Sanctuary:** instanced carved masonry, galleries, columns, a vaulted doorway and a supported staircase. Sandstone is accented with green and orange marble and satin gold. The stairs retain their original sandstone with orange marble handrails and post caps. Dedicated rounded treads sit flush with planar supports, avoiding thin dark undersides and intersections with stretched weathered blocks. A bright doorway beacon projects a slowly rotating procedural seal onto the floor and arriving rover.
- **Lighting:** SunLight with two cached 4096 × 5120 shadow cascades, SSGI with GTAO occlusion and temporal denoising, plus PMREM-filtered sky/cloud IBL. The sky, sunlight and cloud shadows share sun direction and a world-anchored cloud field. Animated cloud transmission updates every frame; stationary fields reuse their map.
- **Stair detail:** the original 4× MSAA is retained. Each flight uses a closed, smooth wedge when individual treads occupy less than two pixels. Complementary, stable dither masks reveal the bevelled geometry between two and four pixels per tread, accounting for camera angle, zoom and resolution. Shadows use the same coverage; physics always uses the full steps. Entrance plinths extend into the sampled sand surface.
- **Atmosphere:** sky-derived clear-air fog fades distant terrain into the horizon. Regional drifting dust raises effective sky turbidity; the sky, altitude-dependent aerosol haze and direct sun transmission share extinction coefficients. Wheel puffs remain local. This is an artistic coupling of regional dust loading, not a volumetric fluid model. Dawn, Day and Sunset interpolate the sun, exposure, scattering, haze and cloud phase together over two seconds. Cloud shadows attenuate direct sunlight; fog does not receive full volumetric cloud shadowing.
- **Mirage:** a planar Reflector captures off-screen objects and sky. A grazing-angle mask, stable basin plane and hot-ground strength produce an inferior mirage. Reflection and dust are composited before shared heat distortion, with foreground and silhouette guards. This is an artistic planar approximation, not a numerical curved-ray solution or thermal-history simulation.
- **Dust:** procedural soft sprites form drifting wisps across 16 anchored regions and camera-local sand, plus contact-driven tire spray. A bounded 1,024-particle pool samples terrain, scene depth, sunlight, cloud transmission and sky fill. Particles soften against opaque geometry and are composited after GI. They do not cast shadows or simulate a volumetric fluid.

The scene has 8,465 rock instances, 8,859 masonry instances and roughly 181 million source triangles when full-detail geometry is multiplied by instance count. Those are scene totals, **not triangles drawn per frame**. Meshlets select LODs from bounding-sphere surface distance, cull clusters and reuse static transforms. Complementary dither masks crossfade neighboring LODs across beauty, reflection and shadow passes. The Rendering settings can disable transitions to reduce their cost.

## Rover

Box3D drives the rigid chassis with four independently suspended tires, steering forces, reverse and braking. A moving collision patch uses terrain triangles, shared procedural rock collision meshes and nearby masonry. Coordinates rebase locally for long drives. Tire sweeps climb small stones; a camera sphere sweep protects the eased chase camera from real obstacles without snapping to oversized rock bounds.

Automatic recovery detects a settled rollover after 1.8 seconds, or 3.5 seconds of throttle with less than 80 cm of progress. It checks nearby collision surfaces for wheel support and chassis clearance, then gently lifts and rights the rover over 1.6 seconds. A blocked rover prefers a position behind the obstruction. Brief jumps, slow progress and ordinary parking do not trigger recovery. Tracks and fresh wheel spray pause during the assist; existing dust keeps fading.

Each leg has two main pieces: an outward shoulder and a shin aligned with the inboard steering plane. The shin meets the wheel hub through the tire's central opening, without an exposed horizontal connector. The chassis has a longer rounded rear shell with a matching collision hull. Shadow invalidation compares the current chassis and wheel pose with the last rendered pose, so slow downhill creep and suspension settling cannot leave a cached shadow behind.

Sand contacts stamp subtle tread impressions into a bounded ring of 8,192 instances. Tracks and wheel spray follow each tire's steering and travel direction, and stop on stone or unsupported wheels. Existing wheel dust keeps drifting and fading after the rover stops, including when ambient animation is paused. The camera keeps its follow radius through turns and continues easing after input ends. Gentle idle sway and speed-dependent vibration affect only its final orientation, leaving the chase distance and collision sweep stable. Camera drift and reduced-motion settings disable the sway.

## Source map

| Modules | Responsibility |
| --- | --- |
| `noise.js`, `terrain-relaxation.js`, `terrain-stitch.js`, `rock-geometry.js`, `rock-shaping.js`, `curvature.js` | Terrain, seeded geology, erosion and curvature |
| `landscape.js`, `island-bedrock.js`, `scene-details.js`, `desert-grass.js` | Layout, rock clusters, foundations, ruins and grass |
| `architecture.js`, `sanctuary-light.js` | Sanctuary, stairs, masonry colliders and projected seal |
| `materials.js` | Generated textures and material shading |
| `rover.js`, `rover-input.js`, `rover-model.js`, `rover-physics.js`, `rover-recovery.js`, `rover-shadow.js`, `wheel-tracks.js` | Vehicle, keyboard/touch input, physics, recovery, shadow invalidation and tracks |
| `atmosphere.js`, `atmosphere-model.js`, `cloud-shadows.js`, `daylight.js` | Sky, IBL, sunlight, haze and time presets |
| `indirect-lighting.js`, `mirage-reflector.js`, `post-processing.js`, `dust.js` | GI, reflections, heat, particles and final composition |
| `mirage-pipeline.js`, `vendor/` | Local three.js rendering extensions |
| `camera.js`, `settings.js`, `main.js` | Camera, settings and rendering lifecycle |

## Validation

```sh
npm ci
npm test
```

CPU tests cover geometry, curvature, joystick response, vehicle dynamics and recovery, terrain continuity, smooth dune crests, terrain stitching, talus relaxation, aerosol transmission and mirage conditions. Browser diagnostics run from the console after `window.mirage.ready` is true:

```js
(await import('./tests/rover-input.browser.js')).checkRoverInput();
(await import('./tests/camera.browser.js')).checkCameraEasing();
(await import('./tests/camera.browser.js')).checkCameraMotion();
(await import('./tests/rover-clearance.browser.js')).checkRoverClearance();
await (await import('./tests/rover-shadow.browser.js')).checkSlowRoverShadow();
(await import('./tests/terrain.browser.js')).checkTerrain();
await (await import('./tests/camera.browser.js')).checkRubbleCamera();
await (await import('./tests/rendering.browser.js')).checkRendering();
await (await import('./tests/stairs.browser.js')).checkStairs();
await (await import('./tests/heat.browser.js')).checkHeat();
await (await import('./tests/mirage.browser.js')).checkMirage();
```

Additional browser diagnostics in `tests/` cover rock topology/contact, sanctuary support, cloud IBL, cloud shadows, LOD queues, dust and performance. Run suites sequentially: they temporarily control the same scene, then restore its settings. Input event tests use native DOM propagation and OrbitControls with simulated pointer-capture bookkeeping; they do not substitute for testing on physical touch hardware.

For deterministic inspection, set `window.mirage.manual = true`, call `advance(dt)`, wait for an animation frame, then call `render()`. Restore `manual = false` to resume. `inspect()` reports scene totals. Changes inside static groups require `group.needsUpdate = true`; shadow geometry also requires `atmosphere.sun.shadow.needsUpdate = true`.

Local making-of screenshots and their camera/settings metadata are retained in `exports/making-of/`, with a contact sheet at `/exports/making-of/`. Exports are not part of the published experiment.

## Capture tools

`scripts/capture-sequence.js` contains the 60-second, 30 fps cinematic shot list. It includes native chase views, rover tracking, rock orbits, wheel details, daylight transitions and the sanctuary ascent. `scripts/capture-video.js` advances the real vehicle physics at a fixed timestep and renders at 1536 × 1536 before downsampling to 1024 × 1024. The capture session temporarily takes over input and camera controls and hides the projected seal to avoid spoiling the discovery, then restores the experiment. The doorway beacon stays visible. `preview(shotIndex, fraction)` makes still rehearsals without recording.

Start a receiver with `python3 scripts/capture-server.py exports/mirage.mp4 --previews`. In a 1024 × 1024 browser viewport at DPR 1, call `await (await import('./scripts/capture-video.js')).captureVideo()`. PNG frames stream directly to FFmpeg; only selected preview frames are retained. The receiver verifies decoded frame count, dimensions and duration before completing the silent H.264 MP4. Use a new output filename and receiver for another recording. `captureProgress.cancel()` cancels encoding while leaving both HTTP servers running.

`scripts/capture-gallery.js` uses the same scene for an interface-free 800 × 800 WebP, rendered at 1600 × 1600. By default it saves `preview.webp` in the receiver's `exports/video-previews/` folder. Review that capture before copying it to `15/preview.webp`, which is shared by the gallery and this experiment's social previews.

## Credits

Three.js extensions retain their MIT notice in `vendor/THREE-LICENSE`. Vehicle dynamics use Box3D 0.1.1. The floating joystick follows this project's Day 13, Labyrinth.

The rock study was informed by Alexander Alekseev (TDM)'s “Wet stone” (2014), supplied as a CC BY-NC-SA 3.0 shader reference. This experiment's radial mesh intersection and erosion routines were written independently. Mirage optics were informed by [Andrew T. Young's mirage principles](https://aty.sdsu.edu/mirages/mirprin.html). The visual references are not distributed with the experiment.
