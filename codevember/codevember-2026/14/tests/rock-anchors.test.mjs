import test from "node:test";
import assert from "node:assert/strict";
import { TensionSimulation, STEP } from "../tension-simulation.js";
import { BreakingJourney } from "../journey.js";
import { CLEVIS, multiplyQuaternion, rotateVector } from "../link-shape.js";

const rockShapes = [
  { socket: [0.15, 0, 0.7], normal: [0, 0, 1] },
  { socket: [0, -0.15, 0.75], normal: [0.3, 0, Math.sqrt(0.91)] },
];
for (const shape of rockShapes)
  shape.ports = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map((normal) => ({ normal, socket: normal.map((v) => v * 0.75) }));
function jointGap(sim, anchor) {
  const rock = anchor.rock,
    link = anchor.linkBody;
  const a = rotateVector(rock.socket, rock.quaternion);
  const b = rotateVector(rock.linkPin, link.quaternion);
  return Math.hypot(
    ...a.map((v, k) => rock.position[k] + v - link.position[k] - b[k]),
  );
}
function checkClevisLimits(sim) {
  for (const joint of sim.clevisJoints) {
    const a = multiplyQuaternion(joint.rock.quaternion, joint.frameA);
    const b = multiplyQuaternion(joint.link.quaternion, joint.frameB);
    const relative = multiplyQuaternion(
      a.map((v, k) => (k < 3 ? -v : v)),
      b,
    );
    const tilt = Math.acos(
      Math.max(-1, Math.min(1, rotateVector([0, 0, 1], relative)[2])),
    );
    const angle = 2 * Math.atan2(relative[2], relative[3]);
    const swing = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    assert.ok(
      tilt < CLEVIS.tiltLimit + 0.02,
      `End link stays between the ears (${tilt})`,
    );
    assert.ok(
      swing < CLEVIS.swingLimit + 0.015,
      `End link cannot swing through the mounting plate (${swing})`,
    );
  }
}

test("moving rocks load pinned chain ends, which stay attached through fracture and retirement", () => {
  for (const chainCount of [2, 3, 4]) {
    const sim = new TensionSimulation({
      chainCount,
      rockShapes,
      centerPull: true,
      weakLink: 6,
      linkCount: 13,
      branchLinkCount: 6,
      rockTethers: true,
    });
    const initial = sim.rocks.map((r) => [...r.position]);
    for (const tether of sim.tethers) {
      const satellite = tether.anchor.rock;
      const clearance = Math.min(
        ...sim.links.map((link) =>
          Math.hypot(
            satellite.position[0] - link.position[0],
            satellite.position[1] - link.position[1],
          ),
        ),
      );
      assert.ok(
        clearance > satellite.size + 0.3,
        "Satellite rocks start outside every breakable span",
      );
    }
    let largestGap = 0;
    try {
      while (!sim.broken && sim.time < 15) {
        sim.advance(STEP);
        if (sim.time > 0.25) checkClevisLimits(sim);
        for (const anchor of sim.anchors)
          largestGap = Math.max(largestGap, jointGap(sim, anchor));
      }
      assert.ok(sim.broken, "Separating rocks produce every required fracture");
      assert.equal(sim.fractures.length, chainCount);
      assert.equal(sim.tetherLinks.length, sim.anchors.length * 5);
      assert.equal(sim.rocks.length, sim.anchors.length * 2);
      assert.equal(
        sim.clevisJoints.length,
        sim.anchors.length * 3,
        "Both ends of every permanent tether have limited mounts too",
      );
      assert.ok(sim.fractures.every((f) => f.load > sim.strength));
      assert.ok(
        sim.rocks.every(
          (r, i) =>
            Math.hypot(...r.position.map((v, k) => v - initial[i][k])) > 0.5,
        ),
      );
      assert.ok(
        largestGap < 0.025,
        `Pin error stays below 2.5 cm (${largestGap})`,
      );
      sim.releaseAnchors();
      const heights = sim.rocks.map((r) => r.position[1]);
      for (let i = 0; i < 3 / STEP; i++) {
        sim.advance(STEP, 0);
        checkClevisLimits(sim);
      }
      assert.ok(sim.rocks.every((r, i) => r.position[1] < heights[i] - 1));
      assert.ok(
        sim.anchors.every((a) => jointGap(sim, a) < 0.025),
        "Old chains fall with their rocks, without detaching",
      );
      for (const tether of sim.tethers) {
        assert.ok(jointGap(sim, tether.anchor) < 0.025);
        for (let i = 1; i < tether.bodies.length; i++)
          assert.ok(
            Math.hypot(
              ...tether.bodies[i].position.map(
                (v, k) => v - tether.bodies[i - 1].position[k],
              ),
            ) < 0.56,
            "Permanent tethers stay connected after the main chains break",
          );
      }
    } finally {
      sim.dispose();
    }
  }
});

