/* ============================================================================
 * CASTELO DA BETINA — game orchestration
 * States: menu → playing → clearing → won → (next level) …
 *                        ↘ dying → over → (retry)
 * The simulation modules (world, player, castle, crabs, pickups) never draw;
 * the renderers (js/render/*) never decide rules. This file connects them.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, hash } = HCR.math;
  const QUALITY_KEY = 'betina.quality';
  const THEME_KEY = 'betina.theme';
  const CLEAR_SECONDS = 3;

  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      // The scene paints an opaque sky every frame, so the canvas needs no alpha.
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.viewW = 1280;
      this.viewH = 720;
      this.dpr = 1;

      // Graphics quality: 'auto' steps down by itself when frames run long.
      this.qualityMode = loadQualityMode();
      this.autoQuality = 'high';
      this.slowTime = 0;
      this.frameAvg = 1 / 60;
      this.scene = null;
      this.sceneKey = '';
      this.sceneDue = 0;
      R.quality = R.QUALITY[this.qualityMode === 'auto' ? this.autoQuality : this.qualityMode];

      this.camera = new HCR.Camera();
      this.effects = new R.Effects();
      this.audio = new HCR.GameAudio();

      this.themeId = HCR.DEFAULT_THEME;
      this.theme = HCR.THEMES[this.themeId];
      this.state = 'menu';
      this.level = 1;
      this.input = { left: false, right: false, jumpPressed: false };
      this.keyState = { left: false, right: false, jump: false };
      this.touchState = { left: false, right: false, jump: false };
      this.jumpQueued = false;
      this.best = 0;
      this.coins = 0;          // this level
      this.deliveries = 0;     // this level
      this.simTime = 0;
      this.time = 0;
      this.timeLeft = 0;
      this.timeTotal = 1;
      this.clearTimer = 0;
      this.deathTimer = 0;
      this.hudTimer = 0;
      this.accumulator = 0;
      this.lastTime = performance.now();
      this.dumpAccum = 0;
      this.hints = {};
      this.hintTimer = 0;
      this.hintTrip = false;
      this.lastTick = -1;
      this.frameDt = 1 / 60;
      this.toastTimer = null;
      this.newRecord = false;

      this.bindUI();
      this.bindInput();
      this.resize();
      this.setTheme(loadTheme(), { initial: true });

      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);

      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.pause();
      });
    }

    /* ------------------------------------------------------------ lifecycle */
    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const q = R.quality;
      // Resolution budget: device ratio, capped by the preset and by a total
      // pixel count so 4K/retina screens don't quadruple the fill cost.
      const device = window.devicePixelRatio || 1;
      const byPixels = Math.sqrt(q.maxPixels / Math.max(1, w * h));
      this.dpr = Math.max(0.75, Math.min(device, q.pixelRatio, byPixels));
      this.viewW = w;
      this.viewH = h;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.camera.setViewport(w, h);
      // Sprites are baked at the density they will be shown at.
      R.sprites.setResolution(this.dpr * this.camera.baseZoom);
      this.sceneDue = performance.now() + (this.scene ? 140 : 0);
      if (this.player) this.camera.snap(this.player);
    }

    /* ------------------------------------------------------------- quality */
    setQualityMode(mode) {
      this.qualityMode = mode;
      writeStorage(QUALITY_KEY, mode);
      if (mode === 'auto') this.autoQuality = 'high';
      this.applyQuality();
    }

    cycleQuality() {
      const order = ['auto', 'high', 'medium', 'low'];
      this.setQualityMode(order[(order.indexOf(this.qualityMode) + 1) % order.length]);
      const q = R.quality;
      this.showToast(this.qualityMode === 'auto' ? `Gráficos: AUTO (${q.label})` : `Gráficos: ${q.label}`);
    }

    applyQuality() {
      const id = this.qualityMode === 'auto' ? this.autoQuality : this.qualityMode;
      R.quality = R.QUALITY[id] || R.QUALITY.high;
      R.sprites.clear();
      this.sceneKey = '';
      this.slowTime = 0;
      this.resize();
      this.sceneDue = 0;
      this.rebuildViews();
      this.updateQualityUI();
    }

    /* In auto mode, sustained long frames step the preset down one notch. */
    governQuality(rawDt) {
      if (this.qualityMode !== 'auto' || this.state !== 'playing') return;
      if (rawDt > 0.25) return;                       // tab switch / hitch
      this.frameAvg += (rawDt - this.frameAvg) * 0.06;
      if (this.frameAvg > 1 / 44) this.slowTime += rawDt;
      else this.slowTime = Math.max(0, this.slowTime - rawDt * 2);
      if (this.slowTime > 2.2) {
        const order = R.QUALITY_ORDER;
        const idx = order.indexOf(this.autoQuality);
        this.slowTime = 0;
        this.frameAvg = 1 / 60;
        if (idx > 0) {
          this.autoQuality = order[idx - 1];
          this.applyQuality();
        }
      }
    }

    updateQualityUI() {
      const q = R.quality;
      document.body.dataset.quality = q.id;
      const btn = this.el && this.el.qualityBtn;
      if (btn) {
        const label = this.qualityMode === 'auto' ? 'AUTO' : q.label;
        const span = btn.querySelector('[data-quality-label]');
        if (span) span.textContent = label;
        btn.title = `Qualidade gráfica: ${label} (G)`;
      }
    }

    ensureScene(now) {
      const key = `${this.themeId}|${this.viewW}x${this.viewH}|${R.quality.id}`;
      if (key === this.sceneKey) return;
      if (this.scene && now < this.sceneDue) return;   // wait for resize to settle
      this.scene = R.buildScene(this.theme, this.viewW, this.viewH);
      this.sceneKey = key;
    }

    /* --------------------------------------------------------------- themes */
    setTheme(id, options) {
      const opts = options || {};
      if (!HCR.THEMES[id]) id = HCR.DEFAULT_THEME;
      this.themeId = id;
      this.theme = HCR.THEMES[id];
      this.best = this.loadBest();
      writeStorage(THEME_KEY, id);
      R.sprites.clear();
      this.sceneKey = '';
      this.sceneDue = 0;
      this.applyThemeVars();
      this.updateThemeUI();

      const wasActive = this.state === 'playing' || this.state === 'paused';
      if (!wasActive) this.level = 1;
      this.loadLevel(this.level, wasActive ? 'playing' : 'menu');

      if (!opts.initial && wasActive) {
        this.showToast(`${this.theme.name} · ${this.theme.tagline}`);
        this.audio.click();
      }
      this.updateSoundUI();
    }

    applyThemeVars() {
      const ui = this.theme.ui;
      const s = document.documentElement.style;
      s.setProperty('--accent', ui.accent);
      s.setProperty('--accent-2', ui.accent2);
      s.setProperty('--accent-ink', ui.accentInk);
      s.setProperty('--fuel-a', ui.fuelA);
      s.setProperty('--fuel-b', ui.fuelB);
      s.setProperty('--glass', ui.glass);
      s.setProperty('--glass-light', ui.glassLight);
      s.setProperty('--ink', ui.ink);
      s.setProperty('--muted', ui.muted);
      s.setProperty('--track', ui.track);
      document.documentElement.dataset.theme = this.themeId;
      document.body.dataset.theme = this.themeId;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', ui.chrome || this.theme.background.sky[0]);
    }

    loadBest() {
      return Number(readStorage(this.theme.bestKey, '0')) || 0;
    }

    /* ---------------------------------------------------------------- levels */
    /** Build everything for one level and put the game in `mode`. */
    loadLevel(level, mode) {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      const theme = this.theme;
      this.level = level;
      this.state = mode;
      this.keyState.left = this.keyState.right = this.keyState.jump = false;
      this.touchState.left = this.touchState.right = this.touchState.jump = false;
      this.jumpQueued = false;
      this.syncInput();
      this.syncPedals();

      const seed = (Math.random() * 0x7fffffff) >>> 0;
      this.world = new HCR.BeachWorld(theme, level, seed);
      this.castle = new HCR.Castle(this.world.p.buckets, this.world.p.castleScale, this.world.castleX);
      this.player = new HCR.Betina(theme, this.world);
      this.crabs = new HCR.CrabField(this.world);
      this.pickups = new HCR.PickupField(this.world, theme, {
        onCoin: (item) => this.collectCoin(item),
        onFuel: (item) => this.collectFuel(item)
      });
      this.rules = theme.rules;
      this.rebuildViews();

      this.timeTotal = this.world.p.time;
      this.timeLeft = this.timeTotal;
      this.simTime = 0;
      this.coins = 0;
      this.deliveries = 0;
      this.dumpAccum = 0;
      this.clearTimer = 0;
      this.deathTimer = 0;
      this.hints = {};
      this.hintTrip = false;
      this.lastTick = -1;
      this.newRecord = false;
      this.accumulator = 0;
      this.effects.clear();
      this.world.update(0);
      this.camera.setViewport(this.viewW, this.viewH);
      this.camera.snap(this.player);

      document.body.dataset.fuel = this.rules.energy ? 'on' : 'off';
      document.body.dataset.state = mode;
      this.hideOverlays();
      if (mode === 'menu') this.showOverlay('startOverlay');
      this.hideHint();
      this.updateStaticTexts();
      this.updateHUD(true);
      this.audio.ambient(false, 0);
      if (mode === 'playing') this.announceLevel();
    }

    /** (Re)create the views that bake sprites for the current theme/quality. */
    rebuildViews() {
      if (!this.world) return;
      const theme = this.theme;
      this.terrainView = new R.TerrainRenderer(this.world, theme, {
        propsFrom: this.world.castleX + 260,
        propsUntil: this.world.shore - 240
      });
      this.seaView = new R.SeaRenderer(theme, this.world);
      this.betinaView = new R.BetinaRenderer(theme);
      this.crabView = new R.CrabRenderer(theme);
      this.campView = new R.CampRenderer(theme, this.world);
      this.castleView = new R.CastleRenderer(theme, this.world, this.castle);
      this.pickupView = new R.PickupRenderer(this.pickups, this.world, theme);
    }

    announceLevel() {
      const b = document.getElementById('banner');
      if (!b) return;
      const label = document.getElementById('bannerLabel');
      const text = document.getElementById('bannerText');
      if (label) label.textContent = this.theme.labels.level;
      if (text) text.textContent = String(this.level);
      b.classList.remove('is-active');
      void b.offsetWidth;
      b.classList.add('is-active');
      this.showHint(this.theme.labels.hintSea, 'sea', 4.2, true);
    }

    startRun() {
      this.audio.init();
      this.audio.click();
      this.loadLevel(1, 'playing');
    }

    retryLevel() {
      this.audio.init();
      this.audio.click();
      this.loadLevel(this.level, 'playing');
    }

    nextLevel() {
      this.audio.init();
      this.audio.click();
      this.loadLevel(this.level + 1, 'playing');
    }

    /** What the big primary button does on the result screen. */
    primaryAction() {
      if (this.state === 'won') this.nextLevel();
      else this.retryLevel();
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      document.body.dataset.state = 'paused';
      this.showOverlay('pauseOverlay');
      this.audio.ambient(false, 0);
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      document.body.dataset.state = 'playing';
      this.hideOverlays();
      this.audio.init();
    }

    /** Time ran out before the castle was done. */
    loseLevel() {
      if (this.state !== 'playing') return;
      this.state = 'dying';
      this.deathTimer = 1.1;
      document.body.dataset.state = 'dying';
      this.timeLeft = 0;
      this.hideHint();
      this.audio.over();
      this.effects.text(this.player.x, this.player.y - 90, 'O sol se pôs!', this.theme.ui.accent, 22);
    }

    /** The castle is finished: celebrate, then show the result. */
    winLevel() {
      if (this.state !== 'playing') return;
      this.state = 'clearing';
      this.clearTimer = CLEAR_SECONDS;
      document.body.dataset.state = 'clearing';
      this.hideHint();
      this.audio.levelUp();
      this.audio.cheer();
      this.camera.kick(5);
      this.campView.cheer(this.theme.labels.winCheer, CLEAR_SECONDS);
      const cx = this.castle.x;
      const top = this.castleView.topY();
      const colors = [this.theme.ui.accent, this.theme.ui.accent2, '#ffd23f', '#4cc9c0', '#ffffff', '#ff6f91'];
      this.effects.confetti(cx, top + 40, colors, 70);
      this.effects.confetti(this.world.campX + 40, this.world.heightAt(this.world.campX) - 150, colors, 40);
      this.effects.text(cx, top - 24, this.theme.labels.winTitle, '#fff6c4', 26);
    }

    starsFor() {
      const r = this.timeLeft / this.timeTotal;
      return r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1;
    }

    showResult(won) {
      const t = this.theme;
      const L = t.labels;
      this.state = won ? 'won' : 'over';
      document.body.dataset.state = this.state;
      this.newRecord = false;
      if (won && this.level > this.best) {
        this.newRecord = true;
        this.best = this.level;
        writeStorage(t.bestKey, String(this.level));
      }
      const el = this.el;
      const stars = won ? this.starsFor() : 0;
      if (el.overEyebrow) el.overEyebrow.textContent = won ? `${L.level} ${this.level}` : 'FIM DA BRINCADEIRA';
      if (el.overTitle) el.overTitle.textContent = won ? L.winTitle : L.loseTitle;
      if (el.overReason) {
        el.overReason.textContent = won
          ? L.winReason
          : `${L.loseReason} Castelo: ${Math.round(this.castle.progress * 100)}%.`;
      }
      if (el.overDistance) el.overDistance.textContent = String(this.deliveries);
      if (el.overCoins) el.overCoins.textContent = String(this.coins);
      if (el.overBest) {
        el.overBest.textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '—';
        el.overBest.classList.toggle('is-stars', won);
      }
      if (el.retryLabel) el.retryLabel.textContent = won ? L.next : L.retry;
      if (el.newRecord) el.newRecord.hidden = !this.newRecord;
      if (el.overHint) {
        el.overHint.textContent = won
          ? `Próxima: praia maior, mais caranguejos e castelo mais alto.`
          : 'Dica: tome picolés pelo caminho e descanse na sombra quando cansar.';
      }
      this.updateBestUI();
      this.showOverlay('overOverlay');
    }

    /* -------------------------------------------------------------- pickups */
    collectCoin(item) {
      this.coins += 1;
      const p = this.theme.pickups;
      this.effects.sparks(item.x, item.y, p.coinLight, 9, 130);
      this.effects.ring(item.x, item.y, p.glow);
      this.effects.text(item.x, item.y - 22, p.coinText || '+1', p.coinLight, 16);
      this.audio.shell();
      this.updateHUD(true);
    }

    collectFuel(item) {
      const ph = this.theme.physics;
      const before = this.player.energy;
      this.player.energy = Math.min(ph.energyMax, before + ph.energyPerPop);
      if (this.player.energy > ph.tiredRecover) this.player.tired = false;
      const gained = Math.round(this.player.energy - before);
      const p = this.theme.pickups;
      this.effects.sparks(item.x, item.y, p.fuelLight, 14, 160);
      this.effects.ring(item.x, item.y, p.glow);
      this.effects.text(item.x, item.y - 30, `+${gained}% energia`, '#fff6e0', 16);
      this.audio.pop();
      this.updateHUD(true);
    }

    /* ---------------------------------------------------------------- input */
    bindInput() {
      const relevant = new Set([
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'
      ]);

      window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'SELECT') return;

        if (e.code === 'Enter') {
          e.preventDefault();
          if (this.state === 'menu') this.startRun();
          else if (this.state === 'over' || this.state === 'won') this.primaryAction();
          else if (this.state === 'paused') this.resume();
          return;
        }
        if (e.code === 'KeyR') {
          e.preventDefault();
          if (this.state !== 'menu') this.retryLevel();
          return;
        }
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          if (this.state === 'playing') this.pause();
          else if (this.state === 'paused') this.resume();
          return;
        }
        if (e.code === 'KeyM') {
          this.audio.init();
          this.audio.toggleMute();
          this.updateSoundUI();
          return;
        }
        if (e.code === 'KeyG') {
          this.cycleQuality();
          return;
        }
        if (relevant.has(e.code)) {
          e.preventDefault();
          if (this.state === 'menu' && e.code === 'Space') {
            this.startRun();
            return;
          }
          if ((this.state === 'over' || this.state === 'won') && e.code === 'Space') {
            this.primaryAction();
            return;
          }
          if (!e.repeat && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) {
            this.jumpQueued = true;
          }
          this.setKey(e.code, true);
        }
      });

      window.addEventListener('keyup', (e) => {
        if (relevant.has(e.code)) {
          e.preventDefault();
          this.setKey(e.code, false);
        }
      });

      window.addEventListener('blur', () => {
        this.keyState.left = this.keyState.right = this.keyState.jump = false;
        this.touchState.left = this.touchState.right = this.touchState.jump = false;
        this.syncInput();
        this.syncPedals();
      });

      const pedals = document.querySelectorAll('[data-pedal]');
      pedals.forEach((pedal) => {
        const which = pedal.dataset.pedal;
        const press = (e) => {
          e.preventDefault();
          this.audio.init();
          this.touchState[which] = true;
          if (which === 'jump') this.jumpQueued = true;
          this.syncInput();
          this.syncPedals();
          if (pedal.setPointerCapture && e.pointerId != null) {
            try {
              pedal.setPointerCapture(e.pointerId);
            } catch (err) {
              /* ignore */
            }
          }
        };
        const release = (e) => {
          if (e) e.preventDefault();
          this.touchState[which] = false;
          this.syncInput();
          this.syncPedals();
        };
        pedal.addEventListener('pointerdown', press);
        pedal.addEventListener('pointerup', release);
        pedal.addEventListener('pointercancel', release);
        pedal.addEventListener('lostpointercapture', release);
        pedal.addEventListener('contextmenu', (e) => e.preventDefault());
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setKey(code, down) {
      if (code === 'ArrowRight' || code === 'KeyD') this.keyState.right = down;
      if (code === 'ArrowLeft' || code === 'KeyA') this.keyState.left = down;
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') this.keyState.jump = down;
      this.syncInput();
      this.syncPedals();
    }

    syncInput() {
      this.input.left = this.keyState.left || this.touchState.left;
      this.input.right = this.keyState.right || this.touchState.right;
    }

    syncPedals() {
      for (const which of ['left', 'right', 'jump']) {
        const node = document.querySelector(`[data-pedal="${which}"]`);
        if (node) node.classList.toggle('is-down', this.keyState[which] || this.touchState[which]);
      }
    }

    /* ---------------------------------------------------------------- UI */
    bindUI() {
      const ids = [
        'themeSelect', 'soundBtn', 'qualityBtn', 'pauseBtn', 'startBtn', 'retryBtn', 'menuBtn',
        'resumeBtn', 'restartBtn', 'startOverlay', 'overOverlay', 'pauseOverlay', 'startTheme',
        'startTagline', 'startBest', 'startBestLabel', 'startBtnLabel', 'startCoinLabel',
        'startFuelContainer', 'overTitle', 'overReason', 'overEyebrow', 'overDistance',
        'overCoins', 'overBest', 'newRecord', 'overLabelA', 'overLabelB', 'overLabelC',
        'retryLabel', 'overHint', 'distanceValue', 'bestValue', 'coinValue', 'coinLabel',
        'fuelLabel', 'fuelFill', 'fuelPct', 'fuelWrap', 'toast', 'flash', 'distanceLabel',
        'bestLabel', 'clockValue', 'clockLabel', 'bucketLabel', 'bucketFill', 'hint'
      ];
      this.el = {};
      for (const id of ids) this.el[id] = document.getElementById(id);

      const el = this.el;
      if (el.qualityBtn) {
        el.qualityBtn.addEventListener('click', () => {
          this.cycleQuality();
          el.qualityBtn.blur();
        });
      }
      this.updateQualityUI();

      if (el.themeSelect) {
        // The selector is built from the registered themes — no HTML edits.
        const select = el.themeSelect;
        select.textContent = '';
        for (const id of Object.keys(HCR.THEMES)) {
          const option = document.createElement('option');
          option.value = id;
          option.textContent = HCR.THEMES[id].name;
          select.appendChild(option);
        }
        select.value = this.themeId;
        select.addEventListener('change', (e) => {
          this.audio.init();
          this.setTheme(e.target.value);
          if (e.target.blur) e.target.blur();
        });
      }
      if (el.soundBtn) {
        el.soundBtn.addEventListener('click', () => {
          this.audio.init();
          this.audio.toggleMute();
          this.updateSoundUI();
          this.audio.click();
        });
      }
      if (el.pauseBtn) {
        el.pauseBtn.addEventListener('click', () => {
          if (this.state === 'playing') this.pause();
          else if (this.state === 'paused') this.resume();
        });
      }
      if (el.startBtn) el.startBtn.addEventListener('click', () => this.startRun());
      if (el.retryBtn) el.retryBtn.addEventListener('click', () => this.primaryAction());
      if (el.restartBtn) el.restartBtn.addEventListener('click', () => this.retryLevel());
      if (el.resumeBtn) el.resumeBtn.addEventListener('click', () => this.resume());
      if (el.menuBtn) {
        el.menuBtn.addEventListener('click', () => {
          this.level = 1;
          this.loadLevel(1, 'menu');
          this.updateBestUI();
        });
      }
      this.updateSoundUI();
    }

    updateThemeUI() {
      const t = this.theme;
      const L = t.labels;
      const el = this.el;
      const set = (node, text) => { if (node) node.textContent = text; };
      if (el.themeSelect) el.themeSelect.value = this.themeId;
      set(el.startTheme, t.name);
      set(el.startTagline, t.tagline);
      set(el.startBtnLabel, L.start);
      set(el.startCoinLabel, L.coin.toLowerCase());
      set(el.startFuelContainer, L.fuelContainer);
      set(el.startBestLabel, L.best);
      set(el.coinLabel, L.coin);
      set(el.fuelLabel, L.fuel);
      set(el.distanceLabel, L.progress);
      set(el.bestLabel, L.level);
      set(el.clockLabel, L.time);
      set(el.overLabelA, L.statA);
      set(el.overLabelB, L.statB);
      set(el.overLabelC, L.statC);
      set(el.retryLabel, L.retry);
      set(document.getElementById('brandSub'), `${L.brandSub} · ${t.shortName}`);
      document.title = `${L.gameTitle} — ${L.gameSubtitle}`;
      this.updateBestUI();
    }

    updateStaticTexts() {
      if (this.el.startBest) this.el.startBest.textContent = this.best > 0 ? `${this.theme.labels.level} ${this.best}` : '—';
    }

    updateBestUI() {
      if (this.el.startBest) this.el.startBest.textContent = this.best > 0 ? `${this.theme.labels.level} ${this.best}` : '—';
    }

    updateSoundUI() {
      document.body.classList.toggle('is-muted', this.audio.muted);
      if (this.el.soundBtn) {
        this.el.soundBtn.setAttribute('aria-pressed', String(!this.audio.muted));
        this.el.soundBtn.title = this.audio.muted ? 'Ativar som' : 'Silenciar';
      }
    }

    showOverlay(id) {
      const node = this.el[id];
      if (!node) return;
      node.classList.add('is-visible');
      node.setAttribute('aria-hidden', 'false');
    }

    hideOverlays() {
      ['startOverlay', 'overOverlay', 'pauseOverlay'].forEach((key) => {
        const node = this.el[key];
        if (!node) return;
        node.classList.remove('is-visible');
        node.setAttribute('aria-hidden', 'true');
      });
    }

    showToast(message) {
      if (!this.el.toast) return;
      this.el.toast.textContent = message;
      this.el.toast.classList.add('is-visible');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.el.toast.classList.remove('is-visible');
      }, 2600);
    }

    /** A short coaching line under the HUD. Each key repeats at most every `gap` s. */
    showHint(text, key, seconds, force, warning) {
      const el = this.el.hint;
      if (!el) return;
      const now = this.time;
      if (!force && this.hints[key] !== undefined && now - this.hints[key] < 7) return;
      this.hints[key] = now;
      this.hintKey = key;
      el.textContent = text;
      el.classList.toggle('is-warning', !!warning);
      el.classList.add('is-visible');
      this.hintTimer = seconds || 3;
    }

    hideHint() {
      const el = this.el && this.el.hint;
      if (el) el.classList.remove('is-visible');
      this.hintTimer = 0;
      this.hintKey = '';
    }

    flash() {
      if (!this.el.flash) return;
      this.el.flash.classList.remove('is-active');
      // Force reflow so the animation can restart.
      void this.el.flash.offsetWidth;
      this.el.flash.classList.add('is-active');
    }

    updateHUD() {
      const el = this.el;
      const p = this.player;
      const ph = this.theme.physics;
      const pct = clamp(p.energy / ph.energyMax, 0, 1);
      if (el.distanceValue) el.distanceValue.textContent = String(Math.round(this.castle.progress * 100));
      if (el.coinValue) el.coinValue.textContent = String(this.coins);
      if (el.bestValue) el.bestValue.textContent = String(this.level);
      if (el.clockValue) {
        const s = Math.max(0, Math.ceil(this.timeLeft));
        el.clockValue.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        el.clockValue.classList.toggle('is-low', this.state === 'playing' && this.timeLeft < 15 && this.rules.sunset);
      }
      if (el.bucketFill) el.bucketFill.style.width = `${clamp(p.fill, 0, 1) * 100}%`;
      if (el.fuelFill) el.fuelFill.style.width = `${pct * 100}%`;
      if (el.fuelPct) el.fuelPct.textContent = `${Math.round(pct * 100)}%`;
      if (el.fuelWrap) el.fuelWrap.classList.toggle('is-low', (pct < 0.2 || p.tired) && this.state === 'playing');
    }

    /* ------------------------------------------------------------ simulation */
    /** One fixed 1/60 s step of the whole beach. */
    simStep(dt) {
      const w = this.world;
      const pl = this.player;
      const active = this.state === 'playing';

      this.simTime += dt;
      w.update(this.simTime);
      this.crabs.update(dt);

      const input = this.input;
      input.jumpPressed = this.jumpQueued && active;
      this.jumpQueued = false;
      const driven = active ? input : { left: false, right: false, jumpPressed: false };
      pl.step(dt, driven, active ? this.castle : null);

      if (active) {
        const crab = this.crabs.collide(pl);
        if (crab && pl.hitByCrab(Math.sign(crab.x - pl.x) || pl.facing)) this.crabs.scare(crab);
        if (w.wave > 0.5 && pl.x >= w.edge - 30) pl.pushedByWave();
        this.pickups.update(pl);

        if (this.rules.sunset) {
          this.timeLeft -= dt;
          if (this.timeLeft <= 0) this.loseLevel();
        }
      }
      this.castle.update(dt);
      this.handleEvents();

      // A delivery visit ends when the bucket stops pouring.
      if (!pl.dumping && this.dumpAccum > 0.04) this.finishDelivery();

      if (this.state === 'playing' && this.castle.complete) this.winLevel();
    }

    handleEvents() {
      const pl = this.player;
      const fx = this.effects;
      const t = this.theme;
      const col = t.colors;
      const events = pl.events;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        switch (e.type) {
          case 'step':
            this.audio.step(e.wet, e.speed);
            if (e.wet) {
              if (e.speed > 120 && Math.random() < 0.7) fx.splash(pl.x, pl.y - 2, col.waterDrop, 3, 70);
            } else if (e.speed > 130) {
              fx.dust(pl.x - pl.facing * 6, pl.y - 1, pl.facing, t.terrain.dust, 1);
            }
            break;
          case 'jump':
            this.audio.jump();
            fx.dust(pl.x, pl.y - 1, 0, t.terrain.dust, 2);
            break;
          case 'land':
            this.audio.land(e.impact, e.wet);
            if (e.wet) fx.splash(pl.x, pl.y - 2, col.waterDrop, 10, 150);
            else fx.burst(pl.x, pl.y - 2, t.terrain.dust, e.impact * 0.01);
            this.camera.kick(Math.min(3, e.impact * 0.003));
            break;
          case 'enterWater':
            this.audio.splash();
            fx.splash(pl.x, pl.y - 2, col.waterDrop, 12, 170);
            break;
          case 'scoopStart':
            this.audio.scoop();
            fx.splash(pl.x + pl.facing * 10, pl.y - 6, col.waterDrop, 9, 130);
            break;
          case 'bucketFull':
            this.audio.full();
            fx.text(pl.x, pl.y - 100, 'Balde cheio!', '#fff6c4', 18);
            fx.sparks(pl.bucketX || pl.x, pl.bucketY || pl.y - 30, col.sandWet, 8, 120);
            this.showHint(t.labels.hintCastle, 'castle', 3.4, true);
            break;
          case 'spill':
            if (e.kind === 'slosh') {
              fx.splash(pl.bucketX || pl.x, (pl.bucketY || pl.y - 30) - 4, col.sandWet, 2, 60);
              if (Math.random() < 0.3) this.audio.spill();
            } else {
              fx.splash(pl.bucketX || pl.x, (pl.bucketY || pl.y - 30) - 4, col.sandWet, 14, 190);
            }
            break;
          case 'dump':
            this.dumpAccum += e.amount;
            this.castle.add(e.amount);
            fx.grains(pl.bucketX || pl.x, (pl.bucketY || pl.y - 30) + 4, col.sandWet, 3, 5);
            if (Math.random() < 0.3) {
              fx.dust(this.castle.x + (Math.random() - 0.5) * 120, this.world.heightAt(this.castle.x) - 4, 0, t.terrain.dust, 1);
            }
            break;
          case 'crab':
            this.audio.crab();
            this.camera.kick(4);
            fx.sparks(pl.x, pl.y - 30, '#ff9a6b', 8, 150);
            fx.text(pl.x, pl.y - 96, 'Ai!', t.ui.accent, 22);
            break;
          case 'pushed':
            this.audio.wave();
            this.camera.kick(8);
            fx.splash(pl.x, pl.y - 10, col.waterDrop, 22, 240);
            fx.text(pl.x, pl.y - 96, 'Ondaaa!', t.ui.accent, 22);
            break;
          case 'tired':
            this.audio.tired();
            this.showHint(t.labels.hintTired, 'tired', 3.6, false, true);
            break;
          default:
            break;
        }
      }
      events.length = 0;
    }

    /** The bucket has been emptied over the castle: applause. */
    finishDelivery() {
      const gained = this.dumpAccum / this.castle.buckets;
      this.dumpAccum = 0;
      this.deliveries += 1;
      this.audio.build(this.castle.progress);
      this.camera.kick(2);
      this.hintTrip = false;
      const pct = Math.max(1, Math.round(gained * 100));
      if (!this.castle.complete) {
        this.effects.text(this.castle.x, this.castleView.topY() - 20, `+${pct}%`, '#fff6c4', 22);
      }
      this.effects.sparks(this.castle.x, this.castleView.topY() + 30, '#fff1c2', 12, 150);
      if (!this.castle.complete) {
        const phrases = this.theme.labels.cheers;
        this.campView.cheer(phrases[(this.deliveries + this.level) % phrases.length], 1.1);
        this.audio.cheer();
        this.pickups.respawn();
        this.showHint(this.theme.labels.hintSea, 'sea', 3, true);
      }
      this.updateHUD(true);
    }

    /** Context-sensitive coaching, evaluated a few times per second. */
    coach() {
      if (this.state !== 'playing') return;
      const pl = this.player;
      const w = this.world;
      const L = this.theme.labels;
      // Retire an instruction once it has been followed.
      if (this.hintKey === 'sea' && pl.fill > 0.05) this.hideHint();
      if (this.hintKey === 'castle' && pl.fill < 0.05) this.hideHint();
      if (w.warn > 0.15 && this.rules.waves) {
        this.showHint(L.hintWave, 'wave', 2.4, false, true);
        if (this.audio && Math.floor(w.warn * 6) !== this.lastWarnTick) {
          this.lastWarnTick = Math.floor(w.warn * 6);
          if (this.lastWarnTick % 3 === 0) this.audio.warn();
        }
      }
      const crab = this.crabs.nextAhead(pl, 230);
      if (crab && Math.abs(crab.x - pl.x) < 200) this.showHint(L.hintCrab, 'crab', 1.8, false, true);
    }

    update(dt) {
      this.time += dt;
      const pl = this.player;

      if (this.state === 'clearing') {
        this.clearTimer -= dt;
        if (this.clearTimer <= 0) this.showResult(true);
      } else if (this.state === 'dying') {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.showResult(false);
      }

      if (this.state !== 'paused') {
        const target = this.state === 'clearing'
          ? { x: this.castle.x - 10, y: this.world.heightAt(this.castle.x) - 20, vx: 0, facing: 0 }
          : pl;
        this.camera.follow(dt, target, this.state);
      }

      this.campView.update(dt);
      this.effects.update(dt);

      // Celebrations: fountains of sand sparkle during the clear animation.
      if (this.state === 'clearing' && Math.random() < dt * 6) {
        const colors = [this.theme.ui.accent, '#ffd23f', '#ffffff', '#4cc9c0'];
        this.effects.confetti(this.castle.x + (Math.random() - 0.5) * 200, this.castleView.topY() + 60, colors, 6);
      }

      // Bucket drip while carrying a full load at speed; dust while running is in handleEvents.
      if (this.state === 'playing') {
        this.coachTimer = (this.coachTimer || 0) - dt;
        if (this.coachTimer <= 0) {
          this.coachTimer = 0.25;
          this.coach();
        }
        // Clock ticks in the last 10 s.
        const sec = Math.ceil(this.timeLeft);
        if (this.rules.sunset && sec <= 10 && sec !== this.lastTick && sec > 0) {
          this.lastTick = sec;
          this.audio.tick();
        }
        const near = clamp(1 - Math.abs(pl.x - this.world.edge) / 900, 0, 1);
        this.audio.ambient(true, near);
      } else if (this.state === 'menu') {
        this.audio.ambient(this.audio.ctx != null, 0.3);
      }

      if (this.hintTimer > 0) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) this.hideHint();
      }

      this.hudTimer -= dt;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.08;
        this.updateHUD();
      }
    }

    /* ---------------------------------------------------------------- loop */
    loop(now) {
      requestAnimationFrame(this.loop);
      const raw = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(0.05, Math.max(0, raw));
      this.frameDt = dt;
      this.governQuality(raw);
      this.ensureScene(now);

      if (this.state !== 'paused') {
        const fixed = 1 / 60;
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= fixed && steps < 4) {
          this.simStep(fixed);
          this.accumulator -= fixed;
          steps += 1;
        }
        if (steps === 4) this.accumulator = 0;
        this.update(dt);
      }

      this.render(this.time);
    }

    /* -------------------------------------------------------------- render */
    render(time) {
      const ctx = this.ctx;
      const w = this.viewW;
      const h = this.viewH;
      const camera = this.camera;
      const pl = this.player;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // 1 — baked sky + parallax strips (screen space).
      if (this.scene) this.scene.draw(ctx, camera, time);
      else {
        ctx.fillStyle = this.theme.background.sky[1];
        ctx.fillRect(0, 0, w, h);
      }

      // 2 — the world, back to front.
      ctx.save();
      camera.applyTransform(ctx);
      this.terrainView.prepare(camera);
      this.terrainView.drawBack(ctx);
      this.terrainView.drawGround(ctx);
      this.seaView.drawWet(ctx, camera);
      this.campView.draw(ctx, camera, time);
      this.castleView.draw(ctx, camera, time, this.state);
      this.pickupView.draw(ctx, camera, time);
      this.crabView.draw(ctx, this.crabs.crabs, camera, time);
      this.betinaView.draw(ctx, pl, time, this.state, this.frameDt, this.effects);
      this.terrainView.drawFront(ctx, time);
      this.seaView.drawWater(ctx, camera, time);
      this.effects.draw(ctx);
      ctx.restore();

      // 3 — screen-space: dusk tint, atmosphere, objective arrow.
      this.drawDusk(ctx, w, h);
      this.effects.drawScreen(ctx, w, h, this.state === 'paused' ? 0 : this.frameDt, {
        time,
        camX: camera.x,
        camY: camera.y,
        speed: 0,
        active: false,
        motes: this.theme.background.motes
      });
      this.drawObjective(ctx, w, h, time);
    }

    /** The sky warms up as the timer runs out. */
    drawDusk(ctx, w, h) {
      if (!this.rules.sunset) return;
      const d = 1 - this.timeLeft / this.timeTotal;
      const a = clamp((d - 0.3) / 0.7, 0, 1);
      if (a <= 0.01) return;
      const dusk = this.theme.background.dusk;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, tint(dusk[0], a));
      g.addColorStop(1, tint(dusk[1], a));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    /** An arrow at the screen edge pointing to where Betina should go next. */
    drawObjective(ctx, w, h, time) {
      if (this.state !== 'playing') return;
      const pl = this.player;
      const toSea = pl.fill < 0.5;
      const targetX = toSea ? this.world.edge - 30 : this.castle.x;
      const cam = this.camera;
      const sx = (targetX - cam.x) * cam.zoom + w / 2;
      const margin = 70;
      if (sx > margin && sx < w - margin) return;
      const right = sx >= w - margin;
      const x = right ? w - 26 : 26;
      const y = h * 0.34 + Math.sin(time * 4) * 4;
      const label = toSea ? 'MAR' : 'CASTELO';
      const ui = this.theme.ui;
      ctx.save();
      ctx.translate(x, y);
      ctx.font = '800 12px "Archivo Black", "Trebuchet MS", sans-serif';
      const tw = ctx.measureText(label).width;
      const pw = tw + 46;
      ctx.beginPath();
      ctx.roundRect(right ? -pw + 12 : -12, -17, pw, 34, 17);
      ctx.fillStyle = ui.accent;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ui.accentInk;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, right ? -pw + 20 : 32, 1);
      // Arrow pointing the way (towards the screen edge the target is beyond).
      const ax = right ? -9 : 9;
      const tip = right ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(ax + tip * 7, 0);
      ctx.lineTo(ax - tip * 3, -7.5);
      ctx.lineTo(ax - tip * 3, 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function tint(color, a) {
    const c = R.color.parse(color);
    return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] * a).toFixed(3)})`;
  }

  function readStorage(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* ignore */
    }
  }

  function loadQualityMode() {
    let mode = readStorage(QUALITY_KEY, 'auto');
    try {
      const param = new URLSearchParams(root.location.search).get('q');
      if (param) mode = param;
    } catch (err) {
      /* ignore */
    }
    return mode === 'auto' || R.QUALITY[mode] ? mode : 'auto';
  }

  function loadTheme() {
    const id = readStorage(THEME_KEY, HCR.DEFAULT_THEME);
    return HCR.THEMES[id] ? id : HCR.DEFAULT_THEME;
  }

  HCR.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
