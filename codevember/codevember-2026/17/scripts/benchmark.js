// Measure the normal RAF loop; includes camera/current animation, shadows,
// spatial FXAA and automatic resolution. No synthetic GPU-only FPS.
export function startBenchmark(seconds=75,warmup=12) {
  if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(warmup)||warmup<0)throw new Error('Expected a positive duration and nonnegative warmup.');
  const s=window.kelp,old={paused:s.settings.paused,rate:s.settings.flightRate,flight:s.settings.flight,lod:s.meshlets.lodThreshold};
  const orbitSeconds=Math.PI*2/.017;
  s.manual=false;s.meshlets.lodThreshold=1;s.settings.paused=false;s.settings.flight=true;s.settings.flightRate=orbitSeconds/(warmup||seconds);s.journey.reset();
  const adjustmentStart=s.metrics.adjustments.length;
  const samples=[],windows=[];let start=0,last=0,bucketStart=0,bucket=[],measuring=false;
  window.kelpBenchmark={status:'running'};
  return new Promise(resolve=>{
    function tick(now){
      if(!start){start=now;last=now;bucketStart=now;requestAnimationFrame(tick);return;}
      const elapsed=(now-start)/1000,ms=now-last;last=now;
      if(elapsed>warmup&&!measuring){measuring=true;s.journey.reset();s.settings.flightRate=orbitSeconds/seconds;bucketStart=now;requestAnimationFrame(tick);return;}
      if(elapsed>warmup){samples.push(ms);bucket.push(ms);}
      if(now-bucketStart>=1000){
        if(bucket.length)windows.push({seconds:elapsed,fps:1000/(bucket.reduce((a,b)=>a+b)/bucket.length),pixelRatio:s.renderer.getPixelRatio(),maxMs:Math.max(...bucket)});
        bucket=[];bucketStart=now;
      }
      if(elapsed<seconds+warmup){requestAnimationFrame(tick);return;}
      const sorted=samples.slice().sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b)/samples.length;
      const report={status:'complete',date:new Date().toISOString(),duration:elapsed,warmup,viewport:[innerWidth,innerHeight],devicePixelRatio,frames:samples.length,meanFps:1000/mean,p95Ms:sorted[Math.floor(sorted.length*.95)],p99Ms:sorted[Math.floor(sorted.length*.99)],framesOver50ms:samples.filter(x=>x>50).length,minimumOneSecondFps:Math.min(...windows.map(w=>w.fps)),windows,scene:s.inspect(),adjustments:s.metrics.adjustments.slice(adjustmentStart)};
      s.settings.paused=old.paused;s.settings.flightRate=old.rate;s.settings.flight=old.flight;s.meshlets.lodThreshold=old.lod;
      window.kelpBenchmark=report;resolve(report);
    }
    requestAnimationFrame(tick);
  });
}
