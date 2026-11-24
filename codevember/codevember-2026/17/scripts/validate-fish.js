// Exercise the actual indirect fish draws, their skinning shader and the
// coupled solver. The fin exposure holds the spine phase and world pose.
import { Vector3 } from 'three/webgpu';

export async function validateFish(){
  const s=window.kelp,r=s.renderer,sim=s.simulation,c=s.camera;
  const old={manual:s.manual,time:s.current.time.value,pos:c.position.clone(),rot:c.quaternion.clone(),forest:s.forest.group.visible};
  const read=d=>r.getArrayBufferAsync(d.attribute),write=(d,a)=>r.backend.device.queue.writeBuffer(r.backend.get(d.attribute).buffer,0,a);
  const saved=[],checks=[],samples={};
  function check(name,pass){checks.push({name,pass:!!pass});if(!pass)throw Error(name+' '+JSON.stringify(samples));}
  async function draw(){
    for(let k=0;k<3;k++){await new Promise(requestAnimationFrame);s.render();}
    const t=s.post.scenePass.renderTarget;return r.readRenderTargetPixelsAsync(t,0,0,t.width,t.height);
  }
  function change(a,b){
    let changed=0,visible=0;
    for(let i=0;i<a.length;i+=4){
      if(a[i]||a[i+1]||a[i+2]||b[i]||b[i+1]||b[i+2])visible++;
      if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;
    }
    return changed/Math.max(1,visible);
  }
  try{
    s.manual=true;
    for(const d of [sim.fish,sim.attitude,sim.motor,sim.blades,sim.dynamics,sim.bounds])saved.push([d,await read(d)]);
    const before=new Float32Array(saved[2][1]);
    for(let n=0;n<15;n++){s.current.time.value+=.02;sim.step(.02);}
    const motor=new Float32Array(await read(sim.motor)),head=new Float32Array(await read(sim.attitude));
    const efforts=[],advances=[];let lengthError=0,bank=0;
    for(let i=0;i<head.length;i+=4){
      lengthError=Math.max(lengthError,Math.abs(Math.hypot(head[i],head[i+1],head[i+2])-1));
      bank=Math.max(bank,Math.abs(head[i+3]));efforts.push(motor[i+1]);
      advances.push((2*Math.PI+motor[i]-before[i])%(2*Math.PI));
    }
    samples.school={lengthError,bank,effort:[Math.min(...efforts),Math.max(...efforts)],differentPhases:new Set(advances.map(x=>Math.round(x*100))).size};
    check('Fish have unit headings and finite banked turns',head.every(Number.isFinite)&&lengthError<.00001&&bank>.02&&bank<.51);
    check('Individuals vary stroke rate and effort',motor.every(Number.isFinite)&&samples.school.differentPhases>10&&Math.max(...efforts)-Math.min(...efforts)>.15);
    const animals=new Float32Array(saved[0][1]);
    for(let i=0;i<animals.length;i+=8)animals.set([200,20,200],i);
    const point=new Vector3(-2,20.5,4);animals.set([...point.toArray(),.29],0);
    head.set([1,0,0,.05]);motor.set([.3,.84,.08,.40]);
    write(sim.fish,animals);write(sim.attitude,head);write(sim.motor,motor);
    c.position.copy(point).add(new Vector3(.15,.28,.70));c.lookAt(point);c.updateMatrixWorld();s.forest.group.visible=false;
    const baseline=await draw(),held=await draw();samples.held=change(baseline,held);
    const counts=async()=>Array.from(new Uint32Array(await r.getArrayBufferAsync(s.fish.commands))).filter((_,i)=>i%5===1);
    samples.nearCounts=await counts();
    check('Only the near blacksmith draw contains the inspected fish',samples.nearCounts.join(',')==='1,0,0,0,0,0');
    check('Held fish, fins and water lighting reproduce identical HDR pixels',samples.held===0);
    motor[3]+=Math.PI/2;write(sim.motor,motor);samples.pectoral=change(baseline,await draw());
    motor[3]-=Math.PI/2;motor[0]+=Math.PI/2;write(sim.motor,motor);samples.tail=change(baseline,await draw());
    check('The pectoral stroke changes drawn fish pixels with the tail held',samples.pectoral>.005);
    check('The body wave changes drawn fish pixels with the pectorals held',samples.tail>.025);
    c.position.copy(point).add(new Vector3(0,1,43));c.lookAt(point);c.updateMatrixWorld();await draw();
    samples.farCounts=await counts();
    check('The same fish switches to the distant draw at small projected size',samples.farCounts.join(',')==='0,1,0,0');
    return {date:new Date().toISOString(),checks,samples};
  }finally{
    for(const [d,a] of saved)write(d,a);
    c.position.copy(old.pos);c.quaternion.copy(old.rot);c.updateMatrixWorld();
    s.forest.group.visible=old.forest;s.current.time.value=old.time;s.manual=old.manual;
  }
}
