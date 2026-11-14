# Auvalanche!

Solte a matilha e derrube a torre dos gatos. Jogo 3D de navegador (Three.js), sem build.

## Como rodar

```
python3 -m http.server 8000
```

Abra http://localhost:8000 (no celular: http://IP-do-computador:8000, na mesma rede Wi-Fi).

## Como jogar

- Celular: arraste para os lados para mirar; mantenha o dedo na tela para soltar filhotes.
- Computador: mouse (arrastar/segurar) ou A/D / ←/→ para mover, Espaço para atirar, E para o Dogão.
- Passe os filhotes pelos portões azuis (x2, x3, +5) e desvie dos vermelhos (-5, ÷2).
- Cada filhote derruba um gato. Quem chega na torre tira vida dela. Não deixe os gatos chegarem na casinha.
- Encheu o medidor? Solte o DOGÃO.
- Ganhe moedas e compre melhorias entre as fases (Cadência, Dogão, Casinha).

## Testes

```
node tests/sim.test.mjs && node tests/progress.test.mjs && node tests/smoke.mjs
```

O teste de fumaça precisa do Playwright; `THREE_DIR` aponta para uma cópia local de three@0.160.0.

## Estrutura

- `src/sim/` — simulação determinística (sem DOM) e gerador de fases
- `src/render/` — cena 3D, modelos procedurais, câmera e efeitos
- `src/ui/`, `styles/` — telas e HUD
- `src/progress/` — save e economia
- `PLANO.md` — plano de implementação

## Créditos

Código, modelos e sons 100% originais e gerados por código. Sem assets de terceiros.
