import { Color } from 'three/webgpu';
import { attribute, faceDirection, float, mix, mx_cell_noise_float, normalView, positionView, uv, vec2, vec3 } from 'three/tsl';
import { PART } from './fish-geometry.js';

const linear=hex=>{const c=new Color(hex);return vec3(c.r,c.g,c.b);};
// Colours sampled by eye from dive footage of each species.
const PALETTE={
  blacksmith:{back:'#1a2440',flank:'#3b4d72',belly:'#8592a6',scaleEdge:.70,fin:'#2a3552',finEdge:'#0d1220',clear:'#3e4a60'},
  senorita:{back:'#9a4a22',flank:'#d88a3c',belly:'#f0dcb8',scaleEdge:.90,fin:'#d9a35c',finEdge:'#c07a38',clear:'#a88e6a'},
  // Adult garibaldi are a solid, brilliant orange, fins included; their
  // membranes are translucent orange rather than clear.
  garibaldi:{back:'#d4501a',flank:'#f0681c',belly:'#f28a34',scaleEdge:.85,fin:'#e85a14',finEdge:'#c4420c',clear:'#e8641e'}
};
// Ray counts per fin: caudal, dorsal, anal, pectoral, pelvic.
const RAYS={blacksmith:[22,26,14,18,6],senorita:[16,22,15,13,6],garibaldi:[20,25,14,18,6]};

