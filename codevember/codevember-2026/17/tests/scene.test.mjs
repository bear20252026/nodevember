import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { createKelpGeometry } from '../kelp-geometry.js';
import { splitGeometry } from '../geometry-chunks.js';
import { createForest, STIPE_SAMPLES } from '../forest.js';
import { FLIGHT_PERIOD, flightPose } from '../journey.js';
import { SURFACE } from '../water-optics.js';
import { groundHeight } from '../seafloor.js';
import { createFishSeeds } from '../fish.js';
import { createFishGeometry } from '../fish-geometry.js';
import { BLADE_REST_FLOATS } from '../water-simulation.js';

test('all kelp variants have finite positions, normals, tissue and valid topology', () => {
  for (let variant=0; variant<4; variant++) {
    const g=createKelpGeometry(171+variant*31,1),n=g.attributes.position.count;
    assert.ok(g.userData.leaves>=100);
    assert.equal(g.userData.organs.length,g.userData.leaves);
    const ids=new Set();
    const coordinates=g.getAttribute('bladeUV');
    for(let i=0;i<coordinates.count;i++)ids.add(coordinates.getZ(i));
    assert.equal(ids.size,g.userData.leaves+1,'Every blade has a unique draw address, plus stipe address zero');
    for(const organ of g.userData.organs){
      assert.deepEqual(organ.base,organ.bladderTip,'Blade must begin at the bladder tip');
      assert.ok(organ.bladderTip[1]>organ.bladderBase[1],'Bladder rises from the curved stalk');
      assert.ok(organ.middle[1]>organ.base[1],'Blade grows upward from its attachment');
    }
    for (const [name,a] of Object.entries(g.attributes)) {
      assert.equal(a.count,n,name);
      assert.ok(a.array.every(Number.isFinite),name);
    }
    assert.ok(g.index.array.every(i=>i>=0&&i<n));
    assert.equal(g.index.count/3,g.userData.triangles);
    for(let i=0;i<n;i++) assert.ok(g.attributes.tissue.getX(i)>0);
    assert.ok(g.boundingSphere.radius>10&&g.boundingSphere.radius<25);
    g.dispose();
  }
});

test('shadow and distant geometry preserve every organ and attachment at lower tessellation', () => {
  for(const [seed,canopy] of [[171,false],[202,false],[233,false],[264,false],[819,true]]){
    const full=createKelpGeometry(seed,1,canopy),shadow=createKelpGeometry(seed,1,canopy,true);
    assert.deepEqual(shadow.userData.organs,full.userData.organs);
    assert.equal(shadow.userData.leaves,full.userData.leaves);
    assert.ok(shadow.index.count<full.index.count*.15);
    assert.ok(shadow.attributes.position.array.every(Number.isFinite));
    assert.ok(shadow.index.array.every(i=>i>=0&&i<shadow.attributes.position.count));
    if(!canopy){
      const distant=createKelpGeometry(seed,1,false,false,true);
      assert.deepEqual(distant.userData.organs,full.userData.organs);
      assert.ok(distant.index.count<full.index.count*.25);
      distant.dispose();
    }
    full.dispose();shadow.dispose();
  }
});

test('spatial LOD splitting preserves every triangle and interpolant', () => {
  const g=createKelpGeometry(171,1),chunks=splitGeometry(g,'y',7);
  assert.ok(chunks.length>=4);
  assert.equal(chunks.reduce((n,c)=>n+c.index.count,0),g.index.count);
  const signature=(geometry,i)=>Object.values(geometry.attributes).flatMap(a=>Array.from(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize))).join(',');
  const original=new Set(Array.from({length:g.attributes.position.count},(_,i)=>signature(g,i)));
  for(const chunk of chunks) {
    for(let i=0;i<chunk.attributes.position.count;i++)assert.ok(original.has(signature(chunk,i)));
    assert.ok(Number.isFinite(chunk.boundingSphere.radius));
    chunk.dispose();
  }
  g.dispose();
});

