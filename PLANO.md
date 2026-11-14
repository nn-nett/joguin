# PLANO.md — "Auvalanche!" (crowd-shooter 3D de filhotes contra gatos)

Estado verificado: `/home/user/joguin` está vazio (só `.git`). A cópia local de three 0.160.0 existe no scratchpad, com `build/three.module.js` e `examples/jsm/utils/BufferGeometryUtils.js`. `require('playwright')` resolve via `NODE_PATH=/usr/local/lib/node_modules_global`, então em arquivos `.mjs` use `createRequire`, não `import`. `python3`, `node 22` e `npx` estão disponíveis; `esbuild` não está instalado.

Os números de balanceamento abaixo não foram jogados. Ficam todos em `CFG`, e o teste de fumaça imprime uma tabela de resultados do bot nas fases 1 a 10 para o orquestrador ajustar.

---

## 1. Jogo e loop central

**Nome:** **Auvalanche!** ("au-au" + avalanche). Subtítulo: "Solte a matilha. Derrube a torre dos gatos."

**Restrição de originalidade:** só gênero e mecânica. Nada de nome, logo, personagens, fases, UI ou estilo do jogo de referência, e nenhum asset de terceiros. Todos os modelos são procedurais, feitos de primitivas Three.js mescladas com vertex colors.

**Tema:**
- Canhão: uma casinha de cachorro vermelha sobre rodas, com um cano em forma de osso oco.
- Unidades: filhotes em 4 variantes (Caramelo, Pintadinho, Pretinho, Branquinho).
- Inimigos: gatos cartunescos roxos/lilás e o "Gatão" gordo laranja.
- Base inimiga: torre-arranhador de gatos, com plataformas, novelo no topo e orelhas.
- Super: o "Dogão", um cachorro gigante.

### 1.1 Sistema de coordenadas (contrato global)
- X atravessa a pista, Y é para cima, Z é o comprimento.
- O canhão fica em `z=0`. Filhotes andam para **−Z**, gatos andam para **+Z**. A torre fica em `z=-48`.
- Geometrias de filhote e do Dogão são construídas olhando para −Z. Gatos olham para +Z. Pés em `y=0`.

### 1.2 Números de tuning (vão para `src/config.js`)

| Grupo | Valores |
|---|---|
| Pista | `halfWidth 5`, `length 48`, `towerZ -48`, `towerHitZ -45.5`, `catSpawnZ -44`, `baseLineZ 0.8`, zona de portões `z ∈ [-33, -9]` |
| Canhão | `maxX 4.0`, `followRate 20` (`x += (target-x)*min(1, 20*dt)`), `muzzleZ -1.4`, `keyboardSpeed 9 u/s` |
| Filhote | `speed 9`, `radius 0.32`, `cap 800`, `jitterX ±0.18`, clones com `vx` aleatório ±1.6 e decaimento `exp(-3·dt)`, `variants 4` |
| Gato | `speed = min(2.6 + 0.07·(L-1), 3.8)`, `radius 0.36`, `hp 1`, `cap 300`, wobble lateral 0.25, persegue o X do canhão a 0.6 u/s quando `z > -22`, dano na base 1 |
| Gatão | a partir da fase 3, chance `min(0.04 + 0.01·L, 0.15)`, `hp 6`, velocidade ×0.6, `radius 0.8`, dano na base 3 |
| Colisão | contato quando `dist < raioFilhote + raioGato`; 1 filhote morre e tira 1 hp do gato; grade espacial de células 1.25 |
| Tiro | `rate = 5 + 0.7·nívelCadência` por segundo (máx 12/s no nível 10); só atira com o dedo/botão/Espaço pressionado |
| Base (Casinha) | `hp = 10 + 2·nívelCasinha` (máx 30) |
| Torre | `hp(L) = 90 + 60·(L-1) + 12·(L-1)²` → F1 90, F2 162, F3 258, F5 522, F10 1602 |
| Dogão | medidor precisa de `max(20, 50 - 3·nívelDogão)` pontos; +1 por gato abatido, +0.5 por dano na torre; `power = 40 + 12·nívelDogão`; `speed 7`; `radius 1.5`; cada gato tocado morre e consome 1 de power (Gatão 3); ao chegar na torre causa o power restante; ignora portões; 1 ativo por vez |
| Ondas | fluxo contínuo `rate = min(1.0 + 0.5·(L-1), 14)` gatos/s × `(1 + t/45)`; rajada a cada 12 s de `min(12 + 5·L, 90)` gatos em 1.5 s (evento `wave`); X de spawn aleatório em ±4.3 |
| Simulação | passo fixo `1/60`, no máximo 4 passos por frame, determinística (RNG semeado) |

### 1.3 Portões
Cada filhote guarda `row`, o índice da próxima fileira de portões. Ao cruzar `z ≤ row.z`, aplica-se o portão cuja faixa contém seu X (`|x - gate.x| ≤ halfWidth`) e `row++`. Clones nascem com `row+1`, então nunca reprocessam a mesma fileira.

| op | Rótulo | Regra por filhote que cruza |
|---|---|---|
| `mul` k (2, 3, 4) | `x2` | cria k−1 clones (se houver espaço no cap) |
| `add` n (3, 5, 10) | `+5` | cooldown de 0.5 s por portão; quando pronto, o cruzamento cria n filhotes extras |
| `sub` n (3, 5, 10) | `-5` | orçamento n, recarregado a cada 1.0 s; enquanto houver orçamento, o filhote é removido |
| `div` 2 | `÷2` | remove 1 a cada 2 filhotes (contador do portão) |

