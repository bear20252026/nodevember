import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three/webgpu';
import { STIPE_SAMPLES } from '../forest.js';
import { NODES, SWIMMER_RADIUS, createSwimmer } from '../swimmer.js';

// One upright stalk at x = z = 0 from y = -3 to 27, no current; the camera
// swims along +x at 1.3 m/s at the height of a stalk node, where the solver
// enforces its limits exactly.
const HEIGHT=-3+32*30/(NODES-1);
function stalk(){
  const lines=[-3,30/(STIPE_SAMPLES-1),0,0];
  for(let k=0;k<STIPE_SAMPLES;k++)lines.push(0,0,0,0);
  return new Float32Array(lines);
}
function swimPast(z){
  const camera=new PerspectiveCamera();camera.position.set(-4*SWIMMER_RADIUS,HEIGHT,z);
  const swimmer=createSwimmer(camera,stalk()),dt=1/60;
  let closest=Infinity,biggest=0,far=0,passing=null;
  while(camera.position.x<4*SWIMMER_RADIUS){
    camera.position.x+=1.3*dt;camera.lookAt(camera.position.x+1,HEIGHT,z);camera.updateMatrixWorld();
    swimmer.update(dt,0,0);
    const [x,zz]=swimmer.offsetAt(0,HEIGHT);
    closest=Math.min(closest,Math.hypot(x-camera.position.x,zz-camera.position.z));
    biggest=Math.max(biggest,Math.hypot(x,zz));
    for(const y of [HEIGHT-10,HEIGHT+10])far=Math.max(far,Math.hypot(...swimmer.offsetAt(0,y)));
    if(!passing&&camera.position.x>=0)passing=[x,zz];
  }
  return {camera,swimmer,closest,biggest,far,passing};
}

test('a soft sphere eases a stalk around itself and lets it bend back', () => {
  const {camera,swimmer,closest,biggest,far,passing}=swimPast(.3);
  assert.ok(closest>.45*SWIMMER_RADIUS-.01,`stalk came within ${closest} of the camera`);
  assert.ok(passing[1]<-.5,`as the camera passes, the stalk is beside it on the far side: ${passing}`);
  assert.ok(far<.6*biggest,`10 m away the stalk moved ${far}, against ${biggest} at the contact`);
  assert.deepEqual(swimmer.offsetAt(0,-3),[0,0],'the holdfast stays put');
  camera.position.set(80,HEIGHT,80);camera.updateMatrixWorld();
  for(let t=0;t<15;t+=1/60)swimmer.update(1/60,0,0);
  assert.equal(swimmer.active.size,0,'the stalk settles and leaves the active set');
});

test('a stalk dead ahead still slides around one side', () => {
  const {closest,passing}=swimPast(0);
  assert.ok(closest>.45*SWIMMER_RADIUS-.01,`stalk came within ${closest} of the camera`);
  assert.ok(Math.abs(passing[1])>.5,`as the camera passes, the stalk is beside it: ${passing}`);
});

test('a paused or zero-radius swimmer does not move stalks', () => {
  const camera=new PerspectiveCamera();camera.position.set(0,HEIGHT,.2);camera.updateMatrixWorld();
  const swimmer=createSwimmer(camera,stalk());
  swimmer.update(0,0,0);
  assert.deepEqual(swimmer.offsetAt(0,HEIGHT),[0,0]);
  swimmer.radius.value=0;swimmer.update(1/60,0,0);
  assert.deepEqual(swimmer.offsetAt(0,HEIGHT),[0,0]);
});
