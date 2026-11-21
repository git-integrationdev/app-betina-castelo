/* ============================================================================
 * CASTELO DA BETINA — beach world (simulation only)
 * One level of beach: the camp and the building site on the left, the sea on
 * the right. Owns the ground profile, the tide and the big waves.
 *
 *   camp ─ castle site ───────── dunes ───────── shore ~~~ sea
 *   x=70   x=470                                 x=shore
 * ========================================================================== */
(function (root) {
  'use strict';

  const { clamp, smoothstep } = root.HCR.math;

  /* Per-level numbers: hand-tuned list first, then the extension formula. */
  function levelParams(theme, level) {
    const L = theme.levels;
    const list = L.list;
    let p;
    if (level <= list.length) {
      p = Object.assign({}, list[level - 1]);
    } else {
      const last = list[list.length - 1];
      const n = level - list.length;
      const e = L.extend;
      p = {
        shore: last.shore + n * e.shore,
        buckets: last.buckets + n * e.buckets,
        crabs: Math.min(e.maxCrabs, last.crabs + n * e.crabs),
        waveEvery: Math.max(e.minWave, (last.waveEvery || 14) - n * e.wave)
      };
    }
    if (!theme.rules.crabs) p.crabs = 0;
    if (!theme.rules.waves) p.waveEvery = 0;
    if (!p.time) {
      const trip = 2 * (p.shore - theme.castle.x);   // castle → sea → castle
      p.time = Math.ceil(p.buckets * (trip / L.pace + L.fetchSeconds) * L.timeSlack + L.timeBase);
    }
    p.level = level;
    p.castleScale = Math.min(1.35, 1 + 0.07 * (level - 1));
    p.duneAmp = Math.min(1.4, 0.55 + 0.12 * level);
    return p;
  }

  const softplus = (z, s) => s * Math.log(1 + Math.exp(z / s));

  class BeachWorld extends root.HCR.HeightField {
    constructor(theme, level, seed) {
      super(seed);
      this.theme = theme;
      this.level = level;
      this.p = levelParams(theme, level);
      this.noise = new root.HCR.Perlin1D(seed);

      this.campX = theme.camp.x;
      this.castleX = theme.castle.x;
      this.shadeFrom = theme.camp.shadeFrom;
      this.shadeTo = theme.camp.shadeTo;
      this.shore = this.p.shore;
      this.startX = this.castleX + 30;
      this.minPlayX = -230;
      this.minX = -1400;

      // Water level where the sand meets the sea at mean tide.
      this.seaBase = this.heightAt(this.shore);
      this.limitX = this.solve(this.seaBase + 62, this.shore - 100, this.shore + 900);

      this.t = 0;
      this.waterY = this.seaBase;
      this.edge = this.shore;
      this.wave = 0;       // 0..1 while a big wave is crashing
      this.warn = 0;       // 0..1 while one is building up
      this.update(0);
    }

    /* --------------------------------------------------------------- ground */
    rawHeight(x) {
      const n = this.noise;
      const dunes = (n.fbm(x * 0.0035 + 5.1, 3) * 24 + Math.sin(x * 0.008 + 1) * 7) * this.p.duneAmp;
      const flatten = smoothstep(560, 900, x) * (1 - smoothstep(this.shore - 700, this.shore - 320, x));
      return dunes * flatten + 0.13 * softplus(x - (this.shore - 300), 120);
    }

    /** x where ground(x) = y inside [lo, hi] (ground is monotonic there). */
    solve(y, lo, hi) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (this.heightAt(mid) < y) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }

    /* ------------------------------------------------------------------ tide */
    surgeAt(t) {
      let s = Math.sin(t * 0.8) * 7 + Math.sin(t * 1.9 + 1.3) * 2.5;
      const every = this.p.waveEvery;
      if (every > 0) {
        const tt = (t + 7) % every;
        // Build-up over the last 3 s, then crest: up 0.5 s, hold 0.6 s, down 0.9 s.
        this.warn = tt > every - 3 ? (tt - (every - 3)) / 3 : 0;
        let env = 0;
        if (tt < 0.5) env = tt / 0.5;
        else if (tt < 1.1) env = 1;
        else if (tt < 2.0) env = 1 - (tt - 1.1) / 0.9;
        this.wave = env * env * (3 - 2 * env);
        s += this.wave * 24 + this.warn * 5;
      } else {
        this.warn = 0;
        this.wave = 0;
      }
      return s;
    }

    /** Advance the tide to time t (seconds) and cache the waterline. */
    update(t) {
      this.t = t;
      this.waterY = this.seaBase - this.surgeAt(t);
      this.edge = this.solve(this.waterY, this.shore - 320, this.shore + 420);
    }

    /** How deep the water is over the sand at x (0 on dry land). */
    depthAt(x) {
      return Math.max(0, this.heightAt(x) - this.waterY);
    }

    inShade(x) {
      return x >= this.shadeFrom && x <= this.shadeTo;
    }

    get maxPlayX() {
      return this.limitX;
    }
  }

  BeachWorld.levelParams = levelParams;
  root.HCR.BeachWorld = BeachWorld;
})(typeof window !== 'undefined' ? window : globalThis);
