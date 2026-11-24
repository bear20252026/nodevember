// Positions stay in world space as the camera and its focus move independently.
// Reuse a slot only once its entire rock is beyond the far fog fade.
export const ROCK_NEAR_FADE = [10, 17];
export const ROCK_FAR_FADE = [49, 63];
const layout = [
  [-17, -11, 28, 5.2],
  [18, 9, 36, 6],
  [-18, 12, 44, 4.5],
  [16, -15, 42, 5],
  [-5, -19, 51, 6],
  [5, 19, 49, 4.5],
  [-9, 7, 48, 1.8],
  [10, -7, 51, 2.2],
  [1, 9, 57, 1.4],
  [-14, -7, 57, 2.5],
];
const noise = (seed) => {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export class RockField {
  constructor() {
    this.rocks = [];
    this.previousTime = null;
  }
  update(time, cameraZ) {
    if (this.previousTime === null || time < this.previousTime) {
      this.rocks = layout.map(([x, y, depth, size], i) => ({
        x,
        y,
        z: cameraZ - depth,
        size,
        phase: i * 2.39996,
        generation: 0,
      }));
    }
    this.previousTime = time;
    for (const [i, rock] of this.rocks.entries()) {
      if (cameraZ - rock.z - rock.size <= ROCK_FAR_FADE[1] + 1) continue;
      const seed = i + ++rock.generation * 19;
      // Fresh placement and rotation; the old silhouette never returns from fog.
      rock.x = (i % 2 ? 1 : -1) * (9 + noise(seed) * 12);
      rock.y = (noise(seed + 7) - 0.5) * 38;
      rock.size = layout[i][3] * (0.82 + noise(seed + 13) * 0.28);
      rock.phase = noise(seed + 29) * Math.PI * 2;
      rock.z = cameraZ - 3;
    }
    return this.rocks;
  }
}
