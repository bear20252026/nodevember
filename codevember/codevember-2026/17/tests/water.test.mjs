import assert from 'node:assert/strict';
import test from 'node:test';
import { EXTINCTION, WATER } from '../water-optics.js';
import { molecularPhase, solveWaterColumn, waterPhase } from '../water-column.js';

test('particle and molecular phase functions conserve energy over solid angle',()=>{
  const bins=100000;
  for(const [phase,backscatter] of [[waterPhase,WATER.backscatter],[molecularPhase,.5]]){
    let integral=0,back=0;
    for(let i=0;i<bins;i++){
      const energy=phase(-1+2*(i+.5)/bins)*4*Math.PI/bins;
      integral+=energy;
      if(i<bins/2)back+=energy;
    }
    assert.ok(Math.abs(integral-1)<.0001);
    assert.ok(Math.abs(back-backscatter)<.0001);
  }
  const [r,g,b]=EXTINCTION.map(x=>Math.exp(-.8*x*20));
  assert.ok(r<.055&&g>.12&&g<.20&&b>g&&b<.23,'Twenty metres of coastal water filters red and reduces distant contrast');
});

test('diffuse transport is finite, respects boundaries and adds nonnegative in-scatter along a ray',()=>{
  const {data,width,height,spacing}=solveWaterColumn();
  const at=(x,y,c)=>data[(y*width+x)*4+c];
  let maximum=0;
  for(let x=0;x<width;x++){
    const mu=2*(x+.5)/width-1,step=Math.sign(mu);
    for(let c=0;c<3;c++){
      const transmission=Math.exp(-EXTINCTION[c]*spacing/Math.abs(mu));
      assert.equal(at(x,mu>0?0:height-1,c),0);
      for(let y=0;y<height;y++){
        const light=at(x,y,c);
        assert.ok(Number.isFinite(light)&&light>=0);
        maximum=Math.max(maximum,light);
        const endpoint=y-step;
        if(endpoint>=0&&endpoint<height)assert.ok(light+1e-7>=at(x,endpoint,c)*transmission);
      }
    }
  }
  assert.ok(maximum>.01&&maximum<2);
});

test('the shared sea tiles every 12 m and has a calm, canopy-damped slope spectrum',async()=>{
  const {WAVES}=await import('../caustics.js');
  const lattice=2*Math.PI/12,keys=new Set();
  for(const w of WAVES){
    for(const k of [w.kx,w.kz])assert.ok(Math.abs(k/lattice-Math.round(k/lattice))<1e-9,'Wave vectors lie on the 12 m lattice');
    const key=`${Math.round(w.kx/lattice)},${Math.round(w.kz/lattice)}`,opposite=`${-Math.round(w.kx/lattice)},${-Math.round(w.kz/lattice)}`;
    assert.ok(!keys.has(key)&&!keys.has(opposite),'No two waves share a wave vector or its opposite');
    keys.add(key);
    assert.ok(Number.isFinite(w.amplitude)&&w.amplitude>0&&w.omega>0);
  }
  // Cox and Munk give an RMS slope near 0.13 at 3 m/s wind; a kelp canopy
  // damps the chop, so the sea should be calmer than open water.
  const rms=Math.sqrt(WAVES.reduce((sum,w)=>sum+(w.amplitude*w.k)**2/2,0));
  assert.ok(rms>.08&&rms<.14,`RMS slope ${rms}`);
  const slope=w=>w.amplitude*w.k,short=WAVES.filter(w=>2*Math.PI/w.k<.5),long=WAVES.filter(w=>{const l=2*Math.PI/w.k;return l>1.5&&l<5;});
  const mean=list=>list.reduce((sum,w)=>sum+slope(w),0)/list.length;
  assert.ok(short.length>2&&long.length>2&&mean(short)<.6*mean(long),'Short chop is damped relative to the longer waves');
});
