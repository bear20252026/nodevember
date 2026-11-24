import * as THREE from 'three/webgpu';
import { Fn, attribute, float, mix, normalViewGeometry, positionView, positionWorld, uniform, vec2, vec3 } from 'three/tsl';
import { TissueMaterial } from './tissue.js';
import { createTissueTexture } from './tissue-noise.js';
import { applyCausticLighting } from './caustic-lighting.js';

import { SUN, SURFACE } from './water-optics.js';
export { SUN, SURFACE };

export function createMaterials(current,caustics,optics) {
  const translucency=uniform(1),colour=attribute('pigment','vec4'),pigment=colour.xyz,tissue=attribute('tissue','vec4'),blade=attribute('bladeUV','vec4'),uv=blade.xy;
  // Relative tissue/water IOR gives a weak interface reflection underwater.
  const material=new TissueMaterial({roughness:.55,metalness:0,ior:1.42/1.333,specularIntensity:.61,alphaTest:.5});
  material.positionNode=current.position;
  const bladeAmount=tissue.y.smoothstep(.7,.95);
  // Metric blade coordinates: arc length from the base and distance across,
  // so folds keep their real spacing on short and long blades. Each blade
  // reads its own part of the periodic tile.
  const coordinates=vec2(blade.w,tissue.z).add(vec2(.157,.211).mul(tissue.w));
  const surface=createTissueTexture()(coordinates);
  // The smooth collar above the bladder carries no folds.
  const corrugation=bladeAmount.mul(blade.w.smoothstep(.02,.12));
  const slope=surface.slope.mul(corrugation);
  // Margin spines, as in the references: thin teeth a few millimetres long,
  // leaning toward the tip, about 2 cm apart and irregular. The band between
  // them is cut back, so the teeth stand out from the blade edge. They fade
  // out where their base would be narrower than about a pixel.
  const halfWidth=tissue.z.abs().div(uv.y.abs().max(.05));
  const edgeDistance=uv.y.abs().oneMinus().mul(halfWidth);
  const spacing=.026,stations=blade.w.div(spacing).add(uv.y.sign().mul(.37)).add(tissue.w);
  const random=k=>stations.floor().mul(12.9898).add(k).sin().mul(43758.5453).fract();
  const resolved=float(.0044).div(blade.w.fwidth().max(1e-6)).smoothstep(1.4,3);
  const band=float(.0085).mul(resolved).mul(blade.w.smoothstep(.04,.1)).mul(halfWidth.div(.04).clamp());
  const spineLength=band.mul(random(3.1).mul(.55).add(.45));
  // 0 where a spine leaves the blade, 1 at its tip.
  const rise=band.sub(edgeDistance).div(spineLength.max(1e-7));
  const offset=stations.fract().sub(random(7.3).mul(.5).add(.25)).mul(spacing).sub(spineLength.mul(rise).mul(.7));
  const spine=rise.lessThan(1).and(offset.abs().lessThan(rise.oneMinus().mul(.0022)));
  material.opacityNode=edgeDistance.greaterThanEqual(band).or(spine).or(bladeAmount.lessThan(.5)).select(1,0);
  // Bump mapping from the stored slopes: the chain rule turns metric slopes
  // into screen derivatives of height, so the normal stays smooth inside a
  // pixel quad and mip filtering averages slopes rather than heights.
  material.normalNode=Fn(()=>{
    const sx=positionView.dFdx(),sy=positionView.dFdy(),n=normalViewGeometry;
    const r1=sy.cross(n),r2=n.cross(sx),det=sx.dot(r1);
    const dx=coordinates.dFdx(),dy=coordinates.dFdy();
    const gradient=r1.mul(slope.dot(dx)).add(r2.mul(slope.dot(dy))).mul(det.sign());
    return n.mul(det.abs().max(1e-10)).sub(gradient).normalize();
  })();
  const waterSun=optics.sunlightAt(positionWorld.y);
  // Smooth, wet, gas-filled bladders; the rest of the non-blade tissue is stalk.
  const bladder=tissue.y.sub(.65).abs().lessThan(.05).select(float(1),float(0));
  // The shadow lookup moves toward the sun: 4 cm clears a blade, and stalks
  // and bladders (radius in tissue.z) move past their own sunward side, so
  // light that crosses them is not lost to their own shadow.
  material.receivedShadowPositionNode=positionWorld.add(vec3(SUN).mul(tissue.z.mul(2).mul(bladeAmount.oneMinus()).add(.04)));
  // Share of light that crosses the tissue rather than reflecting: stalks
  // little, the thin-walled bladders about as much as a blade.
  const fraction=translucency.clamp().mul(mix(mix(float(.3),float(.72),bladder),float(.76),bladeAmount));
  // Tissue gathers in the fold crests, which read as dark wavy lines against
  // the light; mottling varies the pigment density. Mean density stays one.
  // Part of the extra density thickens the sheet (filtering the light toward
  // amber) and part scatters it away neutrally, so the crests stay olive
  // rather than turning red.
  const thicknessScale=mix(float(1),surface.density,corrugation.mul(.55));
  const crestLoss=mix(float(1),float(1.22).sub(surface.density.mul(.22)).clamp(.3,1.15),corrugation);
  // Effective RGB absorption at a 1 mm reference thickness. Pigment controls
  // spectral tint; folds increase optical depth instead of blurring the image.
  // Fucoxanthin absorbs blue-green, so a blade passes red best, green less
  // and blue hardly at all. Under the blue-green underwater light this keeps
  // the kelp golden-olive rather than green. Green stays at about half of red
  // per millimetre: Beer-Lambert compounds the ratio, so overlapping blades
  // and grazing paths deepen to amber instead of turning rust red. These
  // are fitted appearance parameters, not measured kelp optical data.
  const normalizedPigment=pigment.div(pigment.r.max(pigment.g).max(pigment.b).max(.01));
  const bladeTransmission=normalizedPigment.mul(vec3(1,.60,.35)).clamp(.055,.94);
  // Stalks and bladders: golden-amber per millimetre, the bladder walls a
  // little clearer, so a backlit bladder glows amber through its gas.
  const referenceTransmission=mix(mix(vec3(.82,.68,.42),vec3(.90,.76,.46),bladder),bladeTransmission,bladeAmount);
  material.absorptionNode=referenceTransmission.log().negate().div(.001);
  material.tissueThicknessNode=tissue.x.mul(thicknessScale);
  // Under the direct beam the folds stand out; in the diffuse ambient field,
  // which arrives from every direction and spreads within the tissue, they
  // are much softer. This keeps shaded blades from looking striped.
  material.ambientThicknessNode=tissue.x.mul(mix(float(1),surface.density,corrugation.mul(.35)));
  material.ambientTransmissionNode=fraction;
  material.diffuseTransmissionNode=fraction.mul(crestLoss);
  // Reflectance has the same shape as the transmission, lower in green and
  // blue. Denser crests also look slightly darker in reflected light. A
  // hollow bladder returns about half of what it transmits from its far
  // wall, so it loses less reflectance than a sheet.
  material.colorNode=pigment.mul(vec3(1,.5,.5)).mul(fraction.mul(mix(float(1),float(.5),bladder)).oneMinus()).mul(mix(float(1),float(1.05).sub(surface.density.mul(.05)),corrugation));
  // Folds too fine for the pixel leave their slope variance in the mipmaps.
  // Add it to the GGX roughness so distant blades keep a broad wet sheen.
  const variance=surface.slopeSquared.sub(surface.slope.dot(surface.slope)).max(0).mul(corrugation.pow2());
  // Smooth, wet bladders are glossier than the stipes.
  const alpha=mix(mix(float(.49),float(.34),bladder),float(.43),bladeAmount).pow2();
  material.roughnessNode=alpha.pow2().add(variance.mul(2)).sqrt().sqrt();
  // SunLight applies its cascaded shadow visibility to the incoming radiance.
  material.sunAttenuationNode=waterSun;
  // Ambient light comes from scene.environment (water-environment.js): the
  // facing side through the standard environment term, the reverse side
  // through the sheet (tissue.js). That is the open-water light field, mostly
  // forward-scattered sunlight; inside the forest the canopy and the
  // neighbouring plants block about half of it (a fitted factor). The baked
  // term occludes it by the plant's own blades, bladders and stalk
  // (kelp-geometry.js). Direct sunlight uses the shadow maps.
  material.aoNode=colour.w.mul(.5);
  const floor=new THREE.MeshStandardNodeMaterial({color:0x202918,roughness:1});
  applyCausticLighting(material,caustics);
  applyCausticLighting(floor,caustics,undefined,waterSun);
  return {kelp:material,floor,translucency};
}
