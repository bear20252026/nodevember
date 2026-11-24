// A value that is not a finite number (NaN, infinity) in one pixel spreads: a blur takes it into its
// neighbours, and the bloom's smallest image, a texel of which covers a big square of the screen, turns that
// whole square black. These test a float's exponent bits (all ones: not finite), which no compiler folds
// away, unlike x != x.
import { floatBitsToUint, vec3 } from "three/tsl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export const notFinite = (x: N): N => (floatBitsToUint(x) as N).bitAnd(0x7f800000).equal(0x7f800000);
export const finite3 = (v: N): N => notFinite(v.x).or(notFinite(v.y)).or(notFinite(v.z)).not();
/** v where it is finite, else the fallback */
export const safe3 = (v: N, fallback: N): N => finite3(v).select(v, fallback);
export const safe1 = (x: N, fallback: N): N => notFinite(x).select(fallback, x);

/** A normal read back from the picture, made unit length: where the antialiasing averaged the cloth's two
 *  shells (opposite normals) at one pixel it can be about zero, and normalize(0) is NaN; that one faces the eye */
export const unitNormal = (v: N): N => {
  const len = v.length();
  return len.greaterThan(1e-4).select(v.div(len), vec3(0, 0, 1));
};
