// Gathering: a scatter of points over the picture each frame, each taking one sample of the light where its ray
// meets the ball and adding it into the texel that keeps the light there. A flat face's sample goes into one of
// the four texels about it, each as often as it counts in reading them back, so what is read is fair. A texel
// that has as many as it keeps takes no more, and the ray is the only cost. A ray that meets gold goes on, and
// gathers for what is seen in it.
@group(0) @binding(2) var<storage, read_write> keys: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> sums: array<atomic<u32>>; // red, green, blue in 1024ths, and how many

// the slot a texel has, taking an empty one for it if it has none yet
fn slotOf(k: Key) -> i32 {
  let mask = u32(U.more.x) - 1u;
  var i = 0u;
  for (var tries = 0u; tries < 32u && i < 16u; tries++) {
    let s = (k.slot + i) & mask;
    let seen = atomicLoad(&keys[s]);
    if (seen == k.check) { return i32(s); }
    if (seen == 0u) {
      let r = atomicCompareExchangeWeak(&keys[s], 0u, k.check);
      if (r.exchanged || r.old_value == k.check) { return i32(s); }
      // (it may fail with the slot still empty: then the same slot again)
      if (r.old_value == 0u) { continue; }
    }
    i++;
  }
  return -1;
}

@compute @workgroup_size(8, 8)
fn gather(@builtin(global_invocation_id) id: vec3u) {
  if (f32(id.x) >= U.grid.x || f32(id.y) >= U.grid.y) { return; }
  seed = id.x + 7919u * (id.y + 104729u * u32(U.frame));
  rnd();
  seed ^= seed >> 15u;
  rnd();
  let ray = eye((vec2f(id.xy) + vec2f(rnd(), rnd())) / U.grid.xy * U.size);
  // (what is seen in gold is gathered where it is, as if seen straight)
  let seen = onFrom(ray.o, ray.d);
  let hit = seen.hit;
  if (!hit.met || hit.what >= 8u) { return; }
  let p = seen.o + seen.d * hit.t;
  let a = along(hit.n);
  var k: Key;
  if (a >= 0) {
    let f = inPlane(p, a);
    k = flatKey(p, hit.n, a, vec2i(floor(f)) + vec2i(select(0, 1, rnd() < fract(f.x)), select(0, 1, rnd() < fract(f.y))));
  } else {
    k = roundKey(p, hit.n);
  }
  let s = slotOf(k);
  if (s < 0) { return; }
  let at = u32(s) * 4u;
  if (f32(atomicLoad(&sums[at + 3u])) >= U.more.y) { return; }
  let c = clamp(sample(p, hit.n), vec3f(0.0), vec3f(15.0)) * 1024.0 + vec3f(rnd(), rnd(), rnd());
  atomicAdd(&sums[at], u32(c.r));
  atomicAdd(&sums[at + 1u], u32(c.g));
  atomicAdd(&sums[at + 2u], u32(c.b));
  atomicAdd(&sums[at + 3u], 1u);
}
