import"../lib/modulepreload-polyfill.js";import{aH as K,S as ue,C as me,P as de,k as fe,M as ve,aM as pe,o as he,D as V,B as W,t as M,fD as N,a2 as X,ap as ge,f as Y,az as xe,V as we,c as be,r as E,L as Me,aQ as ke,u as ye,g as G,N as Pe,aX as Ce,aF as B}from"../lib/next/leva.esm.js";import{W as Se,P as Ae}from"../lib/next/three.module.js";import{O as Ee}from"../lib/next/OrbitControls.js";import{R as Re}from"../lib/next/RoomEnvironment.js";import{E as Fe,U as Te,O as ze,S as De}from"../lib/next/OutputPass.js";import{R as Oe}from"../lib/next/RenderPass.js";const j=new URLSearchParams(location.search),A=j.has("thumb");document.body.classList.toggle("capture",A);const $=matchMedia("(prefers-reduced-motion: reduce)"),s=new Se({antialias:!0,preserveDrawingBuffer:A});s.setPixelRatio(Math.min(devicePixelRatio,2));s.toneMapping=K;s.toneMappingExposure=1;s.domElement.id="view";s.domElement.setAttribute("aria-label","A glowing lump of lava with a cracked black crust, smoking in the dark. Drag to orbit, click to crack it open.");document.body.prepend(s.domElement);const m=new ue;m.background=new me(197122);const g=new de(32,1,.05,100);g.position.set(.6,.5,6.4);const v=new Ee(g,s.domElement);v.enableDamping=!0;v.enablePan=!1;v.minDistance=3.4;v.maxDistance=10;v.autoRotate=!$.matches;v.autoRotateSpeed=.35;const u=(e=0,i=1)=>e+(i-e)*Math.random(),je=new Ae(s);m.environment=je.fromScene(new Re,.03).texture;m.environmentIntensity=.35;const Q=`
  vec3 h33(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
  float h13(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.02 + 7.3; a *= .5; } return s; }
  // x = F1, y = F2, z = id of the nearest cell
  vec3 vor3(vec3 p, float t){
    vec3 n = floor(p), f = fract(p); float d1 = 8., d2 = 8., id = 0.;
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      vec3 g = vec3(i, j, k), o = h33(n + g);
      o = .5 + .42 * sin(t * (.25 + .2 * o) + 6.2831 * o);      // the plates drift and jostle
      vec3 r = g + o - f; float d = dot(r, r);
      if (d < d1){ d2 = d1; d1 = d; id = h13(n + g); } else if (d < d2) d2 = d;
    }
    return vec3(sqrt(d1), sqrt(d2), id);
  }
  vec3 blackbody(float t){
    t = clamp(t, 800., 12000.) / 100.;
    float r = t <= 66. ? 1. : 1.293 * pow(t - 60., -.1332);
    float g = t <= 66. ? .39 * log(t) - .632 : 1.13 * pow(t - 60., -.0755);
    float b = t >= 66. ? 1. : t <= 19. ? 0. : .543 * log(t - 10.) - 1.196;
    return clamp(vec3(r, g, b), 0., 1.);
  }
  vec3 plateP(vec3 n, float scale, float seed){ return n * scale + seed + .55 * vec3(fbm3(n * 1.8 + seed), fbm3(n * 1.8 + seed + 5.), fbm3(n * 1.8 + seed + 9.)); }
  vec3 glowK(float t){ return blackbody(t) * pow(max(t - 760., 0.) / 640., 4.); }
`,d={uTime:{value:0},uSeed:{value:0},uCrack:{value:1},uScale:{value:2.6},uHeat:{value:1},uOpen:{value:0}},U=new fe({color:723209,roughness:.3,metalness:0,clearcoat:.7,clearcoatRoughness:.12,envMapIntensity:1});U.onBeforeCompile=e=>{Object.assign(e.uniforms,d);const i=`uniform float uTime, uSeed, uCrack, uScale, uHeat, uOpen;
${Q}
varying vec3 vObj;
`;e.vertexShader=i+`
    float shapeH(vec3 n){
      float big = (fbm3(n * 1.25 + uSeed) - .5) * .55 + (fbm3(n * 2.6 + uSeed * 1.7) - .5) * .18;
      vec3 v = vor3(plateP(n, uScale, uSeed), uTime * .6);
      float seam = v.y - v.x;
      float pillow = pow(smoothstep(0., .55, seam), .55) * .1;          // plates bulge, seams sink
      return 1. + big + pillow - .02;
    }
    vec3 surf(vec3 n){ return n * shapeH(n) * vec3(1.18, .92, 1.); }
  `+e.vertexShader.replace("#include <beginnormal_vertex>",`
      vec3 nn = normalize(position);
      vec3 ta = normalize(cross(nn, abs(nn.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), tb = cross(nn, ta);
      const float e = .004;
      vec3 P = surf(nn), Pa = surf(normalize(nn + ta * e)), Pb = surf(normalize(nn + tb * e));
      vec3 objectNormal = normalize(cross(Pa - P, Pb - P));
      if (dot(objectNormal, nn) < 0.) objectNormal = -objectNormal;
      vObj = nn;`).replace("#include <begin_vertex>","vec3 transformed = P;"),e.fragmentShader=i+e.fragmentShader.replace("#include <roughnessmap_fragment>",`
      float roughnessFactor = roughness;
      vec3 vc = vor3(plateP(vObj, uScale, uSeed), uTime * .6);
      float seam = vc.y - vc.x;
      roughnessFactor = mix(.18, .55, fract(vc.z * 7.31));                    // some plates glassy, some dull
      roughnessFactor = mix(roughnessFactor, .9, smoothstep(.12, 0., seam)); // the crack walls are raw
    `).replace("#include <emissivemap_fragment>",`
      // cracks: a hot core, cooling walls, and a dull glow under the thinnest crust next to them
      float wid = (.045 + .03 * fbm3(vObj * 4. + uSeed)) * uCrack * (1. + uOpen * 1.6);
      float core = 1. - smoothstep(wid * .25, wid * .7, seam);
      float wall = 1. - smoothstep(wid * .6, wid * 1.8, seam);
      float under = 1. - smoothstep(wid, wid * 6., seam);
      float boil = fbm3(vObj * 9. + vec3(0., uTime * .4, 0.));
      float Tcore = (1190. + 170. * boil) * uHeat + uOpen * 170.;
      vec3 hot = glowK(Tcore) * core * 1.8 + glowK(mix(1020., Tcore, .5)) * (wall - core) * 1.3 + vec3(1., .18, .04) * under * under * .05 * uHeat;
      totalEmissiveRadiance += hot * .9;
      diffuseColor.rgb *= 1. - wall;
    `)};const R=new ve(new pe(1,128),U);m.add(R);const Le=[0,1,2].map(()=>{const e=new he(16734750,6,4.5,1.6);return m.add(e),e}),J=new V(14212351,.9);J.position.set(-3,4,2);m.add(J);const Z=new V(16747088,.6);Z.position.set(3,-1,-3);m.add(Z);function Ue(){const e=document.createElement("canvas");e.width=e.height=128;const i=e.getContext("2d"),n=i.createImageData(128,128);for(let t=0;t<128;t++)for(let a=0;a<128;a++){const l=a/64-1,f=t/64-1,C=Math.sqrt(l*l+f*f),p=.55+.45*Math.sin(a*.31+Math.sin(t*.27)*2)*Math.sin(t*.23+Math.sin(a*.19)*2),S=Math.max(0,1-C)**2*p,h=(t*128+a)*4;n.data[h]=n.data[h+1]=n.data[h+2]=255,n.data[h+3]=S*255}return i.putImageData(n,0,0),new ke(e)}const y=900,r={pos:new Float32Array(y*3),age:new Float32Array(y),life:new Float32Array(y),seed:new Float32Array(y)},w=new W;w.setAttribute("position",new M(r.pos,3));w.setAttribute("age",new M(r.age,1));w.setAttribute("life",new M(r.life,1));w.setAttribute("seed",new M(r.seed,1));const H=new N({transparent:!0,depthWrite:!1,uniforms:{uMap:{value:Ue()},uPixel:{value:1},uAmount:{value:1}},vertexShader:`attribute float age, life, seed; uniform float uPixel; varying float vA, vRot; varying vec3 vC;
    void main(){ float k = clamp(age / max(life, .001), 0., 1.);
      vA = smoothstep(0., .15, k) * (1. - k); vRot = seed * 6.28 + age * (seed - .5);
      float d = length(position);
      vC = mix(vec3(.24, .23, .24), vec3(1., .3, .08) * .6, exp(-max(d - 1., 0.) * 2.5));    // fire-lit near the stone, grey further out
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_PointSize = uPixel * (.35 + 1.4 * k) * 420. / -mv.z; gl_Position = projectionMatrix * mv; }`,fragmentShader:`uniform sampler2D uMap; uniform float uAmount; varying float vA, vRot; varying vec3 vC;
    void main(){ vec2 c = gl_PointCoord - .5; float s = sin(vRot), co = cos(vRot); c = mat2(co, -s, s, co) * c;
      float a = texture2D(uMap, c + .5).a * vA * .15 * uAmount; if (a < .002) discard; gl_FragColor = vec4(vC, a); }`}),ee=new X(w,H);ee.frustumCulled=!1;m.add(ee);function te(e){const i=u(-1,1),n=u(0,Math.PI*2),t=Math.sqrt(1-i*i);r.pos.set([Math.cos(n)*t*1.1,i*1.1,Math.sin(n)*t*1.1],e*3),r.age[e]=0,r.life[e]=u(4,9),r.seed[e]=Math.random()}for(let e=0;e<y;e++)te(e),r.age[e]=Math.random()*r.life[e];const P=1600,o={pos:new Float32Array(P*3),vel:new Float32Array(P*3),life:new Float32Array(P),max:new Float32Array(P)},x=new W;x.setAttribute("position",new M(o.pos,3));x.setAttribute("life",new M(o.life,1));x.setAttribute("maxLife",new M(o.max,1));const ae=new N({transparent:!0,depthWrite:!1,blending:ge,uniforms:{uPixel:{value:1}},vertexShader:`attribute float life, maxLife; uniform float uPixel; varying vec3 vC; ${Q}
    void main(){ float k = clamp(life / max(maxLife, .001), 0., 1.);
      vC = glowK(mix(1000., 1500., k)) * 1.6 * smoothstep(0., .15, k);
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      gl_PointSize = life > 0. ? uPixel * (1. + 1.5 * k) * 10. / -mv.z : 0.; gl_Position = projectionMatrix * mv; }`,fragmentShader:"varying vec3 vC; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); if (r > .25) discard; gl_FragColor = vec4(vC * exp(-r * 14.), 1.); }"}),ne=new X(x,ae);ne.frustumCulled=!1;m.add(ne);let L=0;function _(e=1){const i=L=(L+1)%P,n=u(-1,1),t=u(0,Math.PI*2),a=Math.sqrt(1-n*n),l=[Math.cos(t)*a,n,Math.sin(t)*a];o.pos.set([l[0]*1.15,l[1]*.95,l[2]*1.15],i*3);const f=u(.15,.9)*e;o.vel.set([l[0]*f+u(-.1,.1),l[1]*f+u(.1,.5),l[2]*f+u(-.1,.1)],i*3),o.life[i]=o.max[i]=u(1.2,4)}const b=new Fe(s);b.addPass(new Oe(m,g));const F=new Te(new Y(256,256),.85,.6,.85);b.addPass(F);b.addPass(new ze);const T=new De({uniforms:{tDiffuse:{value:null},uTime:{value:0},uGrain:{value:1},uVignette:{value:1},uFringe:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uFringe; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 37.) * 43758.5453); }
    void main(){ vec2 d = vUv - .5; float r2 = dot(d, d);
      vec2 off = d * r2 * .012 * uFringe;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1., smoothstep(.85, .15, r2 * 1.6), .85 * uVignette);
      col += (h(vUv * 1000.) - .5) * .035 * uGrain;
      gl_FragColor = vec4(col, 1.); }`});b.addPass(T);function oe(){g.aspect=innerWidth/innerHeight,g.fov=innerWidth<innerHeight?44:32,g.updateProjectionMatrix(),s.setSize(innerWidth,innerHeight),b.setPixelRatio(s.getPixelRatio()),b.setSize(innerWidth,innerHeight);const e=s.getPixelRatio()*innerHeight/900;H.uniforms.uPixel.value=e,ae.uniforms.uPixel.value=e}addEventListener("resize",oe);oe();const z={sparks:1,spin:1};let k=0;const q=new xe,I=new Y;let re=0,ie=0,se=0;s.domElement.addEventListener("pointerdown",e=>{re=performance.now(),ie=e.clientX,se=e.clientY});s.domElement.addEventListener("pointerup",e=>{performance.now()-re>350||Math.hypot(e.clientX-ie,e.clientY-se)>6||(I.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1)),q.setFromCamera(I,g),q.ray.distanceToPoint(new we)<1.6&&le())});function le(){k=1;for(let e=0;e<220;e++)_(2.4)}const He=document.querySelector("#label");function D(){d.uSeed.value=u(0,50),d.uScale.value=u(2.1,3.4),He.textContent=`Basalt crust · core ${Math.round(1080+u(0,150))} °C`}document.querySelector("#random").onclick=D;addEventListener("keydown",e=>{e.key.toLowerCase()==="r"&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.target.closest?.("input,textarea")&&D()});D();function _e(){return ye(()=>({Magma:G({Random:B(D),"Crack it open":B(le),Temperature:{value:1,min:.7,max:1.35,step:.01,onChange:e=>d.uHeat.value=e},"Crack width":{value:1,min:.3,max:3,step:.02,onChange:e=>d.uCrack.value=e},"Plate size":{value:2.6,min:1.2,max:6,step:.05,onChange:e=>d.uScale.value=e},Gloss:{value:.7,min:0,max:1,step:.01,onChange:e=>{U.clearcoat=e,m.environmentIntensity=.15+e*.3}},Smoke:{value:1,min:0,max:3,step:.05,onChange:e=>H.uniforms.uAmount.value=e},Sparks:{value:1,min:0,max:3,step:.05,onChange:e=>z.sparks=e},Spin:{value:1,min:0,max:3,step:.05,onChange:e=>{z.spin=e,v.autoRotateSpeed=.35*e}}}),Finish:G({exposure:{value:1,min:.3,max:2.5,step:.01,onChange:e=>s.toneMappingExposure=e},"tone mapping":{value:"aces",options:["aces","agx","neutral"],onChange:e=>{s.toneMapping={aces:K,agx:Ce,neutral:Pe}[e]}},bloom:{value:.85,min:0,max:3,step:.01,onChange:e=>F.strength=e},"bloom radius":{value:.6,min:0,max:1,step:.01,onChange:e=>F.radius=e},"bloom threshold":{value:.85,min:0,max:2,step:.01,onChange:e=>F.threshold=e},grain:{value:1,min:0,max:3,step:.05,onChange:e=>T.uniforms.uGrain.value=e},vignette:{value:1,min:0,max:1.5,step:.05,onChange:e=>T.uniforms.uVignette.value=e}},{collapsed:!0})}),[]),null}A||be.createRoot(document.querySelector("#controls")).render(E.createElement(E.Fragment,null,E.createElement(Me,{collapsed:!0,titleBar:{title:"Controls"}}),E.createElement(_e)));let O,c=0,ce=!1;s.setAnimationLoop(e=>{const i=O===void 0?0:Math.min((e-O)/1e3,.1);O=e;const n=ce?0:i*($.matches?.3:1);c+=n,d.uTime.value=c,T.uniforms.uTime.value=c,k=Math.max(0,k-n*.5),d.uOpen.value=k*k*(3-2*k),R.rotation.y+=n*.05*z.spin,R.rotation.x=Math.sin(c*.17)*.15,R.position.y=Math.sin(c*.5)*.04,Le.forEach((t,a)=>{const l=c*(.3+a*.13)+a*2.1;t.position.set(Math.cos(l)*1.45,Math.sin(l*1.3)*1.1,Math.sin(l)*1.45),t.intensity=(4+2.5*Math.sin(c*7+a*3)*Math.sin(c*2.3+a))*(1+d.uOpen.value*2)*d.uHeat.value});for(let t=0;t<y;t++){if(r.age[t]+=n,r.age[t]>r.life[t]){te(t);continue}const a=t*3,l=r.pos[a],f=r.pos[a+1],C=r.pos[a+2],p=Math.hypot(l,C)+.001,S=r.seed[t],h=.35/(p+.4);r.pos[a]+=(-C/p*h+l/p*.08+Math.sin(c*.5+f*2+S*9)*.06)*n,r.pos[a+1]+=(.18+.1*S)*n,r.pos[a+2]+=(l/p*h+C/p*.08+Math.cos(c*.4+f*2+S*7)*.06)*n}if(w.attributes.position.needsUpdate=!0,w.attributes.age.needsUpdate=!0,!A)for(let t=0;t<1*z.sparks*n*60;t++)Math.random()<.5&&_();for(let t=0;t<P;t++){if(o.life[t]<=0)continue;o.life[t]-=n;const a=t*3;o.vel[a+1]+=.25*n,o.vel[a]+=Math.sin(c*2+t)*.15*n,o.vel[a+2]+=Math.cos(c*1.7+t)*.15*n,o.vel[a]*=1-n*.3,o.vel[a+1]*=1-n*.3,o.vel[a+2]*=1-n*.3,o.pos[a]+=o.vel[a]*n,o.pos[a+1]+=o.vel[a+1]*n,o.pos[a+2]+=o.vel[a+2]*n}x.attributes.position.needsUpdate=!0,x.attributes.life.needsUpdate=!0,x.attributes.maxLife.needsUpdate=!0,v.update(),b.render()});if(A){c=30;for(let e=0;e<500;e++)_(1.2),o.life[L]*=Math.random();setTimeout(()=>{ce=!0,j.has("port")&&setTimeout(()=>s.domElement.toBlob(e=>fetch(`http://localhost:${j.get("port")}/`,{method:"POST",body:e}),"image/jpeg",.92),400)},2500)}
