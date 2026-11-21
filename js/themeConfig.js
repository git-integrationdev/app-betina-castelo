/* ============================================================================
 * CASTELO DA BETINA — themeConfig
 * Everything that changes between themes lives here: colours, physics,
 * gameplay rules, level progression and which painters draw the scenery.
 *
 *   background.scene     → HCR.render.scenes    (js/render/scenes.js)
 *   terrain.decorSet     → HCR.render.decor     (js/render/terrainRenderer.js)
 *   pickups.coinSprite   → HCR.render.pickups   (js/render/pickupRenderer.js)
 *   pickups.fuelSprite   → HCR.render.pickups
 *
 * A new look or difficulty is a few lines — inherit and override:
 *
 *   HCR.defineTheme('noite', {
 *     extends: 'dia',
 *     name: 'Noite de Lua Cheia',
 *     physics: { runSpeed: 240 },
 *     levels: { timeSlack: 1.8 },
 *     background: { sky: ['#10204a', '#233a7a', '#5a5fa8'] }
 *   });
 * ========================================================================== */
(function (root) {
  'use strict';

  const THEMES = {
    /* ======================================================================
     * THEME 1 — MANHÃ DE SOL
     * ==================================================================== */
    dia: {
      id: 'dia',
      name: 'Manhã de Sol',
      shortName: 'MANHÃ',
      tagline: 'A Betina precisa de um castelo gigante antes do sol baixar.',
      bestKey: 'betina.best.dia',

      labels: {
        progress: 'CASTELO',
        time: 'SOL',
        level: 'FASE',
        coin: 'CONCHINHAS',
        fuel: 'ENERGIA',
        best: 'MAIS ALTA',
        start: 'COMEÇAR A BRINCAR',
        retry: 'TENTAR DE NOVO',
        next: 'PRÓXIMA FASE',
        menu: 'MENU',
        gameTitle: 'CASTELO DA BETINA',
        gameSubtitle: 'Aventura na Praia',
        brandSub: 'PRAIA',
        fuelContainer: 'picolés',
        statA: 'BALDES',
        statB: 'CONCHINHAS',
        statC: 'ESTRELAS',
        winTitle: 'CASTELO PRONTO!',
        winReason: 'A família inteira aplaudiu. Hora de uma praia ainda maior!',
        loseTitle: 'O SOL SE PÔS',
        loseReason: 'Acabou o tempo de brincar. Vamos tentar de novo?',
        hintSea: 'Vá até o mar encher o balde!',
        hintCastle: 'Leve a areia até o castelo!',
        hintCrab: 'Pule o caranguejo!',
        hintWave: 'Ondona vindo!',
        hintTired: 'Betina cansou! Descanse na sombra.',
        cheers: ['Isso aí, Betina!', 'Que balde cheio!', 'Falta pouco!', 'Vai, vai, vai!', 'Que castelo lindo!'],
        winCheer: 'Parabéns, Betina!'
      },

      /* Walking, bucket and stamina tuning. Speeds in px/s, 26 px = 1 m. */
      physics: {
        runSpeed: 285,
        accel: 1500,
        decel: 2100,
        airControl: 0.45,
        gravity: 2150,
        jumpSpeed: 690,
        loadSlow: 0.3,          // a full bucket slows her by 30 %
        wadeSlow: 0.55,         // deep water slows her by 55 %
        wadeFull: 60,           // px of depth where wading is slowest
        slopeGain: 0.55,
        tiredSlow: 0.55,
        // Bucket
        scoopRate: 1.6,         // bucket fills per second in the wet sand
        dumpRate: 3.2,          // bucket empties per second at the castle
        sloshK: 60,
        sloshC: 6.5,
        sloshGain: 0.02,
        landKick: 0.01,
        spillThreshold: 0.78,
        spillRate: 0.55,
        // Stamina ("energia")
        energyMax: 100,
        energyRun: 2.5,
        energyIdle: 4,
        energyShade: 16,
        energyJump: 1.2,
        tiredRecover: 18,
        // Pickups & hazards
        pickupRadius: 46,
        energyPerPop: 45,
        crabSpill: 0.4,
        crabStun: 0.75,
        waveSpill: 0.3
      },

      rules: {
        energy: true,     // stamina drains while running; rest in the shade
        sunset: true,     // the level timer; the sky turns orange as it runs out
        crabs: true,
        waves: true
      },

      /* Hand-tuned first levels, then a formula keeps them going forever. */
      levels: {
        list: [
          { shore: 1150, buckets: 5, crabs: 1, waveEvery: 0 },
          { shore: 1450, buckets: 6, crabs: 2, waveEvery: 22 },
          { shore: 1750, buckets: 7, crabs: 3, waveEvery: 18 },
          { shore: 2050, buckets: 8, crabs: 4, waveEvery: 16 },
          { shore: 2350, buckets: 9, crabs: 5, waveEvery: 14 }
        ],
        extend: { shore: 300, buckets: 1, crabs: 1, maxCrabs: 8, wave: 1, minWave: 10 },
        // time = buckets × (round trip + scooping) × slack + base
        pace: 260,
        fetchSeconds: 3.2,
        timeSlack: 1.75,
        timeBase: 12
      },

      player: {
        scale: 1,
        height: 68,
        headRadius: 11.5
      },

      colors: {
        outline: '#3a2418',
        skin: '#eca77a',
        skinDark: '#d98d62',
        blush: 'rgba(255,110,120,.45)',
        hair: '#4a2a1a',
        hairLight: '#6d4228',
        bow: '#ffd166',
        suit: '#ff6f91',
        suitDark: '#e24a73',
        suitDot: '#fff4e0',
        skirt: '#2ec4b6',
        skirtDark: '#1d9c91',
        bucket: '#ff5252',
        bucketDark: '#c92a2a',
        bucketRim: '#ffd23f',
        bucketHandle: '#2b7bd6',
        sandWet: '#b98a52',
        sandWetDark: '#8f6638',
        waterDrop: '#8fe3ff',
        shadow: 'rgba(60,30,0,.28)',
        dust: '#f0d5a4'
      },

      camp: {
        x: 70,                 // umbrella pole
        shadeFrom: -55,        // shade (rest) zone
        shadeTo: 195,
        panels: ['#ff6f91', '#fff4e0', '#2ec4b6', '#fff4e0'],
        pole: '#efe6d2',
        poleDark: '#b9ad94',
        towelA: '#ff8fab',
        towelB: '#fff4e0',
        towelC: '#4cc9c0',
        chair: '#ffd166',
        chairDark: '#e0a93a',
        cooler: '#2f7fd6',
        coolerDark: '#1f5aa0',
        bag: '#ff9f68',
        people: {
          dad:    { skin: '#d9a27a', hair: '#2b1b12', top: '#4aa3df', bottom: '#2b3a55', cap: '#ff5252' },
          friendA:{ skin: '#f0c09a', hair: '#6b3a1f', top: '#ff9f68', bottom: '#ffd166' },
          friendB:{ skin: '#c68863', hair: '#1e1a17', top: '#f2d24b', bottom: '#2f7fd6' }
        }
      },

      castle: {
        x: 470,                // centre of the building site
        dumpHalf: 125,         // reach of the bucket (before scaling)
        sand: '#e8c98a',
        sandLight: '#f7e3b2',
        sandDark: '#c59a5a',
        sandLine: 'rgba(120,80,30,.28)',
        flag: '#ff4d6d',
        flagPole: '#f6f1e6',
        shellA: '#fff1e6',
        shellB: '#ffb3c1'
      },

      pickups: {
        coinSprite: 'shell',
        fuelSprite: 'popsicle',
        coinText: '+1',
        coinSound: 'shell',
        coin: '#ffd6e0',
        coinLight: '#ffffff',
        coinDark: '#e89ab0',
        coinIcon: '#c95a7d',
        fuel: '#ff8fab',
        fuelLight: '#ffd1dc',
        fuelDark: '#d14a74',
        fuelCap: '#ffd166',
        glow: 'rgba(255,214,230,.6)'
      },

      terrain: {
        decorSet: 'shore',
        surface: '#f1ce88',
        surfaceLight: '#ffeab4',
        surfaceDark: '#cfa65d',
        soilTop: '#c69a5c',
        soilMid: '#a97b42',
        soilDeep: '#6b4a28',
        soilLine: 'rgba(255,244,214,.11)',
        pebble1: '#dcb87c',
        pebble2: '#7b562f',
        decorColor: '#fff3d2',
        decorDark: '#d5ab6c',
        dust: '#f0d5a4',
        ambient: 'rgba(45,190,200,.10)',
        rock: '#a9a394',
        rockDark: '#6a6558',
        trunk: '#8a6a47',
        foliage: '#3f9a6c',
        foliageLight: '#86d48c',
        foliageDark: '#1f6b53',
        flower: '#ff8f7a',
        flowerAlt: '#ffd166',
        sign: '#f4f1e6',
        signDark: '#e2563f',
        signInk: '#0b2730',
        /* The shallows, drawn over the sand to the right of the waterline. */
        water: {
          top: 'rgba(96,222,226,.70)',
          mid: 'rgba(30,160,182,.82)',
          deep: 'rgba(8,104,130,.94)',
          foam: 'rgba(255,255,255,.92)',
          ripple: 'rgba(235,255,252,.55)',
          wet: 'rgba(112,72,30,.42)'
        }
      },

      background: {
        scene: 'sea',
        sky: ['#5fc9e4', '#a9ecec', '#ffedc0'],
        sun: '#fff7d6',
        sunGlow: 'rgba(255,240,170,.5)',
        cloud: 'rgba(255,255,255,.86)',
        cloudShade: 'rgba(224,248,248,.7)',
        haze: 'rgba(255,239,196,.32)',
        seaFar: '#1d8fa2',
        seaMid: '#0e7488',
        seaNear: '#085b70',
        wave: 'rgba(210,255,248,.45)',
        islandFar: '#6c9f8f',
        islandNear: '#2f7a6d',
        islandDark: '#1e5b52',
        palm: '#1e5b4d',
        palmLight: '#3c8772',
        gull: 'rgba(40,70,70,.55)',
        motes: 'rgba(255,255,255,.5)',
        sail: '#fdf8ea',
        hull: '#c9503a',
        sand: '#e9d39c',
        /* Colour the sky drifts towards as the timer runs out. */
        dusk: ['rgba(255,120,70,.55)', 'rgba(150,60,120,.32)']
      },

      ui: {
        chrome: '#0f6d86',
        accent: '#ff7aa2',
        accent2: '#ffb35a',
        accentInk: '#3a0f1f',
        fuelA: '#ff9a3c',
        fuelB: '#ffe27a',
        glass: 'rgba(8, 44, 54, .74)',
        glassLight: 'rgba(255,255,255,.1)',
        ink: '#fff8ee',
        muted: 'rgba(255,248,238,.66)',
        track: 'rgba(255,255,255,.18)'
      }
    }
  };

  /* ------------------------------------------------------------------------
   * defineTheme — register a theme, optionally inheriting from another one.
   * Objects are merged deeply; arrays and scalars are replaced.
   * ---------------------------------------------------------------------- */
  function isPlain(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function deepMerge(base, extra) {
    const out = {};
    for (const key of Object.keys(base || {})) {
      out[key] = isPlain(base[key]) ? deepMerge(base[key], {}) : base[key];
    }
    for (const key of Object.keys(extra || {})) {
      out[key] = isPlain(extra[key]) && isPlain(out[key])
        ? deepMerge(out[key], extra[key])
        : isPlain(extra[key]) ? deepMerge(extra[key], {}) : extra[key];
    }
    return out;
  }

  function defineTheme(id, config) {
    const parentId = config.extends;
    if (parentId && !THEMES[parentId]) {
      throw new Error(`[HCR] tema base "${parentId}" não existe (em defineTheme('${id}')).`);
    }
    const theme = parentId ? deepMerge(THEMES[parentId], config) : deepMerge(config, {});
    delete theme.extends;
    theme.id = id;
    if (!config.bestKey) theme.bestKey = `betina.best.${id}`;
    if (!config.name) theme.name = id;
    if (!config.shortName) theme.shortName = theme.name.toUpperCase();
    THEMES[id] = theme;
    return theme;
  }

  /* ======================================================================
   * THEME 2 — TARDE DOURADA  (same game, warmer light, tighter clock)
   * ==================================================================== */
  defineTheme('tarde', {
    extends: 'dia',
    name: 'Tarde Dourada',
    shortName: 'TARDE',
    tagline: 'O sol já está baixo e a maré está subindo. Corra, Betina!',
    levels: { timeSlack: 1.5 },
    colors: { shadow: 'rgba(80,20,40,.3)' },
    terrain: {
      surface: '#f4c78a',
      surfaceLight: '#ffe2b0',
      surfaceDark: '#d49a5c',
      soilTop: '#c58a56',
      soilMid: '#a76f42',
      soilDeep: '#6a4128',
      ambient: 'rgba(255,150,90,.12)',
      water: {
        top: 'rgba(255,170,130,.62)',
        mid: 'rgba(214,106,128,.78)',
        deep: 'rgba(96,52,110,.92)'
      }
    },
    background: {
      sky: ['#ff9a6b', '#ffc99a', '#ffe9c0'],
      sun: '#fff0c8',
      sunGlow: 'rgba(255,190,110,.62)',
      cloud: 'rgba(255,236,224,.9)',
      cloudShade: 'rgba(255,184,170,.75)',
      haze: 'rgba(255,196,140,.4)',
      seaFar: '#d9787f',
      seaMid: '#a85a86',
      seaNear: '#5d3b78',
      wave: 'rgba(255,224,200,.5)',
      islandFar: '#a86a86',
      islandNear: '#5e3d6e',
      islandDark: '#3d2a54',
      palm: '#2b2447',
      palmLight: '#4d3d70',
      gull: 'rgba(60,30,60,.55)',
      motes: 'rgba(255,224,170,.6)',
      dusk: ['rgba(255,90,70,.5)', 'rgba(110,40,120,.38)']
    },
    ui: {
      chrome: '#7a3a5c',
      accent: '#ffb35a',
      accent2: '#ff6f91',
      glass: 'rgba(52, 22, 40, .74)'
    }
  });

  root.HCR = root.HCR || {};
  root.HCR.THEMES = THEMES;
  root.HCR.defineTheme = defineTheme;
  root.HCR.DEFAULT_THEME = 'dia';
  root.HCR.PIXELS_PER_METER = 26;
})(typeof window !== 'undefined' ? window : globalThis);
