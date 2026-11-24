import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshlets, ready } from 'three/addons/utils/MeshletGeometryUtils.js';
import { MeshoptClusterizer } from 'three/addons/libs/meshopt_clusterizer.module.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { createKelpGeometry } from '../kelp-geometry.js';
import { splitGeometry } from '../geometry-chunks.js';
import { buildMeshletData } from '../meshlet-build.js';
import { meshletInput, wrapMeshletData } from '../kelp-pipeline.js';

// The workers must give the meshlet pipeline exactly what it would build itself.
test('worker meshlets match MeshletGeometryUtils.createMeshlets', async () => {
  await ready;
  const shadow=createKelpGeometry(202,1,false,true);
  for(const name of ['pigment','tissue'])shadow.deleteAttribute(name);
  const chunks=[...splitGeometry(createKelpGeometry(819,1,true),'x',5).slice(0,2),splitGeometry(shadow,'y',7)[1]];
  for(const geometry of chunks){
    const reference=createMeshlets(geometry);
    const input=structuredClone(meshletInput(geometry));
    const wrapped=wrapMeshletData(geometry,buildMeshletData(input,MeshoptClusterizer,MeshoptSimplifier));
    assert.deepEqual(Object.keys(wrapped).sort(),Object.keys(reference).sort());
    for(const key of ['vertexArray','indexArray','chunkArray'])assert.ok(Buffer.from(wrapped[key].buffer).equals(Buffer.from(reference[key].buffer)),key);
    for(const key of ['stride','chunkCount','lodCount','maxChunks','layoutKey'])assert.equal(wrapped[key],reference[key],key);
    assert.deepEqual(wrapped.lodTriangleEnds,reference.lodTriangleEnds);
    assert.deepEqual(wrapped.lodOffsetValues.map(v=>v.toArray()),reference.lodOffsetValues.map(v=>v.toArray()));
    assert.deepEqual([...wrapped.attributeLayout],[...reference.attributeLayout]);
    assert.deepEqual(wrapped.instancedAttributes,reference.instancedAttributes);
    assert.ok(wrapped.boundingSphere.equals(reference.boundingSphere)&&wrapped.boundingBox.equals(reference.boundingBox));
    assert.ok(reference.lodCount>1&&reference.chunkCount>10);
  }
});
