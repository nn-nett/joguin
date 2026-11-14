// Auvalanche! — UI/HUD (DOM puro dentro de #ui-root)
import { STR, fmt } from '../strings.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svg(html, viewBox = '0 0 24 24') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.innerHTML = html;
  return s;
}

const SPEAKER = '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
  '<g class="auv-waves" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.3 6a9 9 0 0 1 0 12"/></g>' +
  '<g class="auv-x" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M16 9l5 6M21 9l-5 6"/></g>';
const PAW = '<g fill="#FFC93C" stroke="#1B2A49" stroke-width="3" stroke-linejoin="round">' +
  '<ellipse cx="14" cy="26" rx="7" ry="9"/><ellipse cx="30" cy="14" rx="7" ry="9"/><ellipse cx="50" cy="14" rx="7" ry="9"/><ellipse cx="66" cy="26" rx="7" ry="9"/>' +
  '<path d="M40 30c-11 0-22 12-22 24 0 7 6 10 13 9 5-1 6-2 9-2s4 1 9 2c7 1 13-2 13-9 0-12-11-24-22-24z"/></g>';
const DOG_ICON = '<g fill="currentColor" stroke="#1B2A49" stroke-width="1.6" stroke-linejoin="round"><path d="M4 8c0-3 2-5 4-4l3 3h2l3-3c2-1 4 1 4 4v6c0 4-4 7-8 7s-8-3-8-7V8z"/></g><circle cx="9" cy="12" r="1.3" fill="#1B2A49"/><circle cx="15" cy="12" r="1.3" fill="#1B2A49"/><ellipse cx="12" cy="15.5" rx="2" ry="1.4" fill="#1B2A49"/>';
const TROPHY = '<g stroke="#1B2A49" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M22 12h36v18a18 18 0 0 1-36 0z" fill="#FFC93C"/><path d="M22 18h-10c0 12 5 18 12 18M58 18h10c0 12-5 18-12 18" fill="none"/><path d="M40 48v12M28 66h24" fill="none"/><path d="M30 60h20v6H30z" fill="#FF9F45"/></g>';
const SAD_CAT = '<g stroke="#1B2A49" stroke-width="3" stroke-linejoin="round"><path d="M14 30L16 8l16 12h16l16-12 2 22c3 20-12 36-26 36S11 50 14 30z" fill="#8E6BD8"/></g><circle cx="30" cy="38" r="4.5" fill="#FFE14D" stroke="#1B2A49" stroke-width="2"/><circle cx="50" cy="38" r="4.5" fill="#FFE14D" stroke="#1B2A49" stroke-width="2"/><path d="M26 31l8 4M54 31l-8 4" stroke="#1B2A49" stroke-width="3.5" stroke-linecap="round"/><path d="M33 54q7-6 14 0" fill="none" stroke="#1B2A49" stroke-width="3" stroke-linecap="round"/>';

function button(id, label, cls) {
  const b = el('button', 'auv-btn' + (cls ? ' ' + cls : ''));
  b.type = 'button';
  if (id) b.id = id;
  const s = el('span', 'auv-btn-label', label);
  b.appendChild(s);
  return b;
}

function coinChip(extraCls) {
  const c = el('span', 'auv-chip' + (extraCls ? ' ' + extraCls : ''));
  c.appendChild(el('i', 'auv-coin'));
  const n = el('span', 'auv-num', '0');
  c.appendChild(n);
  return { chip: c, num: n };
}