// A procedural skin in body coordinates. Body uv is (nose to caudal base,
// belly to back); fin uv is (across the rays, base to edge). Pattern detail
// fades with its screen footprint so distant fish stay stable without
// temporal antialiasing.
// species: 'blacksmith', 'senorita' or 'garibaldi'.
export function createFishSkin(species,tint){
  const wrasse=species==='senorita',garibaldi=species==='garibaldi';
  const colors=PALETTE[species],rays=RAYS[species];
  const part=attribute('part','float'),coord=uv(),u=coord.x,h=coord.y;
  const body=part.lessThan(.5).toFloat(),eye=part.greaterThan(5.5).toFloat(),fin=float(1).sub(body).sub(eye);
  const is=k=>part.sub(k).abs().lessThan(.5).toFloat();

  // Overlapping scales in offset rows; each scale's exposed posterior
  // margin is a darker ridge.
  const along=wrasse?34:33,across=wrasse?14:15;
  const sy=h.mul(across),row=sy.floor(),sx=u.mul(along).add(row.mod(2).mul(.5)),cell=sx.floor();
  const local=vec2(sx.fract().sub(.18),sy.fract().sub(.5).mul(along/across*.62));
  const radius=local.length(),detail=float(1).sub(u.mul(along).fwidth().max(sy.fwidth()).smoothstep(.28,.65));
  const margin=radius.smoothstep(.62,.78).mul(radius.smoothstep(.80,.92).oneMinus());
  const random=mx_cell_noise_float(vec2(cell,row));
  // The gill cover's free edge sweeps back below the eye; the head ahead
  // of it carries no scales.
  const gill=float(.255).add(h.sub(.15).mul(Math.PI/.75).sin().mul(.040));
  const gillMask=h.smoothstep(.14,.26).mul(h.smoothstep(.74,.88).oneMinus());
  const seam=u.sub(gill).div(.006).pow2().negate().exp().mul(gillMask);
  const scaled=u.smoothstep(gill.add(.005),gill.add(.035)).mul(u.smoothstep(.97,1).oneMinus()).mul(detail);
  const lateralLine=h.sub(float(wrasse?.70:.78).sub(u.mul(wrasse?.06:.12))).div(.010).pow2().negate().exp()
    .mul(u.smoothstep(.28,.32)).mul(u.smoothstep(wrasse?.92:.68,wrasse?.95:.72).oneMinus());

  let base=mix(linear(colors.belly),linear(colors.flank),h.smoothstep(.10,.46));
  base=mix(base,linear(colors.back),h.smoothstep(.56,.94));
  let pigment=float(1).sub(margin.mul(scaled).mul(1-colors.scaleEdge)).add(random.sub(.5).mul(.06).mul(scaled).mul(h.smoothstep(.15,.45)))
    .sub(seam.mul(.35)).sub(lateralLine.mul(sx.fract().sub(.5).abs().smoothstep(.05,.18).oneMinus()).mul(.30).mul(detail));
  if(wrasse){
    // Black blotch across the caudal base, carried onto the fin.
    const blotch=u.sub(.965).div(.05).pow2().pow2().add(h.sub(.5).div(.34).pow2().pow2()).negate().exp();
    pigment=pigment.mul(float(1).sub(blotch.mul(.92)));
  }else if(!garibaldi){
    // Scattered black spots on the hind body; a dusky pectoral base.
    const spot=random.greaterThan(.80).toFloat().mul(u.smoothstep(.50,.66)).mul(h.smoothstep(.22,.40))
      .mul(radius.smoothstep(.18,.40).oneMinus()).mul(scaled);
    const axil=vec2(u.sub(.29).div(.035),h.sub(.50).div(.07)).length().smoothstep(.4,1).oneMinus();
    pigment=pigment.mul(float(1).sub(spot.mul(.85)).sub(axil.mul(.45)));
  }
  const skin=base.mul(pigment);

  // Fins: opaque rays and clear membrane between them, a darker margin.
  const count=is(PART.caudal).mul(rays[0]).add(is(PART.dorsal).mul(rays[1])).add(is(PART.anal).mul(rays[2]))
    .add(is(PART.pectoral).mul(rays[3])).add(is(PART.pelvic).mul(rays[4]));
  const rayCoord=u.mul(count),rayDetail=float(1).sub(rayCoord.fwidth().smoothstep(.35,.8));
  const ray=rayCoord.mul(2*Math.PI).cos().mul(.5).add(.5).pow(6).mul(rayDetail).add(float(.18).mul(rayDetail.oneMinus()));
  const edge=h.smoothstep(wrasse?.78:.70,1);
  const clearFin=is(PART.pectoral).add(is(PART.pelvic).mul(wrasse?.6:.3));
  let membrane=mix(mix(linear(colors.fin),linear(colors.finEdge),edge),linear(colors.clear),clearFin.mul(.8));
  if(wrasse){
    const tail=is(PART.caudal).mul(h.smoothstep(.05,.40).oneMinus()).mul(u.sub(.5).abs().smoothstep(.20,.42).oneMinus());
    membrane=membrane.mul(float(1).sub(tail.mul(.9)));
  }else if(!garibaldi){
    const finSpots=mx_cell_noise_float(vec2(u.mul(9).floor(),h.mul(5).floor())).greaterThan(.72).toFloat()
      .mul(is(PART.dorsal).mul(u.smoothstep(.55,.62)).add(is(PART.caudal).mul(.6))).mul(rayDetail);
    membrane=membrane.mul(float(1).sub(finSpots.mul(.6)));
  }
  // Clear membrane shows the water behind it (the emissive term) more than it reflects.
  const finColor=membrane.mul(ray.mul(.35).oneMinus().add(.18)).mul(clearFin.mul(.45).oneMinus());
  // How much background light shows through: clear pectorals most.
  const clarity=fin.mul(ray.oneMinus()).mul(clearFin.mul(.55).add(.25)).mul(h.smoothstep(.05,.25)).mul(garibaldi?.35:1);

  const color=mix(skin,finColor,fin).mul(mix(vec3(.90,.95,1.05),vec3(1.08,1.02,.94),tint)).mul(eye.oneMinus()).add(eye);
  // Wet mucus over scales: glossy flanks with ventral silvering; the dark,
  // countershaded back reflects little of the bright surface overhead.
  const backward=h.smoothstep(.60,.92);
  const roughness=attribute('finMotion','vec4').w.add(margin.mul(scaled).mul(.12)).sub(body.mul(.06)).add(body.mul(backward).mul(.32));
  const metalness=body.mul(float(.03).add(h.smoothstep(.10,.45).oneMinus().mul(wrasse?.10:.18)).add(scaled.mul(radius.smoothstep(.2,.7).oneMinus()).mul(.04))).mul(backward.oneMinus());
  // Relief: scale ridges, the gill-cover step and fin rays. Perturb the
  // normal with the surface gradient of this height (no tangent frame).
  const height=body.mul(margin.mul(scaled).sub(seam.mul(.8)).add(u.smoothstep(gill.sub(.01),gill.add(.004)).mul(gillMask).mul(.6)))
    .add(fin.mul(ray.mul(.7)));
  const relief=height.mul(wrasse?.00022:.00032);
  const dpdx=positionView.dFdx(),dpdy=positionView.dFdy(),n=normalView;
  const r1=dpdy.cross(n),r2=n.cross(dpdx),det=dpdx.dot(r1).mul(faceDirection);
  const gradient=r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(det.sign());
  const normal=det.abs().mul(n).sub(gradient).normalize();
  return {color,roughness,metalness,normal,clarity};
}
