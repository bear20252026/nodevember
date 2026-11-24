import { Vector3 } from 'three/webgpu';
import { attribute, instanceIndex, uniformArray, varying, screenCoordinate, vec2 } from 'three/tsl';

// Choose detail from the projected separation of consecutive treads, not
// world distance alone. Zoom, resolution and oblique views all affect aliasing.
export function createStairLod(masonry, flights) {
  const weights = uniformArray(flights.map(() => 0), 'float');
  const near = masonry.clone(), far = masonry.clone();
  near.name = 'Resolved stair treads'; far.name = 'Distant stair flights';
  const pixel = screenCoordinate.xy.floor();
  const threshold = pixel.dot(vec2(.06711056, .00583715)).fract().mul(52.9829189).fract();
  const nearWeight = varying(weights.element(instanceIndex.div(20)));
  const farWeight = weights.element(attribute('stairFlight', 'float').toInt());
  // Same stable threshold and opposite tests in beauty, reflection and depth
  // passes. No alpha blending, temporal accumulation or overlapping coverage.
  near.maskNode = threshold.lessThan(nearWeight);
  far.maskNode = threshold.greaterThanEqual(farWeight);
  const start = new Vector3(), end = new Vector3(), edge = new Vector3();
  const pixels = flights.map(() => 0);
  return { near, far, weights, pixels,
    update(camera, height, dither = true) {
      let changed = false;
      for (let i = 0; i < flights.length; i++) {
        const { center, step } = flights[i];
        start.copy(center).project(camera); end.copy(center).add(step).project(camera);
        edge.copy(center); edge.x += 1; edge.project(camera).sub(start);
        // Measure perpendicular to the horizontal tread edges. A sideways
        // view must not mistake lateral foreshortening for resolved steps.
        const dx = (end.x - start.x) * camera.aspect, dy = end.y - start.y;
        edge.x *= camera.aspect;
        pixels[i] = Math.abs(dx * edge.y - dy * edge.x) / Math.max(1e-9, Math.hypot(edge.x, edge.y)) * height * .5;
        const t = Number.isFinite(pixels[i]) ? Math.max(0, Math.min(1, (pixels[i] - 2) / 2)) : 1;
        // Match the meshlet transition's 64 coverage levels. Updating the
        // shadow only when a threshold changes keeps the cached map coherent.
        const weight = dither ? Math.round(t * t * (3 - 2 * t) * 63) / 63 : Number(t >= .5);
        if (weight !== weights.array[i]) changed = true;
        weights.array[i] = weight;
      }
      return changed;
    },
    dispose() { near.dispose(); far.dispose(); }
  };
}
