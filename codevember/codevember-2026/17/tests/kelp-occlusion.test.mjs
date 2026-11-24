import assert from 'node:assert/strict';
import test from 'node:test';
import { createKelpGeometry } from '../kelp-geometry.js';

test('baked ambient occlusion is bounded and darkens frond interiors more than blade tips',()=>{
  for(const [seed,canopy] of [[171,false],[819,true]]){
    const g=createKelpGeometry(seed,1,canopy),pigment=g.getAttribute('pigment'),blade=g.getAttribute('bladeUV');
    assert.equal(pigment.itemSize,4,'Occlusion shares the colour vec4');
    let base=0,baseCount=0,tip=0,tipCount=0;
    for(let i=0;i<pigment.count;i++){
      const ao=pigment.getW(i);
      assert.ok(ao>=.449&&ao<=1,`occlusion ${ao}`);
      if(blade.getZ(i)<.5)continue;
      if(blade.getX(i)<.15){base+=ao;baseCount++;}
      if(blade.getX(i)>.85){tip+=ao;tipCount++;}
    }
    assert.ok(base/baseCount<tip/tipCount-.05,'Blade bases near the stalk are more occluded than the tips');
    g.dispose();
  }
  // The shadow casters carry no colour and skip the bake.
  const shadow=createKelpGeometry(171,1,false,true);
  for(let i=0;i<shadow.getAttribute('pigment').count;i++)assert.equal(shadow.getAttribute('pigment').getW(i),1);
  shadow.dispose();
});
