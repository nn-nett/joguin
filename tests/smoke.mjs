// Teste de fumaça do Auvalanche! — executa os 13 passos da seção 5.3 do PLANO.md.
// Uso: node tests/smoke.mjs   (SMOKE_URL sobrescreve a URL da página)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { startServer, launch, openPage } from './helpers.mjs';
import { CFG } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(here, 'out');
await mkdir(outDir, { recursive: true });

const failures = [];
let stepNo = 0;
async function step(name, fn) {
  stepNo++;
  const label = `${String(stepNo).padStart(2, '0')}. ${name}`;
  try {
    await fn();
    console.log(`PASS  ${label}`);
  } catch (e) {
    failures.push(label);
    console.log(`FAIL  ${label}\n      -> ${e && e.message ? e.message : e}`);
  }
}
function check(cond, msg) {
  if (!cond) throw new Error(msg);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) });

// ---------- helpers no contexto da página ----------
const waitStart = (page) =>
  page.waitForFunction(() => window.__game && window.__game.screen === 'start', null, { timeout: 30000 });

const snap = (page) =>
  page.evaluate(() => {
    const g = window.__game;
    const s = g.state;
    return {
      status: s.status, time: s.time, level: s.level, cannonX: s.cannonX,
      puppies: s.puppies.count, cats: s.cats.count,
      towerHp: s.tower.hp, towerMaxHp: s.tower.maxHp, baseHp: s.base.hp,
      superActive: s.superDog.active, stats: { ...s.stats },
      screen: g.screen, coins: g.save.coins, level_save: g.save.level,
      fireRateLvl: g.save.upgrades.fireRate,
    };
  });

// Bot executado dentro da página. Roda em fatias de 0.5 s simulados.
function pageBot({ level, maxSec, aim, muzzleZ }) {
  const g = window.__game;
  if (level != null) g.start(level);
  g.pauseLoop(true);
  g.setInput({ targetX: 0, firing: false });
  let guard = 0;
  while (g.state.status === 'playing' && g.state.time < maxSec && guard++ < 2000) {
    if (aim) {
      const gates = g.state.gates || [];
      let rowZ = -Infinity;
      for (const gt of gates) if (gt.z < muzzleZ && gt.z > rowZ) rowZ = gt.z;
      let best = null;
      let bestScore = -Infinity;
      for (const gt of gates) {
        if (gt.z !== rowZ) continue;
        let sc;
        if (!gt.good) sc = -100;
        else if (gt.op === 'mul') sc = gt.value * 10;
        else sc = gt.value;
        if (sc > bestScore) { bestScore = sc; best = gt; }
      }
      const tx = best ? Math.max(-4, Math.min(4, best.x)) : 0;
      g.setInput({ targetX: tx, firing: true });
    } else {
      g.setInput({ targetX: 0, firing: false });
    }
    g.step(0.5);
  }
  return { status: g.state.status, time: g.state.time };
}
const MUZZLE_Z = -1.4;
const runBot = (page, opts) => page.evaluate(pageBot, { muzzleZ: MUZZLE_Z, maxSec: 90, aim: true, ...opts });

function gateLevel(opGood, vGood, opBad, vBad) {
  return {
    level: 1, seed: 1, towerHp: 100000,
    rows: [{
      z: -10,
      gates: [
        { x: -2.5, halfWidth: 2.3, op: opGood, value: vGood, moving: null },
        { x: 2.5, halfWidth: 2.3, op: opBad, value: vBad, moving: null },
      ],
    }],
    cats: { rate: 0, ramp: 45, burstEvery: 9999, burstSize: 0, speed: 2.6, fatChance: 0 },
  };
}
const emptyLevel = () => ({ ...gateLevel('mul', 2, 'mul', 2), rows: [] });
const MODS = { fireRate: 5, baseHp: 100, superNeed: 50, superPower: 40 };

async function custom(page, def) {
  await page.evaluate(
    ({ def, mods }) => {
      const g = window.__game;
      g.pauseLoop(true);
      g.startCustom(def, mods);
      g.setInput({ targetX: 0, firing: false });
    },
    { def, mods: MODS },
  );
}

// ---------- execução ----------
const externalUrl = process.env.SMOKE_URL;
let server = null;
let url = externalUrl;
if (!url) {
  server = await startServer(root);
  url = server.url + '/index.html';
}
const browser = await launch();
const collectors = []; // { name, page, errors, blocked }

