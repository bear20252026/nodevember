import test from "node:test";
import assert from "node:assert/strict";
import { BreakingJourney } from "../journey.js";
import { STEP } from "../tension-simulation.js";

test("a warning selects the actual failure site and survives release and renewed pulling", () => {
  const journey = new BreakingJourney({ seed: 2 });
  try {
    journey.advance(2, { auto: false });
    const shot = journey.current,
      sim = shot.simulation;
    assert.equal(shot.stressLink, null, "Idle chains have no warning light");
    while (
      (shot.stressLink === null || sim.load < sim.strength * 0.78) &&
      journey.time < 10
    )
      journey.advance(STEP);
    const selected = shot.stressLink;
    assert.notEqual(selected, null);
    assert.equal(sim.fracture, null, "Warning precedes failure");
    assert.equal(journey.lastBreak, null, "Preview is not a completed break");
    journey.advance(1.5, { auto: false });
    assert.equal(shot.stressLink, selected);
    assert.ok(
      sim.load < sim.strength * 0.35,
      "Release removes the warning load",
    );
    while (!sim.fracture && journey.time < 15)
      journey.advance(STEP, { auto: false, pulling: true });
    assert.ok(sim.fracture);
    assert.equal(
      sim.fracture.index,
      selected,
      "The illuminated link is the one that breaks",
    );
    assert.equal(journey.lastBreak, selected);
    assert.equal(
      shot.stressLink,
      null,
      "Completed fracture clears its warning",
    );
  } finally {
    journey.dispose();
  }
});

test("successive branch fractures each break the link that was illuminated", () => {
  const selected = new Map();
  let warnedBreaks = 0,
    branchedBreaks = 0;
  const journey = new BreakingJourney({
    seed: 2,
    onBreak(shot) {
      assert.equal(shot.simulation.fracture.index, selected.get(shot.index));
      warnedBreaks++;
      if (shot.simulation.chainCount > 1) branchedBreaks++;
    },
  });
  try {
    while (journey.index < 3 && journey.time < 90) {
      const shot = journey.current;
      if (shot.stressLink !== null) selected.set(shot.index, shot.stressLink);
      journey.advance(STEP);
    }
    assert.equal(
      journey.index,
      3,
      "Warning selection does not stall surviving paths",
    );
    assert.ok(warnedBreaks >= 4);
    assert.ok(
      branchedBreaks >= 2,
      "Includes multiple breaks within a branched assembly",
    );
  } finally {
    journey.dispose();
  }
});