- Bons (`mul`, `add`) são azuis `#2D9BF0`. Ruins (`sub`, `div`) são vermelhos `#F0483E`.
- Fileira `pair`: dois portões fixos em `x = -2.5` e `x = +2.5`, `halfWidth 2.3`.
- Fileira `mover`: um portão com `halfWidth 1.6` (bom) ou `2.0` (ruim), `x = 3.0·sin(ω·t + phase)`, `ω = min(0.9 + 0.08·L, 2.0)`. Quem passa por fora não sofre efeito.

### 1.4 Vitória e derrota
- Torre com `hp ≤ 0` → `status='won'`. A simulação congela; o render mostra a torre desabando e os filhotes pulando por 1.6 s; depois vem a tela de vitória.
- Gato cruza `baseLineZ` → dano na base. Base com `hp ≤ 0` → `status='lost'`; 1.2 s depois vem a tela de derrota.

---

## 2. Progressão

### 2.1 Gerador de fases (`generateLevel(level)`, determinístico, seed = `level·7919`)
- Número de fileiras: `R = min(2 + floor(L/2), 5)`. Z distribuído por igual de −9 a −33.
- **Fase 1 é fixa (tutorial):** `z=-12: [x2 | +3]`, `z=-28: [+5 | x3]`, sem portões ruins.
- A partir da fase 3, cada fileira exceto a primeira vira `mover` com probabilidade `min(0.15 + 0.05·(L-3), 0.45)`.
- A partir da fase 5, 35% dos movers são ruins (`÷2` ou `-5`).
- Lado bom do `pair`, sorteado esquerda/direita:
  - F1–2: `x2` 70%, `+5` 30%.
  - F3–5: `x2` 50%, `x3` 25%, `+5`/`+10` 25%.
  - F6+: `x2` 40%, `x3` 35%, `+10` 15%, `x4` 10%.
- Outro lado do `pair`: ruim com probabilidade `pBad = (L==1 ? 0 : min(0.2 + 0.06·(L-2), 0.65))`, sorteando entre `-3`, `-5`, `÷2` (F4+) e `-10` (F8+). Caso contrário é fraco (`+3`, ou `x2` se o bom for ≥ x3).
- Mover bom: `x3` (F<6) ou `x3`/`x4`.
- Limite: o produto dos melhores `mul` da fase fica ≤ 24; enquanto exceder, rebaixa o maior multiplicador.

### 2.2 Moedas e melhorias
- Vitória: `25 + 10·L + 2·hpBaseRestante`.
- Derrota: `round((5 + 3·L) · fraçãoDeDanoNaTorre)`.
- Melhorias vão do nível 0 ao 10. Custo do próximo nível: `round5(base · 1.55^n)`.

| id | Nome | Efeito | Custo base |
|---|---|---|---|
| `fireRate` | Cadência | +0.7 filhotes/s | 40 |
| `super` | Dogão | −3 pontos para carregar, +12 de power | 50 |
| `baseHp` | Casinha | +2 de vida | 30 |

### 2.3 Save
- Chave `auvalanche.save.v1`.
- Formato: `{v:1, level:1, best:1, coins:0, upgrades:{fireRate:0, super:0, baseHp:0}, muted:false}`.
- Todo acesso a `localStorage` fica em `save.js`, dentro de try/catch, com cópia em memória. Se o storage lançar, o jogo segue sem persistir.
- Proibido usar `alert`, `confirm` ou `prompt` em qualquer arquivo.

---

## 3. Telas, HUD e visual

**Visual único (cartum claro):**
- Céu em gradiente `#6EC6FF → #BEE9FF`, fog na cor do céu.
- Grama `#7ED957`, pista cor de areia `#FFE8B8` com faixas tracejadas claras, cerquinha laranja `#FF9F45` nas bordas.
- Cenário: árvores-bola, arbustos, ossos e nuvens.
- UI: texto branco com contorno azul-marinho `#1B2A49`; botões amarelos `#FFC93C` com "degrau" `box-shadow: 0 6px 0 #D99A00` e raio 18px; painéis brancos de raio 24px.
- Sem shadow maps. Sombras são blobs: um InstancedMesh de círculos pretos com opacidade 0.18.

**Fontes:** Google Fonts `Baloo 2` (700/800) para títulos e números, `Nunito` (700/800) para o corpo, com `display=swap`. Fallback: `"Baloo 2","Nunito",system-ui,"Trebuchet MS",sans-serif`. Os rótulos dos portões são desenhados na hora com fallback e redesenhados em `document.fonts.ready`.

**Mobile:**
- `<meta viewport … viewport-fit=cover, user-scalable=no>`.
- Altura `100dvh` com fallback `100vh`.
- Paddings com `env(safe-area-inset-*)`.
- Canvas com `touch-action:none`; `overscroll-behavior:none`; `user-select:none`.
- `#ui-root` tem `pointer-events:none`; só botões e painéis têm `auto`.
- Alvos de toque ≥ 48px; botão do Dogão com 76px.

**Layout do HUD:**
- Topo esquerdo: pílula "Fase N".
- Topo centro: barra "Torre dos Gatos" com número.
- Topo direito: moedas e botão de som.
- Rodapé esquerdo: barra "Casinha" e "Filhotes: N".
- Rodapé direito: botão circular "DOGÃO" com preenchimento radial (conic-gradient), pulsando quando pronto.

