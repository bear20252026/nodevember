# Nodevember 2026 · Day 26 · Bioluminescent — Blue Tears on Stone

2026-11-26 · Blender 5.3 · shader nodes and Cycles · a 4 s loop played three times, 1080 × 1080

## Idea

The "blue tears" of the Matsu islands on a shader ball. A thin sheet of sea water washes down a dark stone ball every
2 s. Its running rim glows blue, brighter the faster it falls; a lace of foam with fine flashing cells trails behind
it; a few sparks are left stranded on the stone, blink and fade within a second, and the wet stone dries until the
next wash.

**Constraint:** one material does everything, driven by object coordinates and a single `frame / 24` value. No
keyframes, no image textures, no simulation. The ball and the grey backdrop are plain Geometry Nodes meshes.

**Technique:** the front height is a closed-form fall, h = 1.08 − (0.30 τ + 0.75 τ²) plus noise fingers. Inverting it
gives every point the time since the water passed it, and that one number drives the rim, the trailing foam glow, the
stranded sparks and the drying gloss. The previous wash keeps its own fingers, so the stone's memory of it carries on
smoothly when the next wash starts.

## Files

- `blue-tears-ball.mp4`: the clip, 1080 × 1080, 24 fps, the 96-frame loop three times (12 s).
- `render.png`: frame 22, the front just above the equator, 1080 × 1080.
- `render-031.png`: frame 31, the front near the bottom, fastest and brightest, 1080 × 1080.
- `nodes/`: the node trees: `main.png` (the material) and `ball.png` (the ball and backdrop).
- `tutorial/`: a node-by-node walkthrough.

Rendered in Cycles, 128 samples.

## Caption

**Nodevember 2026 · Day 26 · Bioluminescent | Blue Tears on Stone**

Sea water washes down a dark stone ball every two seconds. Its running edge glows blue, brighter as it speeds up;
foam flashes behind it; stranded sparks blink out on the wet stone as it dries.

One material on a plain ball: the front's fall is a formula, so every point knows how long ago the water passed it,
and that one number drives the whole effect. No keyframes, no image textures, no simulation.

#nodevember #nodevember2026 #b3d

## Alt text

A dark polished stone sphere rests on a seamless grey backdrop. A thin sheet of sea water washes down over it from
the top; its ragged front edge glows electric blue, streaks of blue sparkle trail behind it, and after it passes a
scatter of tiny blue specks fades out on the wet stone before the next wash comes.
