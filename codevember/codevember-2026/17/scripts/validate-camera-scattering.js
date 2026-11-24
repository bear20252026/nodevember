// Render a sharp radiance edge at known distances through the actual camera
// shader. The shadowed side receives light only through forward scattering.
export async function validateCameraScattering(){
  const THREE=await import('three/webgpu');
  const { float, Fn, rtt, uniform, uv, vec3, vec4 }=await import('three/tsl');
  const { createCameraScattering,FORWARD_LOBES }=await import('../camera-scattering.js');
  const { createWaterOptics,EXTINCTION,WATER }=await import('../water-optics.js');
  const s=window.kelp,r=s.renderer,previousTarget=r.getRenderTarget(),previousManual=s.manual;
  const optics=createWaterOptics(),range=uniform(1),end=uniform(1),backdrop=uniform(0);
  const camera=new THREE.PerspectiveCamera(58,4,.08,105);
  const lit=rtt(vec4(vec3(uv().x.greaterThan(.5).select(1,0)),1),null,null,{depthBuffer:false});
  const forward=createCameraScattering(lit,()=>({geometry:range,boundary:float(100)}),optics,camera,()=>vec3(backdrop));
  const material=new THREE.MeshBasicNodeMaterial({depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  material.fragmentNode=Fn(()=>{
    const transmission=optics.transmittance(range);
    const equilibrium=vec3(backdrop).mul(transmission.oneMinus());
    return vec4(lit.rgb.mul(transmission).add(equilibrium).add(forward.received(end)),1);
  })();
  const quad=new THREE.QuadMesh(material),target=new THREE.RenderTarget(256,64,{type:THREE.FloatType,depthBuffer:false});
  const checks=[],samples={};
  function check(name,pass){
    checks.push({name,pass:!!pass});
    if(!pass)throw new Error(name);
  }
  async function read(name,density,distance,visiblePath=distance){
    optics.density.value=density;range.value=distance;end.value=visiblePath;
    await new Promise(requestAnimationFrame);
    r.setRenderTarget(target);quad.render(r);
    const data=await r.readRenderTargetPixelsAsync(target,0,32,256,1);
    const edge=data[127*4+1],bright=data[192*4+1];
    const sample={edge,bright,litEdge:data[128*4+1],beyondCone:data[112*4+1],relativeSpread:edge/Math.max(bright,1e-8)};
    samples[name]=sample;
    check(`${name}: finite nonnegative radiance`,data.every(v=>Number.isFinite(v)&&v>=0));
    return sample;
  }
  try{
    s.manual=true;
    const clear=await read('zero density',0,30);
    check('Zero optical density preserves an unscattered edge',clear.edge<.001&&Math.abs(clear.bright-1)<.001);
    const close=await read('one metre',.8,1);
    const far=await read('thirty metres',.8,30);
    check('The scattered fraction rises with viewing distance',far.relativeSpread>close.relativeSpread*5&&far.relativeSpread>.055);
    const murky=await read('higher optical density',1.6,30);
    // With the wide lobes the edge itself nears the symmetric limit of one half,
    // so more particles show mostly as light carried farther from the edge.
    check('More particles along the path produce more relative spread',murky.relativeSpread>far.relativeSpread*1.1&&murky.beyondCone/murky.bright>far.beyondCone/far.bright*1.3);
    const stopped=await read('foreground blocker',.8,30,.5);
    check('Foreground surfaces shorten the scattering path',stopped.edge<far.edge*.04);
    // The sharp cone alone sets a lower bound on the bright side; adding the
    // halo and glow lobes can at most reach the whole forward budget.
    const share=lobes=>WATER.particles[1]*lobes.reduce((sum,lobe)=>sum+lobe.probability,0);
    const narrowOnly=Math.exp(-(EXTINCTION[1]-share(FORWARD_LOBES.slice(0,1)))*.8*30);
    const allForward=Math.exp(-(EXTINCTION[1]-share(FORWARD_LOBES))*.8*30);
    check('Direct and forward contributions respect the forward-scattering energy budget',far.bright>narrowOnly-.002&&far.bright<allForward+.002);
    check('Halo and glow lobes carry light well beyond the narrow cone',far.beyondCone>.005&&close.beyondCone<far.beyondCone*.25);
    backdrop.value=1;
    const silhouette=await read('dark silhouette at thirty metres',.8,30);
    check('Forward scattering softens the dark edge against lit water',silhouette.litEdge<.98&&Math.abs(silhouette.bright-1)<.002);
    return {date:new Date().toISOString(),checks,samples};
  }finally{
    window.kelpCameraScatteringValidation={date:new Date().toISOString(),checks,samples};
    r.setRenderTarget(previousTarget);s.manual=previousManual;
    target.dispose();material.dispose();lit.dispose();forward.dispose();
  }
}
