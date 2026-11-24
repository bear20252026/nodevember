import { Break, Fn, If, Loop, atomicLoad, float, instanceIndex, mix, mx_cell_noise_float, vec2, vec3, vec4 } from 'three/tsl';
import { STIPE_SAMPLES } from './forest.js';

const limited=(v,limit)=>v.mul(float(limit).div(v.length().max(.00001)).min(1));
const safeUnit=(v,fallback)=>v.length().greaterThan(.0001).select(v.div(v.length().max(.0001)),fallback);

// Blacksmith hold loose stations in the water column facing into the
// current and dart out to pick plankton; señoritas forage close to the
// kelp. Both cruise with their pectoral fins and switch to body and tail
// strokes for bursts. Distances and speeds scale with body length.
export function createSwimKernel({fish,snapshot,homes,attitude,motor,links,nextAt,reactionAt,cellAt,cellIndex,forceScale,current,dt,eye,fishCount,stipes,stipeCount}){
  return Fn(()=>{
    const i=instanceIndex,row=i.mul(2),animal=snapshot.read.element(row).toVar(),velocity=snapshot.read.element(row.add(1)).xyz.toVar();
    const home=homes.read.element(row),params=homes.read.element(row.add(1));
    const old=attitude.write.element(i).toVar(),gait=motor.write.element(i).toVar(),water=current.velocity(animal.xyz).toVar();
    // Species ids (fish.js): 0 blacksmith, 1 señorita, 2 garibaldi.
    const time=current.time,phase=params.z,wrasse=params.w.sub(1).abs().lessThan(.5),garibaldi=params.w.greaterThan(1.5),length=animal.w.max(.1).toVar();

    // Station keeping: a slow wander around a home point. Holding it
    // against the current turns the fish upstream. A garibaldi keeps close
    // to its patch of reef.
    const wander=vec3(time.mul(.11).add(phase).sin().mul(wrasse.select(1.6,1.1)),time.mul(.07).add(phase.mul(2)).sin().mul(.35),
      time.mul(.09).add(phase.mul(1.3)).cos().mul(wrasse.select(1.4,.9))).mul(garibaldi.select(.35,1));
    const desired=limited(home.xyz.add(wander).sub(animal.xyz).mul(.35),.6).toVar();

    // Foraging: in most windows of a few seconds a fish darts at a plankter,
    // mostly upstream, for about 7 body lengths per second, then coasts.
    const clock=time.mul(wrasse.select(.09,.13)).add(phase.mul(.159)),epoch=clock.floor(),window=clock.fract();
    const random=k=>mx_cell_noise_float(vec2(epoch.add(k),phase.mul(7.31)));
    const upstream=safeUnit(water,vec3(1,0,0)).negate();
    const aim=safeUnit(vec3(random(0),random(17.3),random(41.7)).mul(2).sub(1).mul(vec3(1,.4,1)).add(upstream.mul(.8)),upstream);
    const darting=random(5.1).lessThan(.7);
    const burst=window.lessThan(.022).and(darting),coast=window.lessThan(.06).and(darting).and(burst.not());

    // Schooling against the same beginning-of-step snapshot for every
    // neighbour: separation from all fish, alignment and cohesion within
    // the species, weighted toward neighbours ahead.
    const center=vec3(0).toVar(),align=vec3(0).toVar(),repel=vec3(0).toVar(),total=float(0).toVar();
    const radius=length.mul(wrasse.select(4.5,6)).min(2);
    const low=cellAt(animal.xyz.sub(radius)).toVar(),high=cellAt(animal.xyz.add(radius)).toVar();
    Loop({name:'sy',start:low.y,end:high.y.add(1),type:'int'},({sy})=>{
      Loop({name:'sz',start:low.z,end:high.z.add(1),type:'int'},({sz})=>{
        Loop({name:'sx',start:low.x,end:high.x.add(1),type:'int'},({sx})=>{
          const link=atomicLoad(links.element(cellIndex(sx,sy,sz))).toVar();
          Loop({name:'neighbor',start:0,end:fishCount,type:'int'},()=>{
            If(link.lessThanEqual(0),()=>{Break();});
            const j=link.sub(1).toUint(),other=snapshot.read.element(j.mul(2));
            const delta=other.xyz.sub(animal.xyz).toVar(),range=delta.length().toVar();
            If(j.notEqual(i).and(range.lessThan(radius)),()=>{
              const avoidDistance=animal.w.add(other.w).mul(.8);
              repel.subAssign(delta.div(range.max(.035)).mul(range.smoothstep(0,avoidDistance).oneMinus()).mul(1.8));
              If(homes.read.element(j.mul(2).add(1)).w.equal(params.w),()=>{
                const weight=range.div(radius).oneMinus().mul(delta.dot(old.xyz).greaterThan(range.mul(-.72)).select(1,.2));
                center.addAssign(delta.mul(weight));align.addAssign(snapshot.read.element(j.mul(2).add(1)).xyz.mul(weight));total.addAssign(weight);
              });
            });
            link.assign(atomicLoad(links.element(nextAt(j))));
          });
        });
      });
    });
    const mean=total.max(.001);
    If(total.greaterThan(.001),()=>{desired.addAssign(align.div(mean).sub(desired).mul(.45)).addAssign(center.div(mean).mul(.25));});
    desired.addAssign(limited(repel,1.3));

    // Kelp: swim around the swaying stipes rather than through them.
    // Señoritas also keep within a couple of metres of the nearest one.
    const kelp=vec3(0).toVar(),nearest=float(1e3).toVar(),toward=vec3(0).toVar(),reach=length.mul(3).add(.45);
    Loop({name:'stipe',start:0,end:stipeCount,type:'int'},({stipe})=>{
      const at=stipe.mul(STIPE_SAMPLES+1),span=stipes.element(at);
      const t=animal.y.sub(span.x).div(span.y).clamp(0,STIPE_SAMPLES-1.001),k=t.floor().toInt(),w=t.fract();
      const a=stipes.element(at.add(1).add(k)),b=stipes.element(at.add(2).add(k));
      const rest=vec3(mix(a.x,b.x,w),animal.y,mix(a.y,b.y,w)).toVar();
      If(vec2(animal.x.sub(rest.x),animal.z.sub(rest.z)).length().lessThan(reach.add(6)),()=>{
        const axis=current.displace(rest);
        const offset=vec3(animal.x.sub(axis.x),0,animal.z.sub(axis.z)).toVar(),distance=offset.length().toVar();
        const away=offset.div(distance.max(.05)).toVar();
        If(distance.lessThan(nearest),()=>{nearest.assign(distance);toward.assign(away.negate());});
        If(distance.lessThan(reach),()=>{
          const push=distance.div(reach).oneMinus().pow2(),around=vec3(away.z.negate(),0,away.x);
          kelp.addAssign(away.mul(push.mul(2.2)).add(around.mul(around.dot(velocity).greaterThanEqual(0).select(1,-1)).mul(push.mul(.9))));
        });
      });
    });
    desired.addAssign(kelp);
    If(wrasse.and(nearest.greaterThan(1.4)).and(nearest.lessThan(8)),()=>{desired.addAssign(toward.mul(nearest.sub(1.4).min(1).mul(.35)));});

    // The dart replaces the cruise; a coasting fish stops propelling.
    If(burst,()=>{desired.assign(water.add(aim.mul(length.mul(7))));});
    If(coast,()=>{desired.assign(velocity);});
    const reaction=reactionAt(i);
    const contact=vec3(atomicLoad(links.element(reaction)),atomicLoad(links.element(reaction.add(1))),
      atomicLoad(links.element(reaction.add(2)))).div(forceScale);
    const away=animal.xyz.sub(eye).add(vec3(.0001,0,0)).toVar();
    const clearance=animal.w.mul(1.5).add(.53);
    const avoid=away.normalize().mul(away.length().smoothstep(clearance,clearance.add(1.1)).oneMinus().mul(1.8));
    const force=desired.sub(velocity).mul(burst.select(3.2,1.37)).add(water.sub(velocity).mul(.25))
      .add(limited(contact.mul(float(.13).div(animal.w.max(.1))),4)).add(avoid).toVar();
    const next=limited(velocity.add(limited(force,burst.select(9,4)).mul(dt)),2.5).toVar();
    // Schools stay in the water column; a garibaldi stays just above its reef.
    const position=animal.xyz.add(next.mul(dt)).toVar();position.y.assign(position.y.clamp(garibaldi.select(home.y.sub(.4),6.5),27.4));
    const delta=position.sub(eye).add(vec3(.0001,0,0)).toVar();
    If(delta.length().lessThan(clearance),()=>{position.assign(eye.add(delta.normalize().mul(clearance)));});

    // Fish point into their velocity through the water; heading and bank
    // are damped so a drifting or reversing fish does not snap around.
    const relative=next.sub(water).toVar(),wanted=safeUnit(relative,old.xyz).toVar();
    wanted.y.assign(wanted.y.clamp(-.65,.65));wanted.assign(wanted.normalize());
    const turn=old.xyz.cross(wanted).y.toVar();
    // Gait: pectoral rowing up to about 2-3 body lengths per second, body
    // and tail strokes above that or when accelerating hard.
    const lengthsPerSecond=relative.length().div(length);
    const accelerating=limited(force,9).length().div(length).smoothstep(6,14);
    const cruising=lengthsPerSecond.smoothstep(wrasse.select(2.6,2.0),wrasse.select(4.6,4.0)).max(accelerating);
    const target=burst.select(1,coast.select(0,cruising));
    const thrust=mix(gait.y,target,dt.mul(6).clamp()).toVar();
    const rate=dt.mul(mix(2.6,6,thrust)).clamp(0,1);
    const heading=safeUnit(mix(old.xyz,wanted,rate),old.xyz).toVar();
    const bank=mix(old.w,turn.mul(-.68).clamp(-.48,.48),dt.mul(4.2).clamp());
    // About 0.7 body lengths per tail beat, at least 1.5 Hz while stroking.
    const tailRate=lengthsPerSecond.div(.7).max(1.5).mul(thrust.smoothstep(.02,.15));
    const finRate=mix(lengthsPerSecond.mul(.9).add(1.3),.6,thrust);
    const bend=mix(gait.z,turn,dt.mul(5).clamp());
    motor.write.element(i).assign(vec4(gait.x.add(tailRate.mul(2*Math.PI).mul(dt)).mod(2*Math.PI),thrust,bend,
      gait.w.add(finRate.mul(2*Math.PI).mul(dt)).mod(2*Math.PI)));
    attitude.write.element(i).assign(vec4(heading,bank));
    fish.write.element(row).assign(vec4(position,animal.w));fish.write.element(row.add(1)).assign(vec4(next,phase));
  })().compute(fishCount,[64]).setName('Fish: hold station, forage, school and avoid the kelp');
}