**Textos pt-BR (todos em `src/strings.js`):**
- Início:
  - "Auvalanche!"
  - "Solte a matilha. Derrube a torre dos gatos."
  - "JOGAR", "Melhorias", "Fase {n}"
  - Dica de toque: "Arraste para mirar · segure para soltar os filhotes"
  - Dica de desktop: "A/D ou ←/→ para mover · Espaço para atirar · E para o Dogão"
- HUD:
  - "Fase {n}", "Torre dos Gatos", "Casinha", "Filhotes: {n}", "DOGÃO"
  - Toasts: "Lá vem a gataria!", "Dogão pronto!", "Cuidado com os portões vermelhos!", "A casinha está em perigo!"
- Vitória: "VITÓRIA!", "A torre caiu! Au-au!", "+{n} moedas", "Continuar"
- Derrota: "OS GATOS VENCERAM…", "Você derrubou {p}% da torre.", "+{n} moedas", "Tentar de novo", "Melhorias"
- Melhorias:
  - "Melhorias"
  - "Cadência — Mais filhotes por segundo"
  - "Dogão — Carrega mais rápido e bate mais forte"
  - "Casinha — Mais vida para a sua base"
  - "Nível {n}", "MÁX", "Moedas insuficientes", "Jogar fase {n}"
- Som: aria-labels "Silenciar" e "Ativar som".

**Fluxo:**
- Início → Jogar → HUD.
- Vitória → Continuar → Melhorias → "Jogar fase N+1".
- Derrota → "Tentar de novo" (mesma fase) ou Melhorias.
- A tela de início também abre Melhorias.
- `visibilitychange` pausa o acumulador.

**Câmera (retrato primeiro):**
- Perspectiva fixa atrás e acima do canhão. FOV vertical 62° em retrato (`aspect < 1`) e 45° em paisagem.
- Direção fixa: posição `(0, 0.95k, 0.62k)`, `lookAt(0, 0, -20)`.
- `fitCamera(aspect)` procura o menor `k` em `[14, 70]`, passo 0.5, em que estes pontos projetados em NDC cabem em `|x| ≤ 0.96` e `y ∈ [-0.80, 0.84]`:
  - `(±6.2, 0, 1.5)`
  - `(±6.2, 0, -48)`
  - `(0, 9, -48)`
- A folga vertical é para o HUD. Recalcula a cada resize.

---

## 4. Módulos, donos e interfaces

### Convenções obrigatórias para todos os agentes
- ES modules, **apenas named exports**, imports relativos estáticos com extensão `.js`.
- Sem imports circulares e sem top-level await.
- `three` é importado só como `import * as THREE from 'three'` e `three/addons/utils/BufferGeometryUtils.js`.
- Nenhuma outra rede, nenhuma imagem ou asset externo.
- Cada agente edita **somente** seus arquivos. Não faz commit e não mexe em `index.html`, `config.js`, `strings.js` nem `PLANO.md`. Se precisar de uma constante nova, usa um default local e reporta ao orquestrador.
- Sem alocações por frame em loops quentes: nada de `new Vector3` ou arrays temporários por unidade.
- Cores: `new THREE.Color(hex)` e gravar `r,g,b` no atributo `color`. `CanvasTexture.colorSpace = THREE.SRGBColorSpace`.
- Luzes no r160 usam unidades físicas: Hemisphere ≈ 1.6, Directional ≈ 2.5. Ajustar por screenshot.
- Cada agente se autoverifica: A e B com `node`; C, D e E com uma página `dev/*.html` própria e screenshot via `tests/helpers.mjs`.

### Fase 0 — Orquestrador escreve PRIMEIRO, antes de lançar os agentes

| Arquivo | Conteúdo |
|---|---|
| `PLANO.md` | este documento |
| `.gitignore` | `tests/out/`, `node_modules/` |
| `index.html` | `<meta charset>`, viewport acima, `<title>Auvalanche!</title>`, link do Google Fonts, `<link rel="stylesheet" href="styles/ui.css">`, importmap, `<canvas id="game-canvas">`, `<div id="ui-root">`, `<script type="module" src="src/main.js">` |
| `src/config.js` | `export const CFG` com todos os números das seções 1.2, 1.3 e 2, mais `CFG.colors` (paleta da seção 3) e `CFG.upgrades = {fireRate:{base:40,max:10}, super:{base:50,max:10}, baseHp:{base:30,max:10}, growth:1.55}` |
| `src/strings.js` | `export const STR` (textos da seção 3) e `export function fmt(tpl, vars)` (troca `{n}`) |
| `src/util/rng.js` | `export function makeRng(seed)` → `{ next():[0,1), range(a,b), int(a,b), pick(arr), chance(p) }` (mulberry32) |
| `src/render/models.js` | **stub** com a API da seção 4.C devolvendo caixas coloridas; o Agente C substitui o arquivo inteiro |
| `tests/helpers.mjs` | `startServer(rootDir)`, `launch()`, `openPage(browser, url, viewport)` — especificação na seção 5.2 |

Importmap:
```
{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
            "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}
```

### Formas de dados compartilhadas (contrato)

