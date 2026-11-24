import * as THREE from 'three/webgpu';
import { SURFACE } from './water-optics.js';

// The flight: a closed route at 0.3 m/s, about four minutes long. It opens
// looking up into the forest from the clear ring between the inner grove and
// the outer plants, sinks along that ring into the mid-forest about ten
// metres above the reef while looking up at the canopy, turns in and swims through the lone inner plant
// (the swimmer parts it, swimmer.js), rises past the hero column looking up
// to the canopy, and curves back to the opening view. Every gaze points in
// across the grove: the low-detail backdrop plants beyond the ring skip the
// blade solver (forest.js), so they stay at least 14 m off whenever in view.
// Camera positions and look targets are closed centripetal Catmull-Rom
// splines sharing one parameter, so the gaze keeps pace with the camera;
// positions advance at constant speed.
const ROUTE=[
  // position          look at
  [[0,17.5,12],        [1.69,26.89,-11.88]], // the opening view
  [[6,15.5,10.4],      [-4,25,-10]],          // sinking, looking up
  [[10.4,12,6],        [-8,23,-6]],
  [[12,9,0],           [-8,20,-2]],           // mid-forest, across the grove
  [[9.5,8,-7],         [-6,17,4]],
  [[3,7.5,-7.5],       [-4.5,10,-2.5]],       // toward the lone plant
  [[-3.5,8.5,-3.6],    [-8,13,4]],            // through it
  [[-10,13,1],         [-6,24,10]],           // up the hero column
  [[-8.5,20,9.5],      [2,26,6]],
  [[-4,19,12.5],       [1,24,-2]]
];
const FLIGHT_SPEED=.3;
const flightPath=new THREE.CatmullRomCurve3(ROUTE.map(([p])=>new THREE.Vector3(...p)),true,'centripetal');
const flightLook=new THREE.CatmullRomCurve3(ROUTE.map(([,t])=>new THREE.Vector3(...t)),true,'centripetal');
export const FLIGHT_PERIOD=flightPath.getLength()/FLIGHT_SPEED;

export function flightPose(seconds) {
  const u=((seconds/FLIGHT_PERIOD)%1+1)%1,t=flightPath.getUtoTmapping(u);
  return {position:flightPath.getPoint(t),target:flightLook.getPoint(t)};
}

// Camera space: x right, y up, z forward.
const SWIM={KeyW:[0,0,1],ArrowUp:[0,0,1],KeyS:[0,0,-1],ArrowDown:[0,0,-1],KeyA:[-1,0,0],ArrowLeft:[-1,0,0],
  KeyD:[1,0,0],ArrowRight:[1,0,0],KeyE:[0,1,0],KeyQ:[0,-1,0]};
const PITCH_LIMIT=1.5,FLOOR=-2.7,CEILING=SURFACE-.3,RADIUS=70;

