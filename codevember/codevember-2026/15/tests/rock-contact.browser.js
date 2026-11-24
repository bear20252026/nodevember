import { Vector3 } from 'three/webgpu';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Exercise actual generated stones in the current landscape, not synthetic
// stand-ins. Select by world location/size: adding island instances must not
// change the target merely by shifting an InstancedMesh slot number.
export async function checkRockContact(app = window.mirage) {
  const { rover, landscape } = app, physics = rover.physics;
  const saved = rover.capture(), manual = app.manual;
  const report = { colliders: landscape.obstacles.length };
  app.manual = true;
  const place = (x, z) => {
    rover.restore({ ...saved, position: [x, landscape.heightAt(x, z) + 1.05, z], rotation: [0,0,0,1], velocity: [0,0,0], angular: [0,0,0], steering: 0 });
    for (let i = 0; i < 120; i++) physics.update(1 / 120);
  };
  try {
    const small = landscape.obstacles.filter(o => o.variant === 14 && o.rx < 1 && o.rz < 1
      && o.x > 30 && o.x < 65 && o.z > 80 && o.z < 105 && o.top - landscape.heightAt(o.x, o.z) > .2)
      .sort((a, b) => Math.hypot(a.x - 48, a.z - 86) - Math.hypot(b.x - 48, b.z - 86))[0];
    assert(small && small.rx < 1 && small.rz < 1, 'Small rendered boulder has no collider');
    place(small.x + .93, small.z + 6);
    let contacts = 0, elevation = 0, articulation = 0, contactPose;
    for (let i = 0; i < 360; i++) {
      physics.update(1 / 120, 1);
      for (const wheel of physics.wheels) if (wheel.contact && !wheel.sand && Math.hypot(wheel.point[0] - small.x, wheel.point[2] - small.z) < 2) {
        contacts++;
        const rise = wheel.point[1] - landscape.heightAt(wheel.point[0], wheel.point[2]);
        if (rise > elevation) { elevation = rise; contactPose = physics.capture(); }
        articulation = Math.max(articulation, .76 - wheel.length);
      }
      // Finish once the selected stone is crossed and all tires are back on
      // sand. Continuing into another part of this outcrop tests a different
      // obstacle, whose position changes when the formation is regenerated.
      if (contacts > 10 && physics.position[2] < small.z - 4
        && physics.wheels.every(w => w.contact && w.sand)) break;
    }
    assert(contacts > 10 && elevation > .15 && articulation > .1, 'Wheels did not climb the rendered rubble');
    assert(physics.position[2] < small.z - 4, 'Rubble prevented crossing');
    assert(physics.wheels.every(w => w.contact && w.sand), 'Wheels did not return to sand');
    report.smallRock = { contacts, elevation, articulation, crossed: true, end: [...physics.position] };
    rover.restore(contactPose); rover.pose();
    const centers = rover.legs.map(leg => leg.wheel.getWorldPosition(new Vector3()));
    assert(centers.every(p => p.toArray().every(Number.isFinite)), 'Wheel pose became invalid');
    assert(Math.max(...centers.map(p => p.y)) - Math.min(...centers.map(p => p.y)) > .15, 'Visual wheel suspension remained level over rocks');
    report.contactPose = contactPose;

    place(-8, 109);
    let blocked = false, recovered = false;
    for (let i = 0; i < 10 * 120; i++) {
      physics.update(1 / 120, 1);
      assert(physics.position[2] > 93, 'Chassis passed through the large rendered boulder');
      if (physics.position[2] < 100 && physics.speed < 1) blocked = true;
      if (physics.recovering) { recovered = true; break; }
    }
    assert(blocked, 'Chassis did not stop against the boulder');
    assert(recovered, 'An immobilized or tipped rover did not recover');
    for (let i = 0; i < 4 * 120; i++) physics.update(1 / 120);
    assert(!physics.recovering && physics.diagnostics.contacts === 4, 'Recovery did not restore tire contact');
    report.largeRock = { blocked, recovered, end: [...physics.position], speed: physics.speed, diagnostics: physics.diagnostics };
  } finally {
    rover.restore(saved); app.manual = manual; app.render();
  }
  return report;
}