```
LevelDef = {
  level:int, seed:int, towerHp:int,
  rows: [{ z:number, gates:[{ x:number, halfWidth:number, op:'mul'|'add'|'sub'|'div',
                              value:int, moving:null|{amp:number, omega:number, phase:number} }] }],   // z decrescente (−9 … −33)
  cats: { rate:number, ramp:number /*45*/, burstEvery:number, burstSize:int, speed:number, fatChance:number }
}
Mods = { fireRate:number, baseHp:int, superNeed:number, superPower:number }

SimState = {
  status:'idle'|'playing'|'won'|'lost', time:number, level:int,
  cannonX:number, firing:boolean,
  puppies:{ count:int, x:Float32Array, z:Float32Array, vx:Float32Array, phase:Float32Array,
            born:Float32Array, variant:Uint8Array, row:Uint8Array },          // capacidade CFG.puppy.cap
  cats:   { count:int, x:Float32Array, z:Float32Array, phase:Float32Array,
            hp:Uint8Array, kind:Uint8Array /*0 gato, 1 gatão*/ },             // capacidade CFG.cat.cap
  superDog:{ active:boolean, x:number, z:number, power:number },
  gates:[{ id:int, row:int, z:number, x:number, halfWidth:number, op, value:int, good:boolean,
           label:string, moving, lastTrigger:number /*state.time do último efeito*/ }],
  tower:{ hp:number, maxHp:number }, base:{ hp:number, maxHp:number },
  superPoints:number, superNeed:number,
  stats:{ fired:int, cloned:int, catsKilled:int, towerDamage:int, peakPuppies:int }
}

SimEvent (objetos simples, agregados por passo):
  {type:'fire', x}
  {type:'gate', gateId, good, x, z, n}        // no máx. 1 por portão por passo
  {type:'clash', x, z, kind}                  // no máx. 16 por passo
  {type:'towerHit', n}                        // 1 por passo
  {type:'baseHit', dmg, x}
  {type:'wave', size}
  {type:'superReady'} | {type:'superLaunch', x} | {type:'superEnd', x, z, dmg}
  {type:'win'} | {type:'lose'}
```

### Pacote A — Simulação (sem THREE, sem DOM; roda em Node)
**Arquivos:** `src/sim/sim.js`, `src/sim/grid.js`, `tests/sim.test.mjs`
**Depende de:** `config.js`, `util/rng.js`

```
export function createSim() -> {
  state: SimState,
  startLevel(levelDef: LevelDef, mods: Mods): void,   // zera tudo, status='playing'
  setInput({targetX:number, firing:boolean}): void,    // targetX limitado a ±CFG.cannon.maxX
  requestSuper(): boolean,                             // true se lançou
  step(dt:number): void,                               // sem efeito se status != 'playing'
  drainEvents(): SimEvent[],                           // troca o buffer; não aloca por evento além do objeto
  debug: { forceWin(), forceLose(), fillSuper(), spawnPuppies(n, x, z, row=0), spawnCats(n, kind=0), clearCats() }
}
// grid.js
export function createGrid(minX, maxX, minZ, maxZ, cell) -> { clear(), insert(i, x, z), query(x, z, cb(i)) | forNeighbors }
```

**Ordem do `step`:**
1. Avança o tempo e o `cannonX` segue o alvo.
2. Atualiza o X dos portões móveis.
3. Tiro: acumulador `rate·dt`; nasce em `(cannonX ± jitter, muzzleZ)`, variante aleatória, `row=0`.
4. Spawn de gatos: fluxo contínuo e rajadas.
5. Filhotes, iterando de `count-1` até 0:
   - move;
   - `while (row < R && z ≤ rows[row].z)` aplica o portão;
   - `z ≤ towerHitZ` → dano na torre e remove (swap-remove).
6. Gatos: move, persegue, e ao cruzar `baseLineZ` causa dano e é removido.
7. Reconstrói a grade com os gatos. Para cada filhote (ordem reversa), testa a célula e as vizinhas ±1:
   - se houver contato, `cat.hp--` e o filhote é removido;
   - gatos com `hp=0` são ignorados nas consultas e compactados **depois** do loop.
8. Dogão: varredura linear nos gatos; impacto na torre.
9. Medidor (emite `superReady` uma vez ao encher); checa vitória/derrota.

**Autoteste** (`node tests/sim.test.mjs`, só asserts do Node):
- 10 filhotes num `x3` viram 30.
- `+5` com 10 cruzando no mesmo passo vira 15.
- `÷2` deixa 5.
- `-3` deixa 7.
- Filhote e gato se anulam 1:1.
- Gatão precisa de 6.
- Caps são respeitados.
- Determinismo: dois sims com o mesmo input terminam com o mesmo estado.
- 800 filhotes + 300 gatos: `step` médio < 1.5 ms.

### Pacote B — Progressão e Áudio
**Arquivos:** `src/sim/level.js`, `src/progress/save.js`, `src/progress/economy.js`, `src/audio.js`, `tests/progress.test.mjs`
**Depende de:** `config.js`, `util/rng.js`, `strings.js`

```
// level.js
export function generateLevel(level:int): LevelDef
export function towerHpFor(level:int): int
// save.js
export function loadSave(): Save          // sempre devolve um objeto válido (merge com defaults)
export function persist(save): boolean    // false se o storage falhar; nunca lança
export function resetSave(): Save
// economy.js
export function upgradeCost(id, currentLevel): number|null     // null = MÁX
export function computeMods(save): Mods
export function rewardFor(levelDef, {won:boolean, towerDamageFrac:number, baseHp:number}): int
export function upgradeItems(save): [{id, name, desc, level, maxLevel, cost, canAfford, valueText}]
export function buyUpgrade(save, id): boolean                  // altera o save; não persiste
// audio.js
export function createAudio() -> { unlock(), setMuted(b), isMuted(), play(name, opts?), startMusic(), stopMusic() }
```

