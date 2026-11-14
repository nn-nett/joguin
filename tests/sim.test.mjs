import assert from 'node:assert/strict';
import { createSim } from '../src/sim/sim.js';
import { CFG } from '../src/config.js';

const DT = 1 / 60;
const MODS = { fireRate: 5, baseHp: 10, superNeed: 50, superPower: 40 };

function level(rows = [], extra = {}) {
  return {
    level: 1, seed: 123, towerHp: 100000, rows,
    cats: { rate: 0, ramp: 45, burstEvery: 12, burstSize: 0, speed: 2.6, fatChance: 0, ...extra },
  };
}
const gateRow = (op, value, z = -10) => [{ z, gates: [
  { x: -2.5, halfWidth: 2.3, op, value, moving: null },
  { x: 2.5, halfWidth: 2.3, op, value: 1, moving: null },
] }];
function run(sim, seconds) { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) sim.step(DT); }
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok - ' + name); }

function gateTest(op, value, expected, n = 10) {
  const sim = createSim();
  sim.startLevel(level(gateRow(op, value)), MODS);
  sim.debug.spawnPuppies(n, -2.5, -9.5);
  run(sim, 0.2);
  assert.equal(sim.state.puppies.count, expected, `${op} ${value}`);
  return sim;
}

test('x3 turns 10 into 30', () => {
  const sim = gateTest('mul', 3, 30);
  assert.equal(sim.state.stats.cloned, 20);
  const ev = sim.drainEvents().filter((e) => e.type === 'gate');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].good, true);
  assert.equal(ev[0].n, 20);
});
test('+5 with 10 crossing together gives 15', () => gateTest('add', 5, 15));
test('div 2 leaves 5', () => gateTest('div', 2, 5));
test('-3 leaves 7', () => gateTest('sub', 3, 7));
test('sub budget refills every second', () => {
  const sim = createSim();
  sim.startLevel(level(gateRow('sub', 3)), MODS);
  sim.debug.spawnPuppies(5, -2.5, -9.5);
  run(sim, 0.2);
  assert.equal(sim.state.puppies.count, 2);
  sim.debug.spawnPuppies(5, -2.5, -9.5);
  run(sim, 0.2); // t < 1s: no budget
  assert.equal(sim.state.puppies.count, 7);
  run(sim, 1.0);
  sim.debug.spawnPuppies(5, -2.5, -9.5);
  run(sim, 0.2);
  assert.equal(sim.state.puppies.count <= 7 + 5 - 3 + 0, true);
});
test('add cooldown blocks second trigger', () => {
  const sim = createSim();
  sim.startLevel(level(gateRow('add', 5)), MODS);
  sim.debug.spawnPuppies(1, -2.5, -9.5);
  run(sim, 0.1);
  assert.equal(sim.state.puppies.count, 6);
  sim.debug.spawnPuppies(1, -2.5, -9.5);
  run(sim, 0.1);
  assert.equal(sim.state.puppies.count, 7);
});
test('clones never reprocess the same row', () => {
  const sim = gateTest('mul', 2, 20);
  run(sim, 0.3);
  assert.equal(sim.state.puppies.count, 20);
});
test('puppy outside any gate is unaffected', () => {
  const sim = createSim();
  sim.startLevel(level(gateRow('mul', 3)), MODS);
  sim.debug.spawnPuppies(4, 0.0, -9.5);
  run(sim, 0.2);
  assert.equal(sim.state.puppies.count, 4);
});
test('moving gate follows sin', () => {
  const sim = createSim();
  const lv = level([{ z: -10, gates: [{ x: 0, halfWidth: 1.6, op: 'mul', value: 2, moving: { amp: 3, omega: 1, phase: 0 } }] }]);
  sim.startLevel(lv, MODS);
  run(sim, 1);
  assert.ok(Math.abs(sim.state.gates[0].x - 3 * Math.sin(1)) < 1e-6);
});

