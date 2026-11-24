export const FPS = 30, SIZE = 1024, DURATION = 60;
export const opening = {
  position: [-8.30445671, 1.17500556, 141.80295944],
  rotation: [.031036027, .116930626, -.088466167, -.988705099],
  velocity: [0, 0, 0], angular: [0, 0, 0], steering: 0, distance: 0, spins: [0, 0, 0, 0]
};
// Distances are metres; cameras are offsets from the physical chassis.
// The last two cameras keep the doorway's projected seal out of the reveal.
export const shots = [
  { name: 'Departure', duration: 6, start: 'opening', goal: [24, 45], throttle: .85, gameCamera: true, corrections: [[2.2, .18], [4.4, -.16]],
    orbit: [0, -.65], radius: [6.5, 18], height: [2.15, 6], aim: [1.1, 2] },
  { name: 'Sandstone passage', duration: 6, start: [60, 118], goal: [58, 48], route: [[61, 91], [59.4, 82], [59.6, 75], [62, 69], [65, 60], [58, 48]], throttle: .85,
    orbit: [1, .65], radius: [14, 16], height: [3.8, 4.6], aim: [1.4, 1.8] },
  { name: 'Wind-carved spires', duration: 4, continueFrom: 1, goal: [28, 58], route: [[62, 55], [54, 48], [43, 48], [33, 58], [28, 58]], throttle: .75, rockTarget: [50, 3, 55], rockFollow: .7,
    orbit: [.8, 1.5], radius: [24, 24], height: [7, 7], aim: [0, 0] },
  { name: 'Dune traverse', duration: 6, start: [85, -35], goal: [70, -160], throttle: .85, transition: 'Sunset', corrections: [[1.5, -.18], [4.2, .16]],
    orbit: [.25, -.3], radius: [20, 26], height: [5, 7], aim: [3, 4] },
  { name: 'Across the mirage', duration: 5, start: [63, -128], goal: [0, -180], throttle: .7, timeOfDay: 'Sunset', transition: 'Dawn', corrections: [[1.2, .16], [3.5, -.14]],
    orbit: [-2.5, -3.2], radius: [11, 9], height: [.7, .8], aim: [1.4, 1.5], lowCamera: true },
  { name: 'Tires in the sand', duration: 5, start: [0, -78], goal: [0, -160], throttle: .55, wheelCamera: true, timeOfDay: 'Dawn', corrections: [[1.5, -.16], [3.8, .14]],
    orbit: [0, 0], radius: [1, 1], height: [1, 1], aim: [1, 1] },
  { name: 'Sandstone detail', duration: 4, start: [0, -70], goal: [0, -170], throttle: 0, rockTarget: [48, 6, 68], timeOfDay: 'Dawn', transition: 'Day', transitionAt: 2,
    orbit: [1.1, 1.65], radius: [18, 18], height: [2.5, 2.5], aim: [0, 0] },
  { name: 'The approach', duration: 6, start: [-12, -149], goal: [-12, -240], throttle: .75, fov: 64, corrections: [[1.4, .16], [4, -.14]],
    orbit: [-.38, -.12], radius: [22, 26], height: [5, 7], aim: [10, 13] },
  { name: 'The ascent', duration: 6, start: [-12, -219], goal: [-12, -340], throttle: 1, corrections: [[1.8, .1], [4.3, -.1]],
    orbit: [-.7, -.95], radius: [4.5, 48], height: [2.2, 24], aim: [1.05, 6], stairs: true },
  { name: 'Above the dunes', duration: 6, start: [-12, -285], goal: [-12, -345], throttle: .65, corrections: [[1.7, -.1], [4.5, .1]],
    orbit: [-1.55, -1.35], radius: [20, 23], height: [8.5, 10], aim: [1.5, 2], stairs: true },
  { name: 'The summit', duration: 6, start: [-12, -317], goal: [-12, -328], throttle: .65, fov: 44,
    orbit: [0, 0], radius: [0, 8], height: [15, 8], aim: [0, -.8], stairs: true, stop: true, overhead: true }
];
let start = 0;
for (const shot of shots) { shot.startFrame = start; shot.frames = shot.duration * FPS; start += shot.frames; }
if (start !== DURATION * FPS) throw new Error('Shot durations must total sixty seconds');
export const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const mix = (a, b, t) => a + (b - a) * t;
