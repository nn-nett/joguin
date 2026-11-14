// Gerador determinístico de fases (PLANO 2.1). Sem DOM, sem THREE.
import { CFG } from '../config.js';
import { makeRng } from '../util/rng.js';

export function towerHpFor(level) {
  const n = level - 1;
  return Math.round(CFG.tower.hpA + CFG.tower.hpB * n + CFG.tower.hpC * n * n);
}

const G = CFG.gates;

function gate(x, halfWidth, op, value, moving = null) {
  return { x, halfWidth, op, value, moving };
}

function pickGoodPair(L, rng) {
  const r = rng.next();
  if (L <= 2) return r < 0.7 ? ['mul', 2] : ['add', 5];
  if (L <= 5) {
    if (r < 0.5) return ['mul', 2];
    if (r < 0.75) return ['mul', 3];
    return ['add', rng.chance(0.5) ? 5 : 10];
  }
  if (r < 0.4) return ['mul', 2];
  if (r < 0.75) return ['mul', 3];
  if (r < 0.9) return ['add', 10];
  return ['mul', 4];
}

function pickBad(L, rng) {
  const opts = [['sub', 3], ['sub', 5]];
  if (L >= 4) opts.push(['div', 2]);
  if (L >= 8) opts.push(['sub', 10]);
  return rng.pick(opts);
}

function rowBestMul(row) {
  let best = 0;
  for (const g of row.gates) if (g.op === 'mul' && g.value > best) best = g.value;
  return best;
}

function limitMulProduct(rows) {
  for (let guard = 0; guard < 100; guard++) {
    let prod = 1;
    let maxRow = null;
    let maxVal = 0;
    for (const row of rows) {
      const b = rowBestMul(row);
      if (b > 0) prod *= b;
      if (b > maxVal) { maxVal = b; maxRow = row; }
    }
    if (prod <= G.maxMulProduct || !maxRow) return;
    for (const g of maxRow.gates) {
      if (g.op === 'mul' && g.value === maxVal) {
        if (g.value > 2) g.value -= 1;
        else { g.op = 'add'; g.value = 5; }
      }
    }
  }
}

export function generateLevel(level) {
  const L = Math.max(1, Math.floor(level) | 0);
  const seed = L * CFG.levelGen.seedMul;
  const base = {
    level: L,
    seed,
    towerHp: towerHpFor(L),
    cats: {
      rate: Math.min(CFG.waves.rateBase + CFG.waves.ratePerLevel * (L - 1), CFG.waves.rateMax),
      ramp: CFG.waves.ramp,
      burstEvery: CFG.waves.burstEvery,
      burstSize: Math.min(CFG.waves.burstBase + CFG.waves.burstPerLevel * L, CFG.waves.burstMax),
      speed: Math.min(CFG.cat.speedBase + CFG.cat.speedPerLevel * (L - 1), CFG.cat.speedMax),
      fatChance: L >= CFG.fatCat.fromLevel
        ? Math.min(CFG.fatCat.chanceBase + CFG.fatCat.chancePerLevel * L, CFG.fatCat.chanceMax)
        : 0,
    },
  };

  if (L === 1) {
    const px = G.pairX, hw = G.pairHalfWidth;
    base.rows = [
      { z: -12, gates: [gate(-px, hw, 'mul', 2), gate(px, hw, 'add', 3)] },
      { z: -28, gates: [gate(-px, hw, 'add', 5), gate(px, hw, 'mul', 3)] },
    ];
    return base;
  }

  const rng = makeRng(seed);
  const R = Math.min(CFG.levelGen.rowsBase + Math.floor(L / 2), CFG.levelGen.rowsMax);
  const near = CFG.lane.gateZoneNear, far = CFG.lane.gateZoneFar;
  const pMover = L >= 3 ? Math.min(0.15 + 0.05 * (L - 3), 0.45) : 0;
  const pBad = Math.min(0.2 + 0.06 * (L - 2), 0.65);
  const omega = Math.min(G.moverOmegaBase + G.moverOmegaPerLevel * L, G.moverOmegaMax);
  const rows = [];

  for (let i = 0; i < R; i++) {
    const z = R === 1 ? near : near + (far - near) * (i / (R - 1));
    const isMover = i > 0 && pMover > 0 && rng.chance(pMover);
    if (isMover) {
      let bad = false;
      if (L >= 5 && rng.chance(0.35)) bad = true;
      let op, value;
      if (bad) {
        [op, value] = rng.chance(0.5) ? ['div', 2] : ['sub', 5];
      } else {
        op = 'mul';
        value = L < 6 ? 3 : (rng.chance(0.5) ? 3 : 4);
      }
      const phase = rng.range(0, Math.PI * 2);
      rows.push({
        z,
        gates: [gate(0, bad ? G.moverHalfWidthBad : G.moverHalfWidthGood, op, value,
          { amp: G.moverAmp, omega, phase })],
      });
    } else {
      const [gop, gval] = pickGoodPair(L, rng);
      let oop, oval;
      if (rng.chance(pBad)) {
        [oop, oval] = pickBad(L, rng);
      } else if (gop === 'mul' && gval >= 3) {
        [oop, oval] = ['mul', 2];
      } else {
        [oop, oval] = ['add', 3];
      }
      const goodLeft = rng.chance(0.5);
      const px = G.pairX, hw = G.pairHalfWidth;
      const goodG = gate(goodLeft ? -px : px, hw, gop, gval);
      const otherG = gate(goodLeft ? px : -px, hw, oop, oval);
      rows.push({ z, gates: goodLeft ? [goodG, otherG] : [otherG, goodG] });
    }
  }

  limitMulProduct(rows);
  rows.sort((a, b) => b.z - a.z);
  base.rows = rows;
  return base;
}
