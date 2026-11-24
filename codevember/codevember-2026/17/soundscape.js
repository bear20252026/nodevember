import { Vector3 } from 'three/webgpu';
import { sampleCurrent } from './current.js';
import { SURFACE } from './water-optics.js';

// A procedural underwater soundscape, Web Audio only:
// - surge: low, filtered noise that swells with the water's orbital speed
//   at the camera, louder near the surface where the swell is stronger, and
//   a softer swish above it;
// - crackle: sparse, faint clicks in a band above 3 kHz, spread across the
//   stereo field, the background crackle of a living reef.
// Browsers only start audio after a gesture, so start() is called from the
// first click or key press. The context argument allows offline rendering.
const CRACKLE_RATE=22,LEVEL=1.1;

export function createSoundscape(){
  let context=null,master,rumble,swish,noise,click,next=0,enabled=true;
  const here=new Vector3(),ahead=new Vector3();

  function build(target){
    context=target;
    master=context.createGain();master.gain.value=0;master.connect(context.destination);
    // Four seconds of looping white noise feed both surge bands.
    const length=context.sampleRate*4,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=160;low.Q.value=.6;
    const lower=context.createBiquadFilter();lower.type='lowpass';lower.frequency.value=320;
    rumble=context.createGain();rumble.gain.value=0;
    noise.connect(lower).connect(low).connect(rumble).connect(master);
    const band=context.createBiquadFilter();band.type='bandpass';band.frequency.value=520;band.Q.value=.7;
    swish=context.createGain();swish.gain.value=0;
    noise.connect(band).connect(swish).connect(master);
    noise.start();
    // A 4 ms decaying click for the crackle.
    const clickLength=Math.round(context.sampleRate*.004);
    click=context.createBuffer(1,clickLength,context.sampleRate);
    const c=click.getChannelData(0);
    for(let i=0;i<clickLength;i++)c[i]=(Math.random()*2-1)*Math.exp(-i/(clickLength*.18));
    next=context.currentTime;
  }

  // Clicks scheduled up to `until`, at Poisson-distributed times.
  function crackle(until){
    while(next<until){
      next+=-Math.log(1-Math.random())/CRACKLE_RATE;
      const source=context.createBufferSource();source.buffer=click;source.playbackRate.value=.8+Math.random()*.6;
      const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=3000+Math.random()*3000;
      const gain=context.createGain();gain.gain.value=.05*Math.pow(Math.random(),3);
      const pan=context.createStereoPanner?context.createStereoPanner():null;
      let chain=source.connect(high).connect(gain);
      if(pan){pan.pan.value=Math.random()*2-1;chain=chain.connect(pan);}
      chain.connect(master);
      source.start(Math.max(next,context.currentTime));
    }
  }

  return {
    get context(){return context;},
    // Builds the graph on a running context, or on `target` (e.g. offline).
    start(target){
      if(!context)build(target??new AudioContext());
      const offline=typeof OfflineAudioContext!=='undefined'&&context instanceof OfflineAudioContext;
      if(context.state==='suspended'&&!offline)context.resume();
    },
    setEnabled(value){enabled=value;},
    // The water's orbital speed at the camera drives the surge; depth
    // softens everything a little. Called every frame with the current's
    // time and strength.
    update(camera,time,strength){
      if(!context)return;
      here.copy(camera.position);
      const a=sampleCurrent(here,time,strength),b=sampleCurrent(here,time+.1,strength);
      const speed=ahead.subVectors(b,a).length()/.1;
      const depth=Math.max(0,SURFACE-camera.position.y),near=Math.exp(-depth/14);
      const now=context.currentTime,smooth=.15;
      master.gain.setTargetAtTime(enabled?LEVEL:0,now,.4);
      rumble.gain.setTargetAtTime((.35+.9*Math.min(speed/.6,1.5))*(.55+.45*near),now,smooth);
      swish.gain.setTargetAtTime(.06*Math.min(speed/.6,1.5)**2*near,now,smooth);
      crackle(now+.25);
    },
    suspend(){context?.suspend?.();},
    resume(){if(context?.state==='suspended')context.resume();}
  };
}