export function createUI(root, handlers = {}) {
  const h = (name) => (...a) => { try { handlers[name] && handlers[name](...a); } catch (e) { console.error(e); } };
  root.textContent = '';
  let currentName = '';

  const screens = {};
  function mkScreen(name, cls) {
    const s = el('section', 'auv-screen ' + cls);
    s.dataset.screen = name;
    root.appendChild(s);
    screens[name] = s;
    return s;
  }

  // ---------------- START ----------------
  const start = mkScreen('start', 'auv-start');
  const startHead = el('div', 'auv-start-head');
  const logoWrap = el('div', 'auv-logo-wrap');
  const paw = el('span', 'auv-paw');
  paw.appendChild(svg(PAW, '0 0 80 76'));
  const logo = el('h1', 'auv-logo auv-outline');
  logo.setAttribute('aria-label', STR.title);
  [...STR.title].forEach((ch, i) => {
    const sp = el('span', ch === '!' ? 'auv-logo-bang' : '', ch);
    sp.style.setProperty('--i', String(i));
    sp.setAttribute('aria-hidden', 'true');
    logo.appendChild(sp);
  });
  logoWrap.append(paw, logo);
  const subtitle = el('p', 'auv-subtitle auv-outline', STR.subtitle);
  startHead.append(logoWrap, subtitle);

  const startPanel = el('div', 'auv-start-panel auv-panel');
  const meta = el('div', 'auv-start-meta');
  const levelChip = el('span', 'auv-chip auv-num', '');
  levelChip.id = 'auv-start-level';
  const startCoins = coinChip();
  startCoins.chip.id = 'auv-start-coins';
  startCoins.chip.setAttribute('aria-label', STR.coins);
  meta.append(levelChip, startCoins.chip);
  const btnPlay = button('auv-play', STR.play, 'auv-btn--big auv-btn--green');
  const btnOpenUp = button('auv-open-upgrades', STR.upgrades, 'auv-btn--ghost');
  const actions = el('div', 'auv-start-actions');
  actions.append(btnPlay, btnOpenUp);
  const hint = el('p', 'auv-hint', '');
  hint.id = 'auv-hint';
  startPanel.append(meta, actions, hint);
  start.append(startHead, startPanel);

  // ---------------- HUD ----------------
  const hud = mkScreen('hud', 'auv-hud');
  const top = el('div', 'auv-hud-top');
  const hudLeft = el('div', 'auv-hud-left');
  const levelPill = el('span', 'auv-pill', '');
  levelPill.id = 'auv-hud-level';
  hudLeft.appendChild(levelPill);

  const towerWrap = el('div', 'auv-bar-wrap');
  const towerLabel = el('div', 'auv-bar-label auv-outline', STR.hudTower);
  const towerBar = el('div', 'auv-bar');
  const towerFill = el('div', 'auv-bar-fill');
  const towerNum = el('div', 'auv-bar-num', '');
  towerBar.append(towerFill, towerNum);
  towerWrap.append(towerLabel, towerBar);

  const hudRight = el('div', 'auv-hud-right');
  const hudCoins = coinChip('auv-pill');
  hudCoins.chip.id = 'auv-hud-coins';
  hudCoins.chip.setAttribute('aria-label', STR.coins);
  const btnMute = el('button', 'auv-iconbtn');
  btnMute.type = 'button';
  btnMute.id = 'auv-mute';
  btnMute.setAttribute('aria-label', STR.mute);
  btnMute.appendChild(svg(SPEAKER));
  hudRight.append(hudCoins.chip, btnMute);
  top.append(hudLeft, towerWrap, hudRight);

  const bottom = el('div', 'auv-hud-bottom');
  const baseLabel = el('div', 'auv-bar-label auv-outline', STR.hudBase);
  const baseBar = el('div', 'auv-bar');
  const baseFill = el('div', 'auv-bar-fill auv-bar-fill--base');
  const baseNum = el('div', 'auv-bar-num', '');
  baseBar.append(baseFill, baseNum);
  const puppiesEl = el('div', 'auv-puppies auv-outline', '');
  puppiesEl.id = 'auv-puppies';
  bottom.append(baseLabel, baseBar, puppiesEl);

  const btnSuper = el('button', 'auv-super');
  btnSuper.type = 'button';
  btnSuper.id = 'auv-super';
  btnSuper.setAttribute('aria-label', STR.hudSuper);
  btnSuper.setAttribute('aria-disabled', 'true');
  const superInner = el('div', 'auv-super-inner');
  superInner.appendChild(svg(DOG_ICON));
  superInner.appendChild(el('span', '', STR.hudSuper));
  btnSuper.appendChild(superInner);

  const toasts = el('div', 'auv-toasts');
  toasts.setAttribute('aria-live', 'polite');
  hud.append(top, bottom, btnSuper, toasts);

  // ---------------- WIN ----------------
  const win = mkScreen('win', 'auv-end auv-end--win');
  const winPanel = el('div', 'auv-end-panel auv-panel');
  const winIcon = el('div', 'auv-end-emoji');
  winIcon.appendChild(svg(TROPHY, '0 0 80 76'));
  const winTitle = el('h2', 'auv-end-title auv-outline', STR.winTitle);
  const winText = el('p', 'auv-end-text', STR.winText);
  const winReward = el('div', 'auv-reward');
  winReward.id = 'auv-win-reward';
  winReward.appendChild(el('i', 'auv-coin'));
  const winRewardTxt = el('span', 'auv-num', '');
  winReward.appendChild(winRewardTxt);
  const winActions = el('div', 'auv-end-actions');
  const btnNext = button('auv-next', STR.continue, 'auv-btn--big auv-btn--green');
  winActions.appendChild(btnNext);
  winPanel.append(winIcon, winTitle, winText, winReward, winActions);
  win.appendChild(winPanel);

  // ---------------- LOSE ----------------
  const lose = mkScreen('lose', 'auv-end auv-end--lose');
  const losePanel = el('div', 'auv-end-panel auv-panel');
  const loseIcon = el('div', 'auv-end-emoji');
  loseIcon.appendChild(svg(SAD_CAT, '0 0 80 76'));
  const loseTitle = el('h2', 'auv-end-title auv-outline', STR.loseTitle);
  const loseText = el('p', 'auv-end-text', '');
  loseText.id = 'auv-lose-text';
  const loseReward = el('div', 'auv-reward');
  loseReward.id = 'auv-lose-reward';
  loseReward.appendChild(el('i', 'auv-coin'));
  const loseRewardTxt = el('span', 'auv-num', '');
  loseReward.appendChild(loseRewardTxt);
  const loseActions = el('div', 'auv-end-actions');
  const btnRetry = button('auv-retry', STR.retry, 'auv-btn--big auv-btn--green');
  const btnLoseUp = button('auv-lose-upgrades', STR.upgrades, 'auv-btn--ghost');
  loseActions.append(btnRetry, btnLoseUp);
  losePanel.append(loseIcon, loseTitle, loseText, loseReward, loseActions);
  lose.appendChild(losePanel);

  // ---------------- UPGRADES ----------------
  const upg = mkScreen('upgrades', 'auv-upg');
  const upgInner = el('div', 'auv-upg-inner');
  const upgHead = el('div', 'auv-upg-head');
  const upgTitle = el('h2', 'auv-upg-title auv-outline', STR.upgradesTitle);
  const upgCoins = coinChip();
  upgCoins.chip.id = 'auv-upg-coins';
  upgCoins.chip.setAttribute('aria-label', STR.coins);
  upgHead.append(upgTitle, upgCoins.chip);
  const cards = el('div', 'auv-cards');
  const upgFoot = el('div', 'auv-upg-foot');
  const btnPlayLevel = button('auv-play-level', fmt(STR.playLevel, { n: 1 }), 'auv-btn--big auv-btn--green');
  upgFoot.appendChild(btnPlayLevel);
  upgInner.append(upgHead, cards, upgFoot);
  upg.appendChild(upgInner);

  // ---------------- eventos ----------------
  const press = (b, fn) => b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  press(btnPlay, h('onPlay'));
  press(btnOpenUp, h('onOpenUpgrades'));
  press(btnLoseUp, h('onOpenUpgrades'));
  press(btnMute, h('onToggleMute'));
  press(btnNext, h('onNext'));
  press(btnRetry, h('onRetry'));
  press(btnPlayLevel, h('onPlay'));
  press(btnSuper, () => { if (btnSuper.classList.contains('is-ready')) h('onSuper')(); });

  // ---------------- toast ----------------
  function toast(text, kind = 'info') {
    const t = el('div', 'auv-toast' + (kind !== 'info' ? ' auv-toast--' + kind : ''), text);
    // empilha no máximo 3
    while (toasts.children.length >= 3) toasts.removeChild(toasts.firstChild);
    toasts.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }

  // ---------------- upgrades ----------------
  function renderUpgrades(data) {
    upgCoins.num.textContent = String(data.coins ?? 0);
    btnPlayLevel.firstChild.textContent = fmt(STR.playLevel, { n: data.nextLevel ?? 1 });
    cards.textContent = '';
    for (const it of data.items || []) {
      const card = el('div', 'auv-card auv-panel');
      card.dataset.upgrade = it.id;
      const name = el('div', 'auv-card-name');
      name.appendChild(document.createTextNode(it.name));
      name.appendChild(el('span', 'auv-card-lvl', fmt(STR.upLevel, { n: it.level })));
      const desc = el('div', 'auv-card-desc', it.desc);
      const pips = el('div', 'auv-pips');
      const maxL = it.maxLevel || 10;
      for (let i = 0; i < maxL; i++) pips.appendChild(el('i', 'auv-pip' + (i < it.level ? ' is-on' : '')));
      const val = el('div', 'auv-card-val', it.valueText || '');
      const buy = el('button', 'auv-btn');
      buy.type = 'button';
      buy.dataset.buy = it.id;
      const isMax = it.cost == null;
      if (isMax) {
        buy.classList.add('is-max');
        buy.setAttribute('aria-disabled', 'true');
        buy.appendChild(el('span', 'auv-num', STR.upMax));
      } else {
        const cost = el('span', 'auv-cost');
        cost.appendChild(el('i', 'auv-coin'));
        cost.appendChild(el('span', 'auv-num', String(it.cost)));
        buy.appendChild(cost);
        if (!it.canAfford) buy.classList.add('is-unaffordable');
        buy.setAttribute('aria-label', `${it.name}: ${it.cost}`);
      }
      buy.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isMax) return;
        if (!it.canAfford) {
          buy.classList.remove('auv-shake');
          void buy.offsetWidth;
          buy.classList.add('auv-shake');
          card.classList.remove('auv-shake');
          void card.offsetWidth;
          card.classList.add('auv-shake');
          toast(STR.noCoins, 'warn');
          return;
        }
        h('onBuyUpgrade')(it.id);
      });
      card.append(name, desc, pips, val, buy);
      cards.appendChild(card);
    }
  }

  // ---------------- API ----------------
  function showScreen(name, data = {}) {
    if (!screens[name]) return;
    if (name === 'start') {
      levelChip.textContent = fmt(STR.levelN, { n: data.level ?? 1 });
      startCoins.num.textContent = String(data.coins ?? 0);
      hint.textContent = data.isTouch ? STR.hintTouch : STR.hintDesktop;
    } else if (name === 'win') {
      winRewardTxt.textContent = fmt(STR.coinsGained, { n: data.reward ?? 0 });
    } else if (name === 'lose') {
      loseText.textContent = fmt(STR.loseText, { p: data.pct ?? 0 });
      loseRewardTxt.textContent = fmt(STR.coinsGained, { n: data.reward ?? 0 });
    } else if (name === 'upgrades') {
      renderUpgrades(data);
    }
    for (const k in screens) screens[k].classList.toggle('is-active', k === name);
    // reinicia animações de entrada
    const panel = screens[name].querySelector('.auv-end-panel, .auv-start-panel');
    if (panel) { panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = ''; }
    if (name === 'hud') { last.level = last.towerHp = last.towerMax = last.baseHp = last.baseMax = last.puppies = last.coins = undefined; last.frac = last.ready = undefined; }
    currentName = name;
  }

  const last = {};
  function updateHud(d) {
    if (d.level !== last.level) {
      last.level = d.level;
      levelPill.textContent = fmt(STR.hudLevel, { n: d.level });
    }
    const tHp = Math.max(0, Math.ceil(d.towerHp));
    if (tHp !== last.towerHp || d.towerMaxHp !== last.towerMax) {
      last.towerHp = tHp; last.towerMax = d.towerMaxHp;
      towerNum.textContent = String(tHp);
      towerFill.style.transform = `scaleX(${d.towerMaxHp > 0 ? Math.max(0, Math.min(1, d.towerHp / d.towerMaxHp)) : 0})`;
    }
    const bHp = Math.max(0, Math.ceil(d.baseHp));
    if (bHp !== last.baseHp || d.baseMaxHp !== last.baseMax) {
      last.baseHp = bHp; last.baseMax = d.baseMaxHp;
      baseNum.textContent = `${bHp}/${d.baseMaxHp}`;
      const f = d.baseMaxHp > 0 ? Math.max(0, Math.min(1, d.baseHp / d.baseMaxHp)) : 0;
      baseFill.style.transform = `scaleX(${f})`;
      baseFill.classList.toggle('is-low', f <= 0.3);
    }
    if (d.puppies !== last.puppies) {
      last.puppies = d.puppies;
      puppiesEl.textContent = fmt(STR.hudPuppies, { n: d.puppies });
    }
    if (d.coins !== last.coins) {
      last.coins = d.coins;
      hudCoins.num.textContent = String(d.coins);
    }
    const frac = Math.max(0, Math.min(1, d.superFrac || 0));
    const q = Math.round(frac * 200) / 200;
    if (q !== last.frac) {
      last.frac = q;
      btnSuper.style.setProperty('--frac', String(q));
    }
    const ready = frac >= 1;
    if (ready !== last.ready) {
      last.ready = ready;
      btnSuper.classList.toggle('is-ready', ready);
      btnSuper.setAttribute('aria-disabled', ready ? 'false' : 'true');
    }
  }

  function setMuted(b) {
    btnMute.classList.toggle('is-muted', !!b);
    btnMute.setAttribute('aria-label', b ? STR.unmute : STR.mute);
    btnMute.setAttribute('aria-pressed', b ? 'true' : 'false');
  }

  return { showScreen, updateHud, toast, setMuted, current: () => currentName };
}
