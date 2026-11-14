// Auvalanche! — constantes e tuning compartilhados.
// Coordenadas: X atravessa a pista, Y para cima, Z comprimento.
// Canhão em z=0; filhotes andam para −Z; gatos andam para +Z; torre em z=-48.

export const CFG = {
  sim: { dt: 1 / 60, maxSteps: 4 },

  lane: {
    halfWidth: 5,
    length: 48,
    towerZ: -48,
    towerHitZ: -45.5,
    catSpawnZ: -44,
    baseLineZ: 0.8,
    gateZoneNear: -9,
    gateZoneFar: -33,
  },

  cannon: { maxX: 4.0, followRate: 20, muzzleZ: -1.4, keyboardSpeed: 9 },

  puppy: {
    speed: 9,
    radius: 0.32,
    cap: 800,
    jitterX: 0.18,
    cloneVx: 1.6,
    vxDecay: 3,
    variants: 4,
  },

  cat: {
    speedBase: 2.6,
    speedPerLevel: 0.07,
    speedMax: 3.8,
    radius: 0.36,
    hp: 1,
    cap: 300,
    wobble: 0.25,
    chaseZ: -22,
    chaseSpeed: 0.6,
    baseDamage: 1,
    spawnHalfWidth: 4.3,
  },

  fatCat: {
    fromLevel: 3,
    chanceBase: 0.04,
    chancePerLevel: 0.01,
    chanceMax: 0.15,
    hp: 6,
    speedMul: 0.6,
    radius: 0.8,
    baseDamage: 3,
    superCost: 3,
  },

  collision: { cell: 1.25 },

  fire: { baseRate: 5, perLevel: 0.7 },

  base: { hpBase: 10, hpPerLevel: 2 },

  // hp(L) = 180 + 100·(L-1) + 14·(L-1)²  (F1 180, F5 804, F10 2214)
  tower: { hpA: 180, hpB: 100, hpC: 14, height: 9 },

  superDog: {
    needBase: 50,
    needPerLevel: 3,
    needMin: 20,
    pointsPerKill: 1,
    pointsPerTowerDamage: 0.5,
    powerBase: 40,
    powerPerLevel: 12,
    speed: 7,
    radius: 1.5,
  },

  waves: {
    rateBase: 1.0,
    ratePerLevel: 0.5,
    rateMax: 14,
    ramp: 45, // rate × (1 + t/ramp)
    burstEvery: 12,
    burstBase: 12,
    burstPerLevel: 5,
    burstMax: 90,
    burstDuration: 1.5,
  },

  gates: {
    pairX: 2.5,
    pairHalfWidth: 2.3,
    moverHalfWidthGood: 1.6,
    moverHalfWidthBad: 2.0,
    moverAmp: 3.0,
    moverOmegaBase: 0.9,
    moverOmegaPerLevel: 0.08,
    moverOmegaMax: 2.0,
    addCooldown: 0.5,
    subRefill: 1.0,
    maxMulProduct: 16,
    height: 2.2,
  },

  levelGen: { seedMul: 7919, rowsBase: 2, rowsMax: 5 },

  rewards: { winBase: 25, winPerLevel: 10, winPerBaseHp: 2, loseBase: 5, losePerLevel: 3 },

  upgrades: {
    fireRate: { base: 40, max: 10 },
    super: { base: 50, max: 10 },
    baseHp: { base: 30, max: 10 },
    growth: 1.55,
  },

  timing: { winDelay: 1.6, loseDelay: 1.2 },

  render: { maxPixelRatio: 2, slowFrameMs: 22, slowWindow: 2, maxDrawCalls: 50 },

  save: { key: 'auvalanche.save.v1' },

  colors: {
    skyTop: '#6EC6FF',
    skyBottom: '#BEE9FF',
    grass: '#7ED957',
    lane: '#FFE8B8',
    laneStripe: '#FFF6E0',
    fence: '#FF9F45',
    navy: '#1B2A49',
    yellow: '#FFC93C',
    yellowDark: '#D99A00',
    gateGood: '#2D9BF0',
    gateBad: '#F0483E',
    cannonRed: '#E8423F',
    puppyCaramel: '#D9A066',
    cat: '#8E6BD8',
    catBelly: '#C9B6F2',
    catEyes: '#FFE14D',
    fatCat: '#FF9A3C',
    white: '#FFFFFF',
  },
};
