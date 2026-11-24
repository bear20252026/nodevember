"""A finishing grade for the rendered loops, as a 3D LUT (.cube) that ffmpeg applies while encoding:
nothing is rendered again.

    /usr/bin/python3 grade.py out.cube [--tone 0.75] [--cool 1] [--warm 0.8] [--chroma 1.06] [--black 0.075]
    ffmpeg -i renders/loop_reels/f_%04d.png -vf "lut3d=out.cube:interp=tetrahedral" ...

The frames (graded in the compositor) are flat: their darkest pixels sit at a quarter grey and lit sand at 0.72,
and the shadows on the sand are the sand's own hue greyed (h 34), which reads as mud. So:
  - a tone curve on luminance (hue kept): blacks down to --black, a stronger middle, a soft shoulder;
  - chroma kept by luminance, only scaled by --chroma (levels per channel would add 60% colour);
  - shadows lose their brown and take the sky's blue (--cool), as shade under a blue sky does;
  - the brightest sand and cloud a touch warmer (--warm), so light and shade are opposite colours.
"""
import sys

import numpy as np

args = sys.argv[1:]


def arg(name, default):
    return float(args[args.index(name) + 1]) if name in args else default


OUT = args[0]
TONE = arg("--tone", 0.75)
COOL = arg("--cool", 1.0)
WARM = arg("--warm", 0.8)
CHROMA = arg("--chroma", 1.06)
BLACK = arg("--black", 0.075)
N = 65


def monotone(xs, ys):
    # Fritsch-Carlson: a smooth curve through the points that never turns back (no bands from kinks)
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    d = np.diff(ys) / np.diff(xs)
    m = np.concatenate([[d[0]], (d[:-1] + d[1:]) / 2, [d[-1]]])
    for k in range(len(d)):
        if d[k] == 0:
            m[k] = m[k + 1] = 0
        else:
            a, b = m[k] / d[k], m[k + 1] / d[k]
            s = a * a + b * b
            if s > 9:
                t = 3 / np.sqrt(s)
                m[k], m[k + 1] = t * a * d[k], t * b * d[k]

    def f(x):
        x = np.clip(x, xs[0], xs[-1])
        k = np.clip(np.searchsorted(xs, x) - 1, 0, len(d) - 1)
        h = xs[k + 1] - xs[k]
        t = (x - xs[k]) / h
        h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
        return h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1]

    return f


# luminance now -> luminance wanted (measured on the reels frames: shadows 0.24-0.33, sand 0.70, cloud 0.9)
curve = monotone(
    [0.0, 0.20, 0.30, 0.45, 0.55, 0.70, 0.80, 0.92, 1.0],
    [0.0, BLACK, 0.165, 0.375, 0.515, 0.725, 0.85, 0.95, 1.0],
)


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


g = np.linspace(0, 1, N)
# (.cube order: red changes fastest)
b_, g_, r_ = np.meshgrid(g, g, g, indexing="ij")
rgb = np.stack([r_, g_, b_], -1).reshape(-1, 3)
W = np.array([0.2126, 0.7152, 0.0722])
L = rgb @ W
y = L + (curve(L) - L) * TONE
chroma = rgb - L[:, None]
# (chroma follows luminance a little, so shadows pulled down do not turn grey, nor lifted ones garish)
ratio = np.sqrt(np.clip((y + 0.02) / (L + 0.02), 0.25, 4))
chroma *= (CHROMA * ratio)[:, None]
# shade: its brown out, the sky's blue in (h ~212, the sky is h 206)
shade = 1 - smooth(0.12, 0.5, y)
warmish = np.clip(chroma[:, 0] - chroma[:, 2], 0, None)  # brown / sand-coloured shade
chroma -= (shade * np.clip(warmish * 4, 0, 1) * 0.45 * COOL)[:, None] * chroma
blue = np.array([-0.032, -0.006, 0.07])
blue -= blue @ W  # no change of luminance
chroma += (shade * (1 - shade * 0.4) * COOL)[:, None] * blue
# light: a touch warmer at the top
lit = smooth(0.62, 0.95, y)
warm = np.array([0.018, 0.004, -0.03])
warm -= warm @ W
chroma += (lit * WARM)[:, None] * warm
out = np.clip(y[:, None] + chroma, 0, 1)

with open(OUT, "w") as fh:
    fh.write(f"TITLE \"mirage finish\"\nLUT_3D_SIZE {N}\n")
    np.savetxt(fh, out, fmt="%.6f")
print("wrote", OUT)
