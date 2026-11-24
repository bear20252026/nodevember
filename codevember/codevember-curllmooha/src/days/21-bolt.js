import"../lib/modulepreload-polyfill.js";import{aZ as ft,aJ as mt,E as ht,R as pt,aH as Ze,P as vt,fD as Je,V as A,p as qe,aL as gt,M as Ke,a as xt,S as et,es as wt,g5 as tt,ao as at,au as le,cx as Mt,ax as yt,ay as bt,d as St,f as ge,az as zt,c as Tt,r as ie,L as Ct,Q as ot,u as Lt,bk as At,aS as kt,aU as Dt,t as Ce,g as ce,N as qt,aX as Ft,aF as je}from"../lib/next/leva.esm.js";import{W as Bt}from"../lib/next/three.module.js";import{E as Et,S as Ht,U as Rt,O as Pt}from"../lib/next/OutputPass.js";import{a as Gt}from"../lib/next/BufferGeometryUtils.js";const fe=(e,a,r,t)=>{let o=e*374761393+a*668265263+r*2147483647+t*144665|0;return o=Math.imul(o^o>>>13,1274126177),((o^o>>>16)>>>0)/4294967295},Y=(e,a)=>(e%a+a)%a;function Wt(e,a,r,t,o){const p=Math.floor(e),s=Math.floor(a),v=Math.floor(r);let c=e-p,i=a-s,d=r-v;c=c*c*(3-2*c),i=i*i*(3-2*i),d=d*d*(3-2*d);const h=(T,w,l)=>fe(Y(p+T,t),Y(s+w,t),Y(v+l,t),o),m=(T,w,l)=>T+(w-T)*l;return m(m(m(h(0,0,0),h(1,0,0),c),m(h(0,1,0),h(1,1,0),c),i),m(m(h(0,0,1),h(1,0,1),c),m(h(0,1,1),h(1,1,1),c),i),d)}function ue(e,a,r,t,o){const p=Math.floor(e),s=Math.floor(a),v=Math.floor(r);let c=9;for(let i=-1;i<=1;i++)for(let d=-1;d<=1;d++)for(let h=-1;h<=1;h++){const m=p+i,T=s+d,w=v+h,l=Y(m,t),f=Y(T,t),D=Y(w,t),u=m+fe(l,f,D,o)-e,g=T+fe(l,f,D,o+1)-a,C=w+fe(l,f,D,o+2)-r;c=Math.min(c,u*u+g*g+C*C)}return Math.min(1,Math.sqrt(c))}function Ut(e=64){const a=new Uint8Array(e*e*e*4);for(let t=0;t<e;t++)for(let o=0;o<e;o++)for(let p=0;p<e;p++){const s=p/e,v=o/e,c=t/e;let i=0,d=.5,h=0;for(const C of[4,8,16])i+=d*Wt(s*C,v*C,c*C,C,1),h+=d,d*=.5;i/=h;const m=1-ue(s*4,v*4,c*4,4,10),T=1-ue(s*8,v*8,c*8,8,20),w=1-ue(s*16,v*16,c*16,16,30),l=1-ue(s*32,v*32,c*32,32,40),f=m*.625+T*.25+w*.125,D=Math.max(0,Math.min(1,(i-(f-1))/(2-f))),u=T*.625+w*.25+l*.125,g=(p+o*e+t*e*e)*4;a[g]=D*255,a[g+1]=u*255,a[g+2]=f*255,a[g+3]=255}for(let t=0;t<3;t++){let o=255,p=0;for(let s=t;s<a.length;s+=4)o=Math.min(o,a[s]),p=Math.max(p,a[s]);for(let s=t;s<a.length;s+=4)a[s]=(a[s]-o)/Math.max(1,p-o)*255}const r=new ft(a,e,e,e);return r.format=mt,r.minFilter=r.magFilter=ht,r.wrapS=r.wrapT=r.wrapR=pt,r.unpackAlignment=1,r.needsUpdate=!0,r}const jt=343,_t=12,_e=7;function Ot(){const e=new AudioContext,a=e.createGain();a.gain.value=.9;const r=e.createDynamicsCompressor();r.threshold.value=-16,r.ratio.value=4,r.attack.value=.004,r.release.value=.4,a.connect(r).connect(e.destination);const t=e.createConvolver(),o=e.sampleRate*5,p=e.createBuffer(2,o,e.sampleRate);for(let M=0;M<2;M++){const y=p.getChannelData(M);let q=0;for(let z=0;z<o;z++)q+=.08*(Math.random()*2-1-q),y[z]=q*3*Math.pow(1-z/o,2.6)}t.buffer=p;const s=e.createGain();s.gain.value=.55,t.connect(s).connect(a);const v=(M,y)=>{const q=e.sampleRate*M,z=e.createBuffer(2,q,e.sampleRate);for(let k=0;k<2;k++){const U=z.getChannelData(k);let P=0;for(let B=0;B<q;B++){const G=Math.random()*2-1;y==="brown"?(P=(P+.02*G)/1.02,U[B]=P*3.5):U[B]=G*.5}}return z},c=M=>{const y=e.createBufferSource();return y.buffer=M,y.loop=!0,y.start(),y},i=c(v(6,"brown")),d=e.createBiquadFilter();d.type="bandpass",d.Q.value=.7,d.frequency.value=400;const h=e.createGain();h.gain.value=0,i.connect(d).connect(h).connect(a);const m=c(v(5,"brown")),T=e.createBiquadFilter();T.type="lowpass",T.frequency.value=90;const w=e.createGain();w.gain.value=0,m.connect(T).connect(w).connect(a);const l=c(v(4,"white")),f=e.createBiquadFilter();f.type="highpass",f.frequency.value=1800;const D=e.createBiquadFilter();D.type="lowpass",D.frequency.value=7e3;const u=e.createGain();u.gain.value=0,l.connect(f).connect(D).connect(u).connect(a);let g=0;function C(M,y,q){const z=e.currentTime;g+=.016;const k=.5+.5*Math.sin(g*.7)*Math.sin(g*.23+1);h.gain.setTargetAtTime(.04+M*(.16+.14*k)+y*.25,z,.25),d.frequency.setTargetAtTime(260+500*k*(.4+M)+y*600,z,.3),w.gain.setTargetAtTime(M*.18+y*.9,z,.08),u.gain.setTargetAtTime(q*.05+M*.07,z,.4)}function R(M,y,q,z=1){const k=e.sampleRate,U=M.map(S=>S.distanceTo(y)),P=Math.min(...U),B=S=>_e*(1-Math.exp(-(S*_t/jt)/_e)),G=B(P),W=Math.ceil((B(Math.max(...U))-G+6)*k),oe=e.createBuffer(1,W,k),ne=oe.getChannelData(0),Ge=new Float32Array(W);for(let S=0;S<M.length;S++){const O=U[S],se=Math.floor((B(O)-G)*k),Ue=z*9/(6+O),K=Math.floor(k*(.006+O*45e-5)),ut=Math.exp(-O*.012)*.6+.02;let Te=0;for(let F=0;F<K*3&&se+F<W;F++){const dt=F<K?1-2*F/K:0;Te+=ut*(dt+(Math.random()*2-1)*.5*Math.exp(-F/K)-Te),ne[se+F]+=Ue*Te*Math.exp(-F/(K*1.5))}for(let F=0;F<k*.35&&se+F<W;F++)Ge[se+F]+=Ue*.5*Math.exp(-F/(k*.12))}let ye=0,be=0,Se=0;const it=P<30?.08:.025;for(let S=0;S<W;S++){be+=(Ge[S]-be)*9e-4;const O=z*.5*Math.exp(-S/(k*1.8))/(1+P*.02);ye=(ye+.02*(Math.random()*2-1))/1.02,Se+=it*(ye-Se),ne[S]=ne[S]*.8+Se*30*(be+O*(.6+.4*Math.sin(S/k*5)))}for(let S=0;S<400;S++)ne[S]*=S/400;const ze=e.createBufferSource();ze.buffer=oe;const We=e.createStereoPanner(),ct=M[Math.floor(M.length/2)];We.pan.value=Math.max(-.85,Math.min(.85,ct.clone().sub(y).normalize().dot(q)));const re=e.createGain();re.gain.value=.7,ze.connect(We).connect(re),re.connect(a),re.connect(t),ze.start(e.currentTime+G)}return{ctx:e,master:a,ambience:C,thunder:R}}const Fe=new URLSearchParams(location.search),Q=Fe.has("thumb");document.body.classList.toggle("capture",Q);const Oe=matchMedia("(prefers-reduced-motion: reduce)"),b=new Bt({antialias:!1,preserveDrawingBuffer:Q});b.setPixelRatio(Math.min(devicePixelRatio,2));b.toneMapping=Ze;b.domElement.id="view";b.domElement.setAttribute("aria-label","A night flight into a thunderstorm, through it and out again. Click to call a strike.");document.body.prepend(b.domElement);const x=new vt(58,1,.1,2e3),L={journey:1,rate:1,turbulence:1,density:1,exposure:1,bloom:.6,resolution:.5,volume:.8},n=(e=0,a=1)=>e+(a-e)*Math.random(),me=(e,a,r)=>{const t=Math.min(1,Math.max(0,(r-e)/(a-e)));return t*t*(3-2*t)},He=-720,It=720,Vt=0,pe=-45,ae=e=>1-me(105,200,Math.abs(e)),I=e=>(Math.sin(e*.045)*7+Math.sin(e*.013)*5)*ae(e),Ie=e=>7+(19+Math.cos(e*.034)*4)*ae(e),Xt=`
  float insideW(float z){ return 1. - smoothstep(105., 200., abs(z)); }
  vec2 path(float z){ float w = insideW(z); return vec2((sin(z * .045) * 7. + sin(z * .013) * 5.) * w, 7. + (19. + cos(z * .034) * 4.) * w); }`,he=4,$=new Je({depthTest:!1,depthWrite:!1,uniforms:{uNoise:{value:Ut(64)},uInvProj:{value:new qe},uCamWorld:{value:new qe},uCam:{value:new A},uTime:{value:0},uDensity:{value:1},uSun:{value:1},uHaze:{value:1},uSunDir:{value:new A(-.92,.13,.2).normalize()},uFlash:{value:Array.from({length:he},()=>new gt)}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`
    precision highp float; precision highp sampler3D;
    varying vec2 vUv;
    uniform sampler3D uNoise;
    uniform mat4 uInvProj, uCamWorld; uniform vec3 uCam;
    uniform float uTime, uDensity, uSun, uHaze;
    uniform vec3 uSunDir;
    uniform vec4 uFlash[${he}];
    ${Xt}
    const float S = 1.6;                                   // the storm's scale: big enough that it never seems to end inside
    const float GROUND = ${pe.toFixed(1)};
    const vec3 BMIN = vec3(-150., ${pe.toFixed(1)}, -245.), BMAX = vec3(390., 168., 245.);
    const vec3 SUN = vec3(1., .58, .32) * 3.6, FLASH_COL = vec3(.9, .9, 1.);
    float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float ell(vec3 q, vec3 c, vec3 r){ return 1. - length((q - c) / r); }

    // signed "inside the storm" field (storm units = world / S). Built like a real cumulonimbus:
    // a wide flat base, a tower of stacked cauliflower bubbles leaning downwind, an anvil, an overshooting top.
    float coverage(vec3 p, out float h){
      vec3 q = p / S;
      h = q.y / 100.;
      if (h < -.02 || h > 1.02) return -1.;
      float lean = h * h * 30.;
      float f = 1. - length((q.xz - vec2(lean, 0.)) * vec2(1., .85)) / (44. * (1. - .12 * h));
      f = min(f, (.8 - h) * 6.);
      f = max(f, ell(q, vec3(0., 12., 0.), vec3(62., 24., 54.)));
      f = max(f, ell(q, vec3(-18., 30., 12.), vec3(40., 30., 38.)));
      f = max(f, ell(q, vec3(18., 35., -14.), vec3(40., 30., 38.)));
      f = max(f, ell(q, vec3(6., 50., 8.), vec3(38., 26., 36.)));
      f = max(f, ell(q, vec3(-8., 62., -6.), vec3(33., 24., 32.)));
      f = max(f, ell(q, vec3(22., 67., 10.), vec3(31., 22., 30.)));
      f = max(f, ell(q, vec3(16., 77., 0.), vec3(32., 18., 30.)));
      // anvil: wide, thin, flat-topped, blown downwind (+x)
      float fa = ell(q, vec3(50., 85., 0.), vec3(105., 13., 76.));
      fa = min(fa, (91. - q.y) * .35);
      f = max(f, fa);
      f = max(f, ell(q, vec3(26., 90., 0.), vec3(24., 14., 22.)));   // overshooting top
      // younger towers around it
      f = max(f, ell(q, vec3(-52., 14., -60.), vec3(24., 28., 24.)));
      f = max(f, ell(q, vec3(30., 17., 78.), vec3(27., 34., 27.)));
      f = max(f, ell(q, vec3(-34., 10., 44.), vec3(20., 20., 20.)));
      return min(f, q.y * .2);                                         // flat base
    }
    float density(vec3 p, bool detail){
      float h; float f = coverage(p, h);
      if (f < -.55) return 0.;
      vec3 wind = vec3(uTime * .6, -uTime * .15, 0.);
      vec4 n = textureLod(uNoise, (p + wind) * .007, 0.);
      f += (n.r - .55) * .7 + (n.b - .5) * .3;          // the noise moves the surface: billows, not a blob
      if (f <= 0.) return 0.;
      if (detail){
        float det = textureLod(uNoise, (p + wind * 1.6) * .032, 0.).g;
        det = mix(1. - det, det, smoothstep(.05, .3, h));  // wispy at the base, cauliflower above
        f -= det * .22;
        if (f <= 0.) return 0.;
      }
      float d = smoothstep(0., .2, f) * (.55 + .45 * n.r);
      // deep inside: towers and pockets, so the flight has depth and gaps
      float pocket = textureLod(uNoise, (p + wind * 1.3) * .02, 0.).r;
      d *= mix(1., smoothstep(.38, .62, pocket), smoothstep(.25, .9, f) * .92);
      // the flight corridor, only once you are inside
      vec2 c = path(p.z);
      float wob = textureLod(uNoise, p * .018, 0.).b;
      float r = length((p.xy - c) * vec2(.75, 1.25));
      d *= mix(1., smoothstep(3. + 6. * wob, 11. + 10. * wob, r), smoothstep(.45, 1., insideW(p.z)));
      return d * uDensity;
    }
    vec2 box(vec3 ro, vec3 rd){
      vec3 t0 = (BMIN - ro) / rd, t1 = (BMAX - ro) / rd;
      vec3 a = min(t0, t1), b = max(t0, t1);
      return vec2(max(max(a.x, a.y), a.z), min(min(b.x, b.y), b.z));
    }
    vec3 skyCol(vec3 rd){
      float y = max(rd.y, 0.);
      // dusk, about 6 pm: deep blue overhead, apricot at the horizon, hottest toward the low sun
      vec3 zen = vec3(.07, .1, .24), mid = vec3(.36, .3, .42), hor = vec3(.98, .58, .34);
      vec3 col = mix(hor, mid, smoothstep(0., .18, y));
      col = mix(col, zen, smoothstep(.12, .75, y));
      float sd = max(dot(rd, uSunDir), 0.);
      col += vec3(1., .55, .25) * (pow(sd, 4.) * .45 + pow(sd, 40.) * .8) + vec3(1., .8, .55) * pow(sd, 800.) * 8.;
      col *= .5 + .5 * smoothstep(-.3, .2, rd.y);
      return col;
    }
    float hg(float c, float g){ float g2 = g * g; return (1. - g2) / (4. * 3.14159 * pow(1. + g2 - 2. * g * c, 1.5)); }
    vec3 flashAt(vec3 p, bool shadowed){
      vec3 L = vec3(0.);
      for (int k = 0; k < ${he}; k++){
        float I = uFlash[k].w; if (I < .01) continue;
        vec3 v = uFlash[k].xyz - p; float dist = length(v);
        float atten = I / (1. + dist * dist * .02);
        float od;
        if (k == 0 && shadowed){
          vec3 dir = v / dist; float stepL = min(dist, 70.) / 5.; od = 0.;
          for (int s = 1; s <= 5; s++) od += density(p + dir * stepL * (float(s) - .5), false) * stepL;
          od *= .32;
        } else od = dist * .035 * uDensity;
        L += FLASH_COL * atten * (exp(-od) + .3 * exp(-od * .2));
      }
      return L / (1. + .12 * dot(L, vec3(.33)));
    }
    void main(){
      vec4 view = uInvProj * vec4(vUv * 2. - 1., 1., 1.); view /= view.w;
      vec3 rd = normalize((uCamWorld * vec4(view.xyz, 0.)).xyz), ro = uCam;
      vec2 tb = box(ro, rd);
      float tGround = rd.y < 0. ? (GROUND - ro.y) / rd.y : 1e5;
      float tEnd = min(tb.y, tGround);
      float cosSun = dot(rd, uSunDir);
      float phase = mix(hg(cosSun, .55), hg(cosSun, -.2), .45) * 4. * 3.14159;   // silver lining toward the sun
      vec3 col = vec3(0.); float Tr = 1., tHalf = 6e4;
      if (tb.x < tb.y && tb.y > 0.){
        float t = max(tb.x, 0.) + hash(vec3(gl_FragCoord.xy, fract(uTime * 7.))) * 1.2;
        for (int i = 0; i < 160; i++){
          if (t > tEnd) break;
          vec3 p = ro + rd * t;
          float dt = max(.45, t * .01);
          float d = density(p, true);
          if (p.y < 0. && p.y > GROUND){                   // rain shafts under the base
            float hb; float cb = clamp(coverage(vec3(p.x, 2., p.z), hb) * 3., 0., 1.);
            float streak = textureLod(uNoise, vec3(p.x * .02, p.y * .002 + uTime * .25, p.z * .02), 0.).g;
            d += cb * smoothstep(.45, .8, streak) * .03;
          }
          if (d > .002){
            float h = clamp(p.y / 160., 0., 1.);
            float sigma = d * .55;
            // sunlight: march toward the sun through the storm — this is what makes the tops white and the base dark
            float od = 0., sl = 4.;
            for (int s = 0; s < 6; s++){ od += density(p + uSunDir * sl, false) * sl; sl *= 1.75; }
            od *= .7;
            float beer = exp(-od), powder = 1. - exp(-sigma * 8.);
            vec3 sun = SUN * uSun * (beer * phase * mix(1., powder, .5) + .25 * exp(-od * .25));
            vec3 amb = mix(vec3(.025, .025, .04), vec3(.2, .2, .32), h * h) * (.25 + .75 * exp(-od * .12));
            vec3 Sc = (sun + amb + flashAt(p, true)) * sigma;
            float ext = exp(-sigma * dt);
            col += Tr * (Sc - Sc * ext) / max(sigma, 1e-4);
            Tr *= ext;
            if (Tr < .5 && tHalf > 5e4) tHalf = t;
            if (Tr < .01) break;
          } else dt *= 2.4;
          t += dt;
        }
      }
      // aerial perspective: distant cloud fades into the haze
      vec3 haze = mix(vec3(.55, .42, .45), vec3(.95, .6, .4), pow(max(dot(normalize(vec3(rd.x, 0., rd.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 3.));
      float fog = 1. - exp(-min(tHalf, 3000.) * .00045 * uHaze);
      col = mix(col, haze * (1. - Tr), fog);
      vec3 bg;
      if (tGround < 1e4){
        vec3 g = ro + rd * tGround;
        float hb; float under = clamp(coverage(vec3(g.x, 2., g.z), hb) * 2. + .2, 0., 1.);   // the storm's shadow
        vec3 field = mix(vec3(.10, .11, .08), vec3(.16, .13, .09), textureLod(uNoise, g * .004, 0.).r);
        bg = field * mix(1., .3, under) + flashAt(g + vec3(0., 2., 0.), false) * .06;
        bg = mix(bg, haze, 1. - exp(-tGround * .00035 * uHaze));
        if (tHalf > 5e4) tHalf = min(tHalf, tGround);
      } else bg = skyCol(rd);
      col += Tr * bg;
      gl_FragColor = vec4(col, tHalf);
    }`}),nt=new Ke(new xt(2,2),$);nt.frustumCulled=!1;const rt=new et;rt.add(nt);const Nt=new wt,xe=new tt(2,2,{type:at,depthBuffer:!1}),Re=new et,we=new tt(2,2,{type:at,depthBuffer:!1}),Yt=new Je({transparent:!0,depthTest:!1,depthWrite:!1,side:St,blending:bt,blendEquation:yt,blendSrc:le,blendDst:le,blendEquationAlpha:Mt,blendSrcAlpha:le,blendDstAlpha:le,uniforms:{uLead:{value:0},uStroke:{value:0},uBranch:{value:1},uLeader:{value:1}},vertexShader:`
    attribute float aT; attribute float aMain; attribute float aHalo;
    varying float vT, vMain, vHalo, vDist;
    void main(){ vT = aT; vMain = aMain; vHalo = aHalo; vec4 mv = modelViewMatrix * vec4(position, 1.); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,fragmentShader:`
    uniform float uLead, uStroke, uBranch, uLeader;
    varying float vT, vMain, vHalo, vDist;
    void main(){
      if (vT > uLead) discard;
      float tip = exp(-(uLead - vT) * 30.);                  // the searching tips glow
      float leader = uLeader * (.05 + 1.4 * tip);
      float stroke = uStroke * (vMain > .5 ? 1. : uBranch * .3);
      float I = (leader + stroke * 14.) * (vHalo > .5 ? .05 : 1.);
      vec3 col = mix(vec3(.82, .86, 1.), vec3(.62, .58, 1.), vHalo) * I;
      gl_FragColor = vec4(col, 1. / (1. + vDist * .01));
    }`});function Ve(e,a,r,t){let o=[e,a];for(let p=0;p<t;p++){const s=[o[0]];for(let v=1;v<o.length;v++){const c=o[v-1],i=o[v],d=c.distanceTo(i),h=i.clone().sub(c).normalize(),m=new A(n(-1,1),n(-1,1),n(-1,1)).projectOnPlane(h).normalize();s.push(c.clone().lerp(i,n(.35,.65)).addScaledVector(m,d*r*n(.2,1)),i)}o=s}return o}const $t=e=>e.reduce((a,r,t)=>t?a+r.distanceTo(e[t-1]):0,0);function de(e,a,r,t,o,p){const s=new At;for(let m=1;m<e.length;m++)s.add(new kt(e[m-1],e[m]));const v=e.length*2,c=p?6:4,i=new Dt(s,v,a,c,!1),d=i.attributes.position.count,h=new Float32Array(d);for(let m=0;m<d;m++)h[m]=r+Math.floor(m/(c+1))/v*t;return i.setAttribute("aT",new Ce(h,1)),i.setAttribute("aMain",new Ce(new Float32Array(d).fill(o),1)),i.setAttribute("aHalo",new Ce(new Float32Array(d).fill(p),1)),i.deleteAttribute("uv"),i.deleteAttribute("normal"),i}const V=[],ee=[];let X=0,E=null,Me=!1;function Z(e,a){const r=x.position;let t,o,p=.2;if(e==="cg"){const u=n(0,Math.PI*2),g=n(0,70),C=a?a.x:15+Math.cos(u)*g,R=a?a.z:Math.sin(u)*g*1.2;t=new A(C+n(-6,6),Vt+n(6,26),R+n(-6,6)),o=new A(C+n(-25,25),pe,R+n(-25,25))}else{const u=e==="near",g=u?r.z+n(14,45):n(-100,100),C=u?r.y+n(-6,10):n(15,115),R=u?I(g)+(Math.random()<.5?-1:1)*n(8,18):n(-45,140),M=new A(n(-1,1),n(-.5,.2),n(-1,1)).normalize(),y=u?n(25,50):n(60,170);t=new A(R,C,g).addScaledVector(M,-y/2),o=new A(R,C,g).addScaledVector(M,y/2),p=.26}const s=Ve(t,o,p,7),v=$t(s),c=t.clone().lerp(o,.5).distanceTo(r),i=Math.max(.05,c*.0016),d=[de(s,i,0,1,1,0),de(s,i*7,0,1,1,1)],h=[0];for(let u=1;u<s.length;u++)h.push(h[u-1]+s[u].distanceTo(s[u-1]));const m=(u,g,C,R)=>{const M=Math.round(R?n(1,3):n(5,11));for(let y=0;y<M;y++){const q=Math.floor(n(.04,.8)*(u.length-1)),z=u[q],U=u[Math.min(u.length-1,q+1)].clone().sub(z).normalize().add(new A(n(-1,1),n(-.6,.3),n(-1,1)).multiplyScalar(1.3)).normalize(),P=v*n(.06,.22)*C,B=Ve(z.clone(),z.clone().addScaledVector(U,P),.28,5),G=g(q),W=P/v*n(1.1,1.6);d.push(de(B,i*.55,G,W,0,0),de(B,i*4,G,W,0,1)),R||m(B,oe=>G+oe/(B.length-1)*W,.5,1)}};m(s,u=>h[u]/v,1,0);const T=Gt(d);d.forEach(u=>u.dispose());const w=Yt.clone(),l=new Ke(T,w);l.frustumCulled=!1,Re.add(l);const f=[0];if(e==="cg")for(let u=0,g=Math.floor(n(1,5));u<g;u++)f.push(f.at(-1)+n(.045,.13));else for(let u=0,g=Math.floor(n(2,6));u<g;u++)f.push(f.at(-1)+n(.03,.09));const D={mesh:l,mat:w,main:s,kind:e,t:0,lead:e==="cg"?n(.16,.3):n(.12,.22),strokes:f,power:n(.8,1.25)*(e==="near"?1.2:1),lum:0,light:s[Math.floor(s.length*(e==="cg"?.12:.5))],long:e==="cg"&&Math.random()<.3};return D.jolt=L.turbulence*D.power*Math.max(.05,1.3-c/70),V.push(D),D}function Be(e){const a=e?x.position.z+n(-20,60):n(-110,110),r=e?new A(I(a)+n(-35,35),x.position.y+n(-15,25),a):new A(n(-45,150),n(12,125),a);ee.push({p:r,t:0,power:n(.4,1.3),f:n(4,12),life:n(.25,.7)})}function Qt(e,a){e.t+=a;const r=e.t/e.lead,t=e.t-e.lead;let o=0;if(t>=0){for(const p of e.strokes){const s=t-p;s>=0&&(o=Math.max(o,Math.exp(-s/.038)*(p?n(.6,.9):1)))}if(e.long&&(o=Math.max(o,.35*Math.exp(-t/.35)*(.85+.15*Math.sin(t*70)))),!e.struck&&(e.struck=!0,X=Math.min(1,X+e.jolt),E&&Me)){const p=new A().setFromMatrixColumn(x.matrixWorld,0);E.thunder(e.main.filter((s,v)=>v%3===0),x.position.clone(),p,e.power*(e.kind==="cg"?1.2:.8))}}return e.mat.uniforms.uLead.value=t>=0?2:r,e.mat.uniforms.uLeader.value=t>=0?Math.exp(-t/.05):1,e.mat.uniforms.uStroke.value=o*e.power,e.mat.uniforms.uBranch.value=t>=0?Math.exp(-t/.06):1,e.lum=(t<0?.04*r:o)*e.power,t>e.strokes.at(-1)+(e.long?1.2:.45)?(Re.remove(e.mesh),e.mesh.geometry.dispose(),e.mat.dispose(),!1):!0}const J=new Et(b),te=new Ht({uniforms:{tDiffuse:{value:null},tCloud:{value:xe.texture},tBolt:{value:we.texture},uFade:{value:1},uExposure:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`
    uniform sampler2D tCloud, tBolt; uniform float uFade, uExposure; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tCloud, vUv), b = texture2D(tBolt, vUv);
      float bd = b.a > 1e-4 ? (1. / b.a - 1.) * 100. : 1e5;
      float vis = exp(-max(0., bd - c.a) * .07);
      vec3 col = (c.rgb + b.rgb * vis) * uExposure;
      gl_FragColor = vec4(col * uFade, 1.);
    }`});te.uniforms.tCloud.value=xe.texture;te.uniforms.tBolt.value=we.texture;J.addPass(te);const ve=new Rt(new ge(256,256),.6,.5,.9);J.addPass(ve);J.addPass(new Pt);function Pe(){x.aspect=innerWidth/innerHeight,x.updateProjectionMatrix(),b.setSize(innerWidth,innerHeight),J.setPixelRatio(b.getPixelRatio()),J.setSize(innerWidth,innerHeight);const e=b.getPixelRatio();xe.setSize(Math.max(2,Math.floor(innerWidth*e*L.resolution)),Math.max(2,Math.floor(innerHeight*e*L.resolution))),we.setSize(Math.floor(innerWidth*e),Math.floor(innerHeight*e))}addEventListener("resize",Pe);Pe();const Ee=document.querySelector("#sound");function Zt(e){e&&!E&&(E=Ot()),E&&(e?E.ctx.resume():E.ctx.suspend(),E.master.gain.value=L.volume),Me=e,Ee.setAttribute("aria-pressed",e),Ee.querySelector("span").textContent=e?"Sound on":"Sound off"}Ee.onclick=()=>Zt(!Me);const st=new ge,Le=new ge;addEventListener("pointermove",e=>st.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1));b.domElement.addEventListener("pointerdown",e=>{const a=new zt;if(a.setFromCamera(new ge(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1)),x),ae(x.position.z)>.5)Z("near");else{const r=a.ray.direction.y<0?(pe-a.ray.origin.y)/a.ray.direction.y:200,t=a.ray.at(Math.min(r,400),new A);t.x=Math.max(-60,Math.min(110,t.x)),t.z=Math.max(-90,Math.min(90,t.z)),Z("cg",t)}});let N=He,H=0;function Jt(){N=He,H=-1}function Kt(){return Lt(()=>({Storm:ce({Strike:je(()=>Z(ae(x.position.z)>.5?"near":"cg")),"Restart journey":je(Jt),"Journey speed":{value:1,min:0,max:3,step:.05,onChange:e=>L.journey=e},"Strike rate":{value:1,min:0,max:4,step:.05,onChange:e=>L.rate=e},Turbulence:{value:1,min:0,max:2.5,step:.05,onChange:e=>L.turbulence=e},Volume:{value:.8,min:0,max:1.5,step:.05,onChange:e=>{L.volume=e,E&&(E.master.gain.value=e)}}}),Sky:ce({"Sun height":{value:.13,min:.02,max:.8,step:.01,onChange:e=>$.uniforms.uSunDir.value.set(-.92,e,.2).normalize()},Sunlight:{value:1,min:0,max:2,step:.02,onChange:e=>$.uniforms.uSun.value=e},Haze:{value:1,min:0,max:3,step:.02,onChange:e=>$.uniforms.uHaze.value=e},"Cloud density":{value:1,min:.4,max:2,step:.02,onChange:e=>L.density=e}},{collapsed:!0}),Finish:ce({exposure:{value:1,min:.3,max:2.5,step:.01,onChange:e=>b.toneMappingExposure=e},"tone mapping":{value:"aces",options:["aces","agx","neutral"],onChange:e=>{b.toneMapping={aces:Ze,agx:Ft,neutral:qt}[e]}},bloom:{value:.6,min:0,max:2.5,step:.01,onChange:e=>L.bloom=e},"bloom radius":{value:.5,min:0,max:1,step:.01,onChange:e=>ve.radius=e},"bloom threshold":{value:.9,min:0,max:2,step:.01,onChange:e=>ve.threshold=e}},{collapsed:!0}),Performance:ce({"Cloud resolution":{value:.5,min:.25,max:1,step:.05,onChange:e=>{L.resolution=e,Pe()}}},{collapsed:!0})}),[]),null}Q||Tt.createRoot(document.querySelector("#controls")).render(ie.createElement(ie.Fragment,null,ie.createElement(Ct,{collapsed:!0,titleBar:{title:"Controls"}}),ie.createElement(Kt)));const ea=new A(40,60,0),Ae=new ot,ke=new ot,Xe=new qe,ta=new A,aa=new A(0,1,0),j=e=>Math.sin(e*1.7)*.5+Math.sin(e*3.1+1.3)*.3+Math.sin(e*7.3+2.1)*.2;let De,_=0,Ne=.8,Ye=.2,lt=!1,$e=!0;const Qe=$.uniforms.uFlash.value;b.setAnimationLoop(e=>{const a=De===void 0?0:Math.min((e-De)/1e3,.1);De=e;const r=lt?0:a;_+=r;const t=N,o=ae(t);Q||(N+=r*L.journey*(Oe.matches?.3:1)*(4+26*(1-o))),N>It&&H>=0?(H+=a*1.4,H>=1&&(N=He,H=-1)):H<0&&(H=Math.min(0,H+a*1.2));const p=H>0?1-H:1+H,s=L.rate*(Oe.matches?.3:1);if(!Q){if((Ne-=r*s)<0){const l=Math.random();o>.5?Z(l<.55?"near":l<.8?"ic":"cg"):Z(l<.65?"cg":"ic"),Ne=n(.5,o>.5?2.2:3)}(Ye-=r*s)<0&&(Be(o>.5&&Math.random()<.6),Ye=n(.12,.9))}x.position.set(I(t),Ie(t),t),Le.lerp(st,1-Math.exp(-a*2.5));const v=t+10,c=ta.set(I(v),Ie(v),v),i=1-me(-240,-150,t)+me(170,300,t);c.lerp(ea,Math.min(1,i)),c.x+=Le.x*18*(1+i*2),c.y-=Le.y*10*(1+i*1.5),Xe.lookAt(x.position,c,aa),Ae.setFromRotationMatrix(Xe),$e&&(ke.copy(Ae),$e=!1),ke.slerp(Ae,1-Math.exp(-a*2.2)),x.quaternion.copy(ke),x.rotateZ((I(t+6)-I(t))*-.06),X=Math.max(0,X-a*.8);const d=X*X,h=L.turbulence*(.003+.016*o),m=_*24;x.rotateX(h*j(_*2.3)+d*.06*j(m)),x.rotateY(h*j(_*1.9+9)+d*.06*j(m+40)),x.rotateZ(h*.6*j(_*1.3+4)+d*.08*j(m+80)),x.translateY(d*.35*j(m+160)+h*8*j(_*3.1+7)),x.updateMatrixWorld();for(let l=V.length-1;l>=0;l--)Qt(V[l],r)||V.splice(l,1);for(let l=ee.length-1;l>=0;l--){const f=ee[l];f.t+=r,f.lum=f.power*Math.exp(-f.t/(f.life*.4))*(.4+.6*Math.sin(f.t*f.f*6.28)**2)*.5,f.t>f.life*2&&ee.splice(l,1)}const T=[...V.map(l=>({p:l.light,lum:l.lum*(l.kind==="near"?.3:1)})),...ee.map(l=>({p:l.p,lum:l.lum}))].sort((l,f)=>f.lum-l.lum);for(let l=0;l<he;l++){const f=T[l];f?Qe[l].set(f.p.x,f.p.y,f.p.z,f.lum*260):Qe[l].set(0,0,0,0)}E&&Me&&E.ambience(o,d,1-me(60,200,Math.abs(t)));const w=$.uniforms;w.uTime.value=_,w.uDensity.value=L.density,w.uCam.value.copy(x.position),w.uCamWorld.value.copy(x.matrixWorld),w.uInvProj.value.copy(x.projectionMatrixInverse),b.setRenderTarget(xe),b.render(rt,Nt),b.setRenderTarget(we),b.setClearColor(0,0),b.clear(),b.render(Re,x),b.setRenderTarget(null),te.uniforms.uFade.value=p,te.uniforms.uExposure.value=L.exposure,ve.strength=L.bloom,J.render()});Q&&(N=-430,setTimeout(()=>{Z("cg",new A(20,0,-40)),Be(!1),Be(!1),V.at(-1).lead=.001,setTimeout(()=>{lt=!0,Fe.has("port")&&setTimeout(()=>b.domElement.toBlob(e=>fetch(`http://localhost:${Fe.get("port")}/`,{method:"POST",body:e}),"image/jpeg",.92),400)},75)},1500));
