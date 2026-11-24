import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisplayOutput } from '../display-output.js';

function fixture({high=false,format='rgba16float',extended=true}={}){
  const query=new EventTarget();query.matches=high;
  query.change=high=>{query.matches=high;query.dispatchEvent(new Event('change'));};
  const config={format,...(extended?{toneMapping:{mode:'extended'}}:{})};
  const calls=[];
  const context={getConfiguration:()=>config,configure(next){calls.push(next);}};
  const output=createDisplayOutput({backend:{context}},query);
  return {output,query,calls};
}

test('automatic HDR follows the display without reconfiguring the canvas',()=>{
  const {output,query,calls}=fixture();
  assert.equal(output.supported,true);assert.equal(output.active,false);assert.equal(output.headroom,1);
  query.change(true);assert.equal(output.active,true);assert.equal(output.headroom,4);
  query.change(false);assert.equal(output.active,false);assert.equal(output.headroom,1);
  assert.equal(calls.length,0,'The float canvas stays in extended presentation');
  assert.equal(output.inspect().presentation,'extended');
  output.dispose();query.change(true);assert.equal(output.active,false);
});

test('the SDR override lowers the headroom and automatic restores it',()=>{
  const {output,query,calls}=fixture({high:true});
  output.setPeak(6);assert.equal(output.headroom,6);
  output.setMode('sdr');query.change(false);query.change(true);assert.equal(output.headroom,1);
  output.setMode('auto');assert.equal(output.headroom,6);
  output.setPeak(100);assert.equal(output.peak,8);
  assert.throws(()=>output.setPeak(NaN));assert.throws(()=>output.setMode('invalid'));
  assert.equal(calls.length,0);output.dispose();
});

test('an 8-bit canvas or standard presentation never enables HDR',()=>{
  for(const options of [{high:true,format:'bgra8unorm',extended:false},{high:true,extended:false}]){
    const {output,calls}=fixture(options);
    assert.equal(output.supported,false);assert.equal(output.active,false);assert.equal(output.headroom,1);
    assert.equal(calls.length,0);output.dispose();
  }
});

test('peak changes notify the interface',()=>{
  const {output,query}=fixture({high:true});
  let notified=0;output.onChange(()=>notified++);
  output.setPeak(3);query.change(false);output.setMode('sdr');
  assert.equal(notified,4);assert.equal(output.headroom,1);
  output.dispose();
});
