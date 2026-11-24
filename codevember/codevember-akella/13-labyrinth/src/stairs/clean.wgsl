// Cleaning: while the tile has only a few samples of light in it, every pixel borrows from the pixels near it
// that lie on the same face, which is to say: turned the same way, and in the same plane. Light changes slowly
// over a face and not at all like the grain does, so the grain goes and the light stays; edges are kept, because
// nothing is borrowed across them. Done twice, far apart and then close, it reaches a good way for few looks.
struct Clean {
  size: vec2f, // the tile, pixels
  period: f32,
  stride: f32, // pixels between the ones it looks at
}
@group(0) @binding(0) var<uniform> C: Clean;
@group(0) @binding(1) var noisy: texture_2d<f32>;
@group(0) @binding(2) var faces: texture_2d<f32>; // which way each pixel's face looks, and how far along the ray it is

@vertex
fn vert(@builtin(vertex_index) n: u32) -> @builtin(position) vec4f {
  return vec4f(f32(n & 1u) * 4.0 - 1.0, f32(n >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let size = vec2i(C.size);
  let here = vec2i(at.xy);
  let mine = textureLoad(faces, here, 0);
  // a pixel's step across and down the picture, and a unit's step along the ray, in the world
  let across = vec3f(1.0, 0.0, -1.0) * (C.period / C.size.x);
  let down = vec3f(1.0, -2.0, 1.0) * (C.period / C.size.y);
  let along = -vec3f(1.0) / sqrt(3.0);
  let share = array<f32, 3>(0.375, 0.25, 0.0625);
  var sum = vec4f(0.0);
  var total = 0.0;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let off = vec2i(i, j) * i32(C.stride);
      let p = (((here + off) % size) + size) % size; // the tile repeats
      let its = textureLoad(faces, p, 0);
      var w = share[abs(i)] * share[abs(j)];
      if (mine.w < 0.0 || its.w < 0.0) {
        w *= select(0.0, 1.0, mine.w < 0.0 && its.w < 0.0);
      } else {
        let apart = f32(off.x) * across + f32(off.y) * down + along * (its.w - mine.w);
        let off_plane = dot(mine.xyz, apart) / 0.012;
        w *= exp(-(1.0 - dot(mine.xyz, its.xyz)) * 600.0 - off_plane * off_plane);
      }
      if (w > 1e-4) {
        sum += w * textureLoad(noisy, p, 0);
        total += w;
      }
    }
  }
  return sum / max(total, 1e-6);
}
