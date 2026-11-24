export const FPS = 30;
export const SIZE = 1024;
export const DURATION = 60;
export const LOOP_BLEND_FRAMES = 36;
export const SOURCE_FRAMES = DURATION * FPS + LOOP_BLEND_FRAMES;
export const SOURCE_DURATION = SOURCE_FRAMES / FPS;
export const SEED = 2;
// Match the retreats after assemblies 0 and 5, while the next chain is still
// behind the camera. Their transition starts are 65.7667 simulation seconds apart.
export const START_TIME = 8.7;
export const PLAYBACK_SPEED = 1973 / FPS / DURATION;
