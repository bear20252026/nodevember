import { Fn, If, attribute, instanceIndex, mix, normalLocal, positionLocal, vec3, vec4 } from 'three/tsl';
import { BLADE_LINKS, BLADE_STATE_ROWS, BOUND_UNITS, rotateVector } from './blade-rod.js';

export function bladePosition(current,simulation,{offset,stride,plant,radius},shade=true){
  const blade=attribute('bladeUV','vec3');
  return Fn(builder=>{
    if(builder.shaderStage==='compute'){
      const bound=instanceIndex.add(plant).mul(2);
      const travel=simulation.bounds.read.element(bound).toFloat();
      const rotation=simulation.bounds.read.element(bound.add(1)).toFloat();
      // Each joint moves a vertex by at most the shift at its pivot plus
      // 2 sin(angle/2) times its measured influence radius. A dual-quaternion
      // blend of two joints moves it at most sqrt(2) times further.
      // Stalks pushed aside by the swimmer move by up to their plant's reach.
      const pushed=simulation.swimmer?simulation.swimmer.reach(instanceIndex.add(plant)):0;
      const margin=travel.add(rotation.mul(radius)).div(BOUND_UNITS).mul(Math.SQRT2).max(current.strength.mul(1.52)).add(pushed);
      return positionLocal.add(vec3(normalLocal.x.mul(margin),0,0));
    }
    const position=positionLocal.toVar();
    If(blade.z.greaterThan(.5),()=>{
      const row=instanceIndex.mul(stride).add(offset).add(blade.z.toUint().sub(1)).mul(BLADE_STATE_ROWS);
      const along=blade.x.clamp().mul(BLADE_LINKS).toVar();
      const link=along.floor().min(BLADE_LINKS-1),weight=along.sub(link);
      const start=row.add(link.toUint().mul(2));
      const joint=n=>simulation.blades.read.element(start.add(n));
      // Dual-quaternion blending: twisted sections keep their width.
      const q0=joint(0).toVar(),q1=joint(2).toVar(),sign=q0.dot(q1).greaterThanEqual(0).select(1,-1);
      const dual=(q,t)=>vec4(t.mul(q.w).add(t.cross(q.xyz)),t.dot(q.xyz).negate()).mul(.5);
      const real=mix(q0,q1.mul(sign),weight).toVar(),scale=real.length().toVar();
      const blended=mix(dual(q0,joint(1).xyz),dual(q1,joint(3).xyz).mul(sign),weight).div(scale).toVar();
      real.divAssign(scale);
      const translation=blended.xyz.mul(real.w).sub(real.xyz.mul(blended.w)).add(real.xyz.cross(blended.xyz)).mul(2);
      position.assign(rotateVector(real,positionLocal).add(translation));
      if(shade)normalLocal.assign(rotateVector(real,normalLocal).normalize());
    }).Else(()=>{
      const swayed=current.displace(positionLocal);
      position.assign(simulation.swimmer?swayed.add(simulation.swimmer.bend(instanceIndex.add(plant),positionLocal.y)):swayed);
    });
    return position;
  })();
}

export function bindBladeMaterials(forest,current,simulation){
  const variants=new Map();
  forest.group.traverse(mesh=>{
    const binding=mesh.userData.blades;
    if(!binding)return;
    if(!variants.has(binding)){
      const source=mesh.material,material=source.clone();
      material.setupLightingModel=source.setupLightingModel;
      material.positionNode=bladePosition(current,simulation,binding);
      variants.set(binding,material);
    }
    mesh.material=variants.get(binding);
  });
}
