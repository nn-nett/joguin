// STUB — o Pacote C substitui este arquivo inteiro. Mesma API, caixas coloridas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function box(w, h, d, hex, x = 0, y = 0, z = 0) {
  const g = colored(new THREE.BoxGeometry(w, h, d), hex);
  g.translate(x, y, z);
  return g;
}

export function makeUnitMaterial() {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}
const PUP = ['#D9A066', '#FFFFFF', '#222222', '#FFF1D6'];
export function buildPuppyGeometry(variant = 0) {
  return mergeGeometries([box(0.4, 0.4, 0.6, PUP[variant] || PUP[0], 0, 0.3, 0), box(0.3, 0.3, 0.3, PUP[variant] || PUP[0], 0, 0.6, -0.3)]);
}
export function buildCatGeometry() {
  return mergeGeometries([box(0.45, 0.45, 0.6, '#8E6BD8', 0, 0.3, 0), box(0.35, 0.35, 0.35, '#8E6BD8', 0, 0.65, 0.3)]);
}
export function buildFatCatGeometry() {
  return box(1.2, 1.4, 1.2, '#FF9A3C', 0, 0.7, 0);
}
export function buildSuperDogGeometry() {
  return mergeGeometries([box(1.6, 1.6, 2.4, '#D9A066', 0, 1.2, 0), box(1.2, 1.2, 1.2, '#D9A066', 0, 2.6, -1.2)]);
}
export function buildCannon() {
  const mat = makeUnitMaterial();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(box(1.6, 1.2, 1.4, '#E8423F', 0, 0.8, 0), mat));
  const barrel = new THREE.Mesh(box(0.4, 0.4, 1.2, '#FFFFFF', 0, 1.0, -1.0), mat);
  g.add(barrel);
  g.userData.barrel = barrel;
  g.userData.wheels = [];
  return g;
}
export function buildTower() {
  const mat = makeUnitMaterial();
  const g = new THREE.Group();
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(box(4 - i * 0.6, 2.2, 3, i % 2 ? '#B48CE8' : '#8E6BD8', 0, 1.1, 0), mat);
    s.position.y = i * 2.2;
    g.add(s);
    segments.push(s);
  }
  g.userData.height = 9;
  g.userData.segments = segments;
  return g;
}
export function buildGatePosts(halfWidth, height) {
  return mergeGeometries([
    box(0.2, height, 0.2, '#FFFFFF', -halfWidth, height / 2, 0),
    box(0.2, height, 0.2, '#FFFFFF', halfWidth, height / 2, 0),
    box(halfWidth * 2 + 0.2, 0.2, 0.2, '#FFFFFF', 0, height, 0),
  ]);
}
export function buildScenery() {
  return new THREE.Group();
}
export function buildBlobGeometry() {
  const g = new THREE.CircleGeometry(1, 10);
  g.rotateX(-Math.PI / 2);
  return g;
}
