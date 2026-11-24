import * as THREE from 'three/webgpu';
import { positionWorld } from 'three/tsl';
import { KelpDrawingPipeline } from './kelp-pipeline.js';
import { createCurrent } from './current.js';
import { createMaterials } from './materials.js';
import { tissueReady } from './tissue-noise.js';
import { createForest } from './forest.js';
import { createPostProcessing } from './post-processing.js';
import { createFish, createFishSeeds } from './fish.js';
import { MAX_STEP, createWaterSimulation } from './water-simulation.js';
import { bindBladeMaterials } from './blade-motion.js';
import { SWIMMER_RADIUS, createSwimmer } from './swimmer.js';
import { createSunlight } from './sunlight.js';
import { createJourney } from './journey.js';
import { createSeafloor } from './seafloor.js';
import { createSettings, createSettingsPanel } from './settings.js';
import { createDisplayOutput, createDisplayRenderer } from './display-output.js';
import { createSoundscape } from './soundscape.js';
import { createCaustics } from './caustics.js';
import { applyCausticLighting } from './caustic-lighting.js';
import { SURFACE, createWaterOptics } from './water-optics.js';
import { createWaterEnvironment } from './water-environment.js';

export async function startExperiment(){
  const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
  if(!navigator.gpu)throw new Error('This experiment needs a WebGPU-capable browser.');
  // A floating-point canvas, so HDR displays get highlight headroom; SDR
  // displays and browsers without extended presentation get the SDR curve.
  const renderer=await createDisplayRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  const displayOutput=createDisplayOutput(renderer);
  window.addEventListener('pagehide',()=>displayOutput.dispose(),{once:true});
  renderer.toneMapping=THREE.NoToneMapping;
  // Occlusion culling removes almost nothing behind the thin blades, and its
  // screen-sized depth pyramid made every resolution change rebuild all
  // meshlet batches and pipelines, freezing the page for 0.5–2 s.
  const meshlets=new KelpDrawingPipeline({lodThreshold:1.0,shadowLodThreshold:1.5,occlusionCulling:false});renderer.drawingPipeline=meshlets;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
  const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.08,105);
  const current=createCurrent(),optics=createWaterOptics(),sunlight=createSunlight(current,camera),caustics=createCaustics(current),materials=createMaterials(current,caustics,optics),forest=createForest(materials,chunks=>meshlets.prebuild(chunks));
  // The camera is a soft sphere that pushes blades and stalks aside (swimmer.js).
  const swimmer=createSwimmer(camera,forest.stipeLines);
  const simulation=createWaterSimulation(renderer,current,forest.bladeRest,createFishSeeds(forest.stipeLines),camera,swimmer);
  bindBladeMaterials(forest,current,simulation);
  scene.add(forest.group,sunlight.light);sunlight.setForest(forest,simulation);
  const post=createPostProcessing(renderer,scene,camera,sunlight,caustics,optics,current,displayOutput);
  const fish=createFish(simulation,camera,optics,post.water.column);scene.add(fish.mesh);
  fish.mesh.traverse(object=>{if(object.isMesh){applyCausticLighting(object.material,caustics,undefined,optics.sunlightAt(positionWorld.y));object.receiveShadow=true;}});
  const fill=new THREE.HemisphereLight('#93d0fa','#183b48',.45);scene.add(fill);
  // Fish, kelp and floor are lit by, and reflect, the water's radiance at the starting depth.
  const environment=createWaterEnvironment(post.water.column,optics.density);scene.environment=environment.texture;
  // The reef: terrain, boulders and cobbles around the holdfasts.
  const seafloor=createSeafloor({caustics,optics,plants:[...forest.placements,...forest.fronds],ambientDepth:environment.depth,time:current.time,sunlight});scene.add(seafloor.group);
  const journey=createJourney(camera,canvas,{onFreeSwim(){settings.flight=false;meshlets.lodThreshold=1;},ground:seafloor.surfaceHeight});journey.reset();
  let nativeRatio=devicePixelRatio,panel=null;
  const settings=createSettings(matchMedia('(prefers-reduced-motion: reduce)').matches,nativeRatio);
  const metrics={fps:0,frameMs:0,frames:0,history:[],adjustments:[]};
  let manual=false,last=0,windowStart=0,samples=[],settleUntil=performance.now()+9000;
  let slowWindows=0,probe=null,blockedUntil=0;
  function resize(keepProbe=false){
    if(keepProbe!==true){probe=null;slowWindows=0;blockedUntil=0;}
    if(devicePixelRatio!==nativeRatio){
      const useNative=settings.adaptive||settings.resolution>=nativeRatio;
      nativeRatio=devicePixelRatio;
      settings.resolution=useNative?nativeRatio:Math.min(settings.resolution,nativeRatio);
    }
    panel?.setNativeRatio(nativeRatio);
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    const limit=renderer.backend.device.limits.maxTextureDimension2D/Math.max(innerWidth,innerHeight);
    const ratio=Math.min(nativeRatio,settings.resolution,limit);
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth,innerHeight);
    post.water.resize(ratio,innerWidth,innerHeight);
    samples=[];windowStart=performance.now();
    settleUntil=performance.now()+5000;
  }
  resize();window.addEventListener('resize',resize);
  function watchPixelRatio(){
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change',()=>{
      resize();watchPixelRatio();
    },{once:true});
  }
  watchPixelRatio();
  function advance(dt){
    if(!Number.isFinite(dt)||dt<0)throw new Error('Expected a nonnegative finite timestep.');
    const elapsed=Math.min(dt,MAX_STEP*4),steps=Math.ceil(elapsed/MAX_STEP);
    journey.update(elapsed*settings.flightRate,settings.flight,elapsed);
    // The swimmer fades out while inspecting a frond, so it frames it untouched.
    const reach=journey.mode==='inspect'?0:SWIMMER_RADIUS;
    swimmer.radius.value+=(reach-swimmer.radius.value)*(1-Math.exp(-elapsed/.5));
    swimmer.update(elapsed,current.time.value,current.strength.value);
    post.snow?.update(elapsed);
    for(let i=0;i<steps;i++){
      current.time.value+=elapsed/steps;
      simulation.step(elapsed/steps);
    }
  }
  // Like a camera's auto exposure, partly compensate the light lost with
  // depth: about 4% per metre against the flight depth, so the deep reef
  // stays readable and the bright shallows do not burn out.
  function render(){post.adaptation.value=Math.min(2.2,Math.max(.6,Math.exp(.04*(SURFACE-camera.position.y-12.5))));seafloor.update(renderer);fish.prepare(renderer);caustics.render(renderer);post.render();metrics.frames++;}
  const api=window.kelp={displayOutput,renderer,scene,camera,current,swimmer,materials,forest,seafloor,post,meshlets,sunlight,caustics,fish,simulation,journey,settings,metrics,advance,render,resize,
    get manual(){return manual;},set manual(value){manual=!!value;last=0;},
    inspect(){return {fps:metrics.fps,frameMs:metrics.frameMs,viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),lodThreshold:meshlets.lodThreshold,meshlets:meshlets.info,forest:forest.stats,adapter:renderer.backend.device.adapterInfo};}};
  function resetCamera(){journey.reset();meshlets.lodThreshold=1;settings.flight=true;}
  const performanceInfo={fps:'—',blades:`${forest.stats.leaves.toLocaleString()} + ${forest.stats.backdrop.leaves.toLocaleString()}`,meshlets:'—'};
  panel=createSettingsPanel(settings,{
    flight(on){if(on){journey.resume();meshlets.lodThreshold=1;}},
    inspect(){settings.flight=false;meshlets.lodThreshold=.45;journey.inspect(()=>forest.inspectionPose(current.time.value,current.strength.value));},
    reset:resetCamera,
    adaptive(on){if(on){settings.resolution=nativeRatio;resize();}},
    resolution(){settings.adaptive=false;resize();},
    meshlets(on){meshlets.debug=on;},
    sound(on){soundscape.setEnabled(on);},
    changed(){
      current.strength.value=settings.current;materials.translucency.value=settings.translucency;caustics.strength.value=settings.caustics;
      post.water.density.value=settings.density;post.water.rays.value=settings.rays;post.exposure.value=settings.exposure;
      for(const key of ['temperature','tint','saturation','contrast','vignette'])post.grading[key].value=settings[key];
    }
  },performanceInfo,nativeRatio,displayOutput);
  api.gui=panel.gui;
  // Sound starts with the first click or key press, as browsers require.
  const soundscape=createSoundscape();api.soundscape=soundscape;soundscape.setEnabled(settings.sound);
  const listen=()=>soundscape.start();
  for(const type of ['pointerdown','keydown'])window.addEventListener(type,listen,{once:true});
  window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();settings.paused=!settings.paused;}if(e.code==='KeyR')resetCamera();if(e.code==='KeyH')document.body.classList.toggle('ui-hidden');if(e.code==='KeyM'){settings.sound=!settings.sound;soundscape.setEnabled(settings.sound);}});
  document.addEventListener('visibilitychange',()=>{last=0;samples=[];settleUntil=performance.now()+4000;if(document.hidden)soundscape.suspend();else soundscape.resume();});
  renderer.onDeviceLost=info=>{status.hidden=false;status.textContent=`Graphics device lost: ${info.message}. Reload to restart.`;};
  status.textContent='Preparing sunlight and meshlets…';
  simulation.step(MAX_STEP);
  environment.render(renderer,camera);
  await Promise.all([meshlets.whenPrebuilt(),tissueReady()]);
  await renderer.compileAsync(scene,camera);
  render();await renderer.backend.device.queue.onSubmittedWorkDone();status.hidden=true;
  windowStart=performance.now();settleUntil=windowStart+9000;
  function adjustResolution(now,frameTimes){
    // Leave headroom for the denser groves on the flight. Ignore the tail
    // of long stalls when estimating the cost of ordinary frames.
    const budget=1000/35;
    const mean=frameTimes.reduce((sum,ms)=>sum+Math.min(ms,50),0)/frameTimes.length;
    if(now<settleUntil||now<blockedUntil)return;
    if(probe){
      if(mean>probe.mean*1.01&&mean>1000/30){
        settings.resolution=probe.previous;
        metrics.adjustments.push({time:current.time.value,fps:1000/mean,resolution:settings.resolution,reason:'no measured gain'});
        resize(true);blockedUntil=now+20000;
      }
      probe=null;slowWindows=0;
      return;
    }
    slowWindows=mean>budget?slowWindows+1:0;
    if(slowWindows<2)return;
    const ratio=renderer.getPixelRatio(),previous=settings.resolution;
    // Shadows, physics and the water atlas cost the same at every DPR.
    // Model half the frame as fixed cost for this first estimate, then use
    // the measured frame time at the new scale before trying another size.
    const factor=Math.sqrt(Math.max(0,2*budget/mean-1));
    const next=ratio*Math.max(.66,Math.min(.83,factor));
    const resolution=Math.max(Math.min(.6,nativeRatio),Math.floor((next+1e-6)*20)/20);
    if(resolution>=ratio)return;
    probe={previous,mean};slowWindows=0;
    settings.resolution=resolution;
    metrics.adjustments.push({time:current.time.value,fps:1000/mean,resolution,reason:'slow sustained frame time'});
    resize(true);
  }
  function frame(now){
    requestAnimationFrame(frame);if(document.hidden||manual){last=0;return;}
    const raw=last?(now-last)/1000:1/60,dt=Math.min(raw,.1);last=now;
    if(!settings.paused)advance(dt);else journey.update(0,false,dt);render();
    soundscape.update(camera,current.time.value,current.strength.value);
    if(raw>0)samples.push(raw*1000);
    if(now-windowStart>2000&&samples.length>10){
      const mean=samples.reduce((a,b)=>a+b,0)/samples.length;metrics.frameMs=mean;metrics.fps=1000/mean;
      metrics.history.push({time:current.time.value,fps:metrics.fps,ratio:renderer.getPixelRatio(),maxMs:Math.max(...samples)});if(metrics.history.length>300)metrics.history.shift();
      performanceInfo.fps=`${metrics.fps.toFixed(1)} at ${renderer.getPixelRatio().toFixed(2)}×`;performanceInfo.meshlets=meshlets.info.clusters.toLocaleString();
      if(settings.adaptive&&!settings.paused)adjustResolution(now,samples);
      samples=[];windowStart=now;
    }
  }
  requestAnimationFrame(frame);return api;
}
