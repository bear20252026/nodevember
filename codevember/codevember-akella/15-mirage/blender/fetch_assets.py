# /usr/bin/python3 blender/fetch_assets.py: the Poly Haven assets build.py uses (CC0), into blender/assets/<id>/,
# the .blend files with their textures beside them as the .blend expects.
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = [
    # rocks of the Karoo, from boulders to stones
    "namaqualand_boulder_02", "namaqualand_boulder_03", "namaqualand_boulder_04", "namaqualand_boulder_05",
    "namaqualand_boulder_06", "namaqualand_boulders_01", "namaqualand_rocks_01", "namaqualand_stones_01",
    # what grows there, and what is left of it
    "wild_rooibos_bush", "searsia_lucida", "searsia_burchellii", "didelta_spinosa", "othonna_cerarioides",
    "quiver_tree_01", "quiver_tree_02", "dead_quiver_trunk", "dead_quiver_branch_01", "dry_quiver_leaf",
    "bark_debris_01", "cheiridopsis_succulent", "crystalline_iceplant",
    # and what grows where there is water
    "grass_bermuda_01", "grass_medium_01", "grass_medium_02", "shrub_02", "shrub_03", "shrub_04",
]
TEXTURES = ["sand_03", "red_sand", "sandy_gravel_02"]
RES = "2k"


def get(url, to):
    if os.path.exists(to) and os.path.getsize(to) > 0:
        return 0
    os.makedirs(os.path.dirname(to), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "asset-fetch/1.0"})
    with urllib.request.urlopen(req) as r, open(to + ".part", "wb") as f:
        f.write(r.read())
    os.replace(to + ".part", to)
    return os.path.getsize(to)


def files(asset):
    req = urllib.request.Request("https://api.polyhaven.com/files/" + asset, headers={"User-Agent": "asset-fetch/1.0"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


total = 0
for asset in MODELS:
    entry = files(asset)["blend"][RES]["blend"]
    folder = os.path.join(HERE, "assets", asset)
    total += get(entry["url"], os.path.join(folder, os.path.basename(entry["url"])))
    for path, inc in entry.get("include", {}).items():
        total += get(inc["url"], os.path.join(folder, path))
    print("model", asset, flush=True)
for asset in TEXTURES:
    d = files(asset)
    folder = os.path.join(HERE, "assets", asset)
    for kind, fmt in [("Diffuse", "jpg"), ("nor_gl", "exr"), ("Rough", "exr"), ("Displacement", "png")]:
        if kind in d:
            u = d[kind][RES][fmt]["url"]
            total += get(u, os.path.join(folder, os.path.basename(u)))
    print("texture", asset, flush=True)
print("fetched %.0f MB" % (total / 1e6))
