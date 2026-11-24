import { CanvasTexture, SpotLight, LinearMipmapLinearFilter } from 'three/webgpu';
import { Fn, uniform, texture, vec2, sin, cos } from 'three/tsl';

// A light cookie, not a floor decal: the pattern follows real receiving
// surfaces, including the rover, and is occluded by the doorway masonry.
export function createSanctuaryProjection(scene, beacon) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
  ctx.translate(256, 256); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff'; ctx.shadowColor = '#8affdf'; ctx.shadowBlur = 3;
  const arc = (r, a, b, width) => { ctx.lineWidth = width; ctx.beginPath(); ctx.arc(0, 0, r, a, b); ctx.stroke(); };
  arc(158, 0, Math.PI * 2, 2.2); arc(177, 0, Math.PI * 2, 1.3);
  arc(98, 0, Math.PI * 2, 2.4); arc(35, 0, Math.PI * 2, 1.8);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    arc(122, a + .04, a + .36, i % 3 ? 2 : 4);
    ctx.save(); ctx.rotate(a);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 143); ctx.lineTo(0, 154); ctx.stroke();
    // Small abstract inscriptions, separated by open space for readability.
    ctx.beginPath(); ctx.moveTo(-6, 188); ctx.lineTo(-6, 202); ctx.lineTo(5, 198); ctx.lineTo(5, 189); ctx.stroke();
    if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(-9, 207); ctx.lineTo(8, 207); ctx.stroke(); }
    ctx.restore();
  }
  for (let turn = 0; turn < 2; turn++) {
    ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i <= 3; i++) { const a = (i / 3 + turn / 6) * Math.PI * 2, x = Math.sin(a) * 82, y = Math.cos(a) * 82; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const map = new CanvasTexture(canvas); map.name = 'Sanctuary seal / projected light cookie';
  map.minFilter = LinearMipmapLinearFilter; map.anisotropy = 4;
  const phase = uniform(0), light = new SpotLight('#7affdc', 5000, 40, .75, .18, 2);
  light.name = 'Sanctuary seal projector'; light.position.copy(beacon.position);
  // Place the seal beyond the pedestal so it reaches the threshold and the
  // first landing, where the rover arrives at the entrance.
  light.target.position.copy(beacon.position).add({ x: 0, y: -8.5, z: 9 });
  light.colorNode = Fn(([coord]) => {
    const p = coord.xy.sub(.5), c = cos(phase), s = sin(phase);
    const rotated = vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c))).add(.5);
    return texture(map, rotated).rgb;
  });
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = .2; light.shadow.bias = -.0001; light.shadow.normalBias = .025;
  light.shadow.autoUpdate = false; light.shadow.needsUpdate = true; light.layers.enable(1);
  scene.add(light, light.target);
  return { light, map, phase,
    update(time, rover) {
      phase.value = time * .035;
      light.intensity = 5000 * (.94 + .06 * Math.sin(time * 1.1));
      if ((rover.moving || rover.shadowDirty) && rover.position.distanceToSquared(light.position) < 45 * 45) light.shadow.needsUpdate = true;
    },
    dispose() { scene.remove(light, light.target); light.dispose(); map.dispose(); }
  };
}