test("short rock-driven journeys keep breaks central with smooth camera tracking", () => {
  for (const aspect of [16 / 9, 390 / 844])
    for (const seed of [2, 42]) {
      const warnings = new Map();
      let broken = 0;
      const journey = new BreakingJourney({
        rockShapes,
        seed,
        getAspect: () => aspect,
        linkCount: 13,
        branchLinkCount: 6,
        rockTethers: true,
        onBreak(shot) {
          assert.equal(
            shot.simulation.fracture.index,
            warnings.get(shot.index),
          );
          const p = shot.simulation.fracture.position,
            view = journey.cameraPose();
          const h =
            (view.z - shot.z - p[2]) * Math.tan((view.fov * Math.PI) / 360);
          assert.ok(
            Math.hypot((p[0] - view.x) / (h * aspect), (p[1] - view.y) / h) <
              0.65,
          );
          broken++;
          if (shot.simulation.broken)
            assert.equal(
              shot.simulation.fractures.length,
              shot.simulation.chainCount,
            );
        },
      });
      try {
        const openingDepth = journey.cameraZ;
        let closestOpening = openingDepth,
          runningIncoming = 0;
        while (journey.index < 3 && journey.time < 55) {
          const shot = journey.current,
            before = journey.cameraPose();
          const velocity = journey.cameraVelocity;
          if (shot.stressLink !== null)
            warnings.set(shot.index, shot.stressLink);
          journey.advance(STEP);
          const p = journey.cameraPose();
          if (
            shot === journey.current &&
            shot.reportedBreaks > 0 &&
            !shot.simulation.broken
          )
            assert.ok(
              p.z <= before.z + 1e-9,
              "No pullback while another chain remains intact",
            );
          assert.ok(
            Math.abs(p.z - before.z) <= 14 * STEP + 1e-8,
            "No Z position jump",
          );
          assert.ok(
            Math.abs(journey.cameraVelocity - velocity) <= 8 * STEP + 1e-8,
            "No sudden Z velocity change at fracture or handoff",
          );
          if (journey.index === 0)
            closestOpening = Math.min(closestOpening, p.z);
          if (journey.next?.simulation.time > 0) {
            runningIncoming++;
            assert.equal(journey.next.simulation.fractures.length, 0);
          }
          if (journey.transitionAge < 0 && shot === journey.current)
            assert.ok(Math.hypot(p.x - before.x, p.y - before.y) < 0.86 * STEP);
          assert.ok(Number.isFinite(p.z));
        }
        assert.equal(
          journey.index,
          3,
          `Sequence keeps moving (${seed}, ${aspect})`,
        );
        assert.ok(
          broken >= 6,
          "Every assembly has at least two distinct breaks",
        );
        assert.ok(
          closestOpening < openingDepth - 0.5,
          "Camera gently moves closer as tension builds",
        );
        assert.ok(
          runningIncoming > 60,
          "Incoming simulations start during the dolly transition",
        );
      } finally {
        journey.dispose();
      }
    }
});
