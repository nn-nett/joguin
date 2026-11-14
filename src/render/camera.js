// Câmera retrato-primeiro: fitCamera(aspect) devolve o menor k que enquadra pista + torre.
import * as THREE from 'three';

const PTS = [
  [6.2, 0, 1.5], [-6.2, 0, 1.5],
  [6.2, 0, -48], [-6.2, 0, -48],
  [0, 9, -48],
];
const tmpCam = new THREE.PerspectiveCamera();
const tmpV = new THREE.Vector3();

export const LOOK_Z = -20;

export function fovFor(aspect) {
  return aspect < 1 ? 62 : 45;
}

export function placeCamera(cam, k) {
  cam.position.set(0, 0.95 * k, 0.62 * k);
  cam.lookAt(0, 0, LOOK_Z);
}

// Procura o menor k em [14, 70], passo 0.5, com todos os pontos em |x|<=0.96, y em [-0.80, 0.84].
export function fitCamera(aspect) {
  const fov = fovFor(aspect);
  tmpCam.fov = fov;
  tmpCam.aspect = aspect;
  tmpCam.near = 0.5;
  tmpCam.far = 400;
  tmpCam.updateProjectionMatrix();
  for (let k = 14; k <= 70; k += 0.5) {
    placeCamera(tmpCam, k);
    tmpCam.updateMatrixWorld(true);
    let ok = true;
    for (let i = 0; i < PTS.length; i++) {
      const p = PTS[i];
      tmpV.set(p[0], p[1], p[2]).project(tmpCam);
      if (Math.abs(tmpV.x) > 0.96 || tmpV.y < -0.8 || tmpV.y > 0.84) { ok = false; break; }
    }
    if (ok) return { fov, k };
  }
  return { fov, k: 70 };
}
