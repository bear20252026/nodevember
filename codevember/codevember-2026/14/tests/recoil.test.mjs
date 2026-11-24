import test from "node:test";
import assert from "node:assert/strict";
import { TensionSimulation, STEP, CENTER_LINK } from "../tension-simulation.js";

test("recoil moves both chain sections beyond the links beside every type of fracture", () => {
  for (const fractureMode of ["snap", "tear", "shatter"]) {
    for (const chainCount of [1, 3]) {
      const options = {
        fractureMode,
        chainCount,
        weakLink: CENTER_LINK,
        strength: 1e8,
      };
      const sim = new TensionSimulation(options);
      const control = new TensionSimulation(options);
      // Compare the same loaded bodies with and without the release impulses.
      control.startRecoil = () => {};
      try {
        for (const world of [sim, control]) {
          world.advance(5.5);
          world.breakLink();
        }
        if (fractureMode === "tear")
          assert.equal(
            sim.recoil.length,
            0,
            "The intact hinge still carries tension",
          );
        while (sim.pendingFracture && sim.time < 8) {
          sim.advance(STEP);
          control.advance(STEP);
        }
        assert.equal(sim.pendingFracture, null);
        for (let step = 0; step < 42; step++) {
          sim.advance(STEP);
          control.advance(STEP);
          for (const [a, b] of sim.edges) {
            if (!sim.links[a] || !sim.links[b]) continue;
            assert.ok(
              Math.hypot(
                ...sim.links[a].position.map(
                  (v, k) => v - sim.links[b].position[k],
                ),
              ) < 0.56,
              "Recoil keeps every intact connection interlocked",
            );
          }
        }
        for (const indices of [
          [2, 3, 4, 5, 6],
          [12, 13, 14, 15, 16],
        ]) {
          const displacement =
            indices.reduce(
              (sum, i) =>
                sum +
                Math.hypot(
                  ...sim.links[i].position.map(
                    (v, k) => v - control.links[i].position[k],
                  ),
                ),
              0,
            ) / indices.length;
          assert.ok(
            displacement > 0.1,
            `${fractureMode}, ${chainCount} chains: recoil reaches section ${indices[0]} (${displacement})`,
          );
        }
        assert.equal(sim.recoil.length, 0, "The brief release wave finishes");
      } finally {
        sim.dispose();
        control.dispose();
      }
    }
  }
});
