// Partículas instanciadas (um draw call): poof (clash), faíscas (gate), detritos (towerHit).
import * as THREE from 'three';

const CAP = 256;

export function createEffects(scene) {
  const geo = new THREE.IcosahedronGeometry(0.5, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const ma = mesh.instanceMatrix.array;
  const ca = mesh.instanceColor.array;
  for (let i = 0; i < CAP; i++) ma[i * 16 + 15] = 1;

  const px = new Float32Array(CAP), py = new Float32Array(CAP), pz = new Float32Array(CAP);
  const vx = new Float32Array(CAP), vy = new Float32Array(CAP), vz = new Float32Array(CAP);
  const life = new Float32Array(CAP), maxLife = new Float32Array(CAP);
  const size = new Float32Array(CAP), grav = new Float32Array(CAP), grow = new Float32Array(CAP);
  const spin = new Float32Array(CAP), spinV = new Float32Array(CAP);
  let head = 0;
  let active = 0; // maior índice vivo + 1

  const tmpC = new THREE.Color();

  function emit(x, y, z, ax, ay, az, lifeT, sz, g, gr, hex) {
    const i = head;
    head = (head + 1) % CAP;
    px[i] = x; py[i] = y; pz[i] = z;
    vx[i] = ax; vy[i] = ay; vz[i] = az;
    life[i] = lifeT; maxLife[i] = lifeT;
    size[i] = sz; grav[i] = g; grow[i] = gr;
    spin[i] = Math.random() * 6.28; spinV[i] = (Math.random() - 0.5) * 8;
    tmpC.set(hex);
    const o = i * 3;
    ca[o] = tmpC.r; ca[o + 1] = tmpC.g; ca[o + 2] = tmpC.b;
    if (i + 1 > active) active = i + 1;
    mesh.instanceColor.needsUpdate = true;
  }

  const POOF = [0xffffff, 0xf3ecff, 0xe2d4ff];
  function poof(x, z, n = 2, big = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28;
      const sp = 0.6 + Math.random() * 1.2;
      emit(x + (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.3,
        Math.cos(a) * sp, 0.8 + Math.random() * 0.8, Math.sin(a) * sp,
        0.38 + Math.random() * 0.12, (0.7 + Math.random() * 0.4) * big, -1.5, 0.6, POOF[(Math.random() * 3) | 0]);
    }
  }
  const SPARK_GOOD = [0xffe14d, 0xffffff, 0x9fd8ff, 0xffc93c];
  const SPARK_BAD = [0xff7a6e, 0xffb08a, 0xffe14d, 0xffffff];
  function sparkles(x, y, z, good, n = 10) {
    const pal = good ? SPARK_GOOD : SPARK_BAD;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28;
      const sp = 1.2 + Math.random() * 2.4;
      emit(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.6, z,
        Math.cos(a) * sp, 2.0 + Math.random() * 2.5, (Math.random() - 0.3) * 2.0 + 0.5,
        0.55 + Math.random() * 0.3, 0.16 + Math.random() * 0.14, -6, 0, pal[(Math.random() * 4) | 0]);
    }
  }
  const DEBRIS = [0x8e6bd8, 0xb48ce8, 0xc9b6f2, 0xff9a3c];
  function debris(x, y, z, n = 4) {
    for (let k = 0; k < n; k++) {
      emit(x + (Math.random() - 0.5) * 3, y + Math.random() * 3, z + 1.5,
        (Math.random() - 0.5) * 4, 1 + Math.random() * 3, 1 + Math.random() * 3,
        0.7 + Math.random() * 0.4, 0.25 + Math.random() * 0.25, -11, 0, DEBRIS[(Math.random() * 4) | 0]);
    }
  }

  function update(dt) {
    let top = 0;
    let n = 0;
    for (let i = 0; i < active; i++) {
      const o = i * 16;
      let l = life[i];
      if (l <= 0) { ma[o + 10] = 0; ma[o] = 0; ma[o + 5] = 0; continue; }
      l -= dt;
      life[i] = l;
      if (l <= 0) { ma[o] = 0; ma[o + 5] = 0; ma[o + 10] = 0; continue; }
      vy[i] += grav[i] * dt;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      if (py[i] < 0.05 && grav[i] < -5) { py[i] = 0.05; vy[i] *= -0.3; vx[i] *= 0.7; vz[i] *= 0.7; }
      spin[i] += spinV[i] * dt;
      const u = 1 - l / maxLife[i];
      let s = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
      s = size[i] * s * (1 + grow[i] * u);
      const c = Math.cos(spin[i]) * s, sn = Math.sin(spin[i]) * s;
      ma[o] = c; ma[o + 1] = sn; ma[o + 4] = -sn; ma[o + 5] = c; ma[o + 10] = s;
      ma[o + 12] = px[i]; ma[o + 13] = py[i]; ma[o + 14] = pz[i];
      top = i + 1;
      n++;
    }
    active = top;
    mesh.count = top > 0 ? Math.max(top, 1) : 0;
    mesh.instanceMatrix.needsUpdate = true;
    return n;
  }

  function clear() {
    life.fill(0);
    for (let i = 0; i < CAP; i++) { ma[i * 16] = 0; ma[i * 16 + 5] = 0; ma[i * 16 + 10] = 0; }
    active = 0; head = 0; mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, poof, sparkles, debris, update, clear };
}
