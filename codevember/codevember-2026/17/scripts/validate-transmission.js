// Exercise the actual material shader in linear HDR, independently of grading
// and water. Run only after the experiment has finished initialization.
export async function validateTransmission(){
  const THREE=await import('three/webgpu'),{uniform,vec3}=await import('three/tsl');
  const {TissueMaterial}=await import('../tissue.js');
  const {applyCausticLighting}=await import('../caustic-lighting.js');
  const s=window.kelp,renderer=s.renderer,saved={manual:s.manual,target:renderer.getRenderTarget()};
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,10);
  camera.position.z=2;scene.background=new THREE.Color(0);
  const strength=uniform(.7),thickness=uniform(.001),attenuation=uniform(1);
  const material=new TissueMaterial({ior:1.42/1.333,roughness:.55});
  material.diffuseTransmissionNode=strength;material.tissueThicknessNode=thickness;
  material.absorptionNode=vec3(100,300,1200);material.sunAttenuationNode=vec3(attenuation);
  material.colorNode=vec3(.3,.2,.05).mul(strength.oneMinus());
  const focus=uniform(1);applyCausticLighting(material,{strength:uniform(1),causticIrradiance:()=>vec3(focus)});
  const geometry=new THREE.PlaneGeometry(2,2),leaf=new THREE.Mesh(geometry,material);scene.add(leaf);
  const light=new THREE.DirectionalLight(0xffffff,Math.PI);light.position.z=-3;scene.add(light);
  const target=new THREE.RenderTarget(16,16,{type:THREE.FloatType,depthBuffer:true});
  const checks=[],samples={};
  const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name);};
  async function sample(name){
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    const pixels=await renderer.readRenderTargetPixelsAsync(target,8,8,1,1);
    const rgb=Array.from(pixels).slice(0,3);
    check(`${name}: finite nonnegative HDR`,rgb.every(v=>Number.isFinite(v)&&v>=0));
    samples[name]=rgb;return rgb;
  }
  try{
    s.manual=true;
    const thin=await sample('backlit thin');
    check('Backlit pigment selectively absorbs blue',thin[0]>thin[1]&&thin[1]>thin[2]&&thin[2]>.01);
    thickness.value=.004;const thick=await sample('backlit thick');
    check('Increasing thickness attenuates every color channel',thick.every((v,i)=>v<thin[i]));
    thickness.value=.001;strength.value=0;const opaque=await sample('backlit opaque');
    check('No light crosses an opaque leaf',opaque.every(v=>v<.00001));
    strength.value=.7;attenuation.value=0;const shadow=await sample('shadowed');
    check('Blocked sunlight removes direct transmission',shadow.every(v=>v<.00001));
    attenuation.value=1;light.intensity=0;const dark=await sample('unlit');
    check('Transmission does not emit light',dark.every(v=>v<.00001));
    light.intensity=Math.PI*.5;const half=await sample('half sunlight');
    check('Transmission scales linearly with actual light radiance',half.every((v,i)=>Math.abs(v*2-thin[i])<.0001));
    light.intensity=Math.PI;focus.value=2;const focused=await sample('focused caustic');
    check('Caustics focus the incoming light before transmission',focused.every((v,i)=>Math.abs(v-thin[i]*2)<.0001));
    focus.value=.5;const spread=await sample('spread caustic');
    check('Caustics also redistribute light away from darker areas',spread.every((v,i)=>Math.abs(v-thin[i]*.5)<.0001));
    focus.value=2;attenuation.value=0;const blocked=await sample('shadowed caustic');
    check('Caustics cannot illuminate an opaque shadow',blocked.every(v=>v<.00001));
    focus.value=1;attenuation.value=1;
    light.intensity=Math.PI;light.position.z=3;const front=await sample('frontlit transmissive');
    strength.value=0;const frontOpaque=await sample('frontlit opaque');
    check('Transmitted energy is removed from diffuse reflection',frontOpaque.every((v,i)=>v>front[i]));
    check('Material retains opaque meshlet compatibility',material.transmission===0&&!material.transparent&&material.side===THREE.FrontSide);
    const report={date:new Date().toISOString(),checks,samples};window.kelpTransmissionValidation=report;return report;
  }finally{
    window.kelpTransmissionValidation={date:new Date().toISOString(),checks,samples};
    renderer.setRenderTarget(saved.target);s.manual=saved.manual;
    geometry.dispose();material.dispose();target.dispose();
  }
}
