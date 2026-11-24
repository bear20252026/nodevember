import { Fn, If, Loop, PI, atan, atomicMax, float, mix, uint, vec3, vec4 } from 'three/tsl';

export const BLADE_LINKS=8;
export const BLADE_REST_FLOATS=4*(BLADE_LINKS+2);
export const BLADE_STATE_ROWS=2*(BLADE_LINKS+1); // skin rotation + translation per joint
export const BOUND_UNITS=4096;

// Half-width of a blade along its length, as a fraction of its widest point.
export const bladeWidthProfile=u=>u>0?Math.sin(Math.PI*u**.92)**.72:0;

// Physical constants (SI). Tissue density and modulus are assumed values:
// the blade is slightly denser than seawater and only its cupped cross-section
// (sagitta from kelp-geometry.js) stiffens it. Real blades are so limp that
// the flow sets their shape.
const RHO_WATER=1025,RHO_TISSUE=1065,GRAVITY=9.81,THICKNESS=.0008;
const FACE_DRAG=1.2,SKIN_FRICTION=.03; // flat plate, aspect ratio ~5; ruffled skin, both faces
const MODULUS=1e7,CUP=.19*2/Math.PI; // cup amplitude x mean |sin| along the blade
const NECK_RADIUS=.005,NECK_LENGTH=.015;
const NECK_BEND=MODULUS*Math.PI*NECK_RADIUS**4/4/NECK_LENGTH;
// Twenty-centimetre sections cannot represent a sharper crease or more twist.
const NECK_LIMIT=150*Math.PI/180,HINGE_LIMIT=120*Math.PI/180,TWIST_LIMIT=Math.PI/2;
const BROADSIDE_RATE=3,BROADSIDE_SPEED=.2,UNTWIST_RATE=2,SWEEPS=4;
// Share of a section's way out of the swimmer's sphere per sweep: 4 sweeps
// of .12 resolve 40% of a push each 20 ms step.
const SWIMMER_SOFTNESS=.12;

const meanProfile=(a,b)=>{let sum=0;for(let i=0;i<64;i++)sum+=bladeWidthProfile(a+(b-a)*(i+.5)/64);return sum/64;};
const SEGMENT_WIDTH=Array.from({length:BLADE_LINKS},(_,s)=>2*meanProfile(s/BLADE_LINKS,(s+1)/BLADE_LINKS));
const HINGE_WIDTH=Array.from({length:BLADE_LINKS},(_,h)=>2*bladeWidthProfile(h/BLADE_LINKS));
// EI = E (w t^3/12 + 4/45 t w h^2) with w = c W and h = CUP w/2, W the half-width.
const bendingTerms=c=>[MODULUS*c*THICKNESS**3/12,MODULUS*4/45*THICKNESS*c**3*(CUP/2)**2];

export const rotateVector=Fn(([q,v])=>v.add(q.xyz.cross(q.xyz.cross(v).add(v.mul(q.w))).mul(2)));
const limited=(v,max)=>v.mul(float(max).div(v.length().max(1e-6)).min(1));
const direction=(v,fallback)=>v.dot(v).greaterThan(1e-10).select(v.div(v.length().max(1e-6)),fallback);
const across=(v,t)=>v.sub(t.mul(v.dot(t)));
const wrap=a=>atan(a.sin(),a.cos());
const align=Fn(([a,b])=>{
  const cross=a.cross(b),w=a.dot(b).add(1);
  const orthogonal=a.y.abs().lessThan(.8).select(vec3(0,1,0),vec3(1,0,0)).cross(a).normalize();
  return w.greaterThan(.00001).select(vec4(cross,w).normalize(),vec4(orthogonal,0));
});
const multiply=Fn(([a,b])=>vec4(b.xyz.mul(a.w).add(a.xyz.mul(b.w)).add(a.xyz.cross(b.xyz)),a.w.mul(b.w).sub(a.xyz.dot(b.xyz))));
const rollFrame=Fn(([frame,axis,angle])=>{
  const half=angle.mul(.5);
  return multiply(vec4(axis.mul(half.sin()),half.cos()),frame);
});
const halfway=(a,b)=>a.add(b.mul(a.dot(b).greaterThanEqual(0).select(1,-1))).normalize();
const conjugate=q=>vec4(q.xyz.negate(),q.w);

