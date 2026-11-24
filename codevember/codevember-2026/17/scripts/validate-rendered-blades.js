// Read the depth produced by the real forest draw. With the camera, stipes
// and all non-blade geometry fixed, only simulated blades can change it.
import { FloatType, MeshBasicNodeMaterial, QuadMesh, RenderTarget } from 'three/webgpu';
import { perspectiveDepthToViewZ, texture, uv, vec4 } from 'three/tsl';
import { flightPose } from '../journey.js';
import { BLADE_LINKS, BLADE_STATE_ROWS, BOUND_UNITS } from '../blade-rod.js';
import { MAX_STEP } from '../water-simulation.js';

export async function validateRenderedBlades(){
  const s=window.kelp,r=s.renderer,camera=s.camera,sim=s.simulation;
  const saved={manual:s.manual,fish:s.fish.mesh.visible,time:s.current.time.value,strength:s.current.strength.value,
    pos:camera.position.clone(),rot:camera.quaternion.clone(),target:r.getRenderTarget()};
  s.manual=true;
  const width=innerWidth,height=innerHeight;
  const target=new RenderTarget(width,height,{type:FloatType,depthBuffer:false});
  const material=new MeshBasicNodeMaterial({toneMapped:false});
  const depth=texture(s.post.scenePass.renderTarget.depthTexture,uv()).r;
  material.fragmentNode=vec4(perspectiveDepthToViewZ(depth,camera.near,camera.far).negate(),0,0,1);
  const quad=new QuadMesh(material);
  const read=data=>r.getArrayBufferAsync(data.attribute);
  const write=(data,bytes)=>r.backend.device.queue.writeBuffer(r.backend.get(data.attribute).buffer,0,bytes);
  const snapshots=[];
  const reports={};
  async function renderDepth(pose){
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
    for(let i=0;i<5;i++){await new Promise(requestAnimationFrame);s.render();}
    r.setRenderTarget(target);quad.render(r);
    const rgba=await r.readRenderTargetPixelsAsync(target,0,0,width,height);
    r.setRenderTarget(saved.target);
    const viewDepth=new Float32Array(width*height);
    for(let i=0;i<viewDepth.length;i++)viewDepth[i]=rgba[i*4];
    return viewDepth;
  }
  function difference(a,b,cutoff){
    let silhouette=0,foreground=0,surface=0;
    for(let i=0;i<a.length;i++){
      if(Math.min(a[i],b[i])<cutoff){
        foreground++;
        if((a[i]<cutoff)!==(b[i]<cutoff))silhouette++;
        if(Math.abs(a[i]-b[i])>.05)surface++;
      }
    }
    return {foreground,silhouette,surface,fraction:silhouette/Math.max(1,foreground)};
  }
  async function integrate(start,steps){
    for(let i=1;i<=steps;i++){
      s.current.time.value=start+i*MAX_STEP;
      sim.step(MAX_STEP);
      if(i%25===0)await r.backend.device.queue.onSubmittedWorkDone();
    }
  }
  try{
    for(const data of [sim.blades,sim.fish,sim.dynamics,sim.bounds])snapshots.push([data,await read(data)]);
    // Start from the same rest pose each time, then let the current develop.
    for(const [data] of snapshots)write(data,data.attribute.array);
    s.current.strength.value=1;s.fish.mesh.visible=false;
    await integrate(2,100);
    const views=[['flight',flightPose(0),9],['close',s.forest.inspectionPose(4),2.5]];
    const before=[],controls=[];
    for(const [,pose,cutoff] of views){
      const a=await renderDepth(pose);
      before.push(a);controls.push(difference(a,await renderDepth(pose),cutoff));
    }
    const interiorOnly=new Float32Array(await read(sim.blades));
    const heldBounds=new Uint32Array(await read(sim.bounds));
    await integrate(4,60);
    s.current.time.value=4; // freeze the analytical stipe sway at the first exposure
    const advanced=new Float32Array(await read(sim.blades));
    const bounds=new Uint32Array(await read(sim.bounds));
    for(let i=0;i<sim.bladeCount;i++){
      const base=i*BLADE_STATE_ROWS*4;
      // Remove the carrier translation from the second exposure. Move all
      // the skin matrices together so only bending and torsion are compared.
      const delta=[0,1,2].map(k=>advanced[base+4+k]-interiorOnly[base+4+k]);
      for(let n=0;n<=BLADE_LINKS;n++){
        const at=base+n*8;
        for(let k=0;k<3;k++)advanced[at+4+k]-=delta[k];
        if(n>0&&n<BLADE_LINKS)interiorOnly.set(advanced.subarray(at,at+8),at);
      }
    }
    // The spliced exposures combine two real poses. Their conservative
    // diagnostic bound includes both plus the held carrier translation.
    for(let k=0;k<bounds.length;k++)bounds[k]=Math.max(bounds[k],heldBounds[k])+(k%2===0?4*BOUND_UNITS:0);
    write(sim.bounds,bounds);
    write(sim.blades,advanced);
    for(const [i,[name,pose,cutoff]] of views.entries()){
      reports[name]={cutoff,control:controls[i],motion:difference(before[i],await renderDepth(pose),cutoff)};
    }
    write(sim.blades,interiorOnly);
    for(const [i,[name,pose,cutoff]] of views.entries()){
      reports[name].interiorOnly=difference(before[i],await renderDepth(pose),cutoff);
    }
    const checks=Object.entries(reports).flatMap(([name,{control,motion,interiorOnly}])=>[
      {name:name+' has identical depth with physics held',pass:control.foreground>100&&control.surface===0&&control.silhouette===0},
      {name:name+' shows blade motion along silhouettes',pass:motion.fraction>.1},
      {name:name+' shows interior flex with the tips held',pass:interiorOnly.fraction>.01}
    ]);
    const failed=checks.find(check=>!check.pass);
    if(failed)throw new Error(failed.name+' '+JSON.stringify(reports));
    return {date:new Date().toISOString(),width,height,scale:r.getPixelRatio(),seconds:60*MAX_STEP,checks,reports};
  }finally{
    for(const [data,bytes] of snapshots)write(data,bytes);
    camera.position.copy(saved.pos);camera.quaternion.copy(saved.rot);camera.updateMatrixWorld();
    s.current.time.value=saved.time;s.current.strength.value=saved.strength;s.fish.mesh.visible=saved.fish;
    r.setRenderTarget(saved.target);s.manual=saved.manual;
    target.dispose();material.dispose();
  }
}
