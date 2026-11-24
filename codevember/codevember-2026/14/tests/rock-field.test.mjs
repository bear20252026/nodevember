import test from "node:test";
import assert from "node:assert/strict";
import { RockField, ROCK_NEAR_FADE, ROCK_FAR_FADE } from "../rock-field.js";

test("distant rocks stay in world space and recycle only while completely hidden", () => {
  const field = new RockField();
  let before = structuredClone(field.update(0, 13)),
    replacements = 0;
  for (let i = 1; i <= 1200; i++) {
    const cameraZ = 13 + i * 0.1;
    const after = field.update(i / 60, cameraZ);
    after.forEach((rock, index) => {
      const old = before[index];
      if (rock.generation === old.generation) {
        assert.equal(
          rock.z,
          old.z,
          "Camera motion cannot drag an old rock back into view",
        );
      } else {
        assert.ok(
          cameraZ - old.z - old.size > ROCK_FAR_FADE[1],
          "Old surface is fully lost in fog",
        );
        assert.ok(
          cameraZ - rock.z + rock.size < ROCK_NEAR_FADE[0],
          "New surface starts fully invisible",
        );
        assert.notDeepEqual(
          [rock.x, rock.y, rock.phase],
          [old.x, old.y, old.phase],
        );
        replacements++;
      }
    });
    before = structuredClone(after);
  }
  assert.ok(
    replacements >= 20,
    "Covers repeated transitions and rock generations",
  );
  const z = field.rocks.map((r) => r.z);
  field.update(21, 131); // A small push toward the break must not reset the field.
  assert.deepEqual(
    field.rocks.map((r) => r.z),
    z,
  );
  const reset = field.update(0, 13);
  assert.deepEqual(
    reset,
    new RockField().update(0, 13),
    "Restart restores the original field",
  );
});
