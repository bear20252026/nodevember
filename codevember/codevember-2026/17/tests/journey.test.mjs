import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import { SURFACE } from '../water-optics.js';

// A minimal DOM: pointer, wheel and key events reach the journey as plain events.
globalThis.window??=new EventTarget();
const { createJourney, flightPose }=await import('../journey.js');
const event=(type,fields)=>Object.assign(new Event(type,{cancelable:true}),fields);
function rig(){
  const canvas=Object.assign(new EventTarget(),{setPointerCapture(){},focus(){}});
  const camera=new THREE.PerspectiveCamera(58,16/9,.08,105);
  let swims=0;
  const journey=createJourney(camera,canvas,{onFreeSwim(){swims++;}});
  journey.reset();
  const run=(seconds,step=1/60)=>{for(let t=0;t<seconds;t+=step)journey.update(step,true,step);};
  const drag=(dx,dy)=>{
    canvas.dispatchEvent(event('pointerdown',{pointerId:1,clientX:400,clientY:400}));
    for(let i=1;i<=20;i++)canvas.dispatchEvent(event('pointermove',{pointerId:1,clientX:400+dx*i/20,clientY:400+dy*i/20}));
    canvas.dispatchEvent(event('pointerup',{pointerId:1}));
  };
  const key=(code,down)=>window.dispatchEvent(event(down?'keydown':'keyup',{code,shiftKey:false}));
  const pitch=()=>Math.asin(camera.getWorldDirection(new THREE.Vector3()).y);
  return {camera,journey,run,drag,key,pitch,swims:()=>swims};
}

test('looking reaches almost straight up and down without rolling the horizon',()=>{
  const {camera,run,drag,pitch}=rig();
  drag(0,-4000);run(1.5);
  assert.ok(pitch()>1.45&&pitch()<=1.5+1e-4,`pitch ${pitch()}`);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  assert.ok(Math.abs(right.y)<1e-6,'The camera keeps a level horizon');
  drag(0,8000);run(1.5);
  assert.ok(pitch()<-1.45&&pitch()>=-1.5-1e-4,`pitch ${pitch()}`);
});

test('swimming takes over from the flight, glides to rest and stays underwater',()=>{
  const {camera,journey,run,key,swims}=rig();
  run(1);const start=camera.position.clone();
  key('KeyW',true);run(2);key('KeyW',false);
  assert.equal(journey.mode,'free');assert.equal(swims(),1);
  const swum=camera.position.distanceTo(start);
  assert.ok(swum>1.5&&swum<2.8,`swam ${swum} m in two seconds`);
  run(4);const rest=camera.position.clone();run(1);
  assert.ok(camera.position.distanceTo(rest)<.01,'The glide comes to rest');
  key('KeyE',true);run(30);key('KeyE',false);run(2);
  assert.ok(camera.position.y<=SURFACE-.3+1e-6,'Rising stops below the surface');
});

test('rejoining the flight blends back onto the path',()=>{
  const {camera,journey,run,key}=rig();
  key('KeyD',true);run(1.5);key('KeyD',false);run(1);
  const away=camera.position.clone();
  journey.resume();run(.5,1/60);
  const midway=camera.position.clone();
  run(3);
  const pose=flightPose(journey.elapsed);
  assert.ok(midway.distanceTo(away)>.01&&midway.distanceTo(pose.position)>.01,'Halfway through the blend the camera is between the two');
  assert.ok(camera.position.distanceTo(pose.position)<1e-6,'After the blend the camera is on the flight path');
});