test('the complete flight stays submerged, moves smoothly and clears the stipe roots', () => {
  const m=new THREE.MeshBasicMaterial(),forest=createForest({kelp:m,floor:m});
  assert.equal(forest.bladeRest.length/BLADE_REST_FLOATS,forest.stats.leaves);
  assert.ok(forest.bladeRest.every(Number.isFinite));
  for(const shadow of forest.shadowMeshes){
    assert.ok(shadow.geometry.getAttribute('normal'),'Shadow geometry must retain the normal attribute required by meshlets');
    assert.ok(!shadow.geometry.getAttribute('pigment')&&!shadow.geometry.getAttribute('tissue'),'Shadow vertex streams omit unused tissue data');
  }
  // The route opens on the upward view, closes on itself, stays between the
  // reef and the canopy, and keeps clear of every holdfast except the lone
  // plant it swims through, which it meets within the swimmer's radius.
  const start=flightPose(0);
  assert.ok(start.position.distanceTo(new THREE.Vector3(0,17.5,12))<1e-6);
  assert.ok(start.target.y>start.position.y+5,'The flight opens looking up into the forest');
  assert.ok(flightPose(FLIGHT_PERIOD-1e-3).position.distanceTo(start.position)<1e-3,'The route is a loop');
  let previous=start.position;const nearest=new Map();
  for(let t=0;t<800;t+=.25) {
    const {position,target}=flightPose(t);
    assert.ok(position.y>groundHeight(position.x,position.z)+2.5&&position.y<SURFACE-9);
    assert.ok(position.distanceTo(target)>8);
    assert.ok(position.distanceTo(previous)<.1);
    forest.placements.forEach((p,i)=>nearest.set(i,Math.min(nearest.get(i)??Infinity,Math.hypot(position.x-p.x,position.z-p.z))));
    previous=position;
  }
  const [through,...others]=[...nearest.values()].sort((a,b)=>a-b);
  assert.ok(through<1,'The route swims through one plant');
  for(const d of others)assert.ok(d>=3.9);
  assert.ok(forest.specimen,'A visible frond must be available for inspection');
  for(const t of [0,30,90,180]){
    const pose=forest.inspectionPose(t);
    assert.ok(pose.position.toArray().every(Number.isFinite));
    assert.ok(pose.target.toArray().every(Number.isFinite));
    assert.ok(pose.position.distanceTo(pose.target)>1&&pose.position.distanceTo(pose.target)<2);
    assert.ok(pose.target.y>17&&pose.target.y<23);
  }
  assert.ok(forest.inspectionPose(0).target.distanceTo(forest.inspectionPose(30).target)>.05,'Inspection follows the current');
  forest.geometries.forEach(g=>g.dispose());m.dispose();
});

test('all fish start with finite GPU state within the water column', () => {
  const {state,homes}=createFishSeeds();
  assert.equal(state.length/8,1314);
  assert.equal(homes.length,state.length);
  assert.ok(state.every(Number.isFinite)&&homes.every(Number.isFinite));
  // Body lengths per species id: blacksmith, señorita, garibaldi.
  const lengths=[[.174,.316],[.139,.249],[.239,.321]];
  for(let i=0;i<state.length;i+=8){
    assert.ok(state[i+1]>8&&state[i+1]<27);
    const [low,high]=lengths[homes[i+7]];
    assert.ok(state[i+3]>=low&&state[i+3]<=high);
  }
});

test('each garibaldi holds a station by a holdfast, just above the reef', () => {
  // Two straight stipes rising from y = -2.5 at (5, 5) and (-8, 3).
  const lines=[];
  for(const [x,z] of [[5,5],[-8,3]]){lines.push(-2.5,4,0,0);for(let k=0;k<STIPE_SAMPLES;k++)lines.push(x,z,0,0);}
  const {homes}=createFishSeeds(new Float32Array(lines));
  let garibaldi=0;
  for(let i=0;i<homes.length;i+=8){
    if(homes[i+7]!==2)continue;
    garibaldi++;
    const near=Math.min(Math.hypot(homes[i]-5,homes[i+2]-5),Math.hypot(homes[i]+8,homes[i+2]-3));
    assert.ok(near>=1&&near<=2.2&&homes[i+1]>=-2&&homes[i+1]<=-.5,`home ${homes[i]}, ${homes[i+1]}, ${homes[i+2]}`);
  }
  assert.equal(garibaldi,24);
});


test('near and distant fish preserve the body span and both pectoral attachments',()=>{
  for(const species of ['blacksmith','senorita','garibaldi']){
    const near=createFishGeometry(species,true),far=createFishGeometry(species,false);
    try{
      assert.ok(near.index.count>far.index.count*4);
      for(const g of [near,far]){
        g.computeBoundingBox();
        const {position,normal,finMotion,finAnchor}=g.attributes;
        assert.ok(position.array.every(Number.isFinite)&&normal.array.every(Number.isFinite));
        assert.ok(g.index.array.every(i=>i<position.count));
        for(const side of [-1,1]){
          const roots=Array.from({length:position.count},(_,i)=>i).filter(i=>finMotion.getX(i)===side&&finMotion.getY(i)===0);
          assert.ok(roots.length>2);
          for(const i of roots)assert.deepEqual([position.getX(i),position.getY(i),position.getZ(i)],[finAnchor.getX(i),finAnchor.getY(i),finAnchor.getZ(i)]);
        }
      }
      assert.ok(Math.abs(near.boundingBox.min.x-far.boundingBox.min.x)<.025);
      assert.ok(Math.abs(near.boundingBox.max.x-far.boundingBox.max.x)<.015);
    }finally{near.dispose();far.dispose();}
  }
});
