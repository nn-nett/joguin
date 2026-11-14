// Filhotes, gatos, Dogão e sombras-blob: InstancedMeshes com matrizes escritas direto no array.
import * as THREE from 'three';
import { CFG } from '../config.js';
import {
  makeUnitMaterial, buildPuppyGeometry, buildCatGeometry, buildFatCatGeometry,
  buildSuperDogGeometry, buildBlobGeometry,
} from './models.js';

const PUPPY_CAP = CFG.puppy.cap;
const CAT_CAP = CFG.cat.cap;
const FAT_CAP = 64;
const BLOB_CAP = 1200;

function makeInstanced(scene, geo, mat, cap) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  const a = m.instanceMatrix.array;
  for (let i = 0; i < cap; i++) { const o = i * 16; a[o] = 1; a[o + 5] = 1; a[o + 10] = 1; a[o + 15] = 1; }
  scene.add(m);
  return m;
}

export function createUnits(scene) {
  const unitMat = makeUnitMaterial();
  const puppyMeshes = [];
  const puppyArr = [];
  for (let v = 0; v < 4; v++) {
    const m = makeInstanced(scene, buildPuppyGeometry(v), unitMat, PUPPY_CAP);
    puppyMeshes.push(m);
    puppyArr.push(m.instanceMatrix.array);
  }
  const catMesh = makeInstanced(scene, buildCatGeometry(), unitMat, CAT_CAP);
  const fatMesh = makeInstanced(scene, buildFatCatGeometry(), unitMat, FAT_CAP);
  const catArr = catMesh.instanceMatrix.array;
  const fatArr = fatMesh.instanceMatrix.array;

  const blobMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const blobMesh = makeInstanced(scene, buildBlobGeometry(), blobMat, BLOB_CAP);
  blobMesh.renderOrder = 1;
  const blobArr = blobMesh.instanceMatrix.array;

  const dog = new THREE.Mesh(buildSuperDogGeometry(), unitMat);
  dog.visible = false;
  dog.frustumCulled = false;
  scene.add(dog);

  const pc = [0, 0, 0, 0];

  function put(arr, o, x, y, z, s, r) {
    const c = Math.cos(r) * s, sn = Math.sin(r) * s;
    arr[o] = c; arr[o + 1] = sn; arr[o + 4] = -sn; arr[o + 5] = c; arr[o + 10] = s;
    arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z;
  }

  // mode: 'menu' | 'play' | 'won' | 'lost'
  function sync(state, now, mode) {
    const P = state.puppies, C = state.cats;
    const t = state.time;
    const won = mode === 'won', lost = mode === 'lost';
    pc[0] = pc[1] = pc[2] = pc[3] = 0;
    let nb = 0;

    const pn = Math.min(P.count, PUPPY_CAP * 4);
    for (let i = 0; i < pn; i++) {
      const v = P.variant[i] & 3;
      const k = pc[v];
      if (k >= PUPPY_CAP) continue;
      pc[v] = k + 1;
      const ph = P.phase[i];
      const sn = Math.sin(now * 12 + ph);
      let y, r, s = 1;
      if (won) {
        const jn = Math.sin(now * 9 + ph * 1.7);
        y = Math.abs(jn) * 0.9; r = sn * 0.25;
      } else {
        y = Math.abs(sn) * 0.18; r = sn * 0.12;
      }
      const age = t - P.born[i];
      if (age < 0.15 && age >= 0) s = 0.3 + 0.7 * (age / 0.15);
      const x = P.x[i], z = P.z[i];
      put(puppyArr[v], k * 16, x, y, z, s, r);
      if (nb < BLOB_CAP) {
        const o = nb * 16; const bs = 0.36 * s * (1 - Math.min(y, 0.9) * 0.5);
        blobArr[o] = bs; blobArr[o + 10] = bs; blobArr[o + 12] = x; blobArr[o + 13] = 0.03; blobArr[o + 14] = z;
        nb++;
      }
    }
    for (let v = 0; v < 4; v++) {
      const m = puppyMeshes[v];
      m.count = pc[v];
      m.instanceMatrix.needsUpdate = true;
    }

    let nc = 0, nf = 0;
    const cn = Math.min(C.count, CAT_CAP + FAT_CAP);
    for (let i = 0; i < cn; i++) {
      const ph = C.phase[i];
      const sn = Math.sin(now * 9 + ph);
      const fat = C.kind[i] === 1;
      let y, r;
      if (lost) {
        y = Math.abs(Math.sin(now * 8 + ph * 1.7)) * (fat ? 0.7 : 0.9); r = sn * 0.25;
      } else {
        y = Math.abs(sn) * (fat ? 0.12 : 0.15); r = sn * 0.1;
      }
      const x = C.x[i], z = C.z[i];
      let bs;
      if (fat) {
        if (nf >= FAT_CAP) continue;
        put(fatArr, nf * 16, x, y, z, 1, r); nf++; bs = 0.95;
      } else {
        if (nc >= CAT_CAP) continue;
        put(catArr, nc * 16, x, y, z, 1, r); nc++; bs = 0.42;
      }
      if (nb < BLOB_CAP) {
        const o = nb * 16; bs *= (1 - Math.min(y, 0.9) * 0.5);
        blobArr[o] = bs; blobArr[o + 10] = bs; blobArr[o + 12] = x; blobArr[o + 13] = 0.03; blobArr[o + 14] = z;
        nb++;
      }
    }
    catMesh.count = nc; catMesh.instanceMatrix.needsUpdate = true;
    fatMesh.count = nf; fatMesh.instanceMatrix.needsUpdate = true;

    // Dogão
    const sd = state.superDog;
    if (sd && sd.active) {
      dog.visible = true;
      dog.position.set(sd.x, Math.abs(Math.sin(now * 10)) * 0.3, sd.z);
      dog.rotation.z = Math.sin(now * 10) * 0.06;
      if (nb < BLOB_CAP) {
        const o = nb * 16;
        blobArr[o] = 1.6; blobArr[o + 10] = 1.6; blobArr[o + 12] = sd.x; blobArr[o + 13] = 0.03; blobArr[o + 14] = sd.z;
        nb++;
      }
    } else {
      dog.visible = false;
    }
    // sombra do canhão
    if (nb < BLOB_CAP) {
      const o = nb * 16;
      blobArr[o] = 1.1; blobArr[o + 10] = 1.1; blobArr[o + 12] = state.cannonX; blobArr[o + 13] = 0.03; blobArr[o + 14] = 0;
      nb++;
    }
    blobMesh.count = nb;
    blobMesh.instanceMatrix.needsUpdate = true;
  }

  return { sync, dog };
}
