import { BoxGeometry, Float32BufferAttribute } from 'three/webgpu';
import { mergeVertices } from './vendor/mergeVertices.js';
import { noise, smoothstep } from './noise.js';
import { sampleSediment } from './rock-geometry.js';
import { bakeCurvature } from './curvature.js';

// Unequal fracture spacing gives broad planar faces separated by clefts.
// Linear interpolation keeps these geological facets from becoming soft noise.
function fractureProfile(u) {
  const joints = [-160, -119, -88, -69, -32, -8, 17, 44, 61, 91, 116, 160];
  const offsets = [2, -4, 5, -3, 7, 0, -6, 4, -2, 6, -5, 2];
  let i = 0; while (i < joints.length - 2 && u > joints[i + 1]) i++;
  const t = Math.max(0, Math.min(1, (u - joints[i]) / (joints[i + 1] - joints[i])));
  return offsets[i] * (1 - t) + offsets[i + 1] * t;
}

// A continuous rock shelf carries the sanctuary's actual footprint. Its
// crown is buried in the masonry: individual eroded boulders cannot guarantee
// support beneath a long terrace or the outermost columns.
export function createIslandBedrock(beds, detail = 96) {
  const source = new BoxGeometry(2, 2, 2, detail, Math.max(8, Math.round(detail * .3)), Math.round(detail * .7));
  source.deleteAttribute('normal'); source.deleteAttribute('uv'); source.clearGroups();
  const geometry = mergeVertices(source); source.dispose();
  const p = geometry.attributes.position;
  const weathering = new Float32Array(p.count), sediment = new Float32Array(p.count), strata = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i), t = (ny + 1) * .5;
    let x = nx * 104;
    const front = 58 - smoothstep(48, 88, Math.abs(x)) * 40;
    let z = -77 + (nz + 1) * .5 * (front + 77);
    // Rounded, irregular corners and a wider buried toe join the surrounding
    // cliffs without cutting into the required load-bearing footprint.
    const corner = smoothstep(.82, 1, Math.abs(nx)) * smoothstep(.78, 1, Math.abs(nz));
    x -= Math.sign(nx) * corner * 5;
    z -= Math.sign(nz) * corner * 3;
    const crown = 36.9 + smoothstep(45, 54, Math.abs(x)) * 13.5;
    let y = -9 + (crown + 9) * t;
    const level = (y - 24) / 22 + x * .0007 + z * .0003 + noise(x * .022, 8, z * .022) * .09;
    const bed = sampleSediment(level, beds);
    const broad = noise(x * .065 + 17, y * .075, z * .065);
    const grain = noise(x * .36, y * .24 + 23, z * .36);
    const erosion = broad * 3.8 + grain * .48 - bed.seam * 80 - (1 - bed.hardness) * 1.1;
    const toe = (1 - t) * 13, exposed = 1 - smoothstep(.8, 1, t);
    const facetX = fractureProfile(z + y * .18) * exposed * 1.8;
    const facetZ = fractureProfile(x - y * .15 + 13) * exposed * 1.8;
    // Recess the structural core beneath a shell of individual rock masses.
    // The unchanged crown still carries the outermost foundation columns.
    const recess = (1 - smoothstep(.82, .99, t)) * 12;
    x += Math.sign(nx) * Math.pow(Math.abs(nx), 5) * (toe + facetX + erosion - recess);
    z += Math.sign(nz) * Math.pow(Math.abs(nz), 5) * (toe + facetZ + erosion - recess);
    // Keep a small, reliable overlap with the foundation courses on top.
    y += (broad * .32 + grain * .1) * t;
    p.setXYZ(i, x / 40, y / 40, z / 40);
    weathering[i] = Math.max(.75, .98 - bed.seam * 6 - Math.abs(grain) * .08);
    sediment[i] = bed.hardness;
    strata[i * 2] = (level + 3) / 6; strata[i * 2 + 1] = .5 / 32;
  }
  geometry.setAttribute('weathering', new Float32BufferAttribute(weathering, 1));
  geometry.setAttribute('sediment', new Float32BufferAttribute(sediment, 1));
  geometry.setAttribute('strata', new Float32BufferAttribute(strata, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.setAttribute('curvature', new Float32BufferAttribute(bakeCurvature(p.array, geometry.index.array, geometry.attributes.normal.array), 1));
  geometry.name = 'Continuous sanctuary bedrock';
  geometry.userData.preserveSurface = true;
  return geometry;
}
