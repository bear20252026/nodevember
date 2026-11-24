// Verify the path the photon-map tests cannot cover: sampling the atlas at
// world positions, then lighting the actual meshlet kelp and instanced fish.
export async function validateCausticReceivers(){
  const THREE=await import('three/webgpu'),{uniform,uv,vec3,vec4}=await import('three/tsl');
  const {SURFACE}=await import('../materials.js');
  const s=window.kelp,c=s.caustics,r=s.renderer;
  const saved={manual:s.manual,paused:s.settings.paused,strength:c.strength.value,time:s.current.time.value,
    amplitude:c.amplitude.value,forest:s.forest.group.visible,fish:s.fish.mesh.visible,target:r.getRenderTarget(),sun:s.sunlight.light.intensity};
  const depth=uniform(8),point=vec3(uv().x.sub(.5).mul(c.extent),depth.negate().add(SURFACE),uv().y.sub(.5).mul(c.extent));
  const sampled=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  sampled.fragmentNode=vec4(c.causticIrradiance(point),1);
  const modulated=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  modulated.fragmentNode=vec4(c.modulation(point),1);
  const quad=new THREE.QuadMesh(sampled),target=new THREE.RenderTarget(128,128,{type:THREE.FloatType,depthBuffer:false});
  const checks=[],samples={};
  const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name);};
  const next=()=>new Promise(requestAnimationFrame);
  async function receiver(name,material=sampled){
    await next();c.render(r);quad.material=material;r.setRenderTarget(target);quad.render(r);
    const pixels=await r.readRenderTargetPixelsAsync(target,0,0,128,128);
    r.setRenderTarget(saved.target);
    let sum=0,squares=0;const values=[];
    for(let i=0;i<pixels.length;i+=4){const v=pixels[i];values.push(v);sum+=v;squares+=v*v;}
    check(`${name}: finite nonnegative irradiance`,values.every(v=>Number.isFinite(v)&&v>=0));
    const mean=sum/values.length,variance=squares/values.length-mean*mean;
    samples[name]={mean,variance};return {values,mean,variance};
  }
  async function scenePixels(strength){
    c.strength.value=strength;
    // Let the meshlet occlusion queues settle with the fixed camera. Wait for
    // real animation frames so frame-scoped node updates see the new uniform.
    for(let i=0;i<5;i++){await next();s.render();}
    const rt=s.post.scenePass.renderTarget;
    const data=await r.readRenderTargetPixelsAsync(rt,0,0,rt.width,rt.height);
    return data instanceof Uint16Array?Float32Array.from(data,THREE.DataUtils.fromHalfFloat):data;
  }
  function difference(name,a,b,ambient){
    let visible=0,illuminated=0,changed=0,energy=0,delta=0;
    for(let i=0;i<a.length;i+=4){
      const l=a[i]+a[i+1]+a[i+2],d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
      if(l>.002)visible++;
      // Looking up shows mostly fish bellies in ambient light. Test the pixels
      // that actually receive sunlight, rather than requiring unlit faces to
      // acquire a decorative caustic overlay.
      const direct=l-ambient[i]-ambient[i+1]-ambient[i+2];
      if(direct>Math.max(.0002,l*.02)){illuminated++;if(d>Math.max(.0002,direct*.02))changed++;energy+=direct;delta+=d;}
    }
    const stats={visiblePixels:visible,sunlitPixels:illuminated,changedPixels:changed,changedFraction:changed/illuminated,relativeDifference:delta/energy};
    samples[name]=stats;
    check(`${name}: caustics visibly change actual sunlit receivers`,illuminated>100&&stats.changedFraction>.5&&stats.relativeDifference>.05);
  }
  async function receivers(name){
    const off=await scenePixels(0),on=await scenePixels(1);
    s.sunlight.light.intensity=0;
    const ambient=await scenePixels(0),ambientCaustics=await scenePixels(1);
    let ambientDelta=0,ambientEnergy=0,ambientMax=0;
    for(let i=0;i<ambient.length;i+=4)for(let j=0;j<3;j++){
      const d=Math.abs(ambient[i+j]-ambientCaustics[i+j]);ambientDelta+=d;ambientEnergy+=ambient[i+j];ambientMax=Math.max(ambientMax,d);
    }
    samples[`${name} ambient`]={relativeDifference:ambientDelta/Math.max(ambientEnergy,1e-6),maximumDifference:ambientMax};
    check(`${name}: caustics do not modify ambient-only lighting`,ambientDelta/Math.max(ambientEnergy,1e-6)<.0001);
    s.sunlight.light.intensity=saved.sun;
    difference(name,off,on,ambient);
  }
  try{
    s.manual=true;s.settings.paused=true;s.current.time.value=4;c.amplitude.value=1;c.strength.value=1;
    const atDepth=await receiver('8 m receiver');
    check('Atlas sampling retains focused and dark regions',atDepth.variance>.1&&atDepth.mean>.85&&atDepth.mean<1.15);
    depth.value=5;const between=await receiver('5 m receiver');
    check('Depth interpolation retains the caustic pattern',between.variance>.05&&between.mean>.85&&between.mean<1.15);
    depth.value=0;const surface=await receiver('surface');
    check('Irradiance approaches one at the water surface',Math.abs(surface.mean-1)<.001&&surface.variance<.00001);
    depth.value=8;c.strength.value=0;const off=await receiver('volume modulation off',modulated);
    check('Disabling caustics preserves ordinary sunlight',Math.abs(off.mean-1)<.001&&off.variance<.00001);
    c.strength.value=1;const on=await receiver('volume modulation on',modulated);
    check('Full modulation preserves sampled irradiance',on.values.every((v,i)=>Math.abs(v-atDepth.values[i])<.0001));
    s.forest.group.visible=true;s.fish.mesh.visible=false;
    await receivers('kelp');
    s.forest.group.visible=false;s.fish.mesh.visible=true;
    await receivers('fish');
    return {date:new Date().toISOString(),checks,samples};
  }finally{
    window.kelpCausticReceiverValidation={date:new Date().toISOString(),checks,samples};
    c.strength.value=saved.strength;c.amplitude.value=saved.amplitude;s.current.time.value=saved.time;s.sunlight.light.intensity=saved.sun;
    s.forest.group.visible=saved.forest;s.fish.mesh.visible=saved.fish;
    r.setRenderTarget(saved.target);s.settings.paused=saved.paused;s.manual=saved.manual;
    sampled.dispose();modulated.dispose();target.dispose();
  }
}
