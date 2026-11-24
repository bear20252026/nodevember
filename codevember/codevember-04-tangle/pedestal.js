// The pedestal: a plinth of dark polished stone the size of the crust, a cap
// that overhangs, a body, a foot, and the specimen held a little above it on
// two brass pins, as in a museum. On its front a brass plate with its name
// and its seed.
import * as THREE from 'three';

// a dark stone, finely speckled, with a few faint veins (the extruded
// geometry's uvs are in scene units: one tile is about a third of a unit)
function stoneTexture() {
  const N = 512;
  const cv = Object.assign(document.createElement('canvas'), { width: N, height: N });
  const c = cv.getContext('2d');
  c.fillStyle = '#808080';
  c.fillRect(0, 0, N, N);
  const img = c.getImageData(0, 0, N, N), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 34 + (Math.random() < 0.012 ? 70 : 0);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  c.putImageData(img, 0, 0);
  // veins, drawn three times shifted so the tile wraps
  c.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    let x = Math.random() * N, y = Math.random() * N, a = Math.random() * 6.28;
    const pts = [[x, y]];
    for (let j = 0; j < 40; j++) {
      a += (Math.random() - 0.5) * 0.6;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      pts.push([x, y]);
    }
    c.strokeStyle = `rgba(200,195,185,${0.08 + Math.random() * 0.1})`;
    c.lineWidth = 0.6 + Math.random() * 1.4;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      c.beginPath();
      pts.forEach(([px, py], j) => (j ? c.lineTo(px + ox, py + oy) : c.moveTo(px + ox, py + oy)));
      c.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const stone = new THREE.MeshPhysicalMaterial({
  map: stoneTexture(),
  color: 0x3a3833,
  roughness: 0.34,
  metalness: 0,
  clearcoat: 0.7,
  clearcoatRoughness: 0.12,
  fog: false,
});
const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a467, metalness: 1, roughness: 0.32, fog: false });

const GAP = 0.07; // between the cap and the lowest point of the crust
const PIN = 0.008; // the pins' radius

// a slab with rounded corners and a bevel: half sizes hx, hz, from y to y + h
function slab(hx, hz, y, h, corner, bevel) {
  const s = new THREE.Shape();
  const x = hx - bevel, z = hz - bevel, c = Math.min(corner, x, z);
  s.moveTo(-x + c, -z);
  s.lineTo(x - c, -z);
  s.quadraticCurveTo(x, -z, x, -z + c);
  s.lineTo(x, z - c);
  s.quadraticCurveTo(x, z, x - c, z);
  s.lineTo(-x + c, z);
  s.quadraticCurveTo(-x, z, -x, z - c);
  s.lineTo(-x, -z + c);
  s.quadraticCurveTo(-x, -z, -x + c, -z);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  return g.rotateX(-Math.PI / 2).translate(0, y + bevel, 0);
}

function plateTexture(seed) {
  const W = 1024, H = 240;
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = cv.getContext('2d');
  // brushed brass
  c.fillStyle = '#b8935a';
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,235,190' : '70,50,20'},${0.03 + Math.random() * 0.05})`;
    c.fillRect(0, Math.random() * H, W, 1);
  }
  c.strokeStyle = 'rgba(60,40,15,0.6)';
  c.lineWidth = 3;
  c.strokeRect(14, 14, W - 28, H - 28);
  // engraved: dark, with a light edge under it
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const engrave = (text, y, font, spacing) => {
    c.font = font;
    c.letterSpacing = spacing;
    c.fillStyle = 'rgba(255,240,205,0.5)';
    c.fillText(text, W / 2, y + 2);
    c.fillStyle = '#2a1c08';
    c.fillText(text, W / 2, y);
  };
  engrave('EISENBLÜTE', 92, '500 84px Georgia, "Times New Roman", serif', '18px');
  engrave(`aragonite  ·  n° ${seed}`, 172, 'italic 52px Georgia, "Times New Roman", serif', '4px');
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// box: the crust's box, base: its geometry (to find where the pins meet it),
// height: × the first, tall plinth (0.75 high); 0.3 of it by default
export function pedestal(box, base, seed, height = 0.3) {
  const group = new THREE.Group();
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  // its footprint: 3/4 of the crust's with a margin, the crust overhanging it a little
  const hx = (size.x / 2 + 0.16) * 0.75, hz = (size.z / 2 + 0.2) * 0.75;
  const top = box.min.y - GAP;
  const capH = 0.06 * height, bodyH = 0.62 * height, footH = 0.07 * height, inset = 0.045;
  const parts = [
    slab(hx, hz, top - capH, capH, 0.07, Math.min(0.014, capH / 3)),
    slab(hx - inset, hz - inset, top - capH - bodyH, bodyH, 0.05, 0.006),
    slab(hx - inset + 0.02, hz - inset + 0.02, top - capH - bodyH - footH, footH, 0.06, Math.min(0.012, footH / 3)),
  ];
  for (const g of parts) {
    const m = new THREE.Mesh(g.translate(mid.x, 0, mid.z), stone);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }

  // the pins: up from the cap to the crust's underside, at a third of its length
  // either side (closer to the middle where the outline is jagged and misses)
  const probe = new THREE.Mesh(base, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const pinGeo = new THREE.CylinderGeometry(PIN, PIN, 1, 10).translate(0, 0.5, 0);
  for (const side of [-1, 1]) {
    for (let f = 0.34; f > 0.02; f -= 0.04) {
      const x = mid.x + side * f * size.x, z = mid.z;
      ray.set(new THREE.Vector3(x, top - 1, z), new THREE.Vector3(0, 1, 0));
      const hit = ray.intersectObject(probe)[0];
      if (!hit) continue;
      const pin = new THREE.Mesh(pinGeo, brass);
      pin.position.set(x, top - 0.01, z);
      pin.scale.y = hit.point.y - top + 0.02;
      pin.castShadow = true;
      // a little collar where it goes into the stone
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(PIN * 2.4, PIN * 2.8, 0.012, 16), brass);
      collar.position.set(x, top + 0.006, z);
      collar.castShadow = true;
      group.add(pin, collar);
      break;
    }
  }

  // the plate, on the front of the body, a little above its middle
  const pw = Math.min(0.78, hx * 0.75, (bodyH * 0.62) / (240 / 1024)), ph = pw * (240 / 1024);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(pw, ph, 0.006),
    [brass, brass, brass, brass, new THREE.MeshPhysicalMaterial({ map: plateTexture(seed), metalness: 1, roughness: 0.36, fog: false }), brass],
  );
  plate.position.set(mid.x, top - capH - bodyH * (height < 0.8 ? 0.45 : 0.32), mid.z + hz - inset + 0.003);
  plate.receiveShadow = true;
  group.add(plate);

  group.userData.dispose = () => {
    for (const g of parts) g.dispose();
    pinGeo.dispose();
    plate.material[4].map.dispose();
    plate.material[4].dispose();
    group.traverse((o) => o.geometry?.dispose());
  };
  return group;
}