// The automatic flight, a frond inspection, or free swimming. Looking is
// smoothed and composed in world space, so the horizon never rolls and the
// view can turn almost straight up at the surface or down at the floor.
// Any swim input takes over from the current view with a diver's momentum;
// resuming the flight blends back onto its path instead of cutting.
export function createJourney(camera,canvas,{onFreeSwim=()=>{},ground=()=>FLOOR-.5}={}) {
  let elapsed=0,mode='flight',inspection=null,blend=null,dive=0,diveTarget=0,fast=false,pinch=0,surge=0;
  const look={yaw:0,pitch:0},target={yaw:0,pitch:0};
  const position=new THREE.Vector3(),velocity=new THREE.Vector3(),wish=new THREE.Vector3(),direction=new THREE.Vector3();
  const euler=new THREE.Euler(0,0,0,'YXZ'),orientation=new THREE.Quaternion(),keys=new Set(),pointers=new Map();
  const typing=e=>/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey;
  const spread=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
    if(pointers.size===2)pinch=spread();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);if(!p)return;
    if(pointers.size===1){
      // Narrower fields of view turn more slowly under the same drag.
      const sensitivity=.0032*camera.fov/58;
      target.yaw-=(e.clientX-p.x)*sensitivity;target.pitch-=(e.clientY-p.y)*sensitivity;
    }
    p.x=e.clientX;p.y=e.clientY;
    // Spreading two fingers swims forward, pinching swims back.
    if(pointers.size===2){const d=spread();surge+=(d-pinch)*.015;pinch=d;}
  });
  const release=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    if(mode==='free')velocity.y-=e.deltaY*.004;
    else diveTarget=THREE.MathUtils.clamp(diveTarget-e.deltaY*.008,-7,5);
  },{passive:false});
  window.addEventListener('keydown',e=>{
    if(typing(e)||!SWIM[e.code])return;
    e.preventDefault();keys.add(e.code);fast=e.shiftKey;
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);fast=e.shiftKey;});
  window.addEventListener('blur',()=>keys.clear());

  // World-space yaw and pitch of the current view direction.
  function angles(){
    camera.getWorldDirection(direction);
    return {yaw:Math.atan2(-direction.x,-direction.z),pitch:Math.asin(THREE.MathUtils.clamp(direction.y,-1,1))};
  }
  function swim(){
    if(mode==='free')return;
    const {yaw,pitch}=angles();
    position.copy(camera.position);velocity.set(0,0,0);
    look.yaw=target.yaw=yaw;look.pitch=target.pitch=pitch;
    mode='free';inspection=null;blend=null;onFreeSwim();
  }
  // dt advances the flight; wall is real time for looking and swimming, so
  // both still work while the simulation is paused.
  function update(dt,fly=true,wall=dt){
    if(keys.size||surge)swim();
    const settle=1-Math.exp(-wall/.1);
    if(mode==='free'){
      target.pitch=THREE.MathUtils.clamp(target.pitch,-PITCH_LIMIT,PITCH_LIMIT);
      look.yaw+=(target.yaw-look.yaw)*settle;look.pitch+=(target.pitch-look.pitch)*settle;
      orientation.setFromEuler(euler.set(look.pitch,look.yaw,0));
      wish.set(0,0,0);for(const code of keys)wish.add(direction.fromArray(SWIM[code]));
      if(wish.lengthSq()>0)wish.normalize().multiplyScalar(fast?3.5:1.3);
      // Forward follows the view, so looking up swims up; Q and E move
      // straight down and up.
      const rise=wish.y;wish.set(wish.x,0,-wish.z).applyQuaternion(orientation);wish.y+=rise;
      velocity.lerp(wish,1-Math.exp(-wall/.45));
      if(surge){velocity.add(direction.set(0,0,-surge).applyQuaternion(orientation));surge=0;}
      position.addScaledVector(velocity,wall);
      position.y=THREE.MathUtils.clamp(position.y,Math.max(FLOOR,ground(position.x,position.z)+.6),CEILING);
      const radius=Math.hypot(position.x,position.z);
      if(radius>RADIUS){position.x*=RADIUS/radius;position.z*=RADIUS/radius;}
      camera.position.copy(position);camera.quaternion.copy(orientation);
    }else{
      if(fly&&!inspection)elapsed+=dt;
      dive+=(diveTarget-dive)*(1-Math.exp(-wall/.25));
      const pose=inspection?inspection():flightPose(elapsed);
      pose.position.y+=dive;pose.target.y+=dive;
      direction.subVectors(pose.target,pose.position).normalize();
      const yaw=Math.atan2(-direction.x,-direction.z),pitch=Math.asin(THREE.MathUtils.clamp(direction.y,-1,1));
      // Offsets from the guided view, limited by the world-space pitch.
      target.pitch=THREE.MathUtils.clamp(target.pitch,-PITCH_LIMIT-pitch,PITCH_LIMIT-pitch);
      look.yaw+=(target.yaw-look.yaw)*settle;look.pitch+=(target.pitch-look.pitch)*settle;
      // The eased offset trails the clamp while the guided gaze turns, so
      // the world pitch is limited again.
      orientation.setFromEuler(euler.set(THREE.MathUtils.clamp(pitch+look.pitch,-PITCH_LIMIT,PITCH_LIMIT),yaw+look.yaw,0));
      if(blend){
        blend.t=Math.min(1,blend.t+wall/2.5);
        const t=blend.t*blend.t*(3-2*blend.t);
        camera.position.lerpVectors(blend.position,pose.position,t);
        camera.quaternion.slerpQuaternions(blend.quaternion,orientation,t);
        if(blend.t>=1)blend=null;
      }else{camera.position.copy(pose.position);camera.quaternion.copy(orientation);}
    }
    camera.updateMatrixWorld();
  }
  function settle(){look.yaw=target.yaw;look.pitch=target.pitch;dive=diveTarget;update(0,false,0);}
  function guided(provider){
    mode=provider?'inspect':'flight';inspection=provider;blend=null;
    look.yaw=look.pitch=target.yaw=target.pitch=0;velocity.set(0,0,0);
  }
  function reset(){guided(null);elapsed=0;dive=diveTarget=0;keys.clear();settle();}
  function inspect(provider){guided(provider);dive=diveTarget=0;settle();}
  // Back to the flight from wherever the camera is, without a cut.
  function resume(){
    if(mode==='flight'&&!inspection)return;
    blend={position:camera.position.clone(),quaternion:camera.quaternion.clone(),t:0};
    mode='flight';inspection=null;look.yaw=look.pitch=target.yaw=target.pitch=0;
  }
  return {update,reset,inspect,resume,
    get mode(){return mode;},
    get elapsed(){return elapsed;},set elapsed(t){elapsed=t;settle();}};
}
