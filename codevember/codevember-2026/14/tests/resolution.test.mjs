import test from "node:test";
import assert from "node:assert/strict";
import { renderPixelRatio } from "../render-resolution.js";

test("native DPR is preserved on retina desktop and phone screens", () => {
  assert.equal(renderPixelRatio(1440, 900, 2), 2);
  assert.equal(renderPixelRatio(390, 844, 3), 3);
  assert.equal(renderPixelRatio(2560, 1440, 2), 2);
  assert.equal(renderPixelRatio(1920, 1080, 1), 1);
  assert.equal(renderPixelRatio(1440, 900, 2, 1), 1);
  const limit = renderPixelRatio(6000, 3000, 2, 0, 8192);
  assert.equal(
    6000 * limit,
    8192,
    "Oversized buffers respect the actual GPU limit",
  );
});
