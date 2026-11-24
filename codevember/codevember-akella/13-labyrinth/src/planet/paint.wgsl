// Painting: every pixel sends a few rays (for smooth edges), and where one meets the ball, takes the light kept
// there. Nothing here is noisy: the noise is all in the gathering, and is averaged away in the table.
@group(0) @binding(2) var<storage, read> keys: array<u32>;
@group(0) @binding(3) var<storage, read> sums: array<u32>;

@vertex
fn vert(@builtin(vertex_index) n: u32) -> @builtin(position) vec4f {
  return vec4f(f32(n & 1u) * 4.0 - 1.0, f32(n >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}

// what a texel has gathered, and from how many samples (0: nothing yet)
fn kept(k: Key) -> vec4f {
  let mask = u32(U.more.x) - 1u;
  for (var i = 0u; i < 16u; i++) {
    let s = (k.slot + i) & mask;
    let seen = keys[s];
    if (seen == k.check) {
      let at = s * 4u;
      let n = f32(sums[at + 3u]);
      if (n < 0.5) { return vec4f(0.0); }
      return vec4f(vec3f(f32(sums[at]), f32(sums[at + 1u]), f32(sums[at + 2u])) / (1024.0 * n), n);
    }
    if (seen == 0u) { break; }
  }
  return vec4f(0.0);
}

// the light on a point of the ball: from the four texels about it, as far as they have it; and until they do, a
// guess (the sun as if nothing were in its way, and the sky)
fn lightAt(p: vec3f, n: vec3f) -> vec3f {
  let guess = U.clay.rgb * (U.sunTone.rgb * max(dot(n, U.sun.xyz), 0.0) * 0.7 + sky(n) * 0.8);
  let a = along(n);
  var got = vec3f(0.0);
  var weight = 0.0;
  var sure = 0.0;
  if (a >= 0) {
    let f = inPlane(p, a);
    let i = vec2i(floor(f));
    let fr = fract(f);
    for (var j = 0; j < 4; j++) {
      let o = vec2i(j & 1, j >> 1);
      let w = mix(1.0 - fr.x, fr.x, f32(o.x)) * mix(1.0 - fr.y, fr.y, f32(o.y));
      let t = kept(flatKey(p, n, a, i + o));
      if (t.a > 0.0) {
        got += w * t.rgb;
        weight += w;
        sure += w * min(t.a / 6.0, 1.0);
      }
    }
  } else {
    let t = kept(roundKey(p, n));
    if (t.a > 0.0) {
      got = t.rgb;
      weight = 1.0;
      sure = min(t.a / 6.0, 1.0);
    }
  }
  if (weight <= 1e-4) { return guess; }
  return mix(guess, got / weight, sure / weight);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  var offsets = array<vec2f, 4>(vec2f(-0.125, -0.375), vec2f(0.375, -0.125), vec2f(0.125, 0.375), vec2f(-0.375, 0.125));
  let rays = max(i32(U.more.z), 1);
  var sum = vec4f(0.0);
  for (var j = 0; j < rays; j++) {
    var off = vec2f(0.0);
    if (rays > 1) { off = offsets[j & 3]; }
    let ray = eye(at.xy + off);
    // gold shows what it faces, the way the eye sees it (so it is followed here, not gathered), and the light kept
    // where that is met
    let seen = onFrom(ray.o, ray.d);
    let hit = seen.hit;
    if (!hit.met && !seen.mirrored) { continue; }
    var c = vec3f(0.0);
    if (!hit.met) {
      c = away(seen.d, true, true);
    } else if (hit.what == 8u) {
      c = U.glow.rgb;
    } else if (hit.what == 9u) {
      c = U.skyLow.rgb * 0.5;
    } else {
      c = lightAt(seen.o + seen.d * hit.t, hit.n);
    }
    // a soft shoulder, then the screen's curve, for each ray before they are averaged (so edges are smooth on screen)
    c *= seen.carry * U.more.w;
    c = c * (1.0 + c * 0.12) / (1.0 + c * 0.55);
    c = pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
    sum += vec4f(c, 1.0);
  }
  return sum / f32(rays);
}
