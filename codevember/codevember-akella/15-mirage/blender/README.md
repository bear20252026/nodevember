# The garden in Blender

The page's garden (`../index.html`) as a Cycles scene: the same mirrors, doors, rocks, ground and the eye's way,
exported from the page, with what the page could not afford added.

```sh
node ../tools/export-blender.mjs        # the world from the page, into data/ (dev server on 5315)
/usr/bin/python3 fetch_assets.py        # Poly Haven rocks, plants, sand, into assets/ (skies: see below)
blender -b --factory-startup -P build.py -- --frames 30 --res 960x540 --samples 48 --device METAL
./pc.sh sync; ./pc.sh start <job> --frames 0,1,2 ...; ./pc.sh status <job>; ./pc.sh fetch <job>   # on the RTX PC
```

The daylight look (test frames in `renders/oasis2/`):

```
--sky kloofendal_48d_partly_cloudy_puresky --sun-turn -35 --sun-high 28 --sun-power 4.5 --dusk 0 --fill 1
--sand "#d9a45c" --sat 1.05 --sight 2 --ripples 0.02 --dust 0.55 --teal 0.7 --expose 0.75
```

The oasis starts 160 m out (`--oasis-near`, `--oasis-deep`): date palms in clumps, young palms, tamarisk and
grass, a pond dug into the ground under them with a stream winding out of it to the left (`--water 0`,
`--stream 0` for none; `--water-tone`, `--water-shine`), green shores, darker soil under the grove (`--soil`),
and its leaves greener than the dust has left them (`--green`, `--green-light`). The water stands just under the
valley floor and the ground in front of it is laid flat, and nothing tall grows between it and the valley: from
two metres up anything higher hides it. Its body is a dark teal and only partly a mirror, or at that angle it
would be all pale sky, the colour of the sand.

Without `--sky` it is the page's own dusk sky and sun. Every option is read near the top of `build.py` (`arg(...)`).

- Doors are Ray Portal BSDFs with the page's door transform, for what the eye sees only; for light they are the
  mirrors they are made as (light through a portal can only be come on by chance: it was sparkle).
- The haze is in the materials (`air` node group), by the length of the ray that met a surface, weighted by a
  leaf's alpha: the compositor's mist pass goes through portals and could not be used.
- With `--sun-high`, the photographed sky's sun is taken out (all that is brighter than the rest of the sky) and
  given to a lamp where it is wanted. These skies keep their sun only about as bright as the sky: `--sun-power`.

## Loops

- Landscape: `renders/loop_full.args` (1920x1080, 512 samples, ~30 s a frame on the RTX 5080).
- Reels, 9:16: `renders/loop_reels.args`: `--res 1080x1920 --wide 55 --shift 0.1`. The page's angle is the
  picture's height, which in a tall frame is a 31 deg slot, so `--wide` sets the width instead; `--shift` lifts
  the picture by lens shift, which keeps the mirrors upright where `--pitch` would lean them. Blender's shift is
  in units of the side the sensor is fitted to (the width here), not of the longer side.
- A shorter loop: `--path path_02.json` (from `LAPS=0,2 node ../tools/export-blender.mjs`) moves the eye only;
  plants still keep clear of every lap's way, so the world is the one of the full loop.
- A run that stops (the PC lost power twice) is started again with the same command: frames already made are
  skipped, and each frame's noise comes from its number, so a restart does not show.
- The camera's near clip is 1 mm: camera rays start at the clip, and with 5 cm the one frame that came 2.5 cm
  before a door (739 of the full loop) began past the portal and showed the world behind the door. Such a frame
  shows as a lone jump in the difference between each frame and the next, three times the usual on both sides.
- `grade.py` makes a 3D LUT for ffmpeg (`lut3d=finish.cube:interp=tetrahedral`): the frames came out flat
  (darkest at a quarter grey) with shade the sand's own brown greyed; the LUT is a tone curve on luminance with
  the hue kept, shade toward the sky's blue, the brightest light a touch warmer. Nothing is rendered again.

## Credits

- Poly Haven (CC0): Namaqualand boulders, rocks and stones; wild rooibos, searsia, didelta, othonna, quiver trees,
  dead quiver wood, iceplant, cheiridopsis; sand_03, red_sand, sandy_gravel_02; skies kloofendal_48d_partly_cloudy,
  kloofendal_43d_clear, kloofendal_38d_partly_cloudy, sunflowers, kloppenheim_05, qwantani_afternoon (puresky).
- Sketchfab, CC Attribution:
  - "Realistic HD Date palm" 13/78, 21/78, 55/78, 64/78, "Realistic HD Canary Island date palm" 31/40, "Realistic HD
    French tamarisk" 1/20 and 6/20, by PlantCatalog (sketchfab.com/PlantCatalog)
  - "Date palm and vegetation" by Bársh
- Poly Haven (CC0) at the water: grass_medium_02, grass_bermuda_01, grass_medium_01, shrub_02, shrub_03, shrub_04.
- Sketchfab Standard licence (not to be passed on): "Dry realistic grass lods 1" by POLYSCAN.
