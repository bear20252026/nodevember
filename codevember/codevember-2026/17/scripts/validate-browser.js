// Run from the experiment: await (await import('./scripts/validate-browser.js')).validateBrowser()
export async function validateBrowser() {
  if(!window.kelp||!document.querySelector('#status').hidden||window.kelp.metrics.frames<3)throw new Error('Wait until the scene finishes initialization before validating.');
  const s=window.kelp,checks=[],canvas=document.querySelector('canvas');
  const saved={paused:s.settings.paused,manual:s.manual,translucency:s.materials.translucency.value,caustics:s.caustics.strength.value,density:s.post.water.density.value,current:s.current.strength.value,rays:s.post.water.rays.value};
  const frames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
  const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name);};
  // Drive the lil-gui controllers, so each change takes the panel's own path.
  const input=(key,value)=>s.gui.controllersRecursive().find(c=>c.object===s.settings&&c.property===key).setValue(value);
  try {
    check('SunLight uses two 4096² cascades',s.sunlight.light.isSunLight&&s.sunlight.light.castShadow&&s.sunlight.light.shadow.getViewportCount()===2&&s.sunlight.size===4096&&s.sunlight.target.width===8192);
    s.manual=false;s.settings.paused=true;
    const t=s.current.time.value,steps=s.simulation.steps;
    await frames(5);check('Pause freezes the current and GPU simulation',s.current.time.value===t&&s.simulation.steps===steps);
    await frames(20);
    const comparison=new OffscreenCanvas(canvas.width,canvas.height),context=comparison.getContext('2d',{willReadFrequently:true});
    const pixels=async()=>{await s.renderer.backend.device.queue.onSubmittedWorkDone();context.drawImage(canvas,0,0);return context.getImageData(0,0,canvas.width,canvas.height).data;};
    const fixedImage=await pixels(),projection=s.camera.projectionMatrix.elements.slice();await frames(6);const nextImage=await pixels();
    check('Paused pixels are identical across frames without temporal jitter',fixedImage.every((v,i)=>v===nextImage[i]));
    check('Projection remains fixed between paused frames',projection.every((v,i)=>v===s.camera.projectionMatrix.elements[i]));
    s.settings.paused=false;await frames(5);check('GPU simulation advances after resume',s.current.time.value>t&&s.simulation.steps>steps);
    const volumeTask=s.post.water.volume,updateVolume=volumeTask.updateBefore;
    const events=[],shadowBefore=s.sunlight.scene.onBeforeRender,causticBefore=s.caustics.scene.onBeforeRender,sceneAfter=s.scene.onAfterRender;
    const record=(kind,original)=>function(...args){events.push({kind,time:s.current.time.value,step:s.simulation.steps,camera:args[2].uuid});original.apply(this,args);};
    s.caustics.scene.onBeforeRender=record('caustics',causticBefore);s.sunlight.scene.onBeforeRender=record('shadow',shadowBefore);s.scene.onAfterRender=record('scene',sceneAfter);
    volumeTask.updateBefore=function(frame){
      events.push({kind:'volume',time:s.current.time.value,step:s.simulation.steps});
      return updateVolume.call(this,frame);
    };
    try {
      await frames(24);
      const sequence=['caustics','shadow','shadow','scene','volume'];
      check('Caustics, both cascades, color and the water volume update in order every frame',events.length>=24*sequence.length&&events.length%sequence.length===0&&events.every((e,i)=>{
        const j=i%sequence.length;
        return e.kind===sequence[j]&&(j===0||e.time===events[i-1].time&&e.step===events[i-1].step)&&(j!==2||e.camera!==events[i-1].camera);
      }));
    } finally {volumeTask.updateBefore=updateVolume;s.caustics.scene.onBeforeRender=causticBefore;s.sunlight.scene.onBeforeRender=shadowBefore;s.scene.onAfterRender=sceneAfter;}
    s.manual=true;
    canvas.focus({preventScroll:true});check('Canvas focus has no outline',getComputedStyle(canvas).outlineStyle==='none');
    input('current',0);check('Current control reaches shader',s.current.strength.value===0);
    input('translucency',0);check('Diffuse transmission can be disabled',s.materials.translucency.value===0);
    input('caustics',0);check('Caustic illumination can be disabled',s.caustics.strength.value===0);
    await frames(1);s.render();
    // Epipolar shaft texture: one column per screen line through the sun,
    // `radial` rays per line, and blocks of (shaft, canopy) pairs per range.
    const {shafts}=s.post.water,{radial,blocks}=s.post.water.layout,width=shafts.image.width;
    const volume=await s.renderer.backend.copyTextureToBuffer(shafts,0,0,width,shafts.image.height);
    const {DataUtils}=await import('three/webgpu');
    const decode=volume instanceof Uint16Array?DataUtils.fromHalfFloat:v=>v;
    let originError=0,visibilityError=0,rangeChange=0;
    const cameraVisibility=decode(volume[1]);
    for(let block=0;block<blocks;block++)for(let y=block*radial;y<(block+1)*radial;y++)for(let x=0;x<width;x++){
      const at=(y*width+x)*4;
      for(const [shaft,canopy] of [[0,1],[2,3]]){
        const visibility=decode(volume[at+canopy]),range=block*2+canopy/2-.5;
        visibilityError=Math.max(visibilityError,Math.abs(decode(volume[at+shaft])-visibility));
        if(range===0)originError=Math.max(originError,Math.abs(visibility-cameraVisibility));
        else rangeChange=Math.max(rangeChange,Math.abs(visibility-cameraVisibility));
      }
    }
    check('All zero-range rays evaluate visibility at the same camera position',originError<.002);
    check('Shadow visibility changes along the sampled paths',rangeChange>.01);
    check('With caustics off the volume preserves the green-band shadow integral',visibilityError<.002);
    input('rays',0);check('Sun shafts can be disabled',s.post.water.rays.value===0);
    // Zero-density water is an edge case outside the UI's artistic range.
    // Inspect linear HDR samples, before tone mapping could hide NaN/Infinity.
    for(const density of [0,.3,2]) {
      s.post.water.density.value=density;await frames(1);s.render();
      const rt=s.post.renderHDR();await s.renderer.backend.device.queue.onSubmittedWorkDone();
      const pixels=await s.renderer.readRenderTargetPixelsAsync(rt,Math.floor(rt.width/2)-16,Math.floor(rt.height/2)-16,32,32);
      const finite=pixels instanceof Uint16Array?pixels.every(x=>(x&0x7c00)!==0x7c00):pixels.every(Number.isFinite);
      check(`HDR output is finite at water density ${density}`,finite);
    }
    s.gui.open();
    const title=s.gui.domElement.querySelector('.title');
    check('Settings opens with correct accessible state',!s.gui._closed&&title.getAttribute('aria-expanded')==='true');
    const rect=s.gui.domElement.getBoundingClientRect();check('Settings fits viewport',rect.left>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight);
    s.gui.close();
    const report={date:new Date().toISOString(),viewport:[innerWidth,innerHeight],checks};window.kelpValidation=report;return report;
  } finally {
    s.materials.translucency.value=saved.translucency;s.caustics.strength.value=saved.caustics;s.post.water.density.value=saved.density;s.current.strength.value=saved.current;s.post.water.rays.value=saved.rays;
    for(const [key,v] of [['translucency',saved.translucency],['caustics',saved.caustics],['density',saved.density],['current',saved.current],['rays',saved.rays]])input(key,v);
    s.settings.paused=saved.paused;s.manual=saved.manual;
  }
}