test('puppy and cat annul 1:1', () => {
  const sim = createSim();
  sim.startLevel(level(), MODS);
  sim.debug.spawnCats(5);
  const C = sim.state.cats;
  for (let i = 0; i < 5; i++) sim.debug.spawnPuppies(1, C.x[i], C.z[i] + 3);
  run(sim, 1);
  assert.equal(sim.state.puppies.count, 0);
  assert.equal(sim.state.cats.count, 0);
  assert.equal(sim.state.stats.catsKilled, 5);
  assert.ok(sim.state.base.hp === 10);
});
test('fat cat needs 6 puppies', () => {
  for (const [n, killed] of [[5, 0], [6, 1]]) {
    const sim = createSim();
    sim.startLevel(level(), MODS);
    sim.debug.spawnCats(1, 1);
    const cx = sim.state.cats.x[0], cz = sim.state.cats.z[0];
    sim.debug.spawnPuppies(n, cx, cz + 2);
    run(sim, 0.5);
    assert.equal(sim.state.puppies.count, 0);
    assert.equal(sim.state.stats.catsKilled, killed);
    assert.equal(sim.state.cats.count, 1 - killed);
  }
});
test('caps are respected', () => {
  const sim = createSim();
  sim.startLevel(level(gateRow('mul', 4)), { ...MODS, fireRate: 12 });
  sim.debug.spawnPuppies(5000, -2.5, -5);
  assert.equal(sim.state.puppies.count, CFG.puppy.cap);
  sim.debug.spawnCats(5000);
  assert.equal(sim.state.cats.count, CFG.cat.cap);
  sim.setInput({ targetX: 0, firing: true });
  run(sim, 0.5);
  assert.ok(sim.state.puppies.count <= CFG.puppy.cap);
  const s2 = createSim();
  s2.startLevel(level(gateRow('mul', 4)), MODS);
  s2.debug.spawnPuppies(700, -2.5, -9.5);
  run(s2, 0.3);
  assert.equal(s2.state.puppies.count, CFG.puppy.cap);
});
test('tower damage, win event, and freeze', () => {
  const sim = createSim();
  const lv = level(); lv.towerHp = 3;
  sim.startLevel(lv, MODS);
  sim.debug.spawnPuppies(5, 0, -45);
  run(sim, 0.1);
  assert.equal(sim.state.status, 'won');
  assert.equal(sim.state.tower.hp, 0);
  const ev = sim.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.ok(ev.some((e) => e.type === 'towerHit'));
  const t = sim.state.time;
  sim.step(DT);
  assert.equal(sim.state.time, t);
});
test('cats reaching base lose the game', () => {
  const sim = createSim();
  sim.startLevel(level(), { ...MODS, baseHp: 2 });
  sim.debug.spawnCats(2);
  run(sim, 30);
  assert.equal(sim.state.status, 'lost');
  assert.ok(sim.drainEvents().some((e) => e.type === 'lose'));
});
test('super dog charges, launches, damages tower', () => {
  const sim = createSim();
  sim.startLevel(level(), MODS);
  assert.equal(sim.requestSuper(), false);
  sim.debug.fillSuper();
  assert.ok(sim.drainEvents().some((e) => e.type === 'superReady'));
  assert.equal(sim.requestSuper(), true);
  assert.equal(sim.state.superDog.active, true);
  const hp = sim.state.tower.hp;
  run(sim, 8);
  assert.equal(sim.state.superDog.active, false);
  assert.equal(sim.state.tower.hp, hp - 40);
});
test('forceWin / forceLose', () => {
  const a = createSim(); a.startLevel(level(), MODS); a.debug.forceWin();
  assert.equal(a.state.status, 'won');
  const b = createSim(); b.startLevel(level(), MODS); b.debug.forceLose();
  assert.equal(b.state.status, 'lost');
});

function snapshot(sim) {
  const s = sim.state;
  return JSON.stringify({
    t: s.time, c: s.cannonX, st: s.stats, th: s.tower.hp, bh: s.base.hp, sp: s.superPoints,
    p: [s.puppies.count, Array.from(s.puppies.x.subarray(0, s.puppies.count)), Array.from(s.puppies.z.subarray(0, s.puppies.count))],
    k: [s.cats.count, Array.from(s.cats.x.subarray(0, s.cats.count)), Array.from(s.cats.hp.subarray(0, s.cats.count))],
  });
}
test('determinism', () => {
  const lv = level(gateRow('mul', 2), { rate: 3, burstSize: 15, fatChance: 0.1 });
  lv.level = 4; lv.towerHp = 600;
  const mk = () => {
    const sim = createSim();
    sim.startLevel(lv, MODS);
    for (let i = 0; i < 900; i++) {
      sim.setInput({ targetX: Math.sin(i / 50) * 3, firing: i % 200 < 150 });
      sim.step(DT);
    }
    return snapshot(sim);
  };
  const a = mk(), b = mk();
  assert.equal(a, b);
  assert.ok(JSON.parse(a).st.fired > 0);
});

test('perf: 800 puppies + 300 cats, mean step < 1.5 ms', () => {
  const sim = createSim();
  const lv = level(gateRow('mul', 2), { rate: 0 });
  lv.towerHp = 1e9;
  sim.startLevel(lv, { ...MODS, baseHp: 1e6 });
  const N = 300;
  let total = 0;
  for (let i = 0; i < N; i++) {
    // keep populations full
    sim.debug.spawnPuppies(800, (i % 7) - 3, -12 - (i % 5));
    sim.debug.spawnCats(300);
    const t0 = performance.now();
    sim.step(DT);
    total += performance.now() - t0;
    sim.drainEvents();
  }
  const mean = total / N;
  console.log(`   mean step ${mean.toFixed(3)} ms`);
  assert.ok(mean < 1.5, 'mean ' + mean);
});

console.log(`\n${passed} tests passed`);
