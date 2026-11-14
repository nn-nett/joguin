// Renderizador Three.js: cena, câmera, unidades, portões, torre, canhão, efeitos.
import * as THREE from 'three';
import { CFG } from '../config.js';
import { buildTower, buildCannon, buildScenery } from './models.js';
import { fitCamera, placeCamera, LOOK_Z } from './camera.js';
import { createUnits } from './units.js';
import { createGates } from './gates.js';
import { createEffects } from './effects.js';

const FONT = '"Baloo 2","Nunito",system-ui,"Trebuchet MS",sans-serif';

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, CFG.colors.skyTop);
  g.addColorStop(1, CFG.colors.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeLaneTexture(maxAniso) {
  const W = 256, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = CFG.colors.lane;
  ctx.fillRect(0, 0, W, H);
  // bordas um pouco mais escuras
  ctx.fillStyle = '#F6D79B';
  ctx.fillRect(0, 0, 14, H);
  ctx.fillRect(W - 14, 0, 14, H);
  // faixas tracejadas claras
  ctx.fillStyle = CFG.colors.laneStripe;
  const xs = [-2.5, 0, 2.5];
  const ppu = W / 10; // px por unidade em X
  for (let i = 0; i < xs.length; i++) {
    const cx = W / 2 + xs[i] * ppu;
    for (let y = 0; y < H; y += 40) ctx.fillRect(cx - 4, y, 8, 22);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, CFG.render.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(CFG.colors.skyBottom, 60, 200);

  const camera = new THREE.PerspectiveCamera(45, 1, 2, 260);

  // luzes
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8e8a0, 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 14, 9);
  scene.add(sun);

  // chão
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({ color: CFG.colors.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.02, -100);
  scene.add(grass);

  const laneLen = 54;
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.lane.halfWidth * 2, laneLen),
    new THREE.MeshBasicMaterial({ map: makeLaneTexture(renderer.capabilities.getMaxAnisotropy()) }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0, 4 - laneLen / 2);
  scene.add(lane);

  const scenery = buildScenery();
  scene.add(scenery);

  // torre
  const tower = buildTower();
  tower.position.set(0, 0, CFG.lane.towerZ);
  scene.add(tower);
  const segs = tower.userData.segments || [];
  const segBase = segs.map((s) => ({ x: s.position.x, y: s.position.y, z: s.position.z, rx: s.rotation.x, rz: s.rotation.z }));
  const segDone = new Uint8Array(segs.length);
  const towerH = tower.userData.height || CFG.tower.height;

  // barra de HP da torre
  const hpCanvas = document.createElement('canvas');
  hpCanvas.width = 256; hpCanvas.height = 64;
  const hpTex = new THREE.CanvasTexture(hpCanvas);
  hpTex.colorSpace = THREE.SRGBColorSpace;
  const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpTex, transparent: true, fog: false, depthTest: false }));
  hpSprite.scale.set(5, 1.25, 1);
  hpSprite.position.set(0, towerH + 1.1, CFG.lane.towerZ + 1);
  hpSprite.renderOrder = 10;
  scene.add(hpSprite);
  let hpLast = -1, hpMaxLast = -1, hpDrawT = -1;
  function drawHp(hp, maxHp) {
    const ctx = hpCanvas.getContext('2d');
    const f = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = CFG.colors.navy;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(6, 12, 244, 40, 20) : ctx.rect(6, 12, 244, 40); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(11, 17, 234, 30, 15) : ctx.rect(11, 17, 234, 30); ctx.fill();
    if (f > 0) {
      ctx.fillStyle = f > 0.5 ? '#5BD65B' : f > 0.25 ? '#FFC93C' : '#F0483E';
      ctx.beginPath();
      const w = Math.max(24, 234 * f);
      ctx.roundRect ? ctx.roundRect(11, 17, w, 30, 15) : ctx.rect(11, 17, w, 30);
      ctx.fill();
    }
    ctx.font = '800 26px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = CFG.colors.navy;
    const txt = String(Math.ceil(Math.max(0, hp)));
    ctx.strokeText(txt, 128, 33);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, 128, 33);
    hpTex.needsUpdate = true;
  }

  // canhão
  const cannon = buildCannon();
  scene.add(cannon);
  const barrel = cannon.userData.barrel;
  const barrelZ0 = barrel ? barrel.position.z : 0;
  const wheels = cannon.userData.wheels || [];
  let cannonPrevX = 0;
  let recoil = 0;

  const units = createUnits(scene);
  const gates = createGates(scene);
  const fx = createEffects(scene);

  // estado de animação
  let mode = 'menu';
  let modeT0 = 0;
  let lastNow = 0;
  let towerShake = 0;
  let camShake = 0;
  let towerHitCd = 0;
  let camK = 30;
  let aspect = 1;
  let width = 1, height = 1;
  let lastInfo = { drawCalls: 0, triangles: 0, pixelRatio: pixelRatio };
  let slowAcc = 0, slowN = 0;
  let lastDt = 1 / 60;

  function applyCamera() {
    const fit = fitCamera(aspect);
    camK = fit.k;
    camera.fov = fit.fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    placeCamera(camera, camK);
    const d = Math.hypot(0.95 * camK, 0.62 * camK + 48);
    scene.fog.near = d + 12;
    scene.fog.far = d + 120;
  }

  function resize(w, h) {
    width = Math.max(1, w | 0); height = Math.max(1, h | 0);
    aspect = width / height;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    applyCamera();
  }

  function resetTower() {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], b = segBase[i];
      s.position.set(b.x, b.y, b.z);
      s.rotation.set(b.rx, 0, b.rz);
      segDone[i] = 0;
    }
    tower.position.set(0, 0, CFG.lane.towerZ);
    towerShake = 0;
  }

  function buildLevel(levelDef) {
    gates.build(levelDef);
    resetTower();
    fx.clear();
    recoil = 0; camShake = 0; towerHitCd = 0;
    hpLast = -1; hpMaxLast = -1;
    drawHp(levelDef ? levelDef.towerHp : 1, levelDef ? levelDef.towerHp : 1);
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    modeT0 = lastNow;
    if (m === 'won') {
      for (let i = 0; i < segDone.length; i++) segDone[i] = 0;
    } else if (m === 'play' || m === 'menu') {
      resetTower();
    }
  }

  function updateCollapse(now) {
    const tw = now - modeT0;
    const n = segs.length;
    for (let i = 0; i < n; i++) {
      const t = tw - (n - 1 - i) * 0.14;
      const s = segs[i], b = segBase[i];
      if (t <= 0) continue;
      const p = Math.min(1, t / 1.0);
      const e = p * p;
      const dir = i % 2 ? 1 : -1;
      const sink = t > 1 ? (t - 1) * 0.5 : 0;
      s.position.x = b.x + dir * e * (1.5 + (n - i) * 0.4);
      s.position.y = b.y * (1 - e * 0.85) - e * 0.3 - sink;
      s.position.z = b.z + e * 1.2;
      s.rotation.z = b.rz + dir * e * 0.9;
      s.rotation.x = b.rx + e * 0.35;
      if (!segDone[i]) {
        segDone[i] = 1;
        fx.debris(0, b.y + 1, CFG.lane.towerZ, 6);
        fx.poof(dir * 1.5, CFG.lane.towerZ + 1.5, 3, 2);
      }
    }
  }

  function sync(state, nowSec, dtReal) {
    lastNow = nowSec;
    const dt = Math.min(0.1, dtReal > 0 ? dtReal : lastDt);
    lastDt = dt;

    // qualidade adaptativa
    slowAcc += dt; slowN++;
    if (slowAcc >= CFG.render.slowWindow) {
      const avgMs = (slowAcc / slowN) * 1000;
      if (avgMs > CFG.render.slowFrameMs && pixelRatio > 1) {
        pixelRatio = pixelRatio > 1.5 ? 1.5 : 1;
        resize(width, height);
      }
      slowAcc = 0; slowN = 0;
    }

    units.sync(state, nowSec, mode);
    gates.sync(state, nowSec);

    // canhão
    const cx = state.cannonX;
    cannon.position.x = cx;
    recoil *= Math.exp(-14 * dt);
    if (barrel) barrel.position.z = barrelZ0 + recoil;
    const dx = cx - cannonPrevX;
    cannonPrevX = cx;
    for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x -= dx * 3;
    cannon.position.y = mode === 'play' && state.firing ? Math.abs(Math.sin(nowSec * 40)) * 0.015 : 0;

    // torre
    towerShake *= Math.exp(-9 * dt);
    if (mode === 'won') {
      updateCollapse(nowSec);
      tower.position.x = 0;
    } else {
      tower.position.x = Math.sin(nowSec * 60) * towerShake;
    }
    const hp = state.tower.hp, mx = state.tower.maxHp;
    if ((hp !== hpLast || mx !== hpMaxLast) && nowSec - hpDrawT >= 0.1) {
      hpLast = hp; hpMaxLast = mx; hpDrawT = nowSec;
      drawHp(hp, mx);
    } else if (nowSec < hpDrawT) hpDrawT = nowSec;
    hpSprite.visible = mode !== 'won' || nowSec - modeT0 < 0.6;

    towerHitCd -= dt;
    fx.update(dt);
    camShake *= Math.exp(-8 * dt);
  }

  function handleEvents(events) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.type) {
        case 'fire': recoil = 0.28; break;
        case 'clash': fx.poof(e.x, e.z, e.kind === 1 ? 4 : 2, e.kind === 1 ? 1.6 : 1); break;
        case 'gate': {
          const g = gates.find(e.gateId);
          fx.sparkles(e.x, 1.0, e.z, e.good, 10);
          if (g) g.group.scale.set(1.22, 1.22, 1);
          break;
        }
        case 'towerHit':
          towerShake = 0.18;
          if (towerHitCd <= 0) {
            towerHitCd = 0.07;
            fx.debris(0, 1, CFG.lane.towerZ + 1.5, 3);
          }
          break;
        case 'baseHit': camShake = 0.45; break;
        case 'superEnd': fx.debris(e.x, 1, e.z, 8); fx.poof(e.x, e.z, 6, 2); break;
        case 'superLaunch': fx.poof(e.x, -1.5, 4, 1.5); break;
        default: break;
      }
    }
  }

  function render() {
    // balanço do menu e shake
    let ox = 0, oy = 0, oz = 0;
    if (mode === 'menu') { ox = Math.sin(lastNow * 0.5) * 0.9; oy = Math.sin(lastNow * 0.35) * 0.3; }
    if (camShake > 0.002) { ox += (Math.random() - 0.5) * camShake; oy += (Math.random() - 0.5) * camShake; oz += (Math.random() - 0.5) * camShake * 0.5; }
    camera.position.set(ox, 0.95 * camK + oy, 0.62 * camK + oz);
    camera.lookAt(mode === 'menu' ? -ox * 0.3 : 0, 0, LOOK_Z);
    renderer.render(scene, camera);
    const inf = renderer.info.render;
    lastInfo.drawCalls = inf.calls;
    lastInfo.triangles = inf.triangles;
    lastInfo.pixelRatio = pixelRatio;
  }

  function info() {
    return { drawCalls: lastInfo.drawCalls, triangles: lastInfo.triangles, pixelRatio: lastInfo.pixelRatio };
  }

  resize(canvas.clientWidth || canvas.width || 390, canvas.clientHeight || canvas.height || 844);
  drawHp(1, 1);

  return { buildLevel, setMode, sync, handleEvents, resize, render, info };
}
