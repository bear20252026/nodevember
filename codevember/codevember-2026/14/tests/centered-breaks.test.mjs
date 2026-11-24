import test from "node:test";
import assert from "node:assert/strict";
import { BreakingJourney } from "../journey.js";
import { STEP } from "../tension-simulation.js";

function radius(point, shot, pose, aspect) {
  const halfHeight =
    (pose.z - shot.z - point[2]) * Math.tan((pose.fov * Math.PI) / 360);
  return Math.hypot(
    (point[0] - pose.x) / (halfHeight * aspect),
    (point[1] - pose.y) / halfHeight,
  );
}

test("warnings stay central while the camera eases between loaded paths", () => {
  for (const aspect of [16 / 9, 390 / 844])
    for (const seed of [2, 42, 88]) {
      let choices = 0,
        breaks = 0;
      const journey = new BreakingJourney({
        seed,
        getAspect: () => aspect,
        onBreak(shot) {
          const r = radius(
            shot.simulation.fracture.position,
            shot,
            journey.cameraPose(),
            aspect,
          );
          assert.ok(
            r < 0.65,
            `Break stays near the center (${seed}, ${aspect}, ${shot.index}: ${r})`,
          );
          breaks++;
        },
      });
      try {
        // Staying close requires lateral travel between the longer legacy paths.
        while (journey.index < 3 && journey.time < 90) {
          const shot = journey.current,
            previous = shot.stressLink,
            before = journey.cameraPose();
          journey.advance(STEP);
          const after = journey.cameraPose();
          if (
            shot === journey.current &&
            shot.reportedBreaks > 0 &&
            !shot.simulation.broken
          )
            assert.ok(
              after.z <= before.z + 1e-9,
              "No retreat until every path has broken",
            );
          if (journey.transitionAge < 0 && shot === journey.current)
            assert.ok(
              Math.hypot(after.x - before.x, after.y - before.y) <= 0.86 * STEP,
              "The tracking camera has bounded speed and no jumps",
            );
          if (shot.stressLink !== null && previous === null) {
            const selected = shot.stressLink,
              pose = journey.cameraPose();
            assert.ok(
              radius(
                shot.simulation.links[selected].position,
                shot,
                pose,
                aspect,
              ) < 0.46,
              "A new warning is selected in the central portion of the view",
            );
            shot.stressLink = null;
            assert.deepEqual(
              journey.cameraPose(),
              pose,
              "Selecting a warning cannot jump the camera",
            );
            shot.stressLink = selected;
            choices++;
          }
        }
        assert.equal(
          journey.index,
          3,
          "Central selection cannot stall surviving branches",
        );
        assert.ok(choices >= 4 && breaks >= 4);
      } finally {
        journey.dispose();
      }
    }
});
