import assert from 'node:assert/strict';
import { CFG } from '../src/config.js';
import { generateLevel, towerHpFor } from '../src/sim/level.js';
import { loadSave, persist, resetSave } from '../src/progress/save.js';
import { upgradeCost, computeMods, rewardFor, upgradeItems, buyUpgrade } from '../src/progress/economy.js';
import { createAudio } from '../src/audio.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('generateLevel é determinístico', () => {
  for (let L = 1; L <= 30; L++) assert.deepStrictEqual(generateLevel(L), generateLevel(L));
});

t('fase 1 é o tutorial', () => {
  const d = generateLevel(1);
  assert.equal(d.rows.length, 2);
  const [a, b] = d.rows;
  assert.equal(a.z, -12); assert.equal(b.z, -28);
  const sig = (r) => r.gates.map((g) => `${g.op}${g.value}@${g.x}`);
  assert.deepEqual(sig(a), ['mul2@-2.5', 'add3@2.5']);
  assert.deepEqual(sig(b), ['add5@-2.5', 'mul3@2.5']);
  assert.ok(d.rows.every((r) => r.gates.every((g) => g.moving === null)));
  assert.equal(d.towerHp, 180);
  assert.equal(d.cats.fatChance, 0);
});

t('invariantes L=1..30', () => {
  for (let L = 1; L <= 30; L++) {
    const d = generateLevel(L);
    assert.equal(d.level, L);
    assert.equal(d.towerHp, towerHpFor(L));
    assert.equal(d.rows.length, L === 1 ? 2 : Math.min(2 + Math.floor(L / 2), 5));
    let prod = 1;
    let prevZ = Infinity;
    for (const row of d.rows) {
      assert.ok(row.z < prevZ && row.z <= -9 && row.z >= -33, `z fora L${L}`);
      prevZ = row.z;
      let best = 0, bad = 0;
      for (const g of row.gates) {
        const reach = g.moving ? g.moving.amp + g.halfWidth : Math.abs(g.x) + g.halfWidth;
        assert.ok(reach <= CFG.lane.halfWidth + 1e-9, `gate fora da pista L${L}`);
        if (g.op === 'mul') best = Math.max(best, g.value);
        if (g.op === 'sub' || g.op === 'div') bad++;
      }
      if (row.gates.length === 2) assert.ok(bad < 2, `par ruim L${L}`);
      if (best) prod *= best;
    }
    assert.ok(prod <= CFG.gates.maxMulProduct, `produto ${prod} L${L}`);
  }
});

t('towerHp e cats', () => {
  assert.deepEqual([1, 2, 3, 5, 10].map(towerHpFor), [180, 294, 436, 804, 2214]);
  const c = generateLevel(10).cats;
  assert.equal(c.rate, 5.5); assert.equal(c.burstSize, 62); assert.equal(c.ramp, 45);
  assert.equal(c.fatChance, 0.14);
  assert.equal(generateLevel(40).cats.rate, 14);
});

t('tabela de custos', () => {
  const r5 = (x) => Math.round(x / 5) * 5;
  for (const [id, base] of [['fireRate', 40], ['super', 50], ['baseHp', 30]]) {
    for (let l = 0; l < 10; l++) assert.equal(upgradeCost(id, l), r5(base * Math.pow(1.55, l)));
    assert.equal(upgradeCost(id, 10), null);
  }
  assert.equal(upgradeCost('fireRate', 0), 40);
  assert.equal(upgradeCost('fireRate', 1), 60);
  assert.equal(upgradeCost('super', 0), 50);
  assert.equal(upgradeCost('baseHp', 0), 30);
});

t('mods, recompensas, compra', () => {
  const s = { coins: 1000, upgrades: { fireRate: 2, super: 2, baseHp: 2 } };
  const m = computeMods(s);
  assert.ok(Math.abs(m.fireRate - 6.4) < 1e-9);
  assert.equal(m.baseHp, 14); assert.equal(m.superNeed, 44); assert.equal(m.superPower, 64);
  assert.equal(computeMods({ upgrades: { fireRate: 0, super: 10, baseHp: 0 } }).superNeed, 20);
  const d = generateLevel(3);
  assert.equal(rewardFor(d, { won: true, towerDamageFrac: 1, baseHp: 10 }), 25 + 30 + 20);
  assert.equal(rewardFor(d, { won: false, towerDamageFrac: 0.5, baseHp: 0 }), Math.round(14 * 0.5));
  const items = upgradeItems(s);
  assert.equal(items[0].valueText, '6.4/s'); assert.equal(items[1].valueText, '44 pts'); assert.equal(items[2].valueText, '14 ❤');
  const before = s.coins;
  assert.ok(buyUpgrade(s, 'fireRate'));
  assert.equal(s.upgrades.fireRate, 3); assert.equal(s.coins, before - upgradeCost('fireRate', 2));
  assert.equal(buyUpgrade({ coins: 0, upgrades: { fireRate: 0, super: 0, baseHp: 0 } }, 'fireRate'), false);
  assert.equal(buyUpgrade(s, 'nope'), false);
});

t('save sem localStorage', () => {
  delete globalThis.localStorage;
  const s = loadSave();
  assert.deepStrictEqual(s, { v: 1, level: 1, best: 1, coins: 0, upgrades: { fireRate: 0, super: 0, baseHp: 0 }, muted: false });
  s.coins = 7;
  assert.equal(persist(s), false);
  assert.equal(loadSave().coins, 7); // cópia em memória
  assert.equal(resetSave().coins, 0);
});

t('save com localStorage que lança', () => {
  const boom = () => { throw new Error('x'); };
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
  const s = loadSave();
  assert.equal(s.level, 1);
  assert.equal(persist(s), false);
  assert.doesNotThrow(() => resetSave());
  delete globalThis.localStorage;
});

t('save com localStorage funcional e dados inválidos', () => {
  const data = {};
  globalThis.localStorage = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  const s = resetSave();
  s.coins = 123; s.level = 4; s.best = 4; s.upgrades.fireRate = 3; s.muted = true;
  assert.equal(persist(s), true);
  assert.deepStrictEqual(loadSave(), s);
  data[CFG.save.key] = JSON.stringify({ level: 'x', coins: -5, upgrades: { fireRate: 99, super: 'a' }, muted: 'yes' });
  const bad = loadSave();
  assert.equal(bad.level, 1); assert.equal(bad.coins, 0);
  assert.equal(bad.upgrades.fireRate, 10); assert.equal(bad.upgrades.super, 0); assert.equal(bad.muted, false);
  data[CFG.save.key] = '{lixo';
  assert.equal(loadSave().coins, 0);
  delete globalThis.localStorage;
});

t('audio é no-op no Node', () => {
  const a = createAudio();
  assert.doesNotThrow(() => {
    a.unlock(); a.setMuted(true); a.play('fire'); a.play('xyz'); a.startMusic(); a.stopMusic();
  });
  assert.equal(a.isMuted(), true);
});

console.log(`\n${n} testes passaram`);
