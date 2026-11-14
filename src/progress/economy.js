// Moedas, custos e melhorias (PLANO 2.2).
import { CFG } from '../config.js';
import { STR } from '../strings.js';

export function round5(x) {
  return Math.round(x / 5) * 5;
}

export function upgradeCost(id, currentLevel) {
  const u = CFG.upgrades[id];
  if (!u || id === 'growth') return null;
  if (currentLevel >= u.max) return null;
  return round5(u.base * Math.pow(CFG.upgrades.growth, currentLevel));
}

export function computeMods(save) {
  const up = (save && save.upgrades) || {};
  const f = up.fireRate | 0, s = up.super | 0, b = up.baseHp | 0;
  const sd = CFG.superDog;
  return {
    fireRate: CFG.fire.baseRate + CFG.fire.perLevel * f,
    baseHp: CFG.base.hpBase + CFG.base.hpPerLevel * b,
    superNeed: Math.max(sd.needMin, sd.needBase - sd.needPerLevel * s),
    superPower: sd.powerBase + sd.powerPerLevel * s,
  };
}

export function rewardFor(levelDef, { won, towerDamageFrac, baseHp }) {
  const L = levelDef.level;
  const R = CFG.rewards;
  if (won) return Math.round(R.winBase + R.winPerLevel * L + R.winPerBaseHp * Math.max(0, baseHp || 0));
  const frac = Math.min(1, Math.max(0, towerDamageFrac || 0));
  return Math.round((R.loseBase + R.losePerLevel * L) * frac);
}

const META = {
  fireRate: { name: STR.upFireRateName, desc: STR.upFireRateDesc },
  super: { name: STR.upSuperName, desc: STR.upSuperDesc },
  baseHp: { name: STR.upBaseHpName, desc: STR.upBaseHpDesc },
};

function valueText(id, mods) {
  if (id === 'fireRate') return `${mods.fireRate.toFixed(1)}/s`;
  if (id === 'super') return `${mods.superNeed} pts`;
  return `${mods.baseHp} ❤`;
}

export function upgradeItems(save) {
  const mods = computeMods(save);
  return ['fireRate', 'super', 'baseHp'].map((id) => {
    const level = save.upgrades[id] | 0;
    const cost = upgradeCost(id, level);
    return {
      id,
      name: META[id].name,
      desc: META[id].desc,
      level,
      maxLevel: CFG.upgrades[id].max,
      cost,
      canAfford: cost !== null && save.coins >= cost,
      valueText: valueText(id, mods),
    };
  });
}

export function buyUpgrade(save, id) {
  if (!META[id]) return false;
  const level = save.upgrades[id] | 0;
  const cost = upgradeCost(id, level);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[id] = level + 1;
  return true;
}
