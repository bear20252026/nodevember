import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import { createForest } from '../forest.js';
import { flightPose } from '../journey.js';

test('backdrop holdfasts stay clear of the flight and outside the blade solver',()=>{
  const m=new THREE.MeshBasicMaterial(),forest=createForest({kelp:m,floor:m}),{backdrop}=forest;
  const stats=forest.stats.backdrop;
  assert.ok(backdrop.length>=80,`${backdrop.length} backdrop plants`);
  assert.ok(stats.stipes>=2*backdrop.length&&stats.stipes<=3*backdrop.length,'Each holdfast carries two or three fronds');
  for(const item of backdrop){
    for(const p of forest.placements)assert.ok(Math.hypot(item.x-p.x,item.z-p.z)>2.2,'Backdrop plants do not overlap simulated plants');
    assert.ok(item.height>0&&item.scale>0);
  }
  // Fronds spread up to about 2.5 m from the holdfast; keep them well off the path.
  for(let t=0;t<800;t+=.5){
    const {position}=flightPose(t);
    for(const item of backdrop)assert.ok(Math.hypot(position.x-item.x,position.z-item.z)>=5);
  }
  const meshes=forest.group.children.filter(mesh=>mesh.name.startsWith('Kelp backdrop'));
  assert.ok(meshes.length>0);
  for(const mesh of meshes)assert.ok(!mesh.userData.blades,'Backdrop meshes use the current field, not solver rows');
  for(const mesh of forest.shadowMeshes)assert.ok(!mesh.name.startsWith('Kelp backdrop'),'Backdrop plants cast no shadows');
});