**Áudio:**
- Nomes de `play`: `fire, gate, gateBad, clash, towerHit, baseHit, super, superReady, wave, win, lose, click, coin, buy`.
- O AudioContext é criado só em `unlock()`. Antes disso, e fora do browser, tudo é no-op e nunca lança.
- Throttle por nome: `fire` 60 ms, `clash` 50 ms, `towerHit` 70 ms.
- Síntese:
  - latido = square/saw com pitch descendente + envelope;
  - miado = sine com glide;
  - "pop" = burst de ruído filtrado;
  - arpejos para win e lose.
- Música: loop simples de 8 compassos (triangle + baixo) em ganho 0.08, agendado com lookahead.

**Autoteste em Node:**
- `generateLevel` é determinístico.
- F1 é exatamente o tutorial.
- Invariantes para L = 1..30: gates dentro da pista, produto de `mul` ≤ 24, nenhum `pair` com dois portões ruins.
- Tabela de custos confere.
- O save funciona com `localStorage` ausente e com `localStorage` que lança.

### Pacote C — Modelos procedurais
**Arquivos:** `src/render/models.js` (substitui o stub), `dev/modelos.html`
**Depende de:** `three`, `config.js` (cores)

```
export function makeUnitMaterial(): THREE.MeshLambertMaterial        // vertexColors:true, compartilhado
export function buildPuppyGeometry(variant:0|1|2|3): BufferGeometry  // ≤ 260 tris, ~0.75 de altura, olhando −Z
export function buildCatGeometry(): BufferGeometry                   // ≤ 260 tris, olhando +Z
export function buildFatCatGeometry(): BufferGeometry                // ≤ 320 tris, ~1.5 de altura
export function buildSuperDogGeometry(): BufferGeometry              // ≤ 900 tris, ~3.2 de altura, olhando −Z
export function buildCannon(): THREE.Group    // userData.barrel (Object3D para recuo), userData.wheels:Object3D[]; ≤ 3 meshes
export function buildTower(): THREE.Group     // userData.height (~9), userData.segments:Object3D[] (3–4 andares p/ desabar)
export function buildGatePosts(halfWidth:number, height:number): BufferGeometry  // 2 postes + travessa, vertex color branco (tingido pelo material)
export function buildScenery(): THREE.Group   // geometria estática mesclada (≤ 3 meshes): árvores, arbustos, cerca nas bordas ±5.4, ossos, nuvens
export function buildBlobGeometry(): BufferGeometry                  // círculo 10 seg. deitado em XZ, raio 1
```

**Regras:**
- Tudo mesclado com `mergeGeometries`, com atributos `position`, `normal` e `color`. Sem UV e sem texturas.
- Esferas de baixa resolução (6×4), cones de 4–5 lados, caixas.
- Variantes de filhote, todas com olhos, focinho e coleira:
  - 0 Caramelo: orelhas caídas, cor `#D9A066`.
  - 1 Pintadinho: branco com manchas e uma orelha preta.
  - 2 Pretinho: preto com focinho e patas caramelo, orelhas em pé.
  - 3 Branquinho: creme "fofo", com esferas extras na cabeça e no rabo.
- Gato: roxo `#8E6BD8`, barriga lilás, orelhas triangulares, rabo em pé, olhos amarelos, cara de bravo. Desenho original.
- Gatão: laranja listrado.

**Autoverificação:** `dev/modelos.html` mostra todos os modelos lado a lado em fundo de céu, com screenshot via helpers.

### Pacote D — Renderização
**Arquivos:** `src/render/renderer.js`, `src/render/units.js`, `src/render/gates.js`, `src/render/effects.js`, `src/render/camera.js`, `dev/render.html`
**Depende de:** `three`, `models.js` (API da seção C; desenvolve contra o stub), `config.js`

```
export function createRenderer(canvas: HTMLCanvasElement) -> {
  buildLevel(levelDef: LevelDef): void,          // recria portões (postes + painel + rótulo CanvasTexture), reseta torre e efeitos
  setMode(mode:'menu'|'play'|'won'|'lost'): void, // menu: câmera com leve balanço; won: torre desaba + filhotes pulam; lost: gatos pulam
  sync(state: SimState, nowSec:number, dtReal:number): void,   // matrizes instanciadas, portões, canhão, Dogão, barra da torre, partículas
  handleEvents(events: SimEvent[]): void,        // partículas, flash/pulso de portão, recuo do canhão, shake da câmera
  resize(width:number, height:number): void,     // pixelRatio = min(devicePixelRatio, 2) + fitCamera
  render(): void,
  info(): { drawCalls:int, triangles:int, pixelRatio:number }
}
```

**Implementação exigida:**
- InstancedMeshes, todos com `frustumCulled=false`, `DynamicDrawUsage` e `mesh.count` atualizado a cada frame:
  - 4 de filhotes, um por variante, capacidade 800 cada;
  - 1 de gatos (300) e 1 de gatões (64);
  - 1 de sombras-blob (1200);
  - 1 de partículas (256).
