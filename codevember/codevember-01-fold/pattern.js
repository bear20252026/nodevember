// The pattern inside the gum, drawn in rest space (where each point was in the
// first grid of cubes), so it stretches and folds with the shape: every cube
// is a cane of thin pale bands, each cube its own way, with a soft marbling.
// After a few folds the bands are pressed into fine layers.
export const patternGLSL = /* glsl */ `
// per cube, from its colour (continuous: no seams from interpolation)
float gumSeed(vec3 color) { return dot(color, vec3(31.7, 47.3, 23.9)); }
// a gentle swirl
vec3 gumSwirl(vec3 rest, float a) { return rest + 0.1 * sin(rest.yzx * 5.0 + a); }
// the bands run across this phase
float gumPhase(vec3 color, vec3 rest) {
  float a = gumSeed(color);
  vec3 dir = normalize(vec3(cos(a), sin(a), 0.7 * sin(1.7 * a)));
  vec3 q = gumSwirl(rest, a);
  return dot(q, dir) * 6.5 + 0.3 * sin(dot(q, vec3(2.3, 3.1, 1.7)) * 3.0);
}
// w: how much the phase changes over a pixel
vec3 gumPatternW(vec3 color, vec3 rest, float w) {
  float a = gumSeed(color);
  vec3 q = gumSwirl(rest, a);
  float ph = gumPhase(color, rest);
  // thin bands, antialiased; finer than a pixel, they fade to their average
  float d = abs(fract(ph) - 0.5);
  float band = smoothstep(0.37 - w, 0.37 + w, d);
  band = mix(0.26, band, 1.0 - smoothstep(0.2, 0.45, w));
  vec3 c = mix(color, mix(color, vec3(1.0), 0.5), band * 0.6);
  // soft marbling
  return c * (1.0 + 0.05 * sin(dot(q, vec3(3.1, 2.3, 4.7)) * 1.7 + a));
}
vec3 gumPattern(vec3 color, vec3 rest) { return gumPatternW(color, rest, fwidth(gumPhase(color, rest))); }
`;
