// Auvalanche! — cola: loop, máquina de estados, eventos, save e gancho de depuração.
import { CFG } from './config.js';
import { STR } from './strings.js';
import { createSim } from './sim/sim.js';
import { generateLevel } from './sim/level.js';
import { loadSave, persist, resetSave } from './progress/save.js';
import { computeMods, rewardFor, upgradeItems, buyUpgrade } from './progress/economy.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render/renderer.js';
import { createUI } from './ui/ui.js';
import { createInput } from './input.js';

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && (e.reason.stack || e.reason.message) || e.reason)));

const STEP = CFG.sim.dt;
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

let save = loadSave();
const sim = createSim();
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let mode = 'menu'; // menu | playing | ending | win | lose | upgrades
let paused = false;
let acc = 0;
let currentDef = null;
let currentLevel = save.level;
let isCustom = false;
let endTimer = 0;
let pendingEnd = null;
let baseWarned = false;
let badGateWarned = false;

const ui = createUI(uiRoot, {
  onPlay: () => { audio.play('click'); startLevel(save.level); },
  onOpenUpgrades: () => { audio.play('click'); showUpgrades(); },
  onSuper: () => trySuper(),
  onToggleMute: () => {
    save.muted = !save.muted;
    audio.setMuted(save.muted);
    ui.setMuted(save.muted);
    persist(save);
  },
  onBuyUpgrade: (id) => {
    if (buyUpgrade(save, id)) {
      persist(save);
      audio.play('buy');
      showUpgrades();
    } else {
      ui.toast(STR.noCoins, 'warn');
    }
  },
  onNext: () => { audio.play('click'); showUpgrades(); },
  onRetry: () => { audio.play('click'); startLevel(currentLevel); },
});

input.onSuper(() => trySuper());
audio.setMuted(!!save.muted);
ui.setMuted(!!save.muted);

// ---------- fluxo ----------
function previewLevel(level) {
  currentDef = generateLevel(level);
  sim.startLevel(currentDef, computeMods(save));
  renderer.buildLevel(currentDef);
  renderer.setMode('menu');
  input.setEnabled(false);
}

function showStart() {
  mode = 'menu';
  previewLevel(save.level);
  ui.showScreen('start', { level: save.level, coins: save.coins, best: save.best, isTouch });
}

function showUpgrades() {
  if (mode !== 'upgrades') previewLevel(save.level);
  mode = 'upgrades';
  ui.showScreen('upgrades', { coins: save.coins, nextLevel: save.level, items: upgradeItems(save) });
}

function startLevel(level, def = null, mods = null) {
  isCustom = !!def;
  currentLevel = def ? def.level : level;
  currentDef = def || generateLevel(level);
  sim.startLevel(currentDef, mods || computeMods(save));
  renderer.buildLevel(currentDef);
  renderer.setMode('play');
  input.reset();
  input.setEnabled(true);
  acc = 0;
  baseWarned = false;
  pendingEnd = null;
  mode = 'playing';
  ui.showScreen('hud');
  ui.updateHud(hudData());
  audio.startMusic();
  if (!badGateWarned && currentDef.rows.some((r) => r.gates.some((g) => g.op === 'sub' || g.op === 'div'))) {
    badGateWarned = true;
    ui.toast(STR.toastBadGates, 'warn');
  }
}

function trySuper() {
  if (mode !== 'playing') return;
  if (sim.requestSuper()) audio.play('super');
}

function onEnd(won) {
  if (mode !== 'playing') return;
  const st = sim.state;
  mode = 'ending';
  input.setEnabled(false);
  renderer.setMode(won ? 'won' : 'lost');
  audio.play(won ? 'win' : 'lose');
  const towerDamageFrac = Math.max(0, Math.min(1, 1 - st.tower.hp / st.tower.maxHp));
  const reward = rewardFor(currentDef, { won, towerDamageFrac, baseHp: Math.max(0, st.base.hp) });
  save.coins += reward;
  if (won && !isCustom) {
    save.level = Math.max(save.level, currentLevel + 1);
    save.best = Math.max(save.best || 1, save.level);
  }
  persist(save);
  endTimer = won ? CFG.timing.winDelay : CFG.timing.loseDelay;
  pendingEnd = won
    ? { screen: 'win', data: { level: currentLevel, reward, coins: save.coins } }
    : { screen: 'lose', data: { level: currentLevel, reward, coins: save.coins, pct: Math.round(towerDamageFrac * 100) } };
}

function finishEnding() {
  if (mode !== 'ending' || !pendingEnd) return;
  mode = pendingEnd.screen;
  if (pendingEnd.reward || pendingEnd.data.reward) audio.play('coin');
  ui.showScreen(pendingEnd.screen, pendingEnd.data);
  pendingEnd = null;
}

