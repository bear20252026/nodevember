// Use the screen's native pixel density unless the user chooses an override.
// Only the GPU's actual texture dimension limit may reduce that density.
export function renderPixelRatio(
  width,
  height,
  dpr = 1,
  override = 0,
  maxDimension = 8192,
) {
  const preferred = override > 0 ? override : Math.max(1, dpr);
  return Math.min(preferred, maxDimension / Math.max(1, width, height));
}
