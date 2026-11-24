# 11-rust

A pale enamel Suzanne turns slowly. Rust runs in veins under the paint, blisters it, cracks it, and the
flakes cup up, scroll and drop off to show the iron. Each patch ages on its way across the front and resets
while it faces away. Loose flakes slide down the surface, jostle and ride over each other, and fall away.
The loop is two turns (60 s): the flakes settle into a cycle exactly two turns long. The buttons top left
switch to the sphere it was first made on, or to a face.

- `src/bake.ts`: corrosion onset (Dijkstra from a few pits, fast along ridged-noise vein channels), and the
  paint cut into flakes (variable Poisson disk, wobbly Voronoi; on the unit sphere the distance to a
  bisector is `q·(a−b)/|a−b|`). Each flake is a polar patch with a peel coordinate and its gradient per vertex.
- `src/index.ts`: age = view longitude − onset; the vertex stage rolls paint past the peel front round a
  shrinking spiral. Loose flakes are a GPU sim (one disc per flake, 120 Hz): a box grid for touches,
  each cell sorted so runs repeat bit for bit; soft pushes that barely turn into speed, layering by who
  let go first, air drag and flutter so they read as light. A sliding chip whose leading edge catches (on
  a chip in its way or a lump of rust) tips up about that edge; gravity lays it back unless it passes
  upright, then it flops onto its back. Tipping and spin are heavily air-damped, so it is all slow. Steps go to the GPU in batches of 60.
  A jump (load, scrub, tab switch) re-runs the sim from one turn back; a recording settles six turns first.
- Suzanne is the default body (`?body=sphere` and `?body=face` are the others), a watertight remesh. `tools/suzanne.py`
  (`Blender -b --python tools/suzanne.py`) remeshes Blender's monkey closed and writes `public/suzanne.mesh.bin`
  and its signed distance field `public/suzanne.sdf.bin`. On it the bake runs over mesh vertices (onset by
  Dijkstra on the edges, veins per vertex), flakes are cut by 3D bisector planes and projected onto the skin
  through the field, and the sim slides chips on the field (a 3D texture) instead of the unit sphere. It also
  settles into an exact two-turn cycle. The peel gradient there is fitted per vertex to how the peel coordinate
  changes to its neighbours on the flake's grid; the cut's own gradient came out short across thin edges (ears),
  and those flakes curled up to 4× too far, into spikes.
- Buttons top left switch the body (each reload bakes it). `Blender -b --python tools/body.py -- <name> <stl>`
  makes a body from any sealed mesh: decimated to 160k triangles, the field's sign by ray parity (the nearest
  face's normal fails off sharp edges). Day 3's Motherland and Venus were tried and dropped: the paint did not
  read well on them, and Motherland's chips never settled into a loop.
- `?body=face` is the face from day 3: `node tools/face.mjs` meshes `03-melt/public/sdf/me-256` (surface nets)
  and resamples its field to 192³ in the same format.
- Which flakes fall: each has a fixed rank mixing chance with how much it faces down (`fallDown`); the first
  `fallShare` of that order fall, so a small share with `fallDown` near 1 strips only the undersides.
- Speed: the paint is drawn before the iron so the iron's noise is skipped under intact paint, and meshes are
  only as fine as the screen needs (iron 256×128, flakes 10 rings × 32 spokes). Triangles a pixel or two
  across get shaded several times over (GPU 2×2 quads), which was most of the cost.
- `tools/shot.mjs out.png 1200x900 0.3`: headless shot at a playhead (SET, EVAL, CAM, DPR); dev server on 5311.
- `tools/film.mjs outdir 1000x750 0.1 300`: consecutive 60 fps frames and an mp4 (CLIP, EVERY, EXACT).
- `tools/seam.js`: `EVAL="$(cat tools/seam.js)" node tools/shot.mjs out.png 800x600 0` checks the loop closes.

Sketches of the other ideas, each one full-screen WGSL shader on `src/lab.ts`:

- `pit.html`: an endless descent into a corrosion pit. The pit's floor is the same plate again, smaller and
  turned; the camera falls towards the fixed point of that similarity and the light turns with it, so the loop
  (12 s) closes on itself.
- `rings.html`: a sandstone specimen on a turntable, sliced by a fixed plane. Liesegang bands nest inside each
  joint block, spaced geometrically, some broken into spots (24 s).
- `micro.html`: colour-etched steel under an impossible microscope. Crystallographic pits open, turn at grain
  boundaries, crack the boundaries between them, heap rust and interference halos, then heal (16 s).

`tools/film.mjs` takes `URL` and `LOOP` (loop seconds) for these pages.
