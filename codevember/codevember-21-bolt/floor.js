// The floor the diorama stands on: one single board of dark walnut, bare and matte, running on
// as far as the eye goes, but lit only in a pool round the diorama, as if by one lamp
// hung high over it; out of the pool the floor sinks into the night.
// All in the fragment shader: the grain (flat-sawn from a great log: long cathedral arches
// of growth rings, years wide and narrow, swirls; pores, fibres, rays, colour streaks, a
// ripple figure), its surface bare and matte, rough (raised grain, open pores, torn
// fibres, saw marks, grit), and the shade of the base where it sits on the floor.
import * as THREE from 'three';
import { GLSL_NOISE } from './ground.js';
import { BACKDROP } from './post.js';

export function createFloor({ y, footprint, uniforms, radius }) {
  // the base's footprint, for its contact shade (a convex polygon of up to 8 corners)
  const pts = footprint.map(([x, z]) => new THREE.Vector2(x, z));
  while (pts.length < 8) pts.push(pts[pts.length - 1].clone());

  const geo = new THREE.PlaneGeometry(400, 400);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms, {
      uFoot: { value: pts },
      uFootN: { value: footprint.length },
      uPool: { value: radius },
      uLamp: { value: new THREE.Vector3(-9, 15, -6) }, // high, a little to one side: it rakes the grain
      uLampC: { value: new THREE.Color(1.0, 0.9, 0.8).multiplyScalar(1.4) },
    });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW;
        uniform vec2 uFoot[8]; uniform int uFootN; uniform float uPool; uniform vec3 uLamp, uLampC; uniform vec2 uScreen;
        ${GLSL_NOISE}
        ${BACKDROP}
        // signed distance to the base's footprint (negative inside)
        float footDist(vec2 p) {
          float d = -1e9;
          for (int i = 0; i < 8; i++) {
            if (i >= uFootN) break;
            vec2 a = uFoot[i], b = uFoot[i + 1 >= uFootN ? 0 : i + 1];
            vec2 e = normalize(b - a);
            d = max(d, (p.x - a.x) * e.y - (p.y - a.y) * e.x); // CCW: outward is (e.y, -e.x)
          }
          return d;
        }
        // the light of the pool: full in the middle, falling off softly at its rim
        float pool(vec2 p) {
          float r = length(p) / uPool + 0.05 * (bn(p * 0.9) - 0.5);
          return pow(1.0 - smoothstep(0.55, 1.15, r), 1.6);
        }
        float floorAO;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // one single board, flat-sawn from a great walnut: its grain runs along a skew axis
        const float ANG = 0.42;
        vec2 uv = mat2(cos(ANG), -sin(ANG), sin(ANG), cos(ANG)) * vW.xz;
        float u = uv.x, v = uv.y; // along the grain, across it

        // the log it was cut from: its heart wanders a little along the length, and the saw's
        // plane passes near it, then further, so the rings cross the board in long cathedral
        // arches, pinched where the cut comes closest, spreading into straight grain between
        float axis = 3.0 * (bn(vec2(u * 0.05, 1.3)) - 0.5) + 0.6;
        float depth = 0.1 + 4.5 * smoothstep(0.1, 0.9, bn(vec2(u * 0.13 + 4.0, 7.7))) + 0.6 * bfbm(vec2(u * 0.3, v * 0.08)) * smoothstep(0.0, 0.5, bn(vec2(u * 0.05, 2.0)));
        // the rings' radius, the wood warped round slow swirls and small kinks in the fibre
        vec2 rw = vec2(u * 0.11, v * 0.3);
        float swirl = bfbm(rw + 2.0) - 0.5;
        float kink = bfbm(vec2(u * 0.6, v * 1.6) + 8.0) - 0.5;
        float vf = v + 0.8 * swirl; // across the fibres: they bend with the rings
        float rad = length(vec2(vf - axis, depth)) + 0.06 * kink;
        // the years: some wide, some narrow (wet years, dry years), so the rings never repeat
        float yr = rad * 5.2;
        yr += 0.9 * bfbm(vec2(rad * 0.55, 3.0)) + 0.25 * bn(vec2(rad * 2.2, u * 0.04));
        float ring = fract(yr);
        float fw = fwidth(yr);
        float fine = 1.0 - smoothstep(0.1, 0.45, fw); // the rings fade as they get finer than a pixel
        // within each year: pale open earlywood darkening slowly into dense latewood, its edge
        // crisp where the next spring starts
        float late = smoothstep(0.62, 0.96, ring) * (1.0 - smoothstep(0.972, 1.0, ring));
        late = late * late * (0.75 + 0.25 * bn(vec2(u * 1.5, yr * 3.0)));
        // and the faint lines of the earlywood itself, the season's own rhythm
        float growth = (bn(vec2(yr * 9.0, u * 0.3)) - 0.5) * fine * (1.0 - late);
        late = mix(0.3, late, fine);
        // a second, thinner line inside some years (a false ring)
        float falseRing = smoothstep(0.03, 0.0, abs(ring - 0.42 - 0.1 * bn(vec2(yr, 1.0)))) * step(0.6, bh1(vec2(floor(yr), 3.0))) * fine;

        // the pores: walnut is semi-ring-porous, its vessels long dark dashes along the grain,
        // thicker in the earlywood; finer still, the fibres
        float poreScale = 1.0 - smoothstep(0.01, 0.06, fwidth(v * 220.0));
        vec2 pq = vec2(u * 9.0 + 3.0 * kink, vf * 220.0);
        float pores = smoothstep(0.66, 0.86, bn(pq)) * mix(1.0, 0.45, late) * poreScale;
        pores = max(pores, smoothstep(0.75, 0.9, bn(pq * vec2(2.3, 1.7) + 5.0)) * 0.6 * poreScale);
        float fibre = bn(vec2(u * 3.0, vf * 420.0)) * bn(vec2(u * 0.8 + 3.0, vf * 120.0 + kink * 3.0));
        float fibreK = 1.0 - smoothstep(0.02, 0.1, fwidth(v * 420.0));
        // the rays: tiny pale flecks across the grain, catching the light
        float ray = smoothstep(0.86, 0.97, bn(vec2(u * 110.0, vf * 45.0 + yr * 0.4))) * (1.0 - smoothstep(0.3, 1.0, fwidth(u * 90.0)));
        // the colour running along the grain: amber, chocolate, a purplish grey
        float streakA = bfbm(vec2(u * 0.25, vf * 3.5));
        float streakB = bfbm(vec2(u * 0.12 + 9.0, v * 1.2));
        float streakC = bn(vec2(u * 0.6, vf * 22.0));

        // dark walnut
        vec3 earlyC = mix(vec3(0.052, 0.03, 0.018), vec3(0.082, 0.047, 0.027), streakA);
        earlyC = mix(earlyC, vec3(0.06, 0.045, 0.045), smoothstep(0.45, 0.7, streakB) * 0.6); // greyish
        earlyC = mix(earlyC, vec3(0.13, 0.075, 0.035), smoothstep(0.6, 0.8, streakC) * 0.2); // amber
        vec3 lateC = vec3(0.024, 0.013, 0.008) * (0.8 + 0.4 * streakA);
        vec3 wood = mix(earlyC, lateC, late * 0.7);
        wood = mix(wood, lateC, falseRing * 0.35);
        wood = mix(wood, lateC * 0.55, pores * 0.85);
        wood *= mix(1.0, 0.82 + 0.4 * fibre, fibreK);
        wood += vec3(0.01, 0.007, 0.004) * ray * fine;
        wood *= 1.0 + 0.18 * growth;
        // the figure: a ripple across the grain that shimmers as the eye moves (chatoyance)
        vec3 gDir = vec3(cos(ANG), 0.0, sin(ANG));
        vec3 Vw = normalize(cameraPosition - vW);
        float ripple = sin(u * 26.0 + 6.0 * bn(vec2(u * 0.8, vf * 2.0)) + 3.0 * kink);
        float figure = smoothstep(0.35, 0.75, bn(vec2(u * 0.3, v * 0.6) + 20.0)) * fine;
        wood *= 1.0 + 0.03 * figure * ripple * dot(Vw, gDir);

        // years of wear: lighter, duller in the paths, a few scuffs across the grain
        float wear = bfbm(vW.xz * 0.35 + 3.0);
        float scuff = smoothstep(0.7, 0.85, bn(vec2(dot(vW.xz, vec2(0.8, 0.6)) * 3.0, dot(vW.xz, vec2(-0.6, 0.8)) * 60.0))) * smoothstep(0.5, 0.7, bfbm(vW.xz * 1.3));
        wood *= 0.9 + 0.25 * wear;
        wood = mix(wood, wood * 1.4 + 0.008, scuff * 0.25 * fine);
        diffuseColor.rgb = wood;

        // the base's shade on the floor: deep in the corner it sits in, spreading out soft
        float fd = footDist(vW.xz);
        floorAO = mix(0.12, 1.0, smoothstep(-0.02, 0.6, fd)) * mix(0.55, 1.0, smoothstep(0.0, 2.2, fd));

        // a rough, weathered surface: the soft earlywood worn down so the latewood stands
        // proud (raised grain), the pores open, fibres torn up along the grain, saw marks
        // faintly across it, and a dry grit over all
        float raised = smoothstep(0.45, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, ring));
        float torn = smoothstep(0.5, 0.85, bn(vec2(u * 4.0, vf * 240.0)) * bn(vec2(u * 1.3 + 7.0, vf * 60.0)) * 1.6) * (1.0 - smoothstep(0.4, 1.2, fwidth(vf * 240.0)));
        float saw = (bn(vec2(u * 7.0 + 2.0 * bn(vec2(vf * 0.5, u * 0.2)), vf * 0.4)) - 0.5) * smoothstep(0.3, 0.7, bn(vec2(u * 0.2, vf * 0.15) + 30.0));
        float grit = (bn(vW.xz * 170.0) + 0.5 * bn(vW.xz * 340.0 + 9.0) - 0.75) * (1.0 - smoothstep(0.5, 1.5, fwidth(vW.x * 170.0)));
        float bumpH = raised * fine * 0.012 - pores * 0.009 - falseRing * 0.002 + fibre * fibreK * 0.005 + torn * 0.006
                    + saw * 0.005 + grit * 0.004 + streakA * 0.003;
        wood *= (1.0 - 0.4 * torn) * (1.0 + 0.5 * grit); // the torn fibres catch a shadow
        wood = mix(wood, wood * 1.25 + vec3(0.006, 0.005, 0.004), (1.0 - raised) * 0.25 * fine); // the dry, open earlywood a little paler`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(normal, -vViewPosition, bumpH, 1.0);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // bare, oiled at most: matte all over, the hard latewood a touch smoother where it
        // stands proud and has been rubbed, the open pores and the scuffs the dullest
        roughnessFactor = clamp(0.86 + 0.06 * wear - 0.12 * raised * fine + 0.1 * pores + 0.06 * torn + 0.08 * scuff, 0.6, 1.0);`)
      .replace('#include <opaque_fragment>', `
        {
          // the night's light reaches the floor only in the pool, and the lamp over it adds
          // its own: a warm wash and its blurred reflection in the varnish
          float lit = pool(vW.xz);
          vec3 wN = inverseTransformDirection(normal, viewMatrix);
          vec3 Ld = normalize(uLamp - vW);
          vec3 V = normalize(cameraPosition - vW);
          float ndl = max(dot(wN, Ld), 0.0);
          float a = max(roughnessFactor, 0.2);
          float spec = pow(max(dot(wN, normalize(Ld + V)), 0.0), 2.0 / (a * a * a * a) - 2.0) / (a * a * 3.14159);
          vec3 lamp = uLampC * (diffuseColor.rgb * ndl + 0.04 * spec * ndl);
          outgoingLight = (outgoingLight + lamp) * lit * floorAO + outgoingLight * 0.015 * floorAO;
          // far off, past the pool, the floor melts into the night behind
          float far = 1.0 - exp(-max(0.0, length(vW.xz) - uPool * 2.0) / 40.0);
          outgoingLight = mix(outgoingLight, backdrop(gl_FragCoord.xy / uScreen, uScreen.x / uScreen.y), far);
        }
        #include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
