// the water's surface for the picture and the glints: rings and ripples baked together each frame
// (the light rays use surface.wgsl instead, exact, since caustics follow the surface's curvature)

@group(0) @binding(2) var surf: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;

/** (height, dh/dx, dh/dz) */
fn water(p: vec2f) -> vec3f {
  let uv = (p + vec2f(U.PX, U.PZ)) / vec2f(2.0 * U.PX, 2.0 * U.PZ);
  return textureSampleLevel(surf, smp, uv, 0.0).xyz;
}