- A matriz é escrita **direto** em `instanceMatrix.array`, sem `Object3D`:
  - pulo `y = |sin(t·12 + phase)|·0.18`;
  - gingado `roll = sin(t·12 + phase)·0.12`;
  - "pop" de nascimento com escala 0.3 → 1 em 0.15 s usando `born`;
  - gatos usam frequência 9.
- Matriz: `[s·cos r, s·sin r, 0, 0, −s·sin r, s·cos r, 0, 0, 0, 0, s, 0, x, y, z, 1]`.
- Portões:
  - painel `PlaneGeometry` translúcido (`MeshBasicMaterial`, transparente, opacidade 0.85, `depthWrite:false`) em azul ou vermelho;
  - rótulo em CanvasTexture 256×128 com texto branco e contorno marinho;
  - X segue `gate.x`;
  - pulso de escala quando `state.time - lastTrigger < 0.15`.
- Barra de HP da torre: Sprite com CanvasTexture 256×64 acima da torre, redesenhada só quando o hp muda e no máximo 10×/s.
- Cenário de `buildScenery()`, chão, pista, `HemisphereLight` + `DirectionalLight`, fog. Sem shadow map.
- Qualidade adaptativa: se a média de `dtReal` passar de 22 ms por 2 s, o pixelRatio cai 2 → 1.5 → 1.
- Orçamento: ≤ 45 draw calls.

**Autoverificação:** `dev/render.html` cria um SimState falso com 800 filhotes, 300 gatos e 3 fileiras de portões, e anima. Screenshots em 390×844 e 1280×720.

### Pacote E — UI/HUD e Input
**Arquivos:** `styles/ui.css`, `src/ui/ui.js`, `src/input.js`, `dev/ui.html`
**Depende de:** `strings.js`, `config.js`

```
// ui.js — constrói todo o DOM dentro de #ui-root
export function createUI(root: HTMLElement, handlers: {
  onPlay(), onOpenUpgrades(), onSuper(), onToggleMute(), onBuyUpgrade(id), onNext(), onRetry()
}) -> {
  showScreen(name:'start'|'hud'|'win'|'lose'|'upgrades', data?): void,
  updateHud({level, towerHp, towerMaxHp, baseHp, baseMaxHp, puppies, superFrac, coins}): void, // chamado todo frame: comparar com o último valor antes de tocar no DOM
  toast(text:string, kind?:'info'|'warn'|'good'): void,
  setMuted(b:boolean): void,
  current(): string
}
// dados: start {level, coins, best, isTouch} | win {level, reward, coins} | lose {level, reward, coins, pct}
//        upgrades {coins, nextLevel, items:[{id,name,desc,level,maxLevel,cost,canAfford,valueText}]}

// input.js
export function createInput(canvas: HTMLElement) -> {
  state: { targetX:number, firing:boolean },
  update(dt:number): void,        // teclado: A/D e ←/→ movem a 9 u/s; Espaço = atirar
  onSuper(cb): void,              // tecla E
  setEnabled(b:boolean): void,    // false zera firing
  reset(): void                   // targetX = 0
}
```

**Input:**
- Pointer events com `setPointerCapture`, seguindo só o primeiro `pointerId`. Um segundo dedo pode tocar no botão do Dogão.
- Arraste **relativo**: `targetX += dxPx · (2·maxX / larguraDoCanvas) · 1.25`, limitado a ±`maxX`.
- `firing = true` enquanto o ponteiro estiver pressionado. `pointerup`, `pointercancel` e `blur` soltam.

**UI:**
- Classes com prefixo `.auv-`.
- Transições por CSS: pop-in de painéis, shake em "Moedas insuficientes".
- `prefers-reduced-motion` respeitado.
- A tela de início tem painel inferior translúcido, deixando o 3D aparecer atrás.

**Autoverificação:** `dev/ui.html` percorre todas as telas com dados falsos sobre um fundo gradiente. Screenshots 390×844 e 1280×720, sem overflow horizontal.

### Pacote F — Teste de fumaça
**Arquivos:** `tests/smoke.mjs`
**Depende de:** `tests/helpers.mjs`, contrato `window.__game` (seção 5.1)
Escrito em paralelo contra o contrato e executado pelo orquestrador depois da integração. Especificação na seção 5.3.

### Orquestrador, em paralelo aos agentes — `src/main.js` (cola), depois `README.md`
- Cria `renderer`, `sim`, `ui`, `input`, `audio`. Carrega o save.
- Máquina de estados: `menu | playing | ending | win | lose | upgrades`.
- Loop RAF, quando não pausado por `pauseLoop`:
  1. `input.update`;
  2. `sim.setInput`;
  3. acumulador com passos de 1/60, no máximo 4;
  4. `ev = sim.drainEvents()`;
  5. `renderer.handleEvents(ev)`, roteia os eventos para áudio e toasts;
  6. `renderer.sync`, `renderer.render`, `ui.updateHud`.
- Eventos → áudio e toasts:
  - `wave` → "Lá vem a gataria!";
  - `superReady` → "Dogão pronto!";
  - base ≤ 30% → "A casinha está em perigo!", uma vez por fase;
  - primeira fase com portão ruim → "Cuidado com os portões vermelhos!".