try {
  let main, mobile;

  await step('Boot retrato 390x844 (touch)', async () => {
    mobile = await openPage(browser, url, { width: 390, height: 844, isMobile: true, hasTouch: true });
    collectors.push({ name: 'retrato', ...mobile });
    main = mobile.page;
    await waitStart(main);
    check(await main.getByText('Auvalanche!').first().isVisible(), 'título "Auvalanche!" não visível');
    check(await main.locator('#auv-play').isVisible(), 'botão JOGAR não visível');
    const txt = (await main.locator('#auv-play').innerText()).trim();
    check(/JOGAR/i.test(txt), `texto do botão: "${txt}"`);
    const w = await main.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(w.sw <= w.iw, `scrollWidth ${w.sw} > innerWidth ${w.iw}`);
    await shot(main, '01-inicio-retrato.png');
  });

  await step('Jogar pelo clique', async () => {
    await main.click('#auv-play');
    await main.waitForFunction(() => window.__game.screen === 'hud' && window.__game.state.status === 'playing', null, { timeout: 10000 });
  });

  await step('Tiro', async () => {
    await main.evaluate(() => {
      const g = window.__game;
      g.pauseLoop(true);
      g.setInput({ targetX: -2.5, firing: true });
      g.step(2);
    });
    const s = await snap(main);
    check(s.stats.fired >= 9, `stats.fired = ${s.stats.fired} (esperado >= 9)`);
    check(s.puppies > 0, `puppies.count = ${s.puppies}`);
    await main.evaluate(() => window.__game.setInput({ targetX: 0, firing: false }));
  });

  await step('Portoes (mul, sub, add, div)', async () => {
    const cases = [
      ['mul', 3, 'sub', 3, -2.5, 30, 'mul 3'],
      ['mul', 3, 'sub', 3, 2.5, 7, 'sub 3'],
      ['add', 5, 'div', 2, -2.5, 15, 'add 5'],
      ['add', 5, 'div', 2, 2.5, 5, 'div 2'],
    ];
    for (const [og, vg, ob, vb, x, expected, name] of cases) {
      await custom(main, gateLevel(og, vg, ob, vb));
      const count = await main.evaluate((x) => {
        const g = window.__game;
        g.spawnPuppies(10, x, -9.5, 0);
        g.step(0.2);
        return g.state.puppies.count;
      }, x);
      check(count === expected, `${name}: count = ${count}, esperado ${expected}`);
    }
  });

  await step('Combate (gatos e filhotes se anulam)', async () => {
    await custom(main, emptyLevel());
    const r = await main.evaluate(() => {
      const g = window.__game;
      g.spawnCats(5, 0);
      const cs = g.state.cats;
      const pos = [];
      for (let i = 0; i < cs.count; i++) pos.push([cs.x[i], cs.z[i]]);
      for (const [x, z] of pos) g.spawnPuppies(1, x, z + 4, 0);
      let t = 0;
      while (g.state.cats.count > 0 && t < 5) { g.step(0.1); t += 0.1; }
      return { cats: g.state.cats.count, puppies: g.state.puppies.count, killed: g.state.stats.catsKilled, spawned: pos.length };
    });
    check(r.spawned === 5, `spawnCats gerou ${r.spawned}`);
    check(r.cats === 0 && r.puppies === 0, `sobraram gatos=${r.cats} filhotes=${r.puppies}`);
    check(r.killed === 5, `catsKilled = ${r.killed}`);
  });

  await step('Dogao', async () => {
    const def = emptyLevel();
    def.towerHp = 5000;
    await custom(main, def);
    const r = await main.evaluate(() => {
      const g = window.__game;
      const before = g.state.tower.hp;
      g.fillSuper();
      g.super();
      const active = g.state.superDog.active;
      g.step(8);
      return { before, after: g.state.tower.hp, active };
    });
    check(r.active === true, 'superDog.active não ficou true após super()');
    check(r.after < r.before, `tower.hp ${r.before} -> ${r.after} (não diminuiu)`);
  });

  let coinsBeforeWin = 0;
  await step('Vitoria real com bot (fase 1)', async () => {
    await main.evaluate(() => window.__game.reset());
    await main.waitForFunction(() => window.__game.screen === 'start');
    coinsBeforeWin = (await snap(main)).coins;
    const r = await runBot(main, { level: 1 });
    check(r.status === 'won', `bot terminou com status '${r.status}' em ${r.time.toFixed(1)} s simulados`);
    await main.evaluate(() => { window.__game.finishEnding(); });
    await main.waitForFunction(() => window.__game.screen === 'win', null, { timeout: 5000 });
    check(await main.getByText('VITÓRIA!').first().isVisible(), 'texto "VITÓRIA!" não visível');
    await shot(main, '02-vitoria.png');
    const s = await snap(main);
    check(s.coins > coinsBeforeWin, `moedas ${coinsBeforeWin} -> ${s.coins}`);
  });

  await step('Melhorias (comprar, jogar fase 2)', async () => {
    await main.click('#auv-next');
    await main.waitForFunction(() => window.__game.screen === 'upgrades', null, { timeout: 5000 });
    await main.evaluate(() => window.__game.grantCoins(500));
    const before = await snap(main);
    await main.click('[data-buy="fireRate"]');
    await main.waitForFunction(() => window.__game.save.upgrades.fireRate === 1, null, { timeout: 5000 });
    const after = await snap(main);
    check(after.fireRateLvl === 1, `fireRate nível ${after.fireRateLvl}`);
    check(after.coins < before.coins, `moedas ${before.coins} -> ${after.coins} (não descontou)`);
    await shot(main, '03-melhorias.png');
    await main.click('#auv-play-level');
    await main.waitForFunction(() => window.__game.state.level === 2 && window.__game.state.status === 'playing', null, { timeout: 5000 });
  });

  await step('Derrota real (sem atirar, fase 1)', async () => {
    const r = await runBot(main, { level: 1, aim: false });
    check(r.status === 'lost', `status '${r.status}' após ${r.time.toFixed(1)} s simulados`);
    await main.evaluate(() => { window.__game.finishEnding(); });
    await main.waitForFunction(() => window.__game.screen === 'lose', null, { timeout: 5000 });
    check(await main.getByText('Tentar de novo').first().isVisible(), '"Tentar de novo" não visível');
    await shot(main, '04-derrota.png');
    await main.evaluate(() => window.__game.pauseLoop(false));
    await main.click('#auv-retry');
    await main.waitForFunction(() => window.__game.state.status === 'playing' && window.__game.state.level === 1, null, { timeout: 5000 });
  });

  await step('Persistencia (reload) e localStorage lancando', async () => {
    await main.evaluate(() => window.__game.pauseLoop(true));
    const before = await snap(main);
    await main.reload();
    await waitStart(main);
    const after = await snap(main);
    check(after.coins === before.coins, `moedas ${before.coins} -> ${after.coins} após reload`);
    check(after.fireRateLvl === before.fireRateLvl && after.fireRateLvl >= 1, `fireRate ${before.fireRateLvl} -> ${after.fireRateLvl}`);

    // Segundo contexto com Storage lançando.
    const bad = await openPage(browser, url, { width: 390, height: 844, isMobile: true, hasTouch: true });
    collectors.push({ name: 'storage-quebrado', ...bad });
    await bad.context.addInitScript(() => {
      Storage.prototype.getItem = function () { throw new Error('storage bloqueado'); };
      Storage.prototype.setItem = function () { throw new Error('storage bloqueado'); };
    });
    await bad.page.reload();
    await waitStart(bad.page);
    await bad.page.click('#auv-play');
    await bad.page.waitForFunction(() => window.__game.screen === 'hud' && window.__game.state.status === 'playing', null, { timeout: 10000 });
    await bad.page.evaluate(() => {
      const g = window.__game;
      g.pauseLoop(true);
      g.setInput({ targetX: 1, firing: true });
      g.step(1);
      g.forceWin();
      g.finishEnding();
    });
    await bad.page.waitForFunction(() => window.__game.screen === 'win', null, { timeout: 5000 });
    const s = await snap(bad.page);
    check(s.stats.fired > 0, 'sem tiros no contexto com storage quebrado');
  });

  await step('Estresse (800 filhotes + 300 gatos)', async () => {
    await main.evaluate(() => {
      const g = window.__game;
      g.pauseLoop(true);
      g.start(6);
      g.setInput({ targetX: 0, firing: false });
      for (let i = 0; i < 4; i++) g.spawnPuppies(200, -3 + i * 2, -3 - i, 0);
      g.spawnCats(300, 0);
    });
    const r = await main.evaluate(() => {
      const g = window.__game;
      const n = 120;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) g.step(1 / 60);
      const avg = (performance.now() - t0) / n;
      return { avg, puppies: g.state.puppies.count, cats: g.state.cats.count };
    });
    console.log(`      step médio: ${r.avg.toFixed(2)} ms (filhotes ${r.puppies}, gatos ${r.cats})`);
    check(r.avg < 3, `step médio ${r.avg.toFixed(2)} ms (>= 3 ms)`);
    check(r.puppies <= 800 && r.cats <= 300, `caps violados: ${r.puppies}/${r.cats}`);
    // Meio de jogo renderizando.
    await main.evaluate(() => {
      const g = window.__game;
      g.start(6);
      g.setInput({ targetX: 0, firing: true });
      for (let i = 0; i < 4; i++) g.spawnPuppies(200, -3 + i * 2, -3 - i, 0);
      g.spawnCats(300, 0);
      g.pauseLoop(false);
    });
    await sleep(500);
    const info = await main.evaluate(() => window.__game.renderInfo());
    console.log(`      renderInfo: ${JSON.stringify(info)}`);
    check(info && info.drawCalls <= CFG.render.maxDrawCalls, `drawCalls = ${info && info.drawCalls} (> ${CFG.render.maxDrawCalls})`);
    await shot(main, '05-estresse-retrato.png');
    await main.evaluate(() => { window.__game.pauseLoop(true); window.__game.setInput({ targetX: 0, firing: false }); });
  });

  await step('Desktop 1280x720 (teclado)', async () => {
    const d = await openPage(browser, url, { width: 1280, height: 720 });
    collectors.push({ name: 'desktop', ...d });
    const p = d.page;
    await waitStart(p);
    await shot(p, '06-inicio-desktop.png');
    await p.click('#auv-play');
    await p.waitForFunction(() => window.__game.screen === 'hud' && window.__game.state.status === 'playing', null, { timeout: 10000 });
    await p.evaluate(() => { window.__game.pauseLoop(false); window.__game.setInput({ targetX: 0, firing: false }); });
    await p.keyboard.down('d');
    await sleep(300);
    await p.keyboard.up('d');
    const x = (await snap(p)).cannonX;
    check(x > 0, `cannonX = ${x} após segurar D`);
    const f0 = (await snap(p)).stats.fired;
    await p.keyboard.down('Space');
    await sleep(500);
    await p.keyboard.up('Space');
    const f1 = (await snap(p)).stats.fired;
    check(f1 > f0, `fired ${f0} -> ${f1} após Espaço`);
    await shot(p, '07-jogo-desktop.png');
  });

  const tableRows = [];
  await step('Fechamento (erros) e tabela do bot', async () => {
    // Tabela do bot (informativa), fases 1..10 sem melhorias.
    for (let L = 1; L <= 10; L++) {
      try {
        await main.evaluate(() => window.__game.reset());
        const r = await runBot(main, { level: L, maxSec: 90 });
        tableRows.push({ fase: L, resultado: r.status === 'playing' ? 'timeout' : r.status, 'tempo_s': +r.time.toFixed(1) });
      } catch (e) {
        tableRows.push({ fase: L, resultado: 'erro: ' + e.message, 'tempo_s': NaN });
      }
    }
    console.log('\n      Tabela do bot (sem melhorias, 90 s max):');
    console.table(tableRows);

    const problems = [];
    for (const c of collectors) {
      if (c.errors.length) problems.push(`${c.name}: errors ${JSON.stringify(c.errors)}`);
      if (c.blocked.length) problems.push(`${c.name}: blocked ${JSON.stringify(c.blocked)}`);
      let ge = [];
      try { ge = await c.page.evaluate(() => (window.__game ? window.__game.errors.map(String) : [])); } catch {}
      if (ge.length) problems.push(`${c.name}: __game.errors ${JSON.stringify(ge)}`);
    }
    check(problems.length === 0, '\n      ' + problems.join('\n      '));
  });
} catch (e) {
  failures.push('fatal: ' + (e && e.stack ? e.stack : e));
  console.log('FAIL  erro fatal:', e);
} finally {
  try { await browser.close(); } catch {}
  if (server) server.stop();
}

console.log(failures.length ? `\nRESULTADO: ${failures.length} falha(s)\n - ${failures.join('\n - ')}` : '\nRESULTADO: tudo passou');
process.exit(failures.length ? 1 : 0);
