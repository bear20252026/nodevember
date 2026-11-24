// Reused from Day 10. Modulate direct irradiance before evaluating the BRDF/BTDF.
import { mix, positionWorld, vec3 } from 'three/tsl';

export function applyCausticLighting(material,optics,irradiance=optics.causticIrradiance(positionWorld),transmittance=vec3(1)){
  const modulation=mix(vec3(1),irradiance,optics.strength).max(0).mul(transmittance);
  const setupLightingModel=material.setupLightingModel;
  material.setupLightingModel=function(builder){
    const model=setupLightingModel.call(this,builder),direct=model.direct;
    model.direct=function(input,builder){direct.call(this,{...input,lightColor:input.lightColor.mul(modulation)},builder);};
    return model;
  };
}