- `win` e `lose`: calcula `rewardFor`, atualiza save (`level++`, `best`, `coins`), `persist`, mostra a tela após o atraso.
- `audio.unlock()` no primeiro `pointerdown` ou `keydown`. O mute fica salvo.
- `resize` e `orientationchange` → `renderer.resize`.
- `window.addEventListener('error' | 'unhandledrejection')` → `__game.errors.push`.

---

## 5. Integração, testes e aceitação

### 5.1 Gancho de depuração (em `main.js`)
```
window.__game = {
  get state(), get save(), get screen(), errors: [],
  start(level?), startCustom(levelDef, mods?),        // entra em 'playing' sem passar pelos menus
  pauseLoop(b),                                        // RAF continua renderizando mas não avança a sim
  setInput({targetX, firing}), step(seconds),          // avança a sim de forma síncrona em passos de 1/60
  super(), fillSuper(), forceWin(), forceLose(),
  spawnPuppies(n,x,z,row), spawnCats(n,kind), clearCats(),
  grantCoins(n), buy(id), next(), retry(), reset(),    // reset = resetSave + volta ao menu
  finishEnding(),                                      // pula o atraso de 1.6/1.2 s
  renderInfo()
}
```

### 5.2 `tests/helpers.mjs` (Fase 0)
- `createRequire(import.meta.url)('playwright')`.
- `startServer(root)`:
  - spawn de `python3 -m http.server <porta livre> --bind 127.0.0.1` com `cwd=root`;
  - espera responder;
  - devolve `{url, stop()}`.
- `openPage(browser, url, {width, height, isMobile, hasTouch})` usa `context.route('**/*')`:
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/<resto>` → `route.fulfill` com o arquivo `THREE_DIR/<resto>` (`content-type: text/javascript`);
  - `fonts.googleapis.com` → `fulfill` 200 com CSS vazio;
  - `fonts.gstatic.com` → `fulfill` 200 vazio;
  - localhost → `continue`;
  - qualquer outro host → registra em `blocked[]` e `abort`.
- `THREE_DIR = process.env.THREE_DIR || '/tmp/claude-0/-home-user-joguin/d367b80e-1c3f-5352-a984-1809df429e7e/scratchpad/node_modules/three'`.
- Coleta `console.error` e `pageerror` em `errors[]`.
- Devolve `{page, errors, blocked}`.
- Chromium com `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

### 5.3 `tests/smoke.mjs` (`node tests/smoke.mjs`; exit code ≠ 0 em falha; screenshots em `tests/out/`)
1. **Boot retrato 390×844 (touch):**
   - abre `index.html`, espera `window.__game` e `screen === 'start'`;
   - verifica o título "Auvalanche!" e o botão "JOGAR" visíveis;
   - `scrollWidth ≤ innerWidth`;
   - screenshot `01-inicio-retrato.png`.
2. **Jogar pelo clique:**
   - clica "JOGAR" → `screen === 'hud'`, `state.status === 'playing'`.
3. **Tiro:**
   - `pauseLoop(true)`, `setInput({targetX:-2.5, firing:true})`, `step(2)`;
   - espera `stats.fired ≥ 9` e `puppies.count > 0`.
4. **Portões (determinístico):** `startCustom` com `cats.rate=0`, sem rajadas, uma fileira em `z=-10` com `[mul 3 @-2.5 | sub 3 @+2.5]`:
   - `spawnPuppies(10, -2.5, -9.5)`, `step(0.2)` → `count === 30`;
   - reinicia, `spawnPuppies(10, +2.5, -9.5)`, `step(0.2)` → `count === 7`;
   - repete com `add 5` → 15 e `div 2` → 5.
5. **Combate:** fase custom sem portões:
   - `spawnCats(5)` e 5 filhotes no caminho;
   - `step` até se encontrarem → os dois lados zeram e `stats.catsKilled === 5`.
6. **Dogão:**
   - `fillSuper()`, `super()` → `superDog.active === true`;
   - `step(8)` → `tower.hp` menor que antes.
7. **Vitória real com bot:**
   - `reset()`, `start(1)`;
   - bot mira o X do melhor portão da fileira mais próxima (o próprio teste calcula a partir de `state.gates`), `firing:true`;
   - `step` em fatias de 0.5 s até `status !== 'playing'`, máximo 90 s simulados;
   - espera `'won'`;
   - `finishEnding()` → `screen === 'win'`, texto "VITÓRIA!";
   - screenshot `02-vitoria.png`; as moedas aumentaram.
8. **Melhorias:**
   - clica "Continuar" → `screen === 'upgrades'`;
   - `grantCoins(500)`, clica comprar Cadência → nível 1 e moedas descontadas;
   - screenshot `03-melhorias.png`;
   - clica "Jogar fase 2" → `state.level === 2`.
9. **Derrota real:**
   - `start(1)` sem atirar, `step` até 90 s;
   - espera `'lost'`, `screen === 'lose'` com "Tentar de novo";
   - screenshot `04-derrota.png`;
   - clica → jogando de novo na fase 1.
10. **Persistência:** recarrega a página → `save.coins` e `save.upgrades.fireRate` mantidos. Segunda página com `addInitScript` que faz `localStorage.getItem/setItem` lançarem → o jogo abre e joga sem erros.
11. **Estresse:**
    - `start(6)`, `spawnPuppies(800…)`, `spawnCats(300)`;
    - mede 120 chamadas de `step(1/60)` via `performance.now` → média < 3 ms;
    - `renderInfo().drawCalls ≤ 45`;
    - screenshot `05-estresse-retrato.png` em meio de jogo (`pauseLoop(false)`, espera 500 ms).
