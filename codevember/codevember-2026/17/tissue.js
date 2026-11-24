import * as THREE from 'three/webgpu';
import { float, mix, normalView, normalViewGeometry, normalWorldGeometry, pmremTexture, positionViewDirection, specularColor, vec3 } from 'three/tsl';

// A thin diffuse BTDF shares energy with the reflected diffuse lobe. It uses
// the actual light radiance, without scene refraction or screen-space diffusion.
class TissueLightingModel extends THREE.PhysicalLightingModel {
  constructor(m){super(m.useClearcoat,m.useSheen,false,m.useAnisotropy,false,false);this.material=m;}
  direct(input,builder){
    const m=this.material,lightColor=input.lightColor.mul(m.sunAttenuationNode);
    super.direct({...input,lightColor},builder);
    // Fine-scale normal variation is weaker through a diffuse sheet than in
    // reflection. Keep the full relief for the reflected BRDF above.
    const sheetNormal=mix(normalViewGeometry,normalView,.66).normalize();
    const cosine=sheetNormal.dot(input.lightDirection),backCosine=cosine.negate().max(0);
    const path=m.tissueThicknessNode.div(cosine.abs().max(.2));
    const transmitted=m.absorptionNode.mul(path).negate().exp().mul(m.diffuseTransmissionNode);
    const entrance=specularColor.oneMinus().mul(float(1).sub(cosine.abs()).clamp().pow(5)).add(specularColor).oneMinus();
    const exit=specularColor.oneMinus().mul(float(1).sub(sheetNormal.dot(positionViewDirection).clamp()).pow(5)).add(specularColor).oneMinus();
    input.reflectedLight.directDiffuse.addAssign(lightColor.mul(backCosine).mul(transmitted).mul(entrance).mul(exit).mul(1/Math.PI));
  }
  indirectDiffuse(builder){
    super.indirectDiffuse(builder);
    // The scene environment lights the facing side. The reverse side receives
    // its irradiance from the opposite hemisphere (the PMREM at roughness one,
    // times pi), and part of that diffuses through the sheet. Twice the normal
    // thickness is a diffuse path fit. Light arriving from every direction
    // averages over fine thickness variation, so materials may supply a
    // smoother ambient thickness.
    const environment=builder.environmentNode;
    if(!environment?.value)return;
    const m=this.material,thickness=m.ambientThicknessNode??m.tissueThicknessNode,fraction=m.ambientTransmissionNode??m.diffuseTransmissionNode;
    const transmitted=m.absorptionNode.mul(thickness).mul(-2).exp().mul(fraction);
    const behind=pmremTexture(environment.value,normalWorldGeometry.negate(),float(1)).mul(Math.PI);
    builder.context.reflectedLight.indirectDiffuse.addAssign(behind.mul(transmitted).mul(specularColor.oneMinus()).mul(1/Math.PI));
  }
}
export class TissueMaterial extends THREE.MeshPhysicalNodeMaterial {
  constructor(parameters={}){
    super(parameters);this.diffuseTransmissionNode=float(0);this.absorptionNode=vec3(0);this.tissueThicknessNode=float(.001);
    this.sunAttenuationNode=vec3(1);this.fog=false;
    this.ambientThicknessNode=null;this.ambientTransmissionNode=null;
  }
  setupLightingModel(){return new TissueLightingModel(this);}
}
