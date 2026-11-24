import"./modulepreload-polyfill-ulV_1b7r.js";import{y as Le,k as Pe,c as he}from"./studio-presets-CDYyrMX7.js";import"./three-C2t3z6N3.js";import{b3 as Ee,P as Re,O as $,a as Fe,B as a,d as V,e as Oe,S as qe,T as Ge}from"./leva-C0l7872o.js";import{u as Ve,i as Be}from"./look-DcDmlVv9.js";const Ne=`struct Scene {
  frame: vec4f,       // viewport width, height, time, focal length
  eye: vec4f,         // camera origin, index of refraction
  forward: vec4f,     // camera forward, thin-film strength
  right: vec4f,       // camera right, absorption strength
  up: vec4f,          // camera up, bubble visibility
  grab: vec4f,        // contact point, pulse strength
  stretch: vec4f,     // displacement, softness
  cool: vec4f,
  warm: vec4f,
  lobes: array<vec4f, 5>,
  air: array<vec4f, 20>,
  key: vec4f,
  keyColor: vec4f,
  sweep: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var<uniform> look: Look;

const PI = 3.14159265;
const FLOOR = -1.48;


@vertex fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
}

fn hash(p: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715))));
}

fn softUnion(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn unstretch(p: vec3f) -> vec3f {
  if (dot(scene.stretch.xyz, scene.stretch.xyz) < 0.0000001) { return p; }
  let relative = p - scene.grab.xyz - scene.stretch.xyz * 0.48;
  let influence = exp(-dot(relative, relative) * 1.12);
  return p - scene.stretch.xyz * influence * 0.72;
}

fn field(point: vec3f) -> f32 {
  let p = unstretch(point);
  let k = mix(0.26, 0.57, scene.stretch.w);
  var distance = 5.0;
  for (var i = 0u; i < 5u; i++) {
    let lobe = scene.lobes[i];
    let relative = (p - lobe.xyz) * vec3f(1.0, 1.0, 1.08);
    distance = softUnion(distance, length(relative) - lobe.w, k);
  }
  if (scene.grab.w > 0.001) {
    let ripple = length(p - scene.grab.xyz);
    distance += scene.grab.w * 0.066 * cos(ripple * 6.1 + scene.grab.w * 5.0) * exp(-ripple * 1.25);
  }
  return distance + 0.008 * sin(5.8 * p.x - 4.1 * p.y + 3.5 * p.z + scene.frame.z);
}

fn normalAt(p: vec3f) -> vec3f {
  let a = vec3f(1.0, -1.0, -1.0);
  let b = vec3f(-1.0, -1.0, 1.0);
  let c = vec3f(-1.0, 1.0, -1.0);
  let d = vec3f(1.0, 1.0, 1.0);
  return normalize(a * field(p + 0.002 * a) + b * field(p + 0.002 * b)
    + c * field(p + 0.002 * c) + d * field(p + 0.002 * d));
}

fn sphereHit(origin: vec3f, direction: vec3f, radius: f32) -> vec2f {
  let along = dot(origin, direction);
  let discriminant = along * along - dot(origin, origin) + radius * radius;
  if (discriminant < 0.0) { return vec2f(-1.0); }
  let offset = sqrt(discriminant);
  return vec2f(-along - offset, -along + offset);
}

fn entryDistance(origin: vec3f, direction: vec3f, limit: f32) -> f32 {
  let bound = sphereHit(origin, direction, 3.0);
  let far = min(bound.y, limit);
  var t = max(bound.x, 0.0);
  for (var i = 0; i < 76 && t < far; i++) {
    let d = field(origin + direction * t);
    if (d < 0.0017) { return t; }
    t += d * 0.75;
  }
  return -1.0;
}

fn gelThickness(origin: vec3f, direction: vec3f) -> f32 {
  var t = 0.008;
  for (var i = 0; i < 56; i++) {
    let d = field(origin + direction * t);
    if (d > -0.0014 && t > 0.012) { break; }
    t += clamp(-d * 0.77, 0.003, 0.38);
  }
  return t;
}

fn paper(uv: vec2f) -> vec3f {
  let glow = exp(-dot(uv - vec2f(-0.21, 0.12), uv - vec2f(-0.21, 0.12)) * 1.8);
  let edge = smoothstep(0.08, 1.4, length(uv * vec2f(0.70, 1.0)));
  return mix(vec3f(0.81, 0.88, 0.90), vec3f(0.978, 0.987, 0.958), 0.58 + glow * 0.37)
    - edge * vec3f(0.042, 0.045, 0.039);
}

// Each lobe projects a broad penumbra and a narrower pool of tinted light.
fn backdrop(origin: vec3f, direction: vec3f, uv: vec2f) -> vec3f {
  let base = paper(uv) * mix(vec3f(1.0), sqrt(scene.sweep.rgb), scene.sweep.w * 0.65);
  let t = (FLOOR - origin.y) / min(direction.y, -0.0001);
  if (t > 24.0 || t <= 0.0) { return base; }
  let hit = origin + t * direction;
  var shadow = 0.0;
  var spill = vec3f(0.0);
  var caustic = vec3f(0.0);
  for (var i = 0u; i < 5u; i++) {
    let lobe = scene.lobes[i];
    let height = lobe.y - FLOOR;
    let drift = scene.stretch.xz * exp(-dot(lobe.xyz - scene.grab.xyz, lobe.xyz - scene.grab.xyz));
    let projection = lobe.xz - scene.key.xz * height * 0.69 / scene.key.y + drift * 0.50;
    let delta = (hit.xz - projection) * vec2f(0.92, 1.13);
    let r = length(delta) / (lobe.w + 0.17 * height * scene.key.w);
    shadow += exp(-r * r * 1.52) * 0.28;
    let tint = mix(scene.cool.rgb, scene.warm.rgb, f32(i) * 0.22);
    spill += tint * exp(-r * r * 2.5) * 0.092;
    let crescent = length(delta + vec2f(0.09, -0.10)) / lobe.w;
    let arc = (vec3f(crescent) - vec3f(0.69, 0.66, 0.63)) * 8.2;
    caustic += exp(-arc * arc) * smoothstep(-0.25, 0.48, delta.x) * (0.028 + tint * 0.034);
  }
  let gradient = exp(-dot(hit.xz, hit.xz) * 0.10) * 0.033;
  return base * exp(-shadow * 0.66) + spill * scene.right.w + caustic + gradient;
}

fn softbox(r: vec3f, aim: vec3f, size: vec2f, feather: f32) -> f32 {
  let x = normalize(cross(aim, vec3f(0.0, 1.0, 0.0)));
  let y = normalize(cross(x, aim));
  let v = abs(vec2f(dot(r, x), dot(r, y)));
  return (1.0 - smoothstep(size.x, size.x + feather, v.x))
    * (1.0 - smoothstep(size.y, size.y + feather, v.y))
    * smoothstep(0.35, 0.70, dot(r, aim));
}

fn studio(r: vec3f) -> vec3f {
  let keyAim = normalize(mix(vec3f(-0.51, 0.63, 0.59), scene.key.xyz, scene.sweep.w));
  let edgeAim = normalize(vec3f(0.82, 0.35, -0.46));
  let stripAim = normalize(vec3f(0.61, -0.19, 0.76));
  let key = softbox(r, keyAim, vec2f(0.30, 0.12) * scene.key.w, 0.12);
  let edge = softbox(r, edgeAim, vec2f(0.082, 0.47), 0.085);
  let strip = softbox(r, stripAim, vec2f(0.052, 0.25), 0.061);
  let ceiling = smoothstep(-0.45, 0.94, r.y);
  let broad = pow(max(0.0, dot(r, keyAim)), 10.0);
  return mix(vec3f(0.15, 0.27, 0.35), vec3f(0.94, 0.98, 1.0), ceiling)
    + scene.keyColor.rgb * scene.keyColor.w * (key * 5.1 + broad * 1.2)
    + vec3f(0.66, 0.84, 1.0) * edge * 1.65
    + vec3f(0.81, 1.0, 0.91) * strip * 0.87;
}

fn spectralFilm(facing: f32, p: vec3f) -> vec3f {
  let thickness = 0.92 + 0.16 * sin(p.x * 1.8 + p.y * 1.9 - p.z)
    + 0.08 * sin(p.y * 5.4 - p.x * 2.3 + scene.frame.z * 0.55);
  let phase = (thickness * (0.57 + 0.62 * facing)) * vec3f(1.44, 1.82, 2.15);
  return 0.51 + 0.49 * cos(2.0 * PI * (phase + vec3f(0.08, 0.19, 0.39)));
}

// Air inclusions reflect at their curved rims and shorten the path through gel.
fn bubbles(origin: vec3f, direction: vec3f, path: f32, tint: vec3f) -> vec4f {
  let localStart = unstretch(origin);
  let localEnd = unstretch(origin + direction * path);
  let localRay = normalize(localEnd - localStart);
  let localPath = length(localEnd - localStart);
  var nearest = localPath;
  var result = vec4f(0.0);
  for (var i = 0u; i < 20u; i++) {
    let bubble = scene.air[i];
    let hits = sphereHit(localStart - bubble.xyz, localRay, bubble.w);
    if (hits.x > 0.005 && hits.x < nearest && hits.y < localPath) {
      nearest = hits.x;
      let n = normalize(localStart + localRay * hits.x - bubble.xyz);
      let reflected = reflect(localRay, n);
      let facing = clamp(dot(-localRay, n), 0.0, 1.0);
      let rim = pow(1.0 - facing, 2.0);
      let glint = pow(max(dot(reflected, scene.key.xyz), 0.0), 17.0);
      let ring = smoothstep(0.21, 0.55, facing) * (1.0 - smoothstep(0.52, 0.82, facing));
      let light = (vec3f(0.90, 0.98, 1.0) * (0.64 * glint + rim * 0.33)
        - (vec3f(0.18) + (1.0 - tint) * 0.15) * ring) * exp(-hits.x * 0.70);
      result = vec4f(light, hits.y - hits.x);
    }
  }
  return result;
}

fn shadeGel(origin: vec3f, ray: vec3f, entry: f32, uv: vec2f) -> vec3f {
  let surface = origin + ray * entry;
  let n = normalAt(surface);
  let facing = clamp(dot(-ray, n), 0.0, 1.0);
  let ior = scene.eye.w;
  let inside = refract(ray, n, 1.0 / ior);
  let thickness = gelThickness(surface, inside);
  let exit = surface + inside * thickness;
  let exitNormal = normalAt(exit);
  let outgoing = refract(inside, -exitNormal, ior);
  let local = unstretch(surface + inside * thickness * 0.37);
  let blend = clamp(0.50 + 0.36 * local.x - 0.22 * local.y + 0.13 * sin(local.x * 2.4 - local.y * 3.0 - scene.frame.z * 0.8), 0.0, 1.0);
  let tint = mix(scene.cool.rgb, scene.warm.rgb, blend);
  var inclusion = vec4f(0.0);
  if (scene.up.w > 0.5 && thickness > 0.08) { inclusion = bubbles(surface, inside, thickness, tint); }

  let absorption = (1.0 - tint) * vec3f(0.99, 1.21, 0.98) + vec3f(0.04);
  let transmission = exp(-absorption * max(0.0, thickness - inclusion.w) * scene.right.w * 1.52);
  let bend = (inside.xy - ray.xy) * thickness;
  let refractedPaper = vec3f(paper(uv + bend * 0.56).r, paper(uv + bend * 0.61).g, paper(uv + bend * 0.67).b);
  let reflectedLight = mix(refractedPaper, studio(reflect(inside, -exitNormal)), 0.30);
  var transmittedLight = reflectedLight;
  if (dot(outgoing, outgoing) > 0.01) {
    let edgeLight = smoothstep(-0.70, 0.57, outgoing.y);
    let exitGlint = softbox(outgoing, normalize(vec3f(0.14, 0.58, -0.80)), vec2f(0.43, 0.09), 0.12);
    let exitLight = mix(refractedPaper * (0.68 + 0.36 * edgeLight), backdrop(exit, outgoing, uv + bend * 0.6), 0.39)
      + vec3f(0.84, 0.98, 1.0) * exitGlint * 0.38;
    let exitCos = dot(outgoing, exitNormal);
    transmittedLight = mix(reflectedLight, exitLight, smoothstep(0.0, 0.36, exitCos));
  }

  let internalGlow = pow(max(dot(inside, -scene.key.xyz), 0.0), 3.0) * 0.20 + 0.12 + exp(-thickness * 1.7) * 0.11;
  var body = transmittedLight * transmission + tint * (1.0 - transmission) * internalGlow;
  body += inclusion.rgb;

  let reflectance = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fresnel = reflectance + (1.0 - reflectance) * pow(1.0 - facing, 4.5);
  let reflection = studio(reflect(ray, n));
  let film = spectralFilm(facing, local);
  let filmWeight = scene.forward.w * pow(1.0 - facing, 1.8);
  let filmReflection = mix(reflection, reflection * (0.58 + 0.93 * film), clamp(filmWeight, 0.0, 0.9));
  let sheen = film * filmWeight * smoothstep(0.09, 0.40, facing) * 0.24;
  return mix(body, filmReflection, fresnel) + sheen;
}

@fragment fn fragmentMain(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let uv = (pixel.xy - scene.frame.xy * 0.5) * vec2f(1.0, -1.0) / scene.frame.y;
  let origin = scene.eye.xyz;
  let ray = normalize(scene.forward.xyz * scene.frame.w + scene.right.xyz * uv.x + scene.up.xyz * uv.y);
  let floorDistance = (FLOOR - origin.y) / min(ray.y, -0.0001);
  let entry = entryDistance(origin, ray, floorDistance);
  var linearColor = vec3f(0.0);
  if (entry > 0.0) {
    linearColor = shadeGel(origin, ray, entry, uv);
  } else {
    linearColor = backdrop(origin, ray, uv);
  }
  // A soft highlight shoulder keeps the reflections legible on a white sweep.
  // Exposure leaves paper whites near 0.96 on screen, so highlights still have room above them.
  linearColor = lookGrade(linearColor, pixel.xy / scene.frame.xy, look) * 0.95;
  linearColor = min(linearColor, vec3f(0.85)) + 0.15 * (1.0 - exp(-max(linearColor - 0.85, vec3f(0.0)) / 0.15));
  let c = max(linearColor, vec3f(0.0));
  let srgb = select(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - vec3f(0.055), c > vec3f(0.0031308));
  var shown = srgb;
  if (look.b.y > 0.5) { shown = lookTone(c, look.b.y); }
  return vec4f(shown + (hash(pixel.xy) - 0.5) / 140.0 + lookGrain(pixel.xy, 0.0, look), 1.0);
}
`,Ue=Be+Ne,J=Ve(),k=new URLSearchParams(location.search),u=k.has("thumb"),me=matchMedia("(prefers-reduced-motion: reduce)").matches,n=document.querySelector("canvas"),de=document.querySelector("#status");u&&document.body.classList.add("capture");const W={"Sea glass":[[.028,.42,.78],[.18,.89,.49]],Citrus:[[.89,.31,.055],[.8,.91,.19]],Garnet:[[.54,.015,.095],[.98,.17,.21]],Ultraviolet:[[.25,.025,.66],[.16,.29,.97]],Graphite:[[.06,.075,.1],[.34,.38,.44]],Peach:[[.95,.38,.27],[1,.72,.5]]},i={palette:W[k.get("palette")]?k.get("palette"):"Sea glass",speed:me?0:1,softness:.73,film:.45,absorption:.84,refraction:1.34,bubbles:!0,orbit:!1},y={x:0,v:0},De=new a,Y=[[-1.02,.12,.18,.71],[-.32,.57,-.22,.67],[.55,.36,.23,.69],[.84,-.35,-.11,.55],[-.22,-.5,.27,.62]],Z=new a(-.11,-.12,0),C=new a,S=new a,A=new a,R=new a,Ie=new a(0,1,0),B=new a,ee=new a,E=new a,G=new a,K=new a,te=new a,_=new a,ge=Y.map(()=>new a),ve=new Float32Array(Y.length),pe=new a,H=new a,Q=new Ge,Te=new Ee,ie=[[.141,.061,.026,.036],[.085,.029,.045,.025],[.128,.06,.031,.019],[.059,.033,.025,.015],[.094,.041,.028,.021]],be=36,ye=be+Y.length*4,$e=2*Math.PI;let F=.12,b=.17,w=6.55,j=0,l;const ne=1.66;function He(){const t=1-Math.min(1,n.clientWidth/Math.max(n.clientHeight,1));C.set(Math.sin(F)*Math.cos(b),Math.sin(b),Math.cos(F)*Math.cos(b)).multiplyScalar(w*(1+.55*t)).add(Z),S.subVectors(Z,C).normalize(),A.crossVectors(S,Ie).normalize(),R.crossVectors(A,S)}function We(t){const e=n.getBoundingClientRect();return te.copy(S).multiplyScalar(ne*Math.min(1,e.width/e.height)).addScaledVector(A,(t.clientX-e.left-e.width/2)/e.height).addScaledVector(R,(e.top+e.height/2-t.clientY)/e.height).normalize()}function ue(t){We(t);let e=1/0;for(const[r,d]of ge.entries()){_.subVectors(d,C);const p=ve[r],x=te.dot(_),z=(p+.14)**2-_.lengthSq()+x**2;z>=0&&(e=Math.min(e,x-Math.sqrt(z)))}return Number.isFinite(e)?(B.copy(C).addScaledVector(te,e),!0):!1}function xe(){j=1,y.v-=5.5}function je(){n.addEventListener("pointerdown",e=>{if(l||e.button!==0)return;const r=e.shiftKey||!ue(e);l={id:e.pointerId,x:e.clientX,y:e.clientY,orbit:r},n.setPointerCapture(e.pointerId),r||(j=1,y.v-=2.4)}),n.addEventListener("pointermove",e=>{if(!l){e.pointerType==="mouse"&&(ue(e)?G.copy(De.subVectors(B,Z).normalize().multiplyScalar(.085)):G.set(0,0,0));return}if(l?.id!==e.pointerId)return;const r=e.clientX-l.x,d=e.clientY-l.y;if(l.orbit){F-=r*.008,b=V.clamp(b+d*.006,-.1,.7),l.x=e.clientX,l.y=e.clientY;return}const p=w/(n.clientHeight*ne*Math.min(1,n.clientWidth/n.clientHeight));ee.copy(A).multiplyScalar(r*p).addScaledVector(R,-d*p),G.copy(ee).clampLength(0,1.3)});function t(e){l?.id===e.pointerId&&(l.orbit||(y.v+=E.length()*3),l=void 0,G.set(0,0,0))}n.addEventListener("lostpointercapture",t),n.addEventListener("pointercancel",t),n.addEventListener("wheel",e=>{e.preventDefault(),w=V.clamp(w*Math.exp(e.deltaY*.0015),4.4,10)},{passive:!1}),n.addEventListener("keydown",e=>{switch(e.key){case" ":xe();break;case"ArrowLeft":F-=.15;break;case"ArrowRight":F+=.15;break;case"ArrowUp":b=Math.min(b+.12,.7);break;case"ArrowDown":b=Math.max(b-.12,-.1);break;case"+":case"=":w=Math.max(4.4,w-.45);break;case"-":w=Math.min(10,w+.45);break;default:return}e.preventDefault()})}function Ye(t,e){const r=e*$e/7,d=Math.sin(r),p=Math.sin(r-.65)*.13;Q.setFromEuler(Te.set(.17*Math.sin(r-.6),.42*Math.sin(r+.4),-.13*Math.sin(r+.9))),Y.forEach(([x,z,L,o],c)=>{const N=r-x*1.45,O=Math.sin(N),P=y.x;pe.set(x*(1+.1*d)*(1-.07*P)+.028*Math.sin(r*1.7+c*2.1),z*(1-.14*d)*(1+.15*P)+O*.16+.026*Math.sin(r*2.3+c*1.3),(L+Math.cos(N)*.19)*(1-.07*P)+.026*Math.cos(r*1.9+c*1.7));const m=ge[c].copy(pe).applyQuaternion(Q);m.y+=p;const M=o*(1+O*.055+.025*Math.sin(r*2+c*1.7));ve[c]=M,t.set([m.x,m.y,m.z,M],be+c*4),ie[c].forEach((U,g)=>{const v=c*2.4+g*2.1,q=r*(g<2?1:2)+v;H.set(.29*Math.cos(v)+.13*Math.sin(q),.24*Math.sin(v)+.13*Math.sin(q-1.1),.32-g*.11+.11*Math.cos(q)).multiplyScalar(M/.72).applyQuaternion(Q).add(m);const X=ye+(c*ie[c].length+g)*4;t.set([H.x,H.y,H.z,U],X)})})}let f=null;const Xe=Le(k,t=>{f=t});function Ke(){return Oe({Studio:Xe,Palette:{value:i.palette,options:Object.keys(W),onChange:t=>{i.palette=t}},Motion:{value:i.speed,min:0,max:2,step:.01,onChange:t=>{i.speed=t}},Softness:{value:i.softness,min:.2,max:1,step:.01,onChange:t=>{i.softness=t}},"Thin film":{value:i.film,min:0,max:1.3,step:.01,onChange:t=>{i.film=t}},Absorption:{value:i.absorption,min:0,max:2,step:.01,onChange:t=>{i.absorption=t}},Refraction:{value:i.refraction,min:1.05,max:1.55,step:.01,onChange:t=>{i.refraction=t}},"Air bubbles":{value:i.bubbles,onChange:t=>{i.bubbles=t}},"Auto-orbit":{value:i.orbit,onChange:t=>{i.orbit=t}},Pulse:qe(xe),...J.controls()}),null}async function _e(){const t=await navigator.gpu?.requestAdapter();if(!t)throw new Error("This piece needs a browser with WebGPU enabled.");const e=await t.requestDevice();J.attach(e);const r=n.getContext("webgpu"),d=navigator.gpu.getPreferredCanvasFormat();r.configure({device:e,format:d,alphaMode:"opaque"});const p=e.createShaderModule({code:Ue}),x=(await p.getCompilationInfo()).messages.filter(h=>h.type==="error");if(x.length)throw new Error(x.map(h=>`Line ${h.lineNum}: ${h.message}`).join(`
`));const z=await e.createRenderPipelineAsync({layout:"auto",vertex:{module:p,entryPoint:"vertexMain"},fragment:{module:p,entryPoint:"fragmentMain",targets:[{format:d}]}}),L=ye+ie.flat().length*4,o=new Float32Array(L+12),c=e.createBuffer({size:o.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),N=e.createBindGroup({layout:z.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:c}},{binding:1,resource:{buffer:J.buffer}}]});u||(je(),Re.createRoot(document.querySelector("#controls")).render($.createElement($.Fragment,null,$.createElement(Fe,{collapsed:!0,titleBar:{title:"Controls"}}),$.createElement(Ke))));const O=.75,P=k.has("t")?Number(k.get("t")):O;let m=u&&Number.isFinite(P)?P:O,M=performance.now(),U=0,g=1/60,v=1;const[q,X]=W[i.palette].map(h=>new a(...h)),we=new a,ke=new a;function ae(h){const s=Math.min(.045,(h-M)/1e3);M=h,g+=(s-g)*.05,u||(v=V.clamp(g>1/44?v*.985:g<1/56?v*1.004:v,.55,1)),u||(m+=s*i.speed),i.orbit&&!l&&(F+=s*.2),K.addScaledVector(ee.subVectors(G,E),s*V.lerp(160,70,i.softness)),K.multiplyScalar(Math.exp(-s*V.lerp(14,6,i.softness))),E.addScaledVector(K,s),j*=Math.exp(-s*3.4),y.v+=(-150*y.x-7.5*y.v)*s,y.x+=y.v*s,He();const oe=u?1e3:n.clientWidth,ce=u?1e3:n.clientHeight,se=u?1:Math.min(devicePixelRatio,1.5,Math.sqrt(135e4/(oe*ce)))*v,D=Math.max(1,Math.round(oe*se)),I=Math.max(1,Math.round(ce*se));(n.width!==D||n.height!==I)&&(n.width=D,n.height=I),o.set([D,I,m,ne*Math.min(1,D/I)],0),o.set([C.x,C.y,C.z,i.refraction],4),o.set([S.x,S.y,S.z,i.film],8),o.set([A.x,A.y,A.z,i.absorption],12),o.set([R.x,R.y,R.z,Number(i.bubbles)],16),o.set([B.x,B.y,B.z,j],20),o.set([E.x,E.y,E.z,i.softness],24);const[ze,Me]=W[i.palette],le=me?1:1-Math.exp(-s*10);q.lerp(we.fromArray(ze),le).toArray(o,28),X.lerp(ke.fromArray(Me),le).toArray(o,32),Ye(o,m);const Ce=f?Pe(f):[-.5,.77,.39],Se=f?he(f.keyColor):[.94,.99,1.04],Ae=f?he(f.sweep):[1,1,1];o.set([...Ce,f?Math.sqrt(f.soft/4):1],L),o.set([...Se,f?f.keyLevel/4.4:1],L+4),o.set([...Ae,f?1:0],L+8),e.queue.writeBuffer(c,0,o);const fe=e.createCommandEncoder(),T=fe.beginRenderPass({colorAttachments:[{view:r.getCurrentTexture().createView(),loadOp:"clear",storeOp:"store",clearValue:{r:1,g:1,b:1,a:1}}]});T.setPipeline(z),T.setBindGroup(0,N),T.draw(3),T.end(),e.queue.submit([fe.finish()]),u||(U=requestAnimationFrame(ae))}if(ae(M),u&&k.has("port")){const h=Number(k.get("port"));n.toBlob(s=>{s&&fetch(`http://localhost:${h}/`,{method:"POST",body:s}).catch(re)},"image/jpeg",.94)}e.lost.then(()=>{cancelAnimationFrame(U),re(new Error("The graphics device stopped. Reload to reopen Membrane."))})}function re(t){console.error(t),de.textContent=t.message.startsWith("Line ")?"Membrane couldn’t load its shader.":t.message,de.hidden=!1}_e().catch(re);
