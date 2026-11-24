import * as THREE from 'three/webgpu';
import { cameraFar, cameraNear, cameraPosition, float, hash, instanceIndex, mix, perspectiveDepthToViewZ, positionView, screenUV, uniform, uv, varying, vec2, vec3 } from 'three/tsl';
import { SUN } from './water-optics.js';

// Marine snow: aggregates drifting in a box that wraps around the camera,
// carried by the mean current and the swell's orbital motion. They are drawn
// 2-8 mm across, larger than most real aggregates, which would fall far
// below a pixel at screen resolution and vanish. They
// are drawn in their own pass after the water composite, so each speck is
// attenuated by the water between it and the camera, not the background's;
// a manual test against the scene depth hides it behind kelp and fish.
// Each speck scatters only the direct sunlight that reaches it (shadow
// cascades and caustics included), mostly forward, so specks glint in the
// beams and caustic patches and vanish in the kelp's shade. A speck
// smaller than MIN_PIXELS is drawn at that size with its light spread over
// it, so distant specks dim instead of flickering.
// GLINT is an appearance gain, not optics: drawn at least MIN_PIXELS wide
// with their light spread over that, sunlit specks would otherwise sit
// below the water's own glow except when looking toward the sun.
const COUNT=16000,BOX=12,MIN_PIXELS=1.5,ALBEDO=.9,FORWARD=.8,FORWARD_SHARE=.6,SINKING=.003,GLINT=8;

const phase=(cosine,g)=>float(1-g*g).div(float(1+g*g).sub(cosine.mul(2*g)).pow(1.5).mul(4*Math.PI));

export function createMarineSnow({camera,current,sunlight,caustics,optics,depth}){
  const drift=uniform(new THREE.Vector3()),pixelAngle=uniform(.002),size=new THREE.Vector2();
  pixelAngle.onRenderUpdate(({renderer})=>2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,renderer.getDrawingBufferSize(size).y));
  const seed=k=>hash(instanceIndex.add(COUNT*k));
  // Rest position in the wrapping box, then the swell's orbital motion.
  // cameraPosition follows the camera every frame (a vec3 of camera.position
  // would be a constant baked in when the shader is built).
  const wrapped=vec3(seed(0),seed(1),seed(2)).mul(BOX).add(drift).sub(cameraPosition).div(BOX).add(.5).fract().sub(.5);
  const at=cameraPosition.add(wrapped.mul(BOX));
  const center=at.add(current.waterDisplacement(at)).toVar();
  // Log-uniform radius, 1-4 mm.
  const radius=float(.001).mul(float(4).pow(seed(3)));
  const toCamera=center.sub(cameraPosition),distance=toCamera.length();
  const shown=radius.mul(2).max(distance.mul(pixelAngle).mul(MIN_PIXELS));
  const coverage=radius.mul(2).div(shown).pow2();
  // Fade out toward the box faces, where specks wrap around.
  const box=wrapped.x.abs().max(wrapped.y.abs()).max(wrapped.z.abs()).mul(2);
  // ...and right in front of the lens, where a speck would fill the view.
  const fade=box.smoothstep(.75,1).oneMinus().mul(distance.smoothstep(.3,.9));
  // Sunlight reaching the speck, scattered toward the camera.
  // Per vertex, so the shadow lookup uses texel loads (no comparison samplers).
  const sun=vec3(sunlight.irradiance).mul(optics.sunlightAt(center.y)).mul(sunlight.visibilityLoad(center))
    .mul(mix(vec3(1),caustics.causticIrradiance(center),caustics.strength).max(0));
  const cosine=toCamera.div(distance.max(1e-4)).dot(vec3(SUN.x,SUN.y,SUN.z));
  const scatter=phase(cosine,FORWARD).mul(FORWARD_SHARE).add((1-FORWARD_SHARE)/(4*Math.PI));
  const radiance=sun.mul(scatter).mul(ALBEDO*GLINT).mul(coverage).mul(optics.transmittance(distance)).mul(fade);
  const light=varying(radiance),viewZ=varying(positionView.z);
  const material=new THREE.SpriteNodeMaterial({transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
  material.positionNode=center;
  material.scaleNode=vec2(shown);
  // A soft round speck, hidden behind the nearest scene surface.
  const disc=uv().sub(.5).length().mul(2).smoothstep(.4,1).oneMinus();
  const behind=perspectiveDepthToViewZ(depth.sample(screenUV).r,cameraNear,cameraFar);
  material.colorNode=light;
  material.opacityNode=disc.mul(viewZ.greaterThan(behind).select(1,0));
  material.fog=false;
  const sprite=new THREE.Sprite(material);sprite.count=COUNT;sprite.frustumCulled=false;
  const scene=new THREE.Scene();scene.add(sprite);
  return {scene,
    // dt: simulated seconds. The mean flow and a slow sinking carry the snow.
    update(dt){drift.value.x+=.42*current.strength.value*dt;drift.value.z+=.10*current.strength.value*dt;drift.value.y-=SINKING*dt;}};
}
