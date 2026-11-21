# CASTELO DA BETINA — `app-betina-castelo`

Jogo web 2D em **HTML5 Canvas**, sem build, sem dependências e sem imagens externas (tudo é desenhado proceduralmente e guardado em cache de sprites).

A **Betina**, 10 anos, está na praia com o pai e um casal de amigos debaixo do guarda-sol. Para passar de fase ela precisa **correr até o mar, encher o balde, voltar e despejar a areia** até o castelo ficar gigante — antes do sol baixar.

Nasceu como uma cópia do [`app-car-racing`](../app-car-racing): mesma arquitetura (dados em `themeConfig`, simulação separada do desenho, painters registráveis, qualidade adaptativa), com gameplay novo.

---

## ▶︎ Como jogar

```bash
# opção 1: abra index.html direto no navegador (funciona via file://)
# opção 2:
npm run serve        # http://localhost:4173
```

| Ação | Teclado | Toque |
| --- | --- | --- |
| Correr | `A` `D` ou `←` `→` | botões **VOLTAR** / **IR** (esquerda) |
| Pular | `Espaço`, `↑` ou `W` | botão **PULAR** (direita) |
| Pausar | `P` ou `Esc` | botão de pausa |
| Reiniciar a fase | `R` | — |
| Qualidade gráfica | `G` | botão AUTO/ALTO/MÉDIO/BAIXO |
| Som | `M` | botão de som |

As fontes vêm do Google Fonts; offline o jogo cai nas fontes do sistema.

---

## 🏖 Regras

- **Balde:** ao entrar na beira do mar o balde enche sozinho; ao passar pelo castelo ele esvazia sozinho. Quanto mais areia chega inteira, mais o castelo cresce.
- **Derramar:** o conteúdo balança de verdade (mola amortecida). Arrancadas, viradas bruscas, pousos de pulo, tombos e ondas fazem a areia cair. Balde cheio também pesa e deixa a Betina mais lenta.
- **Energia:** gasta enquanto corre; recupera parada e **muito mais rápido na sombra do guarda-sol**. Zerou, ela fica cansada e anda devagar. **Picolés** pelo caminho recuperam 45%.
- **Caranguejos:** patrulham a areia. Encostar = tropeço (derruba 40% do balde). Dá para **pular por cima**.
- **Ondas grandes** (a partir da fase 2): uma crista avisa alguns segundos antes; quem estiver na água é empurrado para a areia e derrama parte da carga.
- **Conchinhas:** em fileiras e arcos pelo caminho (algumas só no pulo). Dão pontos, não tempo.
- **Sol:** o tempo da fase acaba com o pôr do sol — o céu esquenta e escurece conforme o relógio corre. Sobrou tempo = mais **estrelas** (3 estrelas com 50% ou mais de tempo sobrando).
- **Fases:** a praia fica maior, o castelo exige mais baldes e aparecem mais caranguejos e ondas. As 5 primeiras são ajustadas à mão; depois uma fórmula segue para sempre.
- Pai e amigos torcem a cada entrega; o castelo ganha muralhas, torres, portão, torre de menagem e bandeira conforme o progresso.

A fase mais alta concluída é salva por tema.

---

## 🎨 Temas

| Tema | O que muda |
| --- | --- |
| **Manhã de Sol** (`dia`) | céu azul, mar turquesa, margem de tempo mais folgada |
| **Tarde Dourada** (`tarde`) | luz de fim de tarde, mar rosado, relógio mais apertado |

O seletor do topo é montado a partir de `HCR.THEMES`, então qualquer tema registrado aparece sozinho.

### Criar um novo estilo de jogo em poucas linhas

```js
// em js/themeConfig.js, ou num arquivo próprio carregado depois dele
HCR.defineTheme('noite', {
  extends: 'dia',                        // herda tudo; você só sobrescreve o que muda
  name: 'Noite de Lua Cheia',
  physics: { runSpeed: 240, gravity: 1600 },        // andar, pular, balde, energia
  levels:  { timeSlack: 2 },                         // quanto tempo cada fase dá
  rules:   { sunset: false },                        // sem relógio: só relaxar e construir
  background: { sky: ['#10204a', '#233a7a', '#5a5fa8'] }
});
```

| Bloco | Controla |
| --- | --- |
| `physics` | velocidade, aceleração, pulo, gravidade, peso/derrame do balde, energia, dano de caranguejo e onda |
| `rules` | `energy`, `sunset` (relógio), `crabs`, `waves` — ligue/desligue mecânicas |
| `levels` | lista de fases (`shore`, `buckets`, `crabs`, `waveEvery`), fórmula de extensão e folga de tempo |
| `camp` / `castle` | posição e cores do acampamento e do canteiro de obras |
| `colors` | roupa da Betina, balde, tons de areia molhada… |
| `terrain` / `background` | areia, água rasa, céu, ilhas, cores do pôr do sol |
| `labels` / `ui` | todos os textos e a paleta da interface |

### Nova arte: registre um painter

O tema só referencia o id do painter; o desenho fica em `js/render/`.

| Registro | Referenciado por | Arquivo |
| --- | --- | --- |
| `HCR.render.scenes` | `background.scene` | `js/render/scenes.js` |
| `HCR.render.decor` | `terrain.decorSet` | `js/render/terrainRenderer.js` |
| `HCR.render.pickups` | `pickups.coinSprite` / `fuelSprite` | `js/render/pickupRenderer.js` |

```js
HCR.render.pickups.register('estrela-do-mar', {
  box: { x: -20, y: -20, w: 40, h: 40 },   // área do sprite (unidades locais)
  frames: 1, sway: 0.1, glow: 30, sparkle: true,
  paint(ctx, p) { /* p = theme.pickups; desenhe com o centro em (0, 0) */ }
});
```