12. **Desktop 1280×720:**
    - boot;
    - teclado: segura `d` 300 ms → `state.cannonX > 0`; `Space` → `fired` cresce;
    - screenshots `06-inicio-desktop.png` e `07-jogo-desktop.png`.
13. **Fechamento:**
    - `errors.length === 0` em todas as páginas, `__game.errors.length === 0`, `blocked.length === 0`;
    - imprime a tabela do bot nas fases 1..10 (resultado e tempo simulado, sem melhorias). É informativa, não é assert.

### 5.4 Ordem de integração
1. Fase 0 (orquestrador): arquivos da tabela e commit.
2. Lança A, B, C, D, E, F em paralelo. O orquestrador escreve `src/main.js` enquanto isso.
3. Recebe os pacotes. Roda `node tests/sim.test.mjs` e `node tests/progress.test.mjs`.
4. Abre os `dev/*.html` e olha os screenshots dos agentes.
5. Liga tudo no `main.js` e roda `node tests/smoke.mjs`. Corrige divergências de contrato; qualquer mudança de interface é feita pelo orquestrador.
6. Revisão visual dos 7 screenshots:
   - pista inteira visível em retrato;
   - HUD sem sobrepor a torre nem o canhão;
   - rótulos dos portões legíveis;
   - filhotes e gatos distinguíveis.
7. Ajuste de balanceamento só em `config.js`, usando a tabela do bot. Meta: F1 vencida em 20–45 s; fases 5 a 10 exigem escolher portões e 1 a 3 melhorias.
8. `README.md`, commit final e push no branch `ccr-46b60c3c-fnksxy`.
9. Versão Artifact (arquivo único):
   - `npx --yes esbuild src/main.js --bundle --format=esm --external:three --external:three/addons/* --outfile=<scratchpad>/bundle.js`;
   - monta um HTML com o CSS inline, o importmap e o bundle em `<script type="module">`;
   - roda `smoke.mjs` contra esse HTML (aceitar `SMOKE_URL` por env);
   - não precisa ir para o repositório.

### 5.5 Critérios de aceitação
- Abre com `python3 -m http.server`, sem build, e zero erros no console. Nenhuma requisição fora de `cdn.jsdelivr.net/npm/three@0.160.0/` e do Google Fonts.
- `smoke.mjs`, `sim.test.mjs` e `progress.test.mjs` passam.
- Em 390×844: pista inteira (largura e torre) visível, sem scroll nem zoom, safe-areas respeitadas, arraste move o canhão e segurar atira.
- Portões multiplicam, somam, subtraem e dividem conforme a seção 1.3. Portões móveis se movem. Filhote e gato se anulam 1:1. A torre perde vida. Vitória e derrota são alcançáveis jogando de verdade.
- Moedas, melhorias e fase persistem. O jogo funciona com `localStorage` lançando. Nenhum `alert`, `confirm` ou `prompt` (grep).
- Som só depois do primeiro toque; o mute funciona e persiste.
- Com 800 filhotes + 300 gatos: `step` < 3 ms, ≤ 45 draw calls, caps respeitados.
- Todo texto visível em pt-BR. Nenhum nome, arte ou asset de terceiros (grep por URLs externas e pelo nome do jogo de referência).

---

## 6. README.md (pt-BR, curto)

```
# Auvalanche!
Solte a matilha e derrube a torre dos gatos. Jogo 3D de navegador (Three.js), sem build.

## Como rodar
python3 -m http.server 8000
Abra http://localhost:8000 (no celular: http://IP-do-computador:8000, na mesma rede Wi-Fi).

## Como jogar
- Celular: arraste para os lados para mirar; mantenha o dedo na tela para soltar filhotes.
- Computador: mouse (arrastar/segurar) ou A/D / ←/→ para mover, Espaço para atirar, E para o Dogão.
- Passe os filhotes pelos portões azuis (x2, x3, +5) e desvie dos vermelhos (-5, ÷2).
- Cada filhote derruba um gato. Quem chega na torre tira vida dela. Não deixe os gatos chegarem na casinha.
- Encheu o medidor? Solte o DOGÃO.
- Ganhe moedas e compre melhorias entre as fases (Cadência, Dogão, Casinha).

## Testes
node tests/sim.test.mjs && node tests/progress.test.mjs && node tests/smoke.mjs
(precisa de Playwright; THREE_DIR aponta para uma cópia local de three@0.160.0)

## Créditos
Código, modelos e sons 100% originais e gerados por código. Sem assets de terceiros.
```

---

### Critical Files for Implementation
- /home/user/joguin/src/config.js — constantes e tuning compartilhados; escrito primeiro, todos os agentes programam contra ele
- /home/user/joguin/src/sim/sim.js — simulação determinística (pools SoA, portões, grade de colisão, Dogão, vitória/derrota)
- /home/user/joguin/src/render/renderer.js — cena, câmera adaptativa, InstancedMesh por tipo, portões e efeitos (com `units.js`, `gates.js`, `camera.js`)
- /home/user/joguin/src/main.js — cola do orquestrador: loop, máquina de estados, eventos, save, `window.__game`
- /home/user/joguin/tests/smoke.mjs — teste de fumaça com Playwright (com `tests/helpers.mjs` para servidor e roteamento do three local)
