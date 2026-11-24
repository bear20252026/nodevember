// The painted ball on the screen, over a plain ground. (The picture may have fewer pixels than the screen.)
struct Show {
  screen: vec2f,
  grain: f32,
  time: f32,
}
@group(0) @binding(0) var<uniform> S: Show;
@group(0) @binding(1) var painted: texture_2d<f32>;
@group(0) @binding(2) var smooth_: sampler;

@vertex
fn vert(@builtin(vertex_index) n: u32) -> @builtin(position) vec4f {
  return vec4f(f32(n & 1u) * 4.0 - 1.0, f32(n >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let ball = textureSampleLevel(painted, smooth_, at.xy / S.screen, 0.0); // its colour, already times how much of the pixel it covers
  let away = (at.xy - 0.5 * S.screen) / min(S.screen.x, S.screen.y);
  let back = mix(vec3f(0.83, 0.62, 0.57), vec3f(0.6, 0.4, 0.4), smoothstep(0.25, 1.1, length(away)));
  let grain = fract(sin(dot(at.xy + S.time * 61.0, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  return vec4f(ball.rgb + (1.0 - ball.a) * back + grain * S.grain, 1.0);
}