Os painters rodam **uma vez** (viram sprite), então podem ser tão detalhados quanto quiser sem custo por frame. Partes do castelo ficam em `PARTS` (`js/render/castleRenderer.js`): cada uma tem um limiar de progresso, uma altura e um painter; basta acrescentar uma entrada.

### Novas regras
Condições de vitória/derrota, pontuação e HUD ficam em `js/game.js` (`simStep`, `handleEvents`, `winLevel`, `loseLevel`). A simulação avisa o que aconteceu por eventos (`player.events`: `jump`, `land`, `spill`, `dump`, `crab`…); o jogo decide o que fazer com cada um.

---

## 🗂 Estrutura

```
app-betina-castelo/
├── index.html                    # shell da UI, HUD, botões de toque, overlays
├── css/style.css                 # interface responsiva
├── js/
│   ├── themeConfig.js            # DADOS: temas, física, regras, fases + defineTheme
│   ├── noise.js                  # Perlin 1D semeado + utilidades matemáticas
│   ├── terrain.js                # SIMULAÇÃO: height field com cache de alturas
│   ├── world.js                  # SIMULAÇÃO: praia, maré, ondas grandes, parâmetros por fase
│   ├── castle.js                 # SIMULAÇÃO: progresso do castelo
│   ├── player.js                 # SIMULAÇÃO: Betina (corrida, pulo, balde, energia)
│   ├── critters.js               # SIMULAÇÃO: caranguejos
│   ├── pickups.js                # SIMULAÇÃO: conchinhas e picolés
│   ├── camera.js                 # seguir com lerp, look-ahead, shake
│   ├── audio.js                  # synth WebAudio: mar, passos, respingos, jingles
│   ├── render/
│   │   ├── kit.js                # cores, cache de sprites, presets de qualidade, registros
│   │   ├── scenes.js             # cenários parallax pré-renderizados ('sea', 'hills')
│   │   ├── terrainRenderer.js    # areia, estratos, vegetação, props ('shore', 'beach', 'meadow')
│   │   ├── seaRenderer.js        # areia molhada, água rasa, espuma, aviso de onda
│   │   ├── characters.js         # Betina animada e caranguejos
│   │   ├── camp.js               # guarda-sol, pai e amigos, balões de fala
│   │   ├── castleRenderer.js     # castelo em partes que crescem com o progresso
│   │   ├── pickupRenderer.js     # conchinhas e picolés
│   │   └── effects.js            # respingos, poeira, confete, textos
│   ├── game.js                   # loop, estados, regras, input, UI, qualidade
│   └── main.js                   # bootstrap + polyfill de roundRect
└── tools/
    ├── serve.js                  # servidor estático sem dependências
    ├── check.js                  # contrato dos temas + simulação + bot
    └── simulate.js               # bot que joga as fases (npm run simulate)
```

Máquina de estados: `menu → playing → clearing → won → (próxima fase)` e `playing → dying → over → (tentar de novo)`.

---

## 🚀 Gráficos e desempenho

- **Cache de sprites:** Betina (cabeça, tronco, balde), caranguejos, pessoas, guarda-sol, partes do castelo, conchinhas e textos são pintados uma vez em canvases offscreen e depois só copiados. Só membros e pêndulos (tranças, balde) são desenhados ao vivo.
- **Cenário pré-renderizado:** céu e ilhas viram faixas ladrilháveis; o fundo inteiro custa poucos `drawImage` por frame.
- **Alturas em cache:** o terreno amostra o ruído uma vez e interpola.
- **Presets** `AUTO` / `ALTO` / `MÉDIO` / `BAIXO` (tecla `G` ou `?q=low`): resolução, camadas do fundo, estratos, partículas e brilhos. O `AUTO` desce sozinho se os frames passarem de ~23 ms por mais de 2 s.
- **Medido** (Chrome no Mac, 1440×900 @2×, castelo a 85%): ~1,2 ms de canvas por frame no ALTO, ~0,8 ms no MÉDIO e ~0,5 ms no BAIXO.

---

## ✅ Testes

```bash
npm run check        # arquivos, IDs, ordem dos scripts, contrato dos temas, maré, bot
npm run simulate     # o bot joga as fases (npm run simulate -- tarde 8)
```

`check.js` valida: arquivos e IDs da UI; ordem de carregamento; contrato de cada tema (chaves de física e se `scene`, `decorSet` e sprites existem nos registros — o erro lista os ids disponíveis); herança de `defineTheme` sem mutar o pai; que a simulação não desenha nem toca o DOM; que a linha d'água fica sempre na praia durante toda a maré; que o cache de alturas acompanha o terreno exato; que **um bot consegue vencer as fases 1–3 de cada tema**; e que correr bruscamente derrama mais do que correr suave.

---

## 🔧 Ajustes rápidos

- **Mais difícil:** `levels.timeSlack` menor, `physics.spillThreshold` menor, `levels.list[n].crabs` maior.
- **Praia maior / menor:** `levels.list[n].shore` (distância até o mar, em px; 26 px = 1 m).
- **Balde mais pesado:** `physics.loadSlow`; enche mais rápido: `physics.scoopRate`.
- **Sem pressão:** `rules.sunset: false` (sem relógio) e/ou `rules.energy: false`.
- **Menos/mais caranguejos e ondas:** `rules.crabs`, `rules.waves`.
- **Textos e falas:** `labels` (inclui `cheers`, as frases do pessoal do guarda-sol).
