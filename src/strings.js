// Todos os textos visíveis (pt-BR).
export const STR = {
  title: 'Auvalanche!',
  subtitle: 'Solte a matilha. Derrube a torre dos gatos.',
  play: 'JOGAR',
  upgrades: 'Melhorias',
  levelN: 'Fase {n}',
  hintTouch: 'Arraste para mirar · segure para soltar os filhotes',
  hintDesktop: 'A/D ou ←/→ para mover · Espaço para atirar · E para o Dogão',

  hudLevel: 'Fase {n}',
  hudTower: 'Torre dos Gatos',
  hudBase: 'Casinha',
  hudPuppies: 'Filhotes: {n}',
  hudSuper: 'DOGÃO',

  toastWave: 'Lá vem a gataria!',
  toastSuperReady: 'Dogão pronto!',
  toastBadGates: 'Cuidado com os portões vermelhos!',
  toastBaseDanger: 'A casinha está em perigo!',

  winTitle: 'VITÓRIA!',
  winText: 'A torre caiu! Au-au!',
  coinsGained: '+{n} moedas',
  continue: 'Continuar',

  loseTitle: 'OS GATOS VENCERAM…',
  loseText: 'Você derrubou {p}% da torre.',
  retry: 'Tentar de novo',

  upgradesTitle: 'Melhorias',
  upFireRateName: 'Cadência',
  upFireRateDesc: 'Mais filhotes por segundo',
  upSuperName: 'Dogão',
  upSuperDesc: 'Carrega mais rápido e bate mais forte',
  upBaseHpName: 'Casinha',
  upBaseHpDesc: 'Mais vida para a sua base',
  upLevel: 'Nível {n}',
  upMax: 'MÁX',
  noCoins: 'Moedas insuficientes',
  playLevel: 'Jogar fase {n}',

  coins: 'Moedas',
  mute: 'Silenciar',
  unmute: 'Ativar som',
};

export function fmt(tpl, vars = {}) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
