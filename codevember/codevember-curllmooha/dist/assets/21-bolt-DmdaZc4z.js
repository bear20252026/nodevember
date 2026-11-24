import"./modulepreload-polyfill-ulV_1b7r.js";import{V as dt,w as me,p as ht,z as Ke,u as pt,P as Qe,B as E,a as Be,R as vt,i as et,O as gt,o as tt,F as xt,S as ot,N as at,f as ie,c as bt,v as wt,r as yt,t as Mt,Z as Tt,K as zt,b as St,d as ge,$ as At,e as Ct,g as kt,h as se,j as Et,k as nt,l as Bt,m as Ht,E as Rt,M as Gt,n as Dt,J as qt,W as Ft,I as Ut,q as le,s as Pt,D as Lt,x as Ne}from"./OutputPass-CXTxn5cG.js";function Wt(e,a=!1){const n=e[0].index!==null,o=new Set(Object.keys(e[0].attributes)),r=new Set(Object.keys(e[0].morphAttributes)),h={},i={},p=e[0].morphTargetsRelative,u=new dt;u.morphTargetsRelative=p;let d=0;for(let t=0;t<e.length;++t){const s=e[t];let c=0,x=0;if(n!==(s.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const l in s.attributes){if(!o.has(l))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+'. All geometries must have compatible attributes; make sure "'+l+'" attribute exists among all geometries, or in none of them.'),null;h[l]===void 0&&(h[l]=[]),h[l].push(s.attributes[l]),c++}if(c!==o.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". Make sure all geometries have the same number of attributes."),null;if(p!==s.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const l in s.morphAttributes){if(!r.has(l))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+".  .morphAttributes must be consistent throughout all geometries."),null;if(s.morphAttributes[l].length!==e[0].morphAttributes[l].length)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+'. All geometries must have the same number of morph targets for the "'+l+'" morph attribute.'),null;i[l]===void 0&&(i[l]=[]),i[l].push(s.morphAttributes[l]),x++}if(x!==r.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". Make sure all geometries have the same number of morph attributes."),null;if(a){let l;if(n)l=s.index.count;else if(s.attributes.position!==void 0)l=s.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+t+". The geometry must have either an index or a position attribute"),null;u.addGroup(d,l,t),d+=l}}if(n){let t=0;const s=[];for(let c=0;c<e.length;++c){const x=e[c].index;for(let l=0;l<x.count;++l)s.push(x.getX(l)+t);t+=e[c].attributes.position.count}u.setIndex(s)}for(const t in h){const s=je(h[t]);if(!s)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" attribute."),null;u.setAttribute(t,s)}for(const t in i){const s=i[t][0].length;if(s!==0){u.morphAttributes=u.morphAttributes||{},u.morphAttributes[t]=[];for(let c=0;c<s;++c){const x=[];for(let m=0;m<i[t].length;++m)x.push(i[t][m][c]);const l=je(x);if(!l)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+t+" morphAttribute."),null;u.morphAttributes[t].push(l)}}}return u}function je(e){let a,n,o,r=-1,h=0;for(let d=0;d<e.length;++d){const t=e[d];if(a===void 0&&(a=t.array.constructor),a!==t.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(n===void 0&&(n=t.itemSize),n!==t.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(o===void 0&&(o=t.normalized),o!==t.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(r===-1&&(r=t.gpuType),r!==t.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;h+=t.count*n}const i=new a(h),p=new me(i,n,o);let u=0;for(let d=0;d<e.length;++d){const t=e[d];if(t.isInterleavedBufferAttribute){const s=u/n;for(let c=0,x=t.count;c<x;c++)for(let l=0;l<n;l++){const m=t.getComponent(c,l);p.setComponent(c+s,l,m)}}else i.set(t.array,u);u+=t.count*n}return r!==void 0&&(p.gpuType=r),p}const fe=(e,a,n,o)=>{let r=e*374761393+a*668265263+n*2147483647+o*144665|0;return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967295},X=(e,a)=>(e%a+a)%a;function Nt(e,a,n,o,r){const h=Math.floor(e),i=Math.floor(a),p=Math.floor(n);let u=e-h,d=a-i,t=n-p;u=u*u*(3-2*u),d=d*d*(3-2*d),t=t*t*(3-2*t);const s=(x,l,m)=>fe(X(h+x,o),X(i+l,o),X(p+m,o),r),c=(x,l,m)=>x+(l-x)*m;return c(c(c(s(0,0,0),s(1,0,0),u),c(s(0,1,0),s(1,1,0),u),d),c(c(s(0,0,1),s(1,0,1),u),c(s(0,1,1),s(1,1,1),u),d),t)}function ue(e,a,n,o,r){const h=Math.floor(e),i=Math.floor(a),p=Math.floor(n);let u=9;for(let d=-1;d<=1;d++)for(let t=-1;t<=1;t++)for(let s=-1;s<=1;s++){const c=h+d,x=i+t,l=p+s,m=X(c,o),g=X(x,o),B=X(l,o),v=c+fe(m,g,B,r)-e,b=x+fe(m,g,B,r+1)-a,A=l+fe(m,g,B,r+2)-n;u=Math.min(u,v*v+b*b+A*A)}return Math.min(1,Math.sqrt(u))}function jt(e=64){const a=new Uint8Array(e*e*e*4);for(let o=0;o<e;o++)for(let r=0;r<e;r++)for(let h=0;h<e;h++){const i=h/e,p=r/e,u=o/e;let d=0,t=.5,s=0;for(const A of[4,8,16])d+=t*Nt(i*A,p*A,u*A,A,1),s+=t,t*=.5;d/=s;const c=1-ue(i*4,p*4,u*4,4,10),x=1-ue(i*8,p*8,u*8,8,20),l=1-ue(i*16,p*16,u*16,16,30),m=1-ue(i*32,p*32,u*32,32,40),g=c*.625+x*.25+l*.125,B=Math.max(0,Math.min(1,(d-(g-1))/(2-g))),v=x*.625+l*.25+m*.125,b=(h+r*e+o*e*e)*4;a[b]=B*255,a[b+1]=v*255,a[b+2]=g*255,a[b+3]=255}for(let o=0;o<3;o++){let r=255,h=0;for(let i=o;i<a.length;i+=4)r=Math.min(r,a[i]),h=Math.max(h,a[i]);for(let i=o;i<a.length;i+=4)a[i]=(a[i]-r)/Math.max(1,h-r)*255}const n=new Bt(a,e,e,e);return n.format=Ht,n.minFilter=n.magFilter=Rt,n.wrapS=n.wrapT=n.wrapR=Gt,n.unpackAlignment=1,n.needsUpdate=!0,n}const It=343,Ot=12,Ie=7;function $t(){const e=new AudioContext,a=e.createGain();a.gain.value=.9;const n=e.createDynamicsCompressor();n.threshold.value=-16,n.ratio.value=4,n.attack.value=.004,n.release.value=.4,a.connect(n).connect(e.destination);const o=e.createConvolver(),r=e.sampleRate*5,h=e.createBuffer(2,r,e.sampleRate);for(let y=0;y<2;y++){const M=h.getChannelData(y);let H=0;for(let S=0;S<r;S++)H+=.08*(Math.random()*2-1-H),M[S]=H*3*Math.pow(1-S/r,2.6)}o.buffer=h;const i=e.createGain();i.gain.value=.55,o.connect(i).connect(a);const p=(y,M)=>{const H=e.sampleRate*y,S=e.createBuffer(2,H,e.sampleRate);for(let C=0;C<2;C++){const L=S.getChannelData(C);let G=0;for(let D=0;D<H;D++){const P=Math.random()*2-1;M==="brown"?(G=(G+.02*P)/1.02,L[D]=G*3.5):L[D]=P*.5}}return S},u=y=>{const M=e.createBufferSource();return M.buffer=y,M.loop=!0,M.start(),M},d=u(p(6,"brown")),t=e.createBiquadFilter();t.type="bandpass",t.Q.value=.7,t.frequency.value=400;const s=e.createGain();s.gain.value=0,d.connect(t).connect(s).connect(a);const c=u(p(5,"brown")),x=e.createBiquadFilter();x.type="lowpass",x.frequency.value=90;const l=e.createGain();l.gain.value=0,c.connect(x).connect(l).connect(a);const m=u(p(4,"white")),g=e.createBiquadFilter();g.type="highpass",g.frequency.value=1800;const B=e.createBiquadFilter();B.type="lowpass",B.frequency.value=7e3;const v=e.createGain();v.gain.value=0,m.connect(g).connect(B).connect(v).connect(a);let b=0;function A(y,M,H){const S=e.currentTime;b+=.016;const C=.5+.5*Math.sin(b*.7)*Math.sin(b*.23+1);s.gain.setTargetAtTime(.04+y*(.16+.14*C)+M*.25,S,.25),t.frequency.setTargetAtTime(260+500*C*(.4+y)+M*600,S,.3),l.gain.setTargetAtTime(y*.18+M*.9,S,.08),v.gain.setTargetAtTime(H*.05+y*.07,S,.4)}function U(y,M,H,S=1){const C=e.sampleRate,L=y.map(z=>z.distanceTo(M)),G=Math.min(...L),D=z=>Ie*(1-Math.exp(-(z*Ot/It)/Ie)),P=D(G),N=Math.ceil((D(Math.max(...L))-P+6)*C),Ue=e.createBuffer(1,N,C),ae=Ue.getChannelData(0),Pe=new Float32Array(N);for(let z=0;z<y.length;z++){const I=L[z],re=Math.floor((D(I)-P)*C),We=S*9/(6+I),Q=Math.floor(C*(.006+I*45e-5)),mt=Math.exp(-I*.012)*.6+.02;let Se=0;for(let R=0;R<Q*3&&re+R<N;R++){const ft=R<Q?1-2*R/Q:0;Se+=mt*(ft+(Math.random()*2-1)*.5*Math.exp(-R/Q)-Se),ae[re+R]+=We*Se*Math.exp(-R/(Q*1.5))}for(let R=0;R<C*.35&&re+R<N;R++)Pe[re+R]+=We*.5*Math.exp(-R/(C*.12))}let ye=0,Me=0,Te=0;const ut=G<30?.08:.025;for(let z=0;z<N;z++){Me+=(Pe[z]-Me)*9e-4;const I=S*.5*Math.exp(-z/(C*1.8))/(1+G*.02);ye=(ye+.02*(Math.random()*2-1))/1.02,Te+=ut*(ye-Te),ae[z]=ae[z]*.8+Te*30*(Me+I*(.6+.4*Math.sin(z/C*5)))}for(let z=0;z<400;z++)ae[z]*=z/400;const ze=e.createBufferSource();ze.buffer=Ue;const Le=e.createStereoPanner(),ct=y[Math.floor(y.length/2)];Le.pan.value=Math.max(-.85,Math.min(.85,ct.clone().sub(M).normalize().dot(H)));const ne=e.createGain();ne.gain.value=.7,ze.connect(Le).connect(ne),ne.connect(a),ne.connect(o),ze.start(e.currentTime+P)}return{ctx:e,master:a,ambience:A,thunder:U}}const He=new URLSearchParams(location.search),J=He.has("thumb");document.body.classList.toggle("capture",J);const Oe=matchMedia("(prefers-reduced-motion: reduce)"),T=new ht({antialias:!1,preserveDrawingBuffer:J});T.setPixelRatio(Math.min(devicePixelRatio,2));T.toneMapping=Ke;T.domElement.id="view";T.domElement.setAttribute("aria-label","A night flight into a thunderstorm, through it and out again. Click to call a strike.");document.body.prepend(T.domElement);const w=new pt(58,1,.1,2e3),k={journey:1,rate:1,turbulence:1,density:1,exposure:1,bloom:.6,resolution:.5,volume:.8},f=(e=0,a=1)=>e+(a-e)*Math.random(),de=(e,a,n)=>{const o=Math.min(1,Math.max(0,(n-e)/(a-e)));return o*o*(3-2*o)},De=-720,Vt=720,_t=0,pe=-45,oe=e=>1-de(105,200,Math.abs(e)),O=e=>(Math.sin(e*.045)*7+Math.sin(e*.013)*5)*oe(e),$e=e=>7+(19+Math.cos(e*.034)*4)*oe(e),Xt=`
  float insideW(float z){ return 1. - smoothstep(105., 200., abs(z)); }
  vec2 path(float z){ float w = insideW(z); return vec2((sin(z * .045) * 7. + sin(z * .013) * 5.) * w, 7. + (19. + cos(z * .034) * 4.) * w); }`,he=4,Y=new Qe({depthTest:!1,depthWrite:!1,uniforms:{uNoise:{value:jt(64)},uInvProj:{value:new Be},uCamWorld:{value:new Be},uCam:{value:new E},uTime:{value:0},uDensity:{value:1},uSun:{value:1},uHaze:{value:1},uSunDir:{value:new E(-.92,.13,.2).normalize()},uFlash:{value:Array.from({length:he},()=>new vt)}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`
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
    }`}),rt=new et(new gt(2,2),Y);rt.frustumCulled=!1;const it=new tt;it.add(rt);const Yt=new xt,xe=new ot(2,2,{type:at,depthBuffer:!1}),qe=new tt,be=new ot(2,2,{type:at,depthBuffer:!1}),Jt=new Qe({transparent:!0,depthTest:!1,depthWrite:!1,side:Mt,blending:yt,blendEquation:wt,blendSrc:ie,blendDst:ie,blendEquationAlpha:bt,blendSrcAlpha:ie,blendDstAlpha:ie,uniforms:{uLead:{value:0},uStroke:{value:0},uBranch:{value:1},uLeader:{value:1}},vertexShader:`
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
    }`});function Ve(e,a,n,o){let r=[e,a];for(let h=0;h<o;h++){const i=[r[0]];for(let p=1;p<r.length;p++){const u=r[p-1],d=r[p],t=u.distanceTo(d),s=d.clone().sub(u).normalize(),c=new E(f(-1,1),f(-1,1),f(-1,1)).projectOnPlane(s).normalize();i.push(u.clone().lerp(d,f(.35,.65)).addScaledVector(c,t*n*f(.2,1)),d)}r=i}return r}const Zt=e=>e.reduce((a,n,o)=>o?a+n.distanceTo(e[o-1]):0,0);function ce(e,a,n,o,r,h){const i=new qt;for(let c=1;c<e.length;c++)i.add(new Ft(e[c-1],e[c]));const p=e.length*2,u=h?6:4,d=new Ut(i,p,a,u,!1),t=d.attributes.position.count,s=new Float32Array(t);for(let c=0;c<t;c++)s[c]=n+Math.floor(c/(u+1))/p*o;return d.setAttribute("aT",new me(s,1)),d.setAttribute("aMain",new me(new Float32Array(t).fill(r),1)),d.setAttribute("aHalo",new me(new Float32Array(t).fill(h),1)),d.deleteAttribute("uv"),d.deleteAttribute("normal"),d}const $=[],ee=[];let V=0,q=null,we=!1;function Z(e,a){const n=w.position;let o,r,h=.2;if(e==="cg"){const v=f(0,Math.PI*2),b=f(0,70),A=a?a.x:15+Math.cos(v)*b,U=a?a.z:Math.sin(v)*b*1.2;o=new E(A+f(-6,6),_t+f(6,26),U+f(-6,6)),r=new E(A+f(-25,25),pe,U+f(-25,25))}else{const v=e==="near",b=v?n.z+f(14,45):f(-100,100),A=v?n.y+f(-6,10):f(15,115),U=v?O(b)+(Math.random()<.5?-1:1)*f(8,18):f(-45,140),y=new E(f(-1,1),f(-.5,.2),f(-1,1)).normalize(),M=v?f(25,50):f(60,170);o=new E(U,A,b).addScaledVector(y,-M/2),r=new E(U,A,b).addScaledVector(y,M/2),h=.26}const i=Ve(o,r,h,7),p=Zt(i),u=o.clone().lerp(r,.5).distanceTo(n),d=Math.max(.05,u*.0016),t=[ce(i,d,0,1,1,0),ce(i,d*7,0,1,1,1)],s=[0];for(let v=1;v<i.length;v++)s.push(s[v-1]+i[v].distanceTo(i[v-1]));const c=(v,b,A,U)=>{const y=Math.round(U?f(1,3):f(5,11));for(let M=0;M<y;M++){const H=Math.floor(f(.04,.8)*(v.length-1)),S=v[H],C=v[Math.min(v.length-1,H+1)].clone().sub(S).normalize().add(new E(f(-1,1),f(-.6,.3),f(-1,1)).multiplyScalar(1.3)).normalize(),L=p*f(.06,.22)*A,G=Ve(S.clone(),S.clone().addScaledVector(C,L),.28,5),D=b(H),P=L/p*f(1.1,1.6);t.push(ce(G,d*.55,D,P,0,0),ce(G,d*4,D,P,0,1)),U||c(G,N=>D+N/(G.length-1)*P,.5,1)}};c(i,v=>s[v]/p,1,0);const x=Wt(t);t.forEach(v=>v.dispose());const l=Jt.clone(),m=new et(x,l);m.frustumCulled=!1,qe.add(m);const g=[0];if(e==="cg")for(let v=0,b=Math.floor(f(1,5));v<b;v++)g.push(g.at(-1)+f(.045,.13));else for(let v=0,b=Math.floor(f(2,6));v<b;v++)g.push(g.at(-1)+f(.03,.09));const B={mesh:m,mat:l,main:i,kind:e,t:0,lead:e==="cg"?f(.16,.3):f(.12,.22),strokes:g,power:f(.8,1.25)*(e==="near"?1.2:1),lum:0,light:i[Math.floor(i.length*(e==="cg"?.12:.5))],long:e==="cg"&&Math.random()<.3};return B.jolt=k.turbulence*B.power*Math.max(.05,1.3-u/70),$.push(B),B}function Re(e){const a=e?w.position.z+f(-20,60):f(-110,110),n=e?new E(O(a)+f(-35,35),w.position.y+f(-15,25),a):new E(f(-45,150),f(12,125),a);ee.push({p:n,t:0,power:f(.4,1.3),f:f(4,12),life:f(.25,.7)})}function Kt(e,a){e.t+=a;const n=e.t/e.lead,o=e.t-e.lead;let r=0;if(o>=0){for(const h of e.strokes){const i=o-h;i>=0&&(r=Math.max(r,Math.exp(-i/.038)*(h?f(.6,.9):1)))}if(e.long&&(r=Math.max(r,.35*Math.exp(-o/.35)*(.85+.15*Math.sin(o*70)))),!e.struck&&(e.struck=!0,V=Math.min(1,V+e.jolt),q&&we)){const h=new E().setFromMatrixColumn(w.matrixWorld,0);q.thunder(e.main.filter((i,p)=>p%3===0),w.position.clone(),h,e.power*(e.kind==="cg"?1.2:.8))}}return e.mat.uniforms.uLead.value=o>=0?2:n,e.mat.uniforms.uLeader.value=o>=0?Math.exp(-o/.05):1,e.mat.uniforms.uStroke.value=r*e.power,e.mat.uniforms.uBranch.value=o>=0?Math.exp(-o/.06):1,e.lum=(o<0?.04*n:r)*e.power,o>e.strokes.at(-1)+(e.long?1.2:.45)?(qe.remove(e.mesh),e.mesh.geometry.dispose(),e.mat.dispose(),!1):!0}const K=new Tt(T),te=new zt({uniforms:{tDiffuse:{value:null},tCloud:{value:xe.texture},tBolt:{value:be.texture},uFade:{value:1},uExposure:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",fragmentShader:`
    uniform sampler2D tCloud, tBolt; uniform float uFade, uExposure; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tCloud, vUv), b = texture2D(tBolt, vUv);
      float bd = b.a > 1e-4 ? (1. / b.a - 1.) * 100. : 1e5;
      float vis = exp(-max(0., bd - c.a) * .07);
      vec3 col = (c.rgb + b.rgb * vis) * uExposure;
      gl_FragColor = vec4(col * uFade, 1.);
    }`});te.uniforms.tCloud.value=xe.texture;te.uniforms.tBolt.value=be.texture;K.addPass(te);const ve=new St(new ge(256,256),.6,.5,.9);K.addPass(ve);K.addPass(new At);function Fe(){w.aspect=innerWidth/innerHeight,w.updateProjectionMatrix(),T.setSize(innerWidth,innerHeight),K.setPixelRatio(T.getPixelRatio()),K.setSize(innerWidth,innerHeight);const e=T.getPixelRatio();xe.setSize(Math.max(2,Math.floor(innerWidth*e*k.resolution)),Math.max(2,Math.floor(innerHeight*e*k.resolution))),be.setSize(Math.floor(innerWidth*e),Math.floor(innerHeight*e))}addEventListener("resize",Fe);Fe();const Ge=document.querySelector("#sound");function Qt(e){e&&!q&&(q=$t()),q&&(e?q.ctx.resume():q.ctx.suspend(),q.master.gain.value=k.volume),we=e,Ge.setAttribute("aria-pressed",e),Ge.querySelector("span").textContent=e?"Sound on":"Sound off"}Ge.onclick=()=>Qt(!we);const st=new ge,Ae=new ge;addEventListener("pointermove",e=>st.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1));T.domElement.addEventListener("pointerdown",e=>{const a=new Ct;if(a.setFromCamera(new ge(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight*2-1)),w),oe(w.position.z)>.5)Z("near");else{const n=a.ray.direction.y<0?(pe-a.ray.origin.y)/a.ray.direction.y:200,o=a.ray.at(Math.min(n,400),new E);o.x=Math.max(-60,Math.min(110,o.x)),o.z=Math.max(-90,Math.min(90,o.z)),Z("cg",o)}});let _=De,F=0;function eo(){_=De,F=-1}function to(){return Dt(()=>({Storm:le({Strike:Ne(()=>Z(oe(w.position.z)>.5?"near":"cg")),"Restart journey":Ne(eo),"Journey speed":{value:1,min:0,max:3,step:.05,onChange:e=>k.journey=e},"Strike rate":{value:1,min:0,max:4,step:.05,onChange:e=>k.rate=e},Turbulence:{value:1,min:0,max:2.5,step:.05,onChange:e=>k.turbulence=e},Volume:{value:.8,min:0,max:1.5,step:.05,onChange:e=>{k.volume=e,q&&(q.master.gain.value=e)}}}),Sky:le({"Sun height":{value:.13,min:.02,max:.8,step:.01,onChange:e=>Y.uniforms.uSunDir.value.set(-.92,e,.2).normalize()},Sunlight:{value:1,min:0,max:2,step:.02,onChange:e=>Y.uniforms.uSun.value=e},Haze:{value:1,min:0,max:3,step:.02,onChange:e=>Y.uniforms.uHaze.value=e},"Cloud density":{value:1,min:.4,max:2,step:.02,onChange:e=>k.density=e}},{collapsed:!0}),Finish:le({exposure:{value:1,min:.3,max:2.5,step:.01,onChange:e=>T.toneMappingExposure=e},"tone mapping":{value:"aces",options:["aces","agx","neutral"],onChange:e=>{T.toneMapping={aces:Ke,agx:Lt,neutral:Pt}[e]}},bloom:{value:.6,min:0,max:2.5,step:.01,onChange:e=>k.bloom=e},"bloom radius":{value:.5,min:0,max:1,step:.01,onChange:e=>ve.radius=e},"bloom threshold":{value:.9,min:0,max:2,step:.01,onChange:e=>ve.threshold=e}},{collapsed:!0}),Performance:le({"Cloud resolution":{value:.5,min:.25,max:1,step:.05,onChange:e=>{k.resolution=e,Fe()}}},{collapsed:!0})}),[]),null}J||kt.createRoot(document.querySelector("#controls")).render(se.createElement(se.Fragment,null,se.createElement(Et,{collapsed:!0,titleBar:{title:"Controls"}}),se.createElement(to)));const oo=new E(40,60,0),Ce=new nt,ke=new nt,_e=new Be,ao=new E,no=new E(0,1,0),W=e=>Math.sin(e*1.7)*.5+Math.sin(e*3.1+1.3)*.3+Math.sin(e*7.3+2.1)*.2;let Ee,j=0,Xe=.8,Ye=.2,lt=!1,Je=!0;const Ze=Y.uniforms.uFlash.value;T.setAnimationLoop(e=>{const a=Ee===void 0?0:Math.min((e-Ee)/1e3,.1);Ee=e;const n=lt?0:a;j+=n;const o=_,r=oe(o);J||(_+=n*k.journey*(Oe.matches?.3:1)*(4+26*(1-r))),_>Vt&&F>=0?(F+=a*1.4,F>=1&&(_=De,F=-1)):F<0&&(F=Math.min(0,F+a*1.2));const h=F>0?1-F:1+F,i=k.rate*(Oe.matches?.3:1);if(!J){if((Xe-=n*i)<0){const m=Math.random();r>.5?Z(m<.55?"near":m<.8?"ic":"cg"):Z(m<.65?"cg":"ic"),Xe=f(.5,r>.5?2.2:3)}(Ye-=n*i)<0&&(Re(r>.5&&Math.random()<.6),Ye=f(.12,.9))}w.position.set(O(o),$e(o),o),Ae.lerp(st,1-Math.exp(-a*2.5));const p=o+10,u=ao.set(O(p),$e(p),p),d=1-de(-240,-150,o)+de(170,300,o);u.lerp(oo,Math.min(1,d)),u.x+=Ae.x*18*(1+d*2),u.y-=Ae.y*10*(1+d*1.5),_e.lookAt(w.position,u,no),Ce.setFromRotationMatrix(_e),Je&&(ke.copy(Ce),Je=!1),ke.slerp(Ce,1-Math.exp(-a*2.2)),w.quaternion.copy(ke),w.rotateZ((O(o+6)-O(o))*-.06),V=Math.max(0,V-a*.8);const t=V*V,s=k.turbulence*(.003+.016*r),c=j*24;w.rotateX(s*W(j*2.3)+t*.06*W(c)),w.rotateY(s*W(j*1.9+9)+t*.06*W(c+40)),w.rotateZ(s*.6*W(j*1.3+4)+t*.08*W(c+80)),w.translateY(t*.35*W(c+160)+s*8*W(j*3.1+7)),w.updateMatrixWorld();for(let m=$.length-1;m>=0;m--)Kt($[m],n)||$.splice(m,1);for(let m=ee.length-1;m>=0;m--){const g=ee[m];g.t+=n,g.lum=g.power*Math.exp(-g.t/(g.life*.4))*(.4+.6*Math.sin(g.t*g.f*6.28)**2)*.5,g.t>g.life*2&&ee.splice(m,1)}const x=[...$.map(m=>({p:m.light,lum:m.lum*(m.kind==="near"?.3:1)})),...ee.map(m=>({p:m.p,lum:m.lum}))].sort((m,g)=>g.lum-m.lum);for(let m=0;m<he;m++){const g=x[m];g?Ze[m].set(g.p.x,g.p.y,g.p.z,g.lum*260):Ze[m].set(0,0,0,0)}q&&we&&q.ambience(r,t,1-de(60,200,Math.abs(o)));const l=Y.uniforms;l.uTime.value=j,l.uDensity.value=k.density,l.uCam.value.copy(w.position),l.uCamWorld.value.copy(w.matrixWorld),l.uInvProj.value.copy(w.projectionMatrixInverse),T.setRenderTarget(xe),T.render(it,Yt),T.setRenderTarget(be),T.setClearColor(0,0),T.clear(),T.render(qe,w),T.setRenderTarget(null),te.uniforms.uFade.value=h,te.uniforms.uExposure.value=k.exposure,ve.strength=k.bloom,K.render()});J&&(_=-430,setTimeout(()=>{Z("cg",new E(20,0,-40)),Re(!1),Re(!1),$.at(-1).lead=.001,setTimeout(()=>{lt=!0,He.has("port")&&setTimeout(()=>T.domElement.toBlob(e=>fetch(`http://localhost:${He.get("port")}/`,{method:"POST",body:e}),"image/jpeg",.92),400)},75)},1500));
