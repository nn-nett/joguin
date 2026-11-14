// Save em localStorage com cópia em memória. Nunca lança.
import { CFG } from '../config.js';

const KEY = CFG.save.key;
const UP = ['fireRate', 'super', 'baseHp'];
let mem = null;

function defaults() {
  return { v: 1, level: 1, best: 1, coins: 0, upgrades: { fireRate: 0, super: 0, baseHp: 0 }, muted: false };
}

function toInt(x, lo, hi, dflt) {
  const n = typeof x === 'number' && Number.isFinite(x) ? Math.floor(x) : dflt;
  return Math.min(hi, Math.max(lo, n));
}

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  d.level = toInt(raw.level, 1, 1e6, 1);
  d.best = Math.max(d.level, toInt(raw.best, 1, 1e6, 1));
  d.coins = toInt(raw.coins, 0, 1e9, 0);
  d.muted = raw.muted === true;
  const u = raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {};
  for (const id of UP) d.upgrades[id] = toInt(u[id], 0, CFG.upgrades[id].max, 0);
  return d;
}

function store() {
  try { return globalThis.localStorage || null; } catch (e) { return null; }
}

export function loadSave() {
  let raw;
  let ok = false;
  try {
    const s = store();
    if (s) {
      const txt = s.getItem(KEY);
      ok = true;
      if (txt) raw = JSON.parse(txt);
    }
  } catch (e) { raw = undefined; ok = false; }
  if (raw === undefined && !ok && mem) raw = mem;
  if (raw === undefined && ok && mem) raw = mem; // nada salvo: usa a cópia em memória, se houver
  const save = sanitize(raw);
  mem = sanitize(save);
  return save;
}

export function persist(save) {
  mem = sanitize(save);
  try {
    const s = store();
    if (!s) return false;
    s.setItem(KEY, JSON.stringify(mem));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetSave() {
  const d = defaults();
  mem = defaults();
  try {
    const s = store();
    if (s) s.setItem(KEY, JSON.stringify(d));
  } catch (e) { /* segue sem persistir */ }
  return d;
}
