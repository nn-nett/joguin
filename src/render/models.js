// Auvalanche! — modelos procedurais originais (primitivas Three.js mescladas, vertex colors).
// Contrato: puppies e Dogão olham para −Z; gatos olham para +Z; pés em y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../config.js';

const C = CFG.colors;

// ---------------------------------------------------------------- helpers
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _col = new THREE.Color();

function filterTris(g, keep) {
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;
  const outP = [];
  const outN = [];
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    if (keep(nx / l, ny / l, nz / l)) {
      for (let k = 0; k < 9; k++) { outP.push(pos[i + k]); outN.push(nor[i + k]); }
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));
}

function flipFaces(g) {
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;
  for (let i = 0; i < pos.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      let t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t;
      t = nor[i + 3 + k]; nor[i + 3 + k] = nor[i + 6 + k]; nor[i + 6 + k] = t;
    }
  }
  for (let i = 0; i < nor.length; i++) nor[i] = -nor[i];
}

// part(geometria, cor, {p, r, s, flat, noBottom, flip, fn})
function part(geo, color, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s || [1, 1, 1];
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
  g.applyMatrix4(_m);
  if (o.flat) g.computeVertexNormals();
  if (o.flip) flipFaces(g);
  if (o.noBottom) filterTris(g, (nx, ny) => ny > -0.9);
  const pos = g.attributes.position.array;
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  if (o.fn) {
    for (let i = 0; i < n; i += 3) {
      const cx = (pos[i * 3] + pos[i * 3 + 3] + pos[i * 3 + 6]) / 3;
      const cy = (pos[i * 3 + 1] + pos[i * 3 + 4] + pos[i * 3 + 7]) / 3;
      const cz = (pos[i * 3 + 2] + pos[i * 3 + 5] + pos[i * 3 + 8]) / 3;
      _col.set(o.fn(cx, cy, cz));
      for (let k = 0; k < 3; k++) { arr[(i + k) * 3] = _col.r; arr[(i + k) * 3 + 1] = _col.g; arr[(i + k) * 3 + 2] = _col.b; }
    }
  } else {
    _col.set(color);
    for (let i = 0; i < n; i++) { arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function merge(parts) {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
}

const S = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CONE = (r, h, seg = 4) => new THREE.ConeGeometry(r, h, seg, 1);
const CYL = (rt, rb, h, seg = 6, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

export function triangleCount(g) {
  return g.index ? g.index.count / 3 : g.attributes.position.count / 3;
}

let _unitMat = null;
export function makeUnitMaterial() {
  if (!_unitMat) _unitMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return _unitMat;
}

// ---------------------------------------------------------------- filhotes (−Z)
export function buildPuppyGeometry(variant = 0) {
  const v = ((variant | 0) % 4 + 4) % 4;
  const fur = [C.puppyCaramel, '#FFFFFF', '#2E2A3A', '#FFF0CF'][v];
  const dark = ['#A8703A', '#2E2A3A', '#2E2A3A', '#F0D9A8'][v];
  const muzzle = ['#F6DDB4', '#FFE9D6', '#D9A066', '#FFFFFF'][v];
  const legCol = v === 2 ? '#D9A066' : fur;
  const P = [];
  // corpo + cabeça grande
  P.push(part(S(0.25, 5, 4), fur, { p: [0, 0.27, 0.07], s: [1, 0.9, 1.2] }));
  P.push(part(S(0.27, 7, 5), fur, { p: [0, 0.5, -0.16], s: [1.12, 1, 1] }));
  // pernas curtinhas
  for (const sx of [-1, 1]) for (const z of [-0.1, 0.22]) {
    P.push(part(B(0.12, 0.15, 0.12), legCol, { p: [sx * 0.13, 0.075, z], noBottom: true }));
  }
  // focinho e nariz
  P.push(part(B(0.17, 0.1, 0.12), muzzle, { p: [0, 0.43, -0.4], noBottom: true }));
  P.push(part(B(0.08, 0.055, 0.05), '#1B1B24', { p: [0, 0.465, -0.465], noBottom: true }));
  // olhos
  for (const sx of [-1, 1]) P.push(part(B(0.07, 0.09, 0.05), '#1B1B24', { p: [sx * 0.105, 0.56, -0.4] }));
  // coleira
  P.push(part(CYL(0.235, 0.235, 0.07, 6, true), C.cannonRed, { p: [0, 0.36, -0.02], r: [-0.45, 0, 0], flat: true }));
  // orelhas
  if (v === 0) {
    for (const sx of [-1, 1]) P.push(part(B(0.1, 0.22, 0.08), dark, { p: [sx * 0.265, 0.55, -0.14], r: [0, 0, sx * 0.35] }));
  } else if (v === 1) {
    P.push(part(B(0.1, 0.22, 0.08), '#2E2A3A', { p: [-0.265, 0.55, -0.14], r: [0, 0, -0.35] }));
    P.push(part(B(0.1, 0.22, 0.08), '#F2E4D4', { p: [0.265, 0.55, -0.14], r: [0, 0, 0.35] }));
    // manchas
    P.push(part(S(0.14, 5, 3), '#8A5A3A', { p: [0.06, 0.45, 0.12], s: [1.2, 0.45, 1.2] }));
    P.push(part(B(0.1, 0.04, 0.1), '#2E2A3A', { p: [0.13, 0.76, -0.2] }));
  } else if (v === 2) {
    for (const sx of [-1, 1]) P.push(part(CONE(0.1, 0.22, 4), fur, { p: [sx * 0.17, 0.76, -0.14], r: [0, Math.PI / 4, sx * -0.18] }));
  } else {
    for (const sx of [-1, 1]) P.push(part(S(0.1, 5, 3), '#F6DDB4', { p: [sx * 0.27, 0.52, -0.14], s: [0.8, 1.4, 0.9] }));
    P.push(part(S(0.13, 4, 3), fur, { p: [0, 0.77, -0.18] }));
  }
  // rabinho
  if (v === 3) P.push(part(S(0.12, 5, 3), fur, { p: [0, 0.4, 0.34] }));
  else P.push(part(CONE(0.06, 0.24, 4), v === 2 ? '#D9A066' : fur, { p: [0, 0.38, 0.32], r: [0.8, 0, 0] }));
  return merge(P);
}

// ---------------------------------------------------------------- gato (+Z)
export function buildCatGeometry() {
  const fur = C.cat, belly = C.catBelly, dark = '#5A3FA0';
  const P = [];
  P.push(part(S(0.27, 6, 4), fur, { p: [0, 0.32, 0], s: [1, 1.05, 1.1] }));
  P.push(part(S(0.2, 5, 3), belly, { p: [0, 0.28, 0.16], s: [0.9, 1, 0.8] }));
  P.push(part(S(0.31, 7, 5), fur, { p: [0, 0.64, 0.1], s: [1.2, 0.95, 1] }));
  // pernas
  for (const sx of [-1, 1]) for (const z of [-0.12, 0.18]) {
    P.push(part(B(0.12, 0.17, 0.12), dark, { p: [sx * 0.15, 0.085, z], noBottom: true }));
  }
  // orelhas triangulares
  for (const sx of [-1, 1]) {
    P.push(part(CONE(0.14, 0.27, 3), fur, { p: [sx * 0.21, 0.9, 0.06], r: [0, 0, -sx * 0.28] }));
  }
  // focinho e nariz
  P.push(part(B(0.2, 0.1, 0.1), belly, { p: [0, 0.56, 0.37], noBottom: true }));
  P.push(part(B(0.07, 0.05, 0.04), '#FF8FB0', { p: [0, 0.6, 0.43], noBottom: true }));
  // olhos amarelos zangados + sobrancelhas
  for (const sx of [-1, 1]) {
    P.push(part(B(0.13, 0.085, 0.05), C.catEyes, { p: [sx * 0.125, 0.67, 0.37], r: [0, 0, sx * 0.4], noBottom: true }));
    P.push(part(B(0.17, 0.045, 0.05), dark, { p: [sx * 0.135, 0.745, 0.365], r: [0, 0, sx * 0.4], noBottom: true }));
  }
  // rabo em pé, ponta clara
  P.push(part(CONE(0.11, 0.62, 4), fur, { p: [0, 0.62, -0.3], r: [-0.2, Math.PI / 4, 0], flat: true }));
  P.push(part(S(0.08, 4, 3), belly, { p: [0, 0.94, -0.36] }));
  return merge(P);
}

// ---------------------------------------------------------------- gatão (+Z)
export function buildFatCatGeometry() {
  const fur = C.fatCat, stripe = '#D9641A', cream = '#FFE3B8';
  const P = [];
  P.push(part(S(0.66, 8, 6), fur, {
    p: [0, 0.68, 0], s: [1.08, 1, 1],
    fn: (x, y, z) => ((Math.floor((z + 2) * 2.2) & 1) && y > 0.55 ? stripe : fur),
  }));
  P.push(part(S(0.5, 5, 3), cream, { p: [0, 0.55, 0.3], s: [1, 1, 0.7] }));
  P.push(part(S(0.5, 7, 5), fur, { p: [0, 1.18, 0.22], s: [1.25, 0.95, 1] }));
  // pernas gordinhas
  for (const sx of [-1, 1]) for (const z of [-0.3, 0.38]) {
    P.push(part(B(0.3, 0.3, 0.3), stripe, { p: [sx * 0.42, 0.15, z], noBottom: true }));
  }
  // orelhas
  for (const sx of [-1, 1]) P.push(part(CONE(0.2, 0.42, 3), fur, { p: [sx * 0.4, 1.58, 0.15], r: [0, 0, -sx * 0.25] }));
  // listras na testa
  P.push(part(B(0.08, 0.05, 0.22), stripe, { p: [0, 1.6, 0.3], r: [0.5, 0, 0] }));
  // focinho, nariz
  P.push(part(S(0.2, 5, 3), cream, { p: [0, 1.04, 0.62], s: [1.4, 0.8, 0.7] }));
  P.push(part(B(0.1, 0.07, 0.06), '#FF8FB0', { p: [0, 1.1, 0.76], noBottom: true }));
  // olhos zangados + sobrancelhas
  for (const sx of [-1, 1]) {
    P.push(part(B(0.2, 0.12, 0.06), C.catEyes, { p: [sx * 0.22, 1.24, 0.6], r: [0, 0, sx * 0.4] }));
    P.push(part(B(0.3, 0.07, 0.06), '#7A3A10', { p: [sx * 0.24, 1.35, 0.6], r: [0, 0, sx * 0.4] }));
  }
  // rabo listrado em pé
  P.push(part(CONE(0.15, 0.95, 5), fur, { p: [0, 1.1, -0.7], r: [-0.15, 0, 0], flat: true, fn: (x, y) => (y > 1.0 && (Math.floor(y * 6) & 1) ? stripe : fur) }));
  return merge(P);
}

// ---------------------------------------------------------------- Dogão (−Z)
export function buildSuperDogGeometry() {
  const fur = '#F2B83D', light = '#FFE3A0', dark = '#C98A1E', red = '#E8423F', redDark = '#B82E2E';
  const P = [];
  // corpo, peito claro
  P.push(part(S(0.95, 8, 6), fur, { p: [0, 1.5, 0.45], s: [1, 1, 1.35] }));
  P.push(part(S(0.7, 6, 4), light, { p: [0, 1.3, -0.45], s: [1, 1, 0.8] }));
  // cabeça gigante
  P.push(part(S(0.9, 10, 8), fur, { p: [0, 2.32, -1.15], s: [1.1, 1, 1] }));
  // focinho
  P.push(part(B(0.75, 0.5, 0.7), light, { p: [0, 2.05, -1.95] }));
  P.push(part(S(0.2, 6, 4), '#1B1B24', { p: [0, 2.3, -2.3], s: [1.3, 0.9, 0.9] }));
  P.push(part(B(0.3, 0.06, 0.36), '#FF8FA3', { p: [0, 1.8, -2.0], r: [0.25, 0, 0] })); // língua
  // olhos com brilho + sobrancelhas heroicas
  for (const sx of [-1, 1]) {
    P.push(part(B(0.2, 0.28, 0.08), '#1B1B24', { p: [sx * 0.36, 2.55, -2.0] }));
    P.push(part(B(0.07, 0.09, 0.05), '#FFFFFF', { p: [sx * 0.34, 2.62, -2.05] }));
    P.push(part(B(0.34, 0.09, 0.08), dark, { p: [sx * 0.36, 2.8, -1.98], r: [0, 0, sx * -0.3] }));
  }
  // orelhas caídas
  for (const sx of [-1, 1]) P.push(part(B(0.3, 0.8, 0.45), dark, { p: [sx * 1.0, 2.4, -1.0], r: [0, 0, sx * 0.3] }));
  // pernas e patas
  for (const sx of [-1, 1]) for (const z of [-0.45, 1.0]) {
    P.push(part(CYL(0.28, 0.32, 1.0, 6), fur, { p: [sx * 0.55, 0.62, z], flat: true }));
    P.push(part(B(0.62, 0.22, 0.8), light, { p: [sx * 0.55, 0.11, z - 0.1], noBottom: true }));
  }
  // rabo erguido
  P.push(part(CYL(0.12, 0.22, 0.9, 5), fur, { p: [0, 2.05, 1.95], r: [0.7, 0, 0], flat: true }));
  P.push(part(S(0.22, 5, 3), light, { p: [0, 2.5, 2.35] }));
  // coleira + medalha de osso
  P.push(part(CYL(0.88, 0.95, 0.2, 10, true), '#2D9BF0', { p: [0, 1.75, -0.95], r: [-0.6, 0, 0], flat: true }));
  P.push(part(CYL(0.18, 0.18, 0.06, 8), '#FFC93C', { p: [0, 1.35, -1.55], r: [Math.PI / 2 - 0.2, 0, 0] }));
  // capa vermelha ao vento
  P.push(part(S(0.2, 5, 3), '#FFC93C', { p: [-0.5, 1.95, -0.85] }));
  P.push(part(S(0.2, 5, 3), '#FFC93C', { p: [0.5, 1.95, -0.85] }));
  P.push(part(B(1.5, 0.08, 1.0), red, { p: [0, 2.2, -0.2], r: [0.12, 0, 0] }));
  P.push(part(B(1.7, 0.08, 1.0), redDark, { p: [0, 2.2, 0.75], r: [0.28, 0, 0] }));
  P.push(part(B(1.9, 0.08, 0.9), red, { p: [0, 2.0, 1.7], r: [0.6, 0, 0] }));
  return merge(P);
}

// ---------------------------------------------------------------- canhão (casinha sobre rodas)
function buildBoneBarrel() {
  const bone = '#FFF3D6', inner = '#5A4632';
  const R = 0.2, r = 0.12, z0 = 0.2, z1 = -1.4;
  const zc = (z0 + z1) / 2, L = z0 - z1;
  const P = [];
  P.push(part(CYL(R, R, L, 8, true), bone, { p: [0, 0, zc], r: [Math.PI / 2, 0, 0], flat: true }));
  P.push(part(CYL(r, r, L, 8, true), inner, { p: [0, 0, zc], r: [Math.PI / 2, 0, 0], flat: true, flip: true }));
  P.push(part(new THREE.RingGeometry(r, R, 8), bone, { p: [0, 0, z1], r: [0, Math.PI, 0] }));
  P.push(part(new THREE.CircleGeometry(r, 8), '#2A2018', { p: [0, 0, -0.6], r: [0, Math.PI, 0] }));
  for (const sx of [-1, 1]) {
    P.push(part(S(0.18, 6, 4), bone, { p: [sx * 0.24, 0, z1 - 0.04] }));
    P.push(part(S(0.18, 6, 4), bone, { p: [sx * 0.24, 0, z0 + 0.04] }));
  }
  return merge(P);
}

export function buildCannon() {
  const mat = makeUnitMaterial();
  const red = C.cannonRed, redDark = '#B82E2E', cream = '#FFF3D6';
  const P = [];
  // paredes e chassi
  P.push(part(B(1.6, 0.75, 1.5), red, { p: [0, 0.675, 0], noBottom: true }));
  P.push(part(B(1.7, 0.12, 1.6), cream, { p: [0, 0.34, 0] }));
  // telhado triangular (prisma)
  const roof = CYL(1, 1, 1.9, 3);
  P.push(part(roof, redDark, { p: [0, 1.05 + 0.2, 0], r: [-Math.PI / 2, 0, 0], s: [0.95, 1, 0.56], flat: true }));
  // porta arredondada escura na frente (−Z)
  P.push(part(B(0.55, 0.5, 0.06), '#3A2A24', { p: [0, 0.68, -0.76] }));
  P.push(part(CYL(0.275, 0.275, 0.06, 8), '#3A2A24', { p: [0, 0.93, -0.76], r: [Math.PI / 2, 0, 0] }));
  // frisos amarelos
  for (const sx of [-1, 1]) P.push(part(B(0.08, 0.7, 0.06), '#FFC93C', { p: [sx * 0.38, 0.68, -0.77] }));
  // rodinhas dianteiras
  for (const sx of [-1, 1]) P.push(part(S(0.14, 5, 3), '#2E2A3A', { p: [sx * 0.62, 0.17, -0.55] }));
  const body = new THREE.Mesh(merge(P), mat);

  const W = [];
  W.push(part(CYL(0.07, 0.07, 1.8, 5), '#7A7A88', { r: [0, 0, Math.PI / 2] }));
  for (const sx of [-1, 1]) {
    W.push(part(CYL(0.38, 0.38, 0.2, 10), '#2E2A3A', { p: [sx * 0.95, 0, 0], r: [0, 0, Math.PI / 2], flat: true }));
    W.push(part(CYL(0.2, 0.2, 0.24, 6), '#FFC93C', { p: [sx * 0.95, 0, 0], r: [0, 0, Math.PI / 2], flat: true }));
  }
  const wheels = new THREE.Mesh(merge(W), mat);
  wheels.position.set(0, 0.38, 0.15);

  const barrel = new THREE.Mesh(buildBoneBarrel(), mat);
  barrel.position.set(0, 1.63, 0);

  const g = new THREE.Group();
  g.add(body, wheels, barrel);
  g.userData.barrel = barrel;
  g.userData.wheels = [wheels];
  return g;
}

// ---------------------------------------------------------------- torre-arranhador (+Z é a frente)
function towerSegment(w, h, room, slab, top) {
  const P = [];
  const sisal = '#E3C48A', rope = '#B8925A', hole = '#2A1F4A';
  P.push(part(B(w, 0.4, 3.6), slab, { p: [0, 0.2, 0] }));
  P.push(part(B(w - 1.2, h - 0.4, 2.8), room, { p: [0, 0.4 + (h - 0.4) / 2, 0] }));
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.35);
    P.push(part(CYL(0.28, 0.28, h - 0.4, 6), sisal, { p: [x, 0.4 + (h - 0.4) / 2, 1.35], flat: true }));
    P.push(part(CYL(0.32, 0.32, 0.1, 6), rope, { p: [x, 0.4 + (h - 0.4) * 0.3, 1.35], flat: true }));
    P.push(part(CYL(0.32, 0.32, 0.1, 6), rope, { p: [x, 0.4 + (h - 0.4) * 0.7, 1.35], flat: true }));
  }
  if (!top) {
    P.push(part(CYL(0.55, 0.55, 0.1, 8), hole, { p: [0, 0.4 + (h - 0.4) / 2 - 0.1, 1.42], r: [Math.PI / 2, 0, 0] }));
    P.push(part(B(w - 1.6, 0.12, 0.2), slab, { p: [0, 0.4 + 0.06, 1.5] }));
  } else {
    const yE = 0.4 + (h - 0.4) * 0.5;
    for (const sx of [-1, 1]) {
      P.push(part(B(0.85, 0.42, 0.1), C.catEyes, { p: [sx * 0.8, yE, 1.43], r: [0, 0, sx * 0.4] }));
      P.push(part(B(0.14, 0.34, 0.1), '#1B1B24', { p: [sx * 0.8, yE - 0.02, 1.47] }));
      P.push(part(B(1.1, 0.16, 0.1), '#5A3FA0', { p: [sx * 0.85, yE + 0.38, 1.43], r: [0, 0, sx * 0.4] }));
      P.push(part(CONE(0.6, 1.0, 3), room, { p: [sx * (w / 2 - 0.5), h + 0.75, 0.2], r: [0, 0, -sx * 0.15] }));
      P.push(part(CONE(0.32, 0.6, 3), '#FF8FB0', { p: [sx * (w / 2 - 0.5), h + 0.6, 0.5], r: [0, 0, -sx * 0.15] }));
    }
    P.push(part(B(0.35, 0.22, 0.1), '#FF8FB0', { p: [0, yE - 0.4, 1.44] }));
    P.push(part(B(w - 0.4, 0.3, 3.2), slab, { p: [0, h + 0.15, 0] }));
    // novelo de lã no topo
    P.push(part(S(0.55, 8, 6), '#FF6FA5', {
      p: [0, h + 0.3 + 0.55, 0],
      fn: (x, y, z) => ((Math.floor((x + y * 0.8) * 4) & 1) ? '#FF6FA5' : '#FFA3C8'),
    }));
    P.push(part(B(0.08, 0.08, 1.2), '#FF6FA5', { p: [0.3, h + 0.35, 0.9], r: [0, 0.3, 0] }));
  }
  return merge(P);
}

export function buildTower() {
  const mat = makeUnitMaterial();
  const g = new THREE.Group();
  const segments = [];
  const defs = [
    { w: 5.2, h: 2.1, room: '#B79CF0', slab: '#8E6BD8' },
    { w: 4.6, h: 2.1, room: '#C9B6F2', slab: '#7A57C4' },
    { w: 4.0, h: 1.9, room: '#B79CF0', slab: '#8E6BD8' },
    { w: 3.4, h: 1.7, room: '#9D7EE6', slab: '#7A57C4', top: true },
  ];
  let y = 0;
  for (const d of defs) {
    const mesh = new THREE.Mesh(towerSegment(d.w, d.h, d.room, d.slab, !!d.top), mat);
    mesh.position.y = y;
    g.add(mesh);
    segments.push(mesh);
    y += d.h;
  }
  g.userData.height = 9;
  g.userData.segments = segments;
  return g;
}

// ---------------------------------------------------------------- portões
export function buildGatePosts(halfWidth, height) {
  const W = '#FFFFFF';
  const P = [];
  for (const sx of [-1, 1]) {
    P.push(part(CYL(0.13, 0.15, height, 6), W, { p: [sx * halfWidth, height / 2, 0], flat: true }));
    P.push(part(B(0.5, 0.14, 0.5), W, { p: [sx * halfWidth, 0.07, 0] }));
    P.push(part(S(0.22, 6, 4), W, { p: [sx * halfWidth, height + 0.05, 0] }));
  }
  P.push(part(B(halfWidth * 2, 0.16, 0.16), W, { p: [0, height, 0] }));
  return merge(P);
}

// ---------------------------------------------------------------- cenário
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function buildScenery() {
  const mat = makeUnitMaterial();
  const rnd = lcg(1234);
  const rr = (a, b) => a + (b - a) * rnd();
  const sides = [-1, 1];

  // 1) árvores + arbustos
  const T = [];
  const greens = ['#4FBF4A', '#5ACD52', '#3FAE48'];
  for (const sx of sides) {
    for (let z = 6, i = 0; z > -64; z -= rr(3.4, 5.2), i++) {
      const near = i % 2 === 0;
      const x = sx * (near ? rr(8.2, 10.5) : rr(11, 17));
      const sc = rr(0.9, 1.5);
      const gc = greens[(rnd() * 3) | 0];
      T.push(part(CYL(0.2 * sc, 0.28 * sc, 1.3 * sc, 5), '#9A6A3A', { p: [x, 0.65 * sc, z], flat: true }));
      T.push(part(S(1.15 * sc, 6, 4), gc, { p: [x, 2.0 * sc, z], flat: true }));
      T.push(part(S(0.75 * sc, 6, 4), '#7FE06E', { p: [x - 0.2 * sc, 2.9 * sc, z + 0.1], flat: true }));
    }
    for (let z = 4; z > -62; z -= rr(2.5, 4.5)) {
      const x = sx * rr(6.9, 8.0);
      const sc = rr(0.6, 1.0);
      T.push(part(S(0.8 * sc, 6, 4), '#3FAE48', { p: [x, 0.45 * sc, z], s: [1.2, 0.8, 1], flat: true }));
      T.push(part(S(0.55 * sc, 6, 4), '#5ACD52', { p: [x + 0.5 * sc, 0.35 * sc, z + 0.3], flat: true }));
    }
  }
  const trees = new THREE.Mesh(merge(T), mat);

  // 2) cerca laranja em x=±5.4 (z 2 … −50) + ossos
  const F = [];
  const fence = C.fence, fenceDark = '#E8832A';
  for (const sx of sides) {
    for (let z = 2; z >= -50.01; z -= 1.6) {
      F.push(part(B(0.2, 0.85, 0.2), fence, { p: [sx * 5.4, 0.425, z], noBottom: true }));
      F.push(part(CONE(0.14, 0.2, 4), fence, { p: [sx * 5.4, 0.95, z], r: [0, Math.PI / 4, 0] }));
    }
    F.push(part(B(0.1, 0.14, 52), fenceDark, { p: [sx * 5.4, 0.62, -24] }));
    F.push(part(B(0.1, 0.14, 52), fenceDark, { p: [sx * 5.4, 0.3, -24] }));
  }
  const bone = '#FFF8E8';
  for (let i = 0; i < 14; i++) {
    const sx = sides[i % 2];
    const x = sx * rr(6.2, 9);
    const z = 2 - i * 4.2 - rr(0, 1.5);
    const a = rr(0, Math.PI);
    const ca = Math.cos(a), sa = Math.sin(a);
    F.push(part(B(0.14, 0.14, 0.6), bone, { p: [x, 0.1, z], r: [0, a, 0] }));
    for (const e of [-1, 1]) for (const k of [-1, 1]) {
      // pontas do osso: dois nós em cada extremo (eixo local z após rotação y=a)
      F.push(part(S(0.12, 4, 3), bone, { p: [x + sa * e * 0.3 + ca * k * 0.09, 0.1, z + ca * e * 0.3 - sa * k * 0.09] }));
    }
  }
  const props = new THREE.Mesh(merge(F), mat);

  // 3) nuvens
  const K = [];
  for (let i = 0; i < 14; i++) {
    const cx = rr(-34, 34), cy = rr(15, 24), cz = rr(-80, -5);
    if (Math.abs(cx) < 6 && cz > -40) continue;
    const n = 3 + ((rnd() * 2) | 0);
    for (let j = 0; j < n; j++) {
      const r = rr(1.6, 2.8);
      K.push(part(S(r, 6, 4), '#FFFFFF', { p: [cx + (j - n / 2) * 2.2, cy + rr(-0.4, 0.4), cz + rr(-0.8, 0.8)], s: [1.3, 0.8, 1] }));
    }
  }
  const clouds = new THREE.Mesh(merge(K), mat);

  const g = new THREE.Group();
  g.add(trees, props, clouds);
  return g;
}

// ---------------------------------------------------------------- sombra-blob
export function buildBlobGeometry() {
  const g = new THREE.CircleGeometry(1, 10);
  g.rotateX(-Math.PI / 2);
  return merge([part(g, '#FFFFFF')]);
}
