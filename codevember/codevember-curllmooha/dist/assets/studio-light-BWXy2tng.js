import{k as x,c as S}from"./studio-presets-CDYyrMX7.js";const w=`// Percentage-closer soft shadows for the raw-WebGPU days. Needs \`shadowMap: texture_depth_2d\` and \`shadowCmp: sampler_comparison\`.
// Shadows stay sharp where something touches the surface and widen with the distance it falls, up to \`spread\` texels
// (the softness each call site already chose): blocker search, penumbra from the depth gap, then a filter that wide.
const PCSS_TAPS = array<vec2f, 12>(vec2f(-0.33, 0.12), vec2f(0.21, 0.4), vec2f(0.5, -0.1), vec2f(-0.06, -0.47), vec2f(-0.7, -0.33), vec2f(-0.6, 0.55), vec2f(0.1, 0.86), vec2f(0.75, 0.48), vec2f(0.86, -0.42), vec2f(0.2, -0.9), vec2f(-0.41, -0.88), vec2f(-0.96, 0.08));
const PCSS_LIGHT = 0.08;

fn pcss(uv: vec2f, z: f32, spread: f32, size: f32, taps: i32) -> f32 {
  let texel = 1.0 / size;
  let maxR = spread * texel;
  let last = vec2i(i32(size) - 1);
  var blockerSum = 0.0;
  var blockers = 0.0;
  for (var i = 0; i < 12; i++) {
    let coord = clamp(vec2i((uv + PCSS_TAPS[i] * maxR) * size), vec2i(0), last);
    let d = textureLoad(shadowMap, coord, 0);
    if (d < z - 0.0006) { blockerSum += d; blockers += 1.0; }
  }
  if (blockers < 0.5) { return 1.0; }
  let penumbra = (z - blockerSum / blockers) * PCSS_LIGHT;
  let r = clamp(penumbra, texel, max(maxR, texel));
  let n = clamp(taps, 8, 12);
  var sum = 0.0;
  for (var i = 0; i < n; i++) { sum += textureSampleCompareLevel(shadowMap, shadowCmp, uv + PCSS_TAPS[i] * r, z); }
  return sum / f32(n);
}
`,L=`// The photographic finish: a soft glow from the brightest highlights, a little local contrast, then a filmic grade.
struct Pass { texel: vec2f, strength: f32, time: f32 }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> pass_: Pass;
@group(0) @binding(3) var bloomTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> look: Look;
struct Quad { @builtin(position) clip: vec4f, @location(0) uv: vec2f }
@vertex fn quadVs(@builtin(vertex_index) v: u32) -> Quad {
  let c = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return Quad(vec4f(c[v], 0.0, 1.0), vec2f(c[v].x * 0.5 + 0.5, 0.5 - c[v].y * 0.5));
}
fn blurDown(uv: vec2f) -> vec3f {
  let t = pass_.texel;
  var sum = textureSampleLevel(source, linearSampler, uv, 0.0).rgb * 4.0;
  sum += textureSampleLevel(source, linearSampler, uv + t * vec2f(-1, -1), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, uv + t * vec2f(1, -1), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, uv + t * vec2f(-1, 1), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, uv + t * vec2f(1, 1), 0.0).rgb;
  return sum / 8.0;
}
@fragment fn brightFs(q: Quad) -> @location(0) vec4f {
  let c = blurDown(q.uv);
  let peak = max(c.r, max(c.g, c.b));
  // One bad pixel must never spread through the blur into a block. (A value that isn't equal to itself isn't a number.)
  if (peak != peak || peak > 1e4) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  return vec4f(min(c * smoothstep(1.1, 2.2, peak), vec3f(16.0)), 1.0);
}
@fragment fn downFs(q: Quad) -> @location(0) vec4f { return vec4f(blurDown(q.uv), 1.0); }
@fragment fn upFs(q: Quad) -> @location(0) vec4f {
  let t = pass_.texel;
  var sum = vec3f(0.0);
  sum += textureSampleLevel(source, linearSampler, q.uv + t * vec2f(-1, 0), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, q.uv + t * vec2f(1, 0), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, q.uv + t * vec2f(0, -1), 0.0).rgb;
  sum += textureSampleLevel(source, linearSampler, q.uv + t * vec2f(0, 1), 0.0).rgb;
  return vec4f(sum * 0.25, 1.0);
}
fn filmic(c: vec3f) -> vec3f {
  // Holds pastel colours, gives a soft toe and a long shoulder.
  let m = (c * (c * 0.66 + 0.1)) / (c * (c * 0.66 + 0.3) + 0.06);
  return clamp(m / 0.94, vec3f(0.0), vec3f(1.0));
}
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
@fragment fn finishFs(q: Quad) -> @location(0) vec4f {
  let t = pass_.texel;
  let c = textureSampleLevel(source, linearSampler, q.uv, 0.0).rgb;
  // Local contrast: a little sharper than a lens gives, as a retouched product photo is.
  let around = (textureSampleLevel(source, linearSampler, q.uv + vec2f(t.x, 0.0), 0.0).rgb
    + textureSampleLevel(source, linearSampler, q.uv - vec2f(t.x, 0.0), 0.0).rgb
    + textureSampleLevel(source, linearSampler, q.uv + vec2f(0.0, t.y), 0.0).rgb
    + textureSampleLevel(source, linearSampler, q.uv - vec2f(0.0, t.y), 0.0).rgb) * 0.25;
  var x = max(c + (c - around) * 0.12, vec3f(0.0));
  x += textureSampleLevel(bloomTexture, linearSampler, q.uv, 0.0).rgb * pass_.strength;
  x = lookGrade(x, q.uv, look);
  // Light falls off toward the corners, as it does through any real lens.
  let d = length((q.uv - 0.5) * vec2f(1.0, 0.86));
  x *= 1.0 - smoothstep(0.32, 0.86, d) * 0.34;
  var s = pow(filmic(x), vec3f(1.0 / 2.2));
  if (look.b.y > 0.5) { s = lookTone(x, look.b.y); }
  // The grade: richer colour, shadows leaning cool, highlights leaning warm.
  let luma = dot(s, vec3f(0.2126, 0.7152, 0.0722));
  s = mix(vec3f(luma), s, 1.1);
  s = mix(s * vec3f(0.97, 0.995, 1.03), s * vec3f(1.015, 1.0, 0.975), smoothstep(0.15, 0.8, luma));
  // A gentle S-curve.
  s = mix(s, s * s * (3.0 - 2.0 * s), 0.22);
  s += (hash(q.clip.xy + fract(pass_.time) * 91.0) - 0.5) * 0.012 + lookGrain(q.clip.xy, pass_.time, look);
  return vec4f(s, 1.0);
}
`,b=[[6.977,8.0138,9.0364],[3.7137,4.2706,4.8893],[-.1716,-.1827,-.1336],[-2.6957,-3.1333,-3.7194],[-2.316,-2.666,-3.0513],[.3464,.3993,.4589],[.0745,.094,.1397],[-1.0182,-1.1633,-1.2847],[1.7637,2.0235,2.2799]],k=[{dir:[-.7467,.6535,.1237],colour:[3.61,4.2,5.086]},{dir:[.8897,-.013,-.4564],colour:[4.464,5.025,5.298]},{dir:[.8808,.2088,-.4251],colour:[1.155,1.343,1.518]}],s={sh:b,lights:k};function g(t,a,{amount:l=1,falloff:c=.65,strength:p=1,turn:n=0,warmth:f=.35}={}){const u=n*Math.PI/180,v=Math.cos(u),i=Math.sin(u);t.set([l,c,v,i],a);const r=[0,1,2].map(e=>s.sh[0][e]*.282095+s.sh[1][e]*.488603+s.sh[6][e]*.63078),h=.2126*r[0]+.7152*r[1]+.0722*r[2],o=[0,1,2].map(e=>h/r[e]*(e===0?1+.14*f:e===2?1-.2*f:1)*1.3*p/h);s.sh.forEach((e,m)=>t.set([e[0]*o[0],e[1]*o[1],e[2]*o[2],0],a+4+m*4));const d=e=>[v*e[0]+i*e[2],e[1],-i*e[0]+v*e[2]];return s.lights.slice(0,2).forEach((e,m)=>{t.set([...d(e.dir),0],a+40+m*4),t.set([e.colour[0]*o[0],e.colour[1]*o[1],e.colour[2]*o[2],0],a+48+m*4)}),d(s.lights[0].dir)}function _(t,a,l,c){if(!l)return g(t,a,c);const p=s.lights[0].dir,n=r=>Math.atan2(r[0],r[2]),f=(n(l.key)-n(p))*180/Math.PI;g(t,a,{...c,turn:f,strength:c.strength*l.env/.5});const u=x(l);t.set([...u,0],a+40);const v=S(l.keyColor),i=l.keyLevel/4.4/(l.env/.5);for(let r=0;r<3;r++)t[a+48+r]*=v[r]*i;return u}export{_,w as q,L as y};