// ---------- eventos ----------
function processEvents() {
  const ev = sim.drainEvents();
  if (!ev.length) return;
  renderer.handleEvents(ev);
  const st = sim.state;
  for (const e of ev) {
    switch (e.type) {
      case 'fire': audio.play('fire'); break;
      case 'gate': audio.play(e.good ? 'gate' : 'gateBad'); break;
      case 'clash': audio.play('clash'); break;
      case 'towerHit': audio.play('towerHit'); break;
      case 'baseHit':
        audio.play('baseHit');
        if (!baseWarned && st.base.hp > 0 && st.base.hp <= st.base.maxHp * 0.3) {
          baseWarned = true;
          ui.toast(STR.toastBaseDanger, 'warn');
        }
        break;
      case 'wave': audio.play('wave'); ui.toast(STR.toastWave, 'info'); break;
      case 'superReady': audio.play('superReady'); ui.toast(STR.toastSuperReady, 'good'); break;
      case 'win': onEnd(true); break;
      case 'lose': onEnd(false); break;
    }
  }
}

function hudData() {
  const st = sim.state;
  return {
    level: currentLevel,
    towerHp: Math.max(0, Math.ceil(st.tower.hp)),
    towerMaxHp: st.tower.maxHp,
    baseHp: Math.max(0, Math.ceil(st.base.hp)),
    baseMaxHp: st.base.maxHp,
    puppies: st.puppies.count,
    superFrac: st.superDog.active ? 0 : Math.min(1, st.superPoints / Math.max(1, st.superNeed)),
    coins: save.coins,
  };
}

// ---------- loop ----------
let last = performance.now() / 1000;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  const dt = Math.min(0.1, Math.max(0, now - last));
  last = now;
  try {
    if (mode === 'playing' && !paused) {
      input.update(dt);
      sim.setInput(input.state);
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < CFG.sim.maxSteps) { sim.step(STEP); acc -= STEP; n++; }
      if (n === CFG.sim.maxSteps) acc = 0;
    }
    processEvents();
    if (mode === 'ending' && !paused) {
      endTimer -= dt;
      if (endTimer <= 0) finishEnding();
    }
    renderer.sync(sim.state, now, dt);
    renderer.render();
    if (mode === 'playing' || mode === 'ending') ui.updateHud(hudData());
  } catch (err) {
    errors.push(String(err && (err.stack || err.message) || err));
    throw err;
  }
}

function onResize() { renderer.resize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
document.addEventListener('visibilitychange', () => { acc = 0; last = performance.now() / 1000; });

function unlockAudio() {
  audio.unlock();
  audio.setMuted(!!save.muted);
  if (mode === 'playing') audio.startMusic();
}
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

onResize();
showStart();
requestAnimationFrame(frame);

// ---------- gancho de depuração ----------
window.__game = {
  get state() { return sim.state; },
  get save() { return save; },
  get screen() { return ui.current(); },
  get mode() { return mode; },
  errors,
  start(level) { startLevel(level || save.level); },
  startCustom(def, mods) { startLevel(def.level, def, mods || null); },
  pauseLoop(b) { paused = !!b; acc = 0; },
  setInput(i) { sim.setInput(i); },
  step(seconds) {
    const n = Math.max(1, Math.round(seconds / STEP));
    for (let k = 0; k < n; k++) {
      if (sim.state.status !== 'playing') break;
      sim.step(STEP);
      if (k % 30 === 29) processEvents();
    }
    processEvents();
  },
  super() { trySuper(); processEvents(); return sim.state.superDog.active; },
  fillSuper() { sim.debug.fillSuper(); processEvents(); },
  forceWin() { sim.debug.forceWin(); processEvents(); },
  forceLose() { sim.debug.forceLose(); processEvents(); },
  spawnPuppies(n, x, z, row = 0) { sim.debug.spawnPuppies(n, x, z, row); },
  spawnCats(n, kind = 0) { sim.debug.spawnCats(n, kind); },
  clearCats() { sim.debug.clearCats(); },
  grantCoins(n) {
    save.coins += n;
    persist(save);
    if (mode === 'upgrades') ui.showScreen('upgrades', { coins: save.coins, nextLevel: save.level, items: upgradeItems(save) });
  },
  buy(id) {
    const ok = buyUpgrade(save, id);
    if (ok) { persist(save); if (mode === 'upgrades') showUpgrades(); }
    return ok;
  },
  next() { showUpgrades(); },
  retry() { startLevel(currentLevel); },
  reset() { save = resetSave(); currentLevel = save.level; badGateWarned = false; audio.setMuted(!!save.muted); ui.setMuted(!!save.muted); showStart(); },
  finishEnding() { finishEnding(); },
  renderInfo() { return renderer.info(); },
};
