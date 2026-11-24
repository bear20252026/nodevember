// Adapted from Day 10's GPU photon-energy checks. Read actual HDR receiver maps.
export async function validateCaustics(){
  const {DataUtils}=await import('three/webgpu'),s=window.kelp,c=s.caustics;
  const saved={manual:s.manual,paused:s.settings.paused,time:s.current.time.value,amplitude:c.amplitude.value};
  const checks=[],samples={};
  const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name);};
  async function sample(name){
    await new Promise(requestAnimationFrame);c.render(s.renderer);
    const data=await s.renderer.readRenderTargetPixelsAsync(c.map,0,0,c.map.width,c.map.height);
    const values=Float32Array.from(data,DataUtils.fromHalfFloat),layers=[],stride=values.length/(c.map.width*c.map.height);
    check(`${name}: finite nonnegative irradiance`,values.every(v=>Number.isFinite(v)&&v>=0));
    for(let layer=0;layer<c.depths.length;layer++){
      let sum=0,squares=0,maximum=0,minimum=Infinity;
      const x0=(layer%c.columns)*c.tileSize,y0=Math.floor(layer/c.columns)*c.tileSize;
      for(let y=y0;y<y0+c.tileSize;y++)for(let x=x0;x<x0+c.tileSize;x++){
        const v=values[(y*c.map.width+x)*stride];sum+=v;squares+=v*v;maximum=Math.max(maximum,v);minimum=Math.min(minimum,v);
      }
      const mean=sum/c.tileSize**2;layers.push({depth:c.depths[layer],mean,variance:squares/c.tileSize**2-mean*mean,minimum,maximum});
    }
    samples[name]=layers;return {data,values,layers};
  }
  try{
    s.manual=true;s.settings.paused=true;s.current.time.value=0;c.amplitude.value=0;
    const flat=await sample('flat');
    check(`Flat water preserves unit irradiance at all ${c.depths.length} depths`,flat.layers.every(v=>Math.abs(v.mean-1)<.01&&v.variance<.0001));
    c.amplitude.value=1;
    const focused=await sample('focused');
    check('Refraction conserves mean photon energy at every depth',focused.layers.every(v=>v.mean>.90&&v.mean<1.04));
    check('Waves focus and spread light',focused.layers.slice(1).every(v=>v.maximum>1.2&&v.minimum<.8&&v.variance>.01));
    check('Contrast fades below the focal depths as the sun disk and scrambled waves blur the pattern',
      focused.layers.slice(2).every((v,i,a)=>i===0||v.variance<a[i-1].variance));
    const paused=await sample('paused');
    check('Paused photon maps are byte-identical',focused.data.every((v,i)=>v===paused.data[i]));
    s.current.time.value=1;
    const moved=await sample('moving');let difference=0;
    const stride=moved.values.length/(c.map.width*c.map.height);
    for(let i=0;i<moved.values.length;i+=stride)difference+=Math.abs(moved.values[i]-focused.values[i]);
    difference/=moved.values.length/stride;
    check('Caustics move with the shared water clock',difference>.01);
    return {date:new Date().toISOString(),checks,samples,meanAnimationDifference:difference};
  }finally{
    window.kelpCausticValidation={date:new Date().toISOString(),checks,samples};
    c.amplitude.value=saved.amplitude;s.current.time.value=saved.time;s.settings.paused=saved.paused;s.manual=saved.manual;
  }
}