// Each blade is a weak, inextensible ribbon of BLADE_LINKS sections in one
// compute invocation. Positions and velocities are relative to the moving
// gas bladder, in world-oriented axes. A section's frame is carried from the
// previous one; the stored twist is the roll between neighbours (at the
// collar, relative to the swing from the rest direction). The optional
// swimmer (swimmer.js) bends the stalk under the collar and is a soft sphere
// that pushes the sections out.
export function bladeRod(i,restData,state,current,dt,swimmer=null){
  const at=i.mul(BLADE_LINKS+2),row=i.mul(BLADE_LINKS*2);
  const collar=restData.read.element(at).toVar(),side=restData.read.element(at.add(1)).toVar(),halfWidth=collar.w;
  const base=current.displace(collar.xyz).add(swimmer?swimmer.bend(side.w.toUint(),collar.y):vec3(0)).toVar();
  const carrier=current.stipeVelocity(collar.xyz).toVar(),carrierAcceleration=current.stipeAcceleration(collar.xyz).toVar();
  const rest=[vec3(0)],dirs=[null],lengths=[null],points=[vec3(0)],velocity=[vec3(0)],twist=[float(0)],tangents=[null],kicks=[null];
  for(let n=1;n<=BLADE_LINKS;n++){
    const r=restData.read.element(at.add(n+1)).toVar();
    const pose=state.write.element(row.add(2*n-2)).toVar(),speed=state.write.element(row.add(2*n-1)).toVar();
    rest.push(r.xyz);lengths[n]=r.w;dirs[n]=r.xyz.sub(rest[n-1]).div(r.w).toVar();
    points.push(r.xyz.add(pose.xyz).toVar());velocity.push(speed.xyz);twist.push(pose.w);
    tangents[n]=direction(points[n].sub(points[n-1]),dirs[n]).toVar();
    kicks[n]=vec3(0).toVar();
  }
  // Q_n = Roll(t_n, twist_n) align(Q_{n-1} r_n, t_n) Q_{n-1}
  function frames(tangent,roll){
    const Q=[null];
    for(let n=1;n<=BLADE_LINKS;n++){
      const swing=n===1?align(dirs[1],tangent[1]):multiply(align(rotateVector(Q[n-1],dirs[n]),tangent[n]),Q[n-1]);
      Q[n]=rollFrame(swing,tangent[n],roll[n]).normalize().toVar();
    }
    return Q;
  }

  const segments=tangents.map((t,n)=>n?points[n].sub(points[n-1]).toVar():null);
  const low=points.reduce((a,p)=>a.min(p)).add(base),high=points.reduce((a,p)=>a.max(p)).add(base);
  // Fish contacts change the section velocities directly (a local
  // interaction; the fish take the opposite impulse).
  function contact(animal,swimming){
    const local=animal.xyz.sub(base).toVar();
    const best=float(1e8).toVar(),link=uint(0).toVar(),fraction=float(0).toVar(),separation=vec3(0).toVar();
    for(let n=1;n<=BLADE_LINKS;n++){
      const segment=segments[n],u=local.sub(points[n-1]).dot(segment).div(lengths[n].pow2()).clamp().toVar();
      const delta=points[n-1].add(segment.mul(u)).sub(local).toVar(),squared=delta.dot(delta);
      If(squared.lessThan(best),()=>{best.assign(squared);link.assign(uint(n));fraction.assign(u);separation.assign(delta);});
    }
    const distance=best.sqrt().toVar(),radius=collar.w.mul(.72).add(animal.w.mul(.26));
    const reaction=vec3(0).toVar(),hit=distance.lessThan(radius.add(.47)).toVar();
    If(hit,()=>{
      for(let n=1;n<=BLADE_LINKS;n++)If(link.equal(n),()=>{
        const v=mix(velocity[n-1],velocity[n],fraction).add(carrier);
        const wake=distance.smoothstep(radius,radius.add(.47)).oneMinus().pow2();
        reaction.assign(limited(separation.div(distance.max(.025)).mul(radius.sub(distance).max(0).mul(33))
          .add(swimming.sub(v).mul(wake.mul(1.75))),10));
        kicks[n].addAssign(reaction.mul(fraction));
        if(n>1)kicks[n-1].addAssign(reaction.mul(fraction.oneMinus()));
      });
    });
    return {reaction,hit};
  }

  function integrate(draw,bounds,contacts){
    const Q=frames(tangents,twist);
    const area=[null],added=[null],tissue=[null],displaced=[null];
    for(let s=1;s<=BLADE_LINKS;s++){
      const width=halfWidth.mul(SEGMENT_WIDTH[s-1]);
      area[s]=width.mul(lengths[s]).toVar();
      added[s]=width.pow2().mul(lengths[s]).mul(RHO_WATER*Math.PI/4).toVar(); // strip theory, face-on
      tissue[s]=area[s].mul(RHO_TISSUE*THICKNESS);displaced[s]=area[s].mul(RHO_WATER*THICKNESS);
    }
    // Bending moments (proportional to the bend angle) act as balanced force
    // couples on the two sections of each hinge. The round neck at the
    // bladder bends in any direction.
    const forces=points.map(()=>vec3(0).toVar());
    const couple=(s,torque)=>{
      const f=torque.cross(tangents[s]).div(lengths[s]).toVar();
      forces[s].addAssign(f);if(s>1)forces[s-1].subAssign(f);
    };
    const bend=(e,t)=>{const k=e.cross(t),sine=k.length();return k.mul(atan(sine,e.dot(t)).div(sine.max(1e-7)));};
    couple(1,bend(dirs[1],tangents[1]).mul(-NECK_BEND));
    for(let h=1;h<BLADE_LINKS;h++){
      const [linear,cubic]=bendingTerms(HINGE_WIDTH[h]);
      const stiffness=halfWidth.mul(linear).add(halfWidth.pow(3).mul(cubic)).div(lengths[h].add(lengths[h+1]).mul(.5));
      const torque=bend(rotateVector(Q[h],dirs[h+1]),tangents[h+1]).mul(stiffness.negate()).toVar();
      couple(h+1,torque);couple(h,torque.negate());
    }
    // A limp ribbon rolls broadside to any cross-flow and bends across its
    // face, so its centreline meets face-on drag and added mass in every
    // lateral direction and skin friction along it (a towed-cable model).
    // Drag is semi-implicit; the water's acceleration acts through its
    // pressure gradient and the added mass.
    const predicted=[vec3(0)];
    for(let n=1;n<=BLADE_LINKS;n++){
      const next=n<BLADE_LINKS,half=(a,b)=>next?a.add(b).mul(.5):a.mul(.5);
      const exposed=half(area[n],area[n+1]),entrained=half(added[n],added[n+1]);
      const own=half(tissue[n],tissue[n+1]),volume=half(displaced[n],displaced[n+1]),mass=own.add(entrained);
      const axis=(next?direction(tangents[n].add(tangents[n+1]),tangents[n]):tangents[n]).toVar();
      const position=base.add(points[n]).toVar();
      const water=current.velocity(position).sub(carrier).toVar(),relative=water.sub(velocity[n]).toVar();
      const lateral=exposed.mul(across(relative,axis).length()).mul(.5*RHO_WATER*FACE_DRAG).toVar();
      const along=exposed.mul(relative.dot(axis).abs()).mul(.5*RHO_WATER*SKIN_FRICTION).toVar();
      const accelerating=current.acceleration(position).toVar();
      const force=forces[n].add(vec3(0,own.sub(volume).mul(-GRAVITY),0))
        .add(accelerating.mul(volume)).add(across(accelerating.sub(carrierAcceleration),axis).mul(entrained))
        .sub(carrierAcceleration.mul(own));
      // (m I + dt K) v' = m v + dt (F + K w),  K = lateral I + (along - lateral) axis axis^T
      const diagonal=mass.add(dt.mul(lateral)),rank=dt.mul(along.sub(lateral));
      const rhs=velocity[n].mul(mass).add(force.add(water.mul(lateral)).add(axis.mul(along.sub(lateral).mul(axis.dot(water)))).mul(dt)).toVar();
      const solved=rhs.sub(axis.mul(rank.div(diagonal.add(rank)).mul(axis.dot(rhs)))).div(diagonal).add(kicks[n].mul(dt));
      predicted.push(points[n].add(solved.mul(dt)).toVar());
    }
    // Inextensibility: Gauss-Seidel distance constraints with the collar
    // fixed, sweeping both ways. Velocities come from this solved state.
    const project=n=>{
      const segment=predicted[n].sub(predicted[n-1]).toVar(),length=segment.length();
      const correction=segment.mul(length.sub(lengths[n]).div(length.max(1e-9))).toVar();
      if(n===1)predicted[1].subAssign(correction);
      else{predicted[n-1].addAssign(correction.mul(.5));predicted[n].subAssign(correction.mul(.5));}
    };
    // The swimmer's sphere is a soft collision constraint in the same
    // sweeps: each sweep moves a section part of the way out, so a push
    // resolves over a few steps, and the section keeps its length and leaves
    // with the push's velocity.
    const clear=n=>{
      const at=base.add(predicted[n]).toVar(),axis=swimmer.nearest(at).toVar();
      const offset=at.sub(axis).toVar(),distance=offset.length();
      If(distance.lessThan(swimmer.radius),()=>{
        const surface=axis.add(offset.mul(swimmer.radius.div(distance.max(1e-4)))).sub(base);
        predicted[n].assign(mix(predicted[n],surface,SWIMMER_SOFTNESS));
      });
    };
    Loop(SWEEPS,()=>{
      if(swimmer)for(let n=1;n<=BLADE_LINKS;n++)clear(n);
      for(let n=1;n<=BLADE_LINKS;n++)project(n);
      for(let n=BLADE_LINKS;n>=1;n--)project(n);
    });
    const solved=predicted.map(p=>p.toVar());
    // Outward pass: exact lengths and joint limits. The collar twist also
    // absorbs the change of its swing-from-rest reference relative to
    // parallel transport, so the material frame is continuous in time.
    const finalTangents=[null],roll=[float(0)],carried=[null];
    for(let n=1;n<=BLADE_LINKS;n++){
      const expected=(n===1?dirs[1]:rotateVector(carried[n-1],dirs[n])).toVar();
      const heading=direction(predicted[n].sub(predicted[n-1]),tangents[n]).toVar(),limit=n===1?NECK_LIMIT:HINGE_LIMIT;
      If(heading.dot(expected).lessThan(Math.cos(limit)),()=>{
        const away=across(heading,expected).toVar();
        const sideways=direction(away,across(tangents[n],expected).normalize());
        heading.assign(expected.mul(Math.cos(limit)).add(sideways.mul(Math.sin(limit))));
      });
      predicted[n].assign(predicted[n-1].add(heading.mul(lengths[n])));
      finalTangents[n]=heading;
      if(n===1){
        const change=multiply(multiply(align(tangents[1],heading),align(dirs[1],tangents[1])),conjugate(align(dirs[1],heading)));
        roll[1]=wrap(twist[1].add(atan(change.xyz.dot(heading),change.w).mul(2))).toVar();
      }else roll[n]=twist[n];
      const swing=n===1?align(expected,heading):multiply(align(expected,heading),carried[n-1]);
      carried[n]=rollFrame(swing,heading,roll[n]).normalize().toVar();
    }
    // Each section rolls toward broadside to its cross-flow, the stable
    // orientation of a flat plate, faster in stronger cross-flow. Torsion
    // evens out the sections; neck and section twist are limited.
    const turn=[float(0)];
    for(let s=1;s<=BLADE_LINKS;s++){
      const t=finalTangents[s],middle=base.add(predicted[s].add(predicted[s-1]).mul(.5));
      const cross=across(current.velocity(middle).sub(carrier).sub(velocity[s].add(velocity[s-1]).mul(.5)),t).toVar();
      const speed=cross.length(),flow=cross.div(speed.max(1e-6));
      const face=t.cross(across(rotateVector(carried[s],side.xyz),t)).normalize();
      const angle=atan(face.cross(flow).dot(t),face.dot(flow)).toVar();
      const nearest=angle.sub(angle.div(PI).round().mul(PI)); // either face may lead
      turn[s]=nearest.mul(speed.div(BROADSIDE_SPEED).pow2().min(1)).mul(dt.mul(BROADSIDE_RATE).min(1)).toVar();
    }
    const twisted=[float(0)];
    for(let s=1;s<=BLADE_LINKS;s++)twisted[s]=wrap(roll[s].add(turn[s]).sub(turn[s-1]))
      .mul(dt.mul(UNTWIST_RATE).min(1).oneMinus()).clamp(-TWIST_LIMIT,TWIST_LIMIT).toVar();
    const Q2=frames(finalTangents,twisted);

    const drawRow=i.mul(BLADE_STATE_ROWS),shift=base.sub(collar.xyz).toVar();
    const joints=[halfway(vec4(0,0,0,1),Q2[1]).toVar()];
    for(let n=1;n<=BLADE_LINKS;n++)joints[n]=(n<BLADE_LINKS?halfway(Q2[n],Q2[n+1]):Q2[n]).toVar();
    draw.write.element(drawRow).assign(joints[0]);
    draw.write.element(drawRow.add(1)).assign(vec4(base.sub(rotateVector(joints[0],collar.xyz)),contacts));
    const translationBound=shift.length().toVar(),rotationBound=joints[0].xyz.length().mul(2).toVar();
    for(let n=1;n<=BLADE_LINKS;n++){
      const bend=predicted[n].sub(rest[n]).toVar();
      state.write.element(row.add(2*n-2)).assign(vec4(bend,twisted[n]));
      state.write.element(row.add(2*n-1)).assign(vec4(limited(solved[n].sub(points[n]).div(dt),4),0));
      const pivot=collar.xyz.add(rest[n]);
      draw.write.element(drawRow.add(2*n)).assign(joints[n]);
      draw.write.element(drawRow.add(2*n+1)).assign(vec4(base.add(predicted[n]).sub(rotateVector(joints[n],pivot)),0));
      translationBound.assign(translationBound.max(shift.add(bend).length()));
      rotationBound.assign(rotationBound.max(joints[n].xyz.length().mul(2)));
    }
    const plant=side.w.toUint().mul(2);
    atomicMax(bounds.element(plant),translationBound.mul(BOUND_UNITS).ceil().toUint());
    atomicMax(bounds.element(plant.add(1)),rotationBound.mul(BOUND_UNITS).ceil().toUint());
  }
  return {low,high,width:collar.w,contact,integrate};
}
