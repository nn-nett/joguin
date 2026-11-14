// Auvalanche! — Simulação determinística (sem THREE, sem DOM).
import { CFG } from '../config.js';
import { makeRng } from '../util/rng.js';
import { createGrid } from './grid.js';

const TAU = Math.PI * 2;
const MAX_CLASH_EVENTS = 16;

function gateLabel(op, v) {
  if (op === 'mul') return 'x' + v;
  if (op === 'add') return '+' + v;
  if (op === 'sub') return '-' + v;
  return '÷' + v;
}

export function createSim() {
  const PC = CFG.puppy.cap;
  const CC = CFG.cat.cap;
  const L = CFG.lane;

  const state = {
    status: 'idle',
    time: 0,
    level: 0,
    cannonX: 0,
    firing: false,
    puppies: {
      count: 0,
      x: new Float32Array(PC),
      z: new Float32Array(PC),
      vx: new Float32Array(PC),
      phase: new Float32Array(PC),
      born: new Float32Array(PC),
      variant: new Uint8Array(PC),
      row: new Uint8Array(PC),
    },
    cats: {
      count: 0,
      x: new Float32Array(CC),
      z: new Float32Array(CC),
      phase: new Float32Array(CC),
      hp: new Uint8Array(CC),
      kind: new Uint8Array(CC),
    },
    superDog: { active: false, x: 0, z: 0, power: 0 },
    gates: [],
    tower: { hp: 0, maxHp: 0 },
    base: { hp: 0, maxHp: 0 },
    superPoints: 0,
    superNeed: CFG.superDog.needBase,
    stats: { fired: 0, cloned: 0, catsKilled: 0, towerDamage: 0, peakPuppies: 0 },
  };

  const P = state.puppies;
  const C = state.cats;
  const SD = state.superDog;

  let rng = makeRng(1);
  let events = [];
  let targetX = 0;

  // Parâmetros do nível/mods.
  let rows = [];
  let R = 0;
  let rowZ = new Float64Array(8);
  let rowStart = new Int32Array(8);
  let rowEnd = new Int32Array(8);
  let steerZ = CFG.lane.gateZoneFar;
  let fireRate = CFG.fire.baseRate;
  let superPower = CFG.superDog.powerBase;
  let catCfg = { rate: 0, ramp: CFG.waves.ramp, burstEvery: 0, burstSize: 0, speed: CFG.cat.speedBase, fatChance: 0 };
  let levelNum = 1;

  // Estado dos gerados.
  let fireAcc = 0;
  let catAcc = 0;
  let burstTimer = 0;
  let burstLeft = 0;
  let burstAcc = 0;
  let superReadyEmitted = false;
  let gN = new Int32Array(16); // efeito por portão neste passo
  let towerHitN = 0;
  let clashCount = 0;
  let needCompact = false;

  const grid = createGrid(
    -(L.halfWidth + 1),
    L.halfWidth + 1,
    L.towerZ - 2,
    L.baseLineZ + 2,
    CFG.collision.cell,
    CC + 8,
  );

  // ---------- helpers ----------
  function emit(e) {
    events.push(e);
  }

  function removePuppy(i) {
    const last = P.count - 1;
    if (i !== last) {
      P.x[i] = P.x[last];
      P.z[i] = P.z[last];
      P.vx[i] = P.vx[last];
      P.phase[i] = P.phase[last];
      P.born[i] = P.born[last];
      P.variant[i] = P.variant[last];
      P.row[i] = P.row[last];
    }
    P.count = last;
  }

  function removeCat(i) {
    const last = C.count - 1;
    if (i !== last) {
      C.x[i] = C.x[last];
      C.z[i] = C.z[last];
      C.phase[i] = C.phase[last];
      C.hp[i] = C.hp[last];
      C.kind[i] = C.kind[last];
    }
    C.count = last;
  }

  function addPuppy(x, z, vx, row) {
    const n = P.count;
    if (n >= PC) return false;
    P.x[n] = x;
    P.z[n] = z;
    P.vx[n] = vx;
    P.phase[n] = rng.next() * TAU;
    P.born[n] = state.time;
    P.variant[n] = (rng.next() * CFG.puppy.variants) | 0;
    P.row[n] = row;
    P.count = n + 1;
    return true;
  }

  function addCat(kind) {
    const n = C.count;
    if (n >= CC) return false;
    C.x[n] = (rng.next() * 2 - 1) * CFG.cat.spawnHalfWidth;
    C.z[n] = L.catSpawnZ;
    C.phase[n] = rng.next() * TAU;
    C.kind[n] = kind;
    C.hp[n] = kind === 1 ? CFG.fatCat.hp : CFG.cat.hp;
    C.count = n + 1;
    return true;
  }


  function spawnCatRandom() {
    let kind = 0;
    if (levelNum >= CFG.fatCat.fromLevel && catCfg.fatChance > 0 && rng.next() < catCfg.fatChance) kind = 1;
    addCat(kind);
  }

  function compactCats() {
    for (let i = C.count - 1; i >= 0; i--) {
      if (C.hp[i] === 0) removeCat(i);
    }
    needCompact = false;
  }

  function pushClash(x, z, kind) {
    if (clashCount < MAX_CLASH_EVENTS) {
      clashCount++;
      emit({ type: 'clash', x, z, kind });
    }
  }

  // ---------- portões ----------
  // Aplica o portão gi ao filhote i. Retorna true se o filhote foi removido.
  function applyGate(g, gi, i, x, z, nextRow) {
    const op = g.op;
    if (op === 'mul') {
      const k = g.value - 1;
      let made = 0;
      for (let c = 0; c < k; c++) {
        if (!addPuppy(x, z - rng.next() * 0.1, (rng.next() * 2 - 1) * CFG.puppy.cloneVx, nextRow)) break;
        made++;
      }
      if (made > 0) {
        state.stats.cloned += made;
        gN[gi] += made;
        g.lastTrigger = state.time;
      }
      return false;
    }
    if (op === 'add') {
      if (state.time >= g.cdUntil) {
        g.cdUntil = state.time + CFG.gates.addCooldown;
        let made = 0;
        for (let c = 0; c < g.value; c++) {
          if (!addPuppy(x, z - rng.next() * 0.1, (rng.next() * 2 - 1) * CFG.puppy.cloneVx, nextRow)) break;
          made++;
        }
        state.stats.cloned += made;
        gN[gi] += made;
        g.lastTrigger = state.time;
      }
      return false;
    }
    if (op === 'sub') {
      if (g.budget > 0) {
        g.budget--;
        gN[gi]++;
        g.lastTrigger = state.time;
        removePuppy(i);
        return true;
      }
      return false;
    }
    // div
    g.counter++;
    if ((g.counter & 1) === 0) {
      gN[gi]++;
      g.lastTrigger = state.time;
      removePuppy(i);
      return true;
    }
    return false;
  }

  // ---------- colisão ----------
  let cpx = 0;
  let cpz = 0;
  let cHit = false;
  const rP = CFG.puppy.radius;
  const hitRadiusNormal = rP + CFG.cat.radius;
  const hitRadiusFat = rP + CFG.fatCat.radius;
  const onCat = (ci) => {
    if (C.hp[ci] === 0) return false;
    const fat = C.kind[ci] === 1;
    const rr = fat ? hitRadiusFat : hitRadiusNormal;
    const dx = C.x[ci] - cpx;
    const dz = C.z[ci] - cpz;
    if (dx * dx + dz * dz < rr * rr) {
      C.hp[ci]--;
      pushClash(cpx, cpz, fat ? 1 : 0);
      if (C.hp[ci] === 0) {
        state.stats.catsKilled++;
        state.superPoints += CFG.superDog.pointsPerKill;
        needCompact = true;
      }
      cHit = true;
      return true;
    }
    return false;
  };

  // ---------- API ----------
  function startLevel(levelDef, mods) {
    rng = makeRng(levelDef.seed);
    levelNum = levelDef.level;
    rows = levelDef.rows || [];
    R = rows.length;
    if (rowZ.length < R) {
      rowZ = new Float64Array(R);
      rowStart = new Int32Array(R);
      rowEnd = new Int32Array(R);
    }
    state.gates.length = 0;
    let id = 0;
    for (let r = 0; r < R; r++) {
      rowZ[r] = rows[r].z;
      rowStart[r] = state.gates.length;
      const gs = rows[r].gates;
      for (let k = 0; k < gs.length; k++) {
        const d = gs[k];
        state.gates.push({
          id: id++,
          row: r,
          z: rows[r].z,
          x: d.moving ? d.moving.amp * Math.sin(d.moving.phase) : d.x,
          halfWidth: d.halfWidth,
          op: d.op,
          value: d.value,
          good: d.op === 'mul' || d.op === 'add',
          label: gateLabel(d.op, d.value),
          moving: d.moving || null,
          lastTrigger: -10,
          // internos
          budget: d.value,
          nextRefill: CFG.gates.subRefill,
          cdUntil: 0,
          counter: 0,
        });
      }
      rowEnd[r] = state.gates.length;
    }
    if (gN.length < state.gates.length) gN = new Int32Array(state.gates.length);
    gN.fill(0);
    steerZ = R > 0 ? rows[R - 1].z : -1e9; // sem portões: sem direcionamento

    const m = mods || {};
    fireRate = m.fireRate != null ? m.fireRate : CFG.fire.baseRate;
    superPower = m.superPower != null ? m.superPower : CFG.superDog.powerBase;
    state.superNeed = m.superNeed != null ? m.superNeed : CFG.superDog.needBase;
    const baseHp = m.baseHp != null ? m.baseHp : CFG.base.hpBase;

    const cc = levelDef.cats || {};
    catCfg = {
      rate: cc.rate || 0,
      ramp: cc.ramp || CFG.waves.ramp,
      burstEvery: cc.burstEvery || 0,
      burstSize: cc.burstSize || 0,
      speed:
        cc.speed != null
          ? cc.speed
          : Math.min(CFG.cat.speedBase + CFG.cat.speedPerLevel * (levelNum - 1), CFG.cat.speedMax),
      fatChance: cc.fatChance || 0,
    };

    state.status = 'playing';
    state.time = 0;
    state.level = levelNum;
    state.cannonX = 0;
    state.firing = false;
    targetX = 0;
    P.count = 0;
    C.count = 0;
    SD.active = false;
    SD.x = 0;
    SD.z = 0;
    SD.power = 0;
    state.tower.maxHp = levelDef.towerHp;
    state.tower.hp = levelDef.towerHp;
    state.base.maxHp = baseHp;
    state.base.hp = baseHp;
    state.superPoints = 0;
    const s = state.stats;
    s.fired = 0;
    s.cloned = 0;
    s.catsKilled = 0;
    s.towerDamage = 0;
    s.peakPuppies = 0;
    fireAcc = 0;
    catAcc = 0;
    burstTimer = 0;
    burstLeft = 0;
    burstAcc = 0;
    superReadyEmitted = false;
    needCompact = false;
    events = [];
  }

  function setInput(inp) {
    const m = CFG.cannon.maxX;
    let t = inp.targetX;
    if (!(t === t)) t = 0;
    targetX = t < -m ? -m : t > m ? m : t;
    state.firing = !!inp.firing;
  }

  function requestSuper() {
    if (state.status !== 'playing' || SD.active) return false;
    if (state.superPoints < state.superNeed) return false;
    state.superPoints -= state.superNeed;
    if (state.superPoints < 0) state.superPoints = 0;
    superReadyEmitted = false;
    SD.active = true;
    SD.x = state.cannonX;
    SD.z = 0;
    SD.power = superPower;
    emit({ type: 'superLaunch', x: SD.x });
    return true;
  }

  function finishWin() {
    state.status = 'won';
    emit({ type: 'win' });
  }
  function finishLose() {
    state.status = 'lost';
    emit({ type: 'lose' });
  }

  function step(dt) {
    if (state.status !== 'playing') return;
    const pu = CFG.puppy;
    const catC = CFG.cat;
    const fatC = CFG.fatCat;
    clashCount = 0;
    towerHitN = 0;

    // 1. tempo e canhão
    state.time += dt;
    const time = state.time;
    {
      const k = CFG.cannon.followRate * dt;
      state.cannonX += (targetX - state.cannonX) * (k < 1 ? k : 1);
    }

    // 2. portões móveis, recarga dos "sub"
    const gates = state.gates;
    const G = gates.length;
    for (let gi = 0; gi < G; gi++) {
      const g = gates[gi];
      const mv = g.moving;
      if (mv !== null) g.x = mv.amp * Math.sin(mv.omega * time + mv.phase);
      if (g.op === 'sub' && time >= g.nextRefill) {
        g.budget = g.value;
        g.nextRefill = time + CFG.gates.subRefill;
      }
    }

    // 3. tiro
    if (state.firing) {
      fireAcc += fireRate * dt;
      let shots = 0;
      while (fireAcc >= 1) {
        fireAcc -= 1;
        const jx = (rng.next() * 2 - 1) * pu.jitterX;
        if (addPuppy(state.cannonX + jx, CFG.cannon.muzzleZ, 0, 0)) {
          state.stats.fired++;
          shots++;
        }
      }
      if (shots > 0) emit({ type: 'fire', x: state.cannonX });
    } else {
      fireAcc = 0;
    }

    // 4. spawn de gatos
    if (catCfg.rate > 0) {
      catAcc += catCfg.rate * (1 + time / catCfg.ramp) * dt;
      while (catAcc >= 1) {
        catAcc -= 1;
        spawnCatRandom();
      }
    }
    if (catCfg.burstEvery > 0 && catCfg.burstSize > 0) {
      burstTimer += dt;
      if (burstTimer >= catCfg.burstEvery) {
        burstTimer -= catCfg.burstEvery;
        burstLeft += catCfg.burstSize;
        emit({ type: 'wave', size: catCfg.burstSize });
      }
      if (burstLeft > 0) {
        burstAcc += (catCfg.burstSize / CFG.waves.burstDuration) * dt;
        while (burstAcc >= 1 && burstLeft > 0) {
          burstAcc -= 1;
          burstLeft--;
          spawnCatRandom();
        }
        if (burstLeft === 0) burstAcc = 0;
      }
    }

    // 5. filhotes
    {
      const px = P.x, pz = P.z, pvx = P.vx, prow = P.row;
      const speed = pu.speed * dt;
      const vxDecay = Math.exp(-pu.vxDecay * dt);
      const xmax = L.halfWidth - 0.3;
      const hitZ = L.towerHitZ;
      const steerK = 0.8 * dt;
      const pc0 = P.count;
      for (let i = pc0 - 1; i >= 0; i--) {
        let x = px[i] + pvx[i] * dt;
        const z = pz[i] - speed;
        pvx[i] *= vxDecay;
        if (z < steerZ && prow[i] >= R) x -= x * steerK;
        if (x < -xmax) {
          x = -xmax;
          pvx[i] = 0;
        } else if (x > xmax) {
          x = xmax;
          pvx[i] = 0;
        }
        px[i] = x;
        pz[i] = z;

        let removed = false;
        let row = prow[i];
        while (row < R && z <= rowZ[row]) {
          const e = rowEnd[row];
          let hit = -1;
          for (let gi = rowStart[row]; gi < e; gi++) {
            const g = gates[gi];
            const d = x - g.x;
            if ((d < 0 ? -d : d) <= g.halfWidth) {
              hit = gi;
              break;
            }
          }
          row++;
          prow[i] = row;
          if (hit >= 0 && applyGate(gates[hit], hit, i, x, z, row)) {
            removed = true;
            break;
          }
        }
        if (removed) continue;

        if (z <= hitZ) {
          if (state.tower.hp > 0) {
            state.tower.hp -= 1;
            state.stats.towerDamage += 1;
            state.superPoints += CFG.superDog.pointsPerTowerDamage;
            towerHitN++;
          }
          removePuppy(i);
        }
      }
      for (let gi = 0; gi < G; gi++) {
        const n = gN[gi];
        if (n > 0) {
          const g = gates[gi];
          emit({ type: 'gate', gateId: g.id, good: g.good, x: g.x, z: g.z, n });
          gN[gi] = 0;
        }
      }
      if (P.count > state.stats.peakPuppies) state.stats.peakPuppies = P.count;
    }

    // 6. gatos
    {
      const cx = C.x, cz = C.z, ph = C.phase, kind = C.kind;
      const chaseZ = catC.chaseZ;
      const chaseMax = catC.chaseSpeed * dt;
      const wob = catC.wobble * dt;
      const baseZ = L.baseLineZ;
      const cannonX = state.cannonX;
      const xmax = L.halfWidth - 0.3;
      const spN = catCfg.speed * dt;
      const spF = spN * fatC.speedMul;
      for (let i = C.count - 1; i >= 0; i--) {
        const z = cz[i] + (kind[i] === 1 ? spF : spN);
        let x = cx[i] + Math.cos(time * 2.5 + ph[i]) * wob;
        if (z > chaseZ) {
          const d = cannonX - x;
          x += d > chaseMax ? chaseMax : d < -chaseMax ? -chaseMax : d;
        }
        if (x < -xmax) x = -xmax;
        else if (x > xmax) x = xmax;
        cx[i] = x;
        cz[i] = z;
        if (z >= baseZ) {
          const dmg = kind[i] === 1 ? fatC.baseDamage : catC.baseDamage;
          state.base.hp -= dmg;
          emit({ type: 'baseHit', dmg, x });
          removeCat(i);
        }
      }
      if (state.base.hp < 0) state.base.hp = 0;
    }

    // 7. colisões filhote x gato
    if (P.count > 0 && C.count > 0) {
      grid.clear();
      const cx = C.x, cz = C.z, hp = C.hp;
      for (let i = 0, n = C.count; i < n; i++) {
        if (hp[i] > 0) grid.insert(i, cx[i], cz[i]);
      }
      const px = P.x, pz = P.z;
      for (let i = P.count - 1; i >= 0; i--) {
        cpx = px[i];
        cpz = pz[i];
        cHit = false;
        grid.query(cpx, cpz, onCat);
        if (cHit) removePuppy(i);
      }
      if (needCompact) compactCats();
    }

    // 8. Dogão
    if (SD.active) {
      SD.z -= CFG.superDog.speed * dt;
      const rD = CFG.superDog.radius;
      const cx = C.x, cz = C.z, hp = C.hp, kind = C.kind;
      for (let i = 0, n = C.count; i < n && SD.power > 0; i++) {
        if (hp[i] === 0) continue;
        const rr = rD + (kind[i] === 1 ? fatC.radius : catC.radius);
        const dx = cx[i] - SD.x;
        const dz = cz[i] - SD.z;
        if (dx * dx + dz * dz < rr * rr) {
          hp[i] = 0;
          needCompact = true;
          state.stats.catsKilled++;
          state.superPoints += CFG.superDog.pointsPerKill;
          SD.power -= kind[i] === 1 ? fatC.superCost : 1;
          pushClash(cx[i], cz[i], kind[i]);
        }
      }
      if (needCompact) compactCats();
      if (SD.z <= L.towerHitZ || SD.power <= 0) {
        let dmg = 0;
        if (SD.z <= L.towerHitZ && SD.power > 0) {
          dmg = Math.min(SD.power, state.tower.hp);
          state.tower.hp -= dmg;
          state.stats.towerDamage += dmg;
          state.superPoints += CFG.superDog.pointsPerTowerDamage * dmg;
          towerHitN += dmg;
        }
        SD.active = false;
        emit({ type: 'superEnd', x: SD.x, z: SD.z, dmg });
      }
    }
    if (towerHitN > 0) emit({ type: 'towerHit', n: towerHitN });

    // 9. medidor, vitória/derrota
    if (state.superPoints > state.superNeed) state.superPoints = state.superNeed;
    if (!superReadyEmitted && !SD.active && state.superPoints >= state.superNeed) {
      superReadyEmitted = true;
      emit({ type: 'superReady' });
    }
    if (state.tower.hp <= 0) finishWin();
    else if (state.base.hp <= 0) finishLose();
  }

  function drainEvents() {
    const e = events;
    events = [];
    return e;
  }

  const debug = {
    forceWin() {
      if (state.status !== 'playing') return;
      state.tower.hp = 0;
      finishWin();
    },
    forceLose() {
      if (state.status !== 'playing') return;
      state.base.hp = 0;
      finishLose();
    },
    fillSuper() {
      state.superPoints = state.superNeed;
      if (!superReadyEmitted && !SD.active && state.status === 'playing') {
        superReadyEmitted = true;
        emit({ type: 'superReady' });
      }
    },
    spawnPuppies(n, x, z, row = 0) {
      for (let i = 0; i < n; i++) {
        if (!addPuppy(x, z, 0, row)) break;
      }
      if (P.count > state.stats.peakPuppies) state.stats.peakPuppies = P.count;
    },
    spawnCats(n, kind = 0) {
      for (let i = 0; i < n; i++) {
        if (!addCat(kind)) break;
      }
    },
    clearCats() {
      C.count = 0;
    },
  };

  return { state, startLevel, setInput, requestSuper, step, drainEvents, debug };
}
