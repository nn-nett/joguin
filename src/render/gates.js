// Portões: postes + painel translúcido com rótulo (CanvasTexture), um grupo por portão (2 draw calls).
import * as THREE from 'three';
import { CFG } from '../config.js';
import { buildGatePosts } from './models.js';

const FONT = '"Baloo 2","Nunito",system-ui,"Trebuchet MS",sans-serif';
const PANEL_H = 1.7;
const HEIGHT = CFG.gates.height;
const PULSE_T = 0.15;

function labelFor(op, value) {
  if (op === 'mul') return 'x' + value;
  if (op === 'add') return '+' + value;
  if (op === 'sub') return '-' + value;
  return '÷' + value;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createGates(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const postMatGood = new THREE.MeshLambertMaterial({
    vertexColors: true, color: CFG.colors.gateGood, emissive: CFG.colors.gateGood, emissiveIntensity: 0.35,
  });
  const postMatBad = new THREE.MeshLambertMaterial({
    vertexColors: true, color: CFG.colors.gateBad, emissive: CFG.colors.gateBad, emissiveIntensity: 0.35,
  });
  const vis = []; // {id, group, tex, canvas, label, good, hw, moving, panelW, postGeo}
  const geoCache = new Map();
  const planeCache = new Map();
  let ready = false;

  function drawLabel(g) {
    const ctx = g.canvas.getContext('2d');
    const col = g.good ? CFG.colors.gateGood : CFG.colors.gateBad;
    ctx.clearRect(0, 0, 256, 128);
    rr(ctx, 3, 3, 250, 122, 20);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    // compensa o esticamento do painel para o texto ficar isotrópico
    const sx = (PANEL_H * 2) / g.panelW;
    ctx.save();
    ctx.translate(128, 68);
    ctx.scale(sx, 1);
    ctx.font = '800 96px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = CFG.colors.navy;
    ctx.strokeText(g.label, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(g.label, 0, 0);
    ctx.restore();
    g.tex.needsUpdate = true;
  }

  function addGate(d) {
    const hw = d.halfWidth;
    const group = new THREE.Group();
    let pg = geoCache.get(hw);
    if (!pg) { pg = buildGatePosts(hw, HEIGHT); geoCache.set(hw, pg); }
    const posts = new THREE.Mesh(pg, d.good ? postMatGood : postMatBad);
    posts.frustumCulled = false;
    group.add(posts);
    let plane = planeCache.get(hw);
    if (!plane) { plane = new THREE.PlaneGeometry(hw * 2, PANEL_H); planeCache.set(hw, plane); }
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(plane, pm);
    panel.position.set(0, 0.2 + PANEL_H / 2, 0);
    panel.rotation.x = -0.35;
    panel.frustumCulled = false;
    panel.renderOrder = 2;
    group.add(panel);
    group.position.set(d.x, 0, d.z);
    root.add(group);
    const g = { id: d.id, group, tex, canvas, material: pm, label: d.label, good: d.good, hw, moving: d.moving || null, panelW: hw * 2, z: d.z, x: d.x };
    drawLabel(g);
    vis.push(g);
  }

  function clear() {
    for (let i = 0; i < vis.length; i++) {
      root.remove(vis[i].group);
      vis[i].tex.dispose();
      vis[i].material.dispose();
    }
    vis.length = 0;
    for (const g of geoCache.values()) g.dispose();
    for (const g of planeCache.values()) g.dispose();
    geoCache.clear(); planeCache.clear();
  }

  function build(levelDef) {
    clear();
    let id = 0;
    if (levelDef && levelDef.rows) {
      for (const row of levelDef.rows) {
        for (const g of row.gates) {
          addGate({
            id: id++, x: g.x, z: row.z, halfWidth: g.halfWidth,
            good: g.op === 'mul' || g.op === 'add', label: labelFor(g.op, g.value), moving: g.moving,
          });
        }
      }
    }
    ready = true;
  }

  function matches(list) {
    if (list.length !== vis.length) return false;
    for (let i = 0; i < list.length; i++) if (vis[i].id !== list[i].id || vis[i].hw !== list[i].halfWidth) return false;
    return true;
  }

  function sync(state, now) {
    const list = state.gates;
    if (list && list.length) {
      if (!matches(list)) {
        clear();
        for (let i = 0; i < list.length; i++) {
          const g = list[i];
          addGate({ id: g.id, x: g.x, z: g.z, halfWidth: g.halfWidth, good: g.good, label: g.label || labelFor(g.op, g.value), moving: g.moving });
        }
      }
      const t = state.time;
      for (let i = 0; i < list.length; i++) {
        const g = list[i], v = vis[i];
        const d = t - g.lastTrigger;
        const p = d >= 0 && d < PULSE_T ? 1 - d / PULSE_T : 0;
        const s = 1 + 0.22 * p;
        v.group.scale.set(s, s, 1);
        v.group.position.x = g.x;
        v.group.position.z = g.z;
      }
    } else {
      // sem estado de portões (menu): anima os móveis pelo relógio
      for (let i = 0; i < vis.length; i++) {
        const v = vis[i];
        if (v.moving) v.group.position.x = v.moving.amp * Math.sin(v.moving.omega * now + v.moving.phase);
      }
    }
  }

  function find(id) {
    for (let i = 0; i < vis.length; i++) if (vis[i].id === id) return vis[i];
    return null;
  }

  function redrawAll() {
    for (let i = 0; i < vis.length; i++) drawLabel(vis[i]);
  }
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(redrawAll).catch(() => {});
  }

  return { build, sync, find, redrawAll, root };
}
