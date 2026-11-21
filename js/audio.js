/* ============================================================================
 * CASTELO DA BETINA — audio
 * Tiny WebAudio synth, no external assets: a rolling-sea ambience plus short
 * effects (steps, splash, scoop, sand pour, cheers, jingles).
 * ========================================================================== */
(function (root) {
  'use strict';

  const KEY = 'betina.muted';

  class GameAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.seaGain = null;
      this.seaFilter = null;
      this.lastStep = 0;
      this.muted = readMuted();
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const Ctor = root.AudioContext || root.webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.master.connect(this.ctx.destination);

        // One second of white noise, reused by every noisy effect.
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        // Sea ambience: filtered noise whose level slowly swells.
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        this.seaFilter = this.ctx.createBiquadFilter();
        this.seaFilter.type = 'lowpass';
        this.seaFilter.frequency.value = 520;
        this.seaGain = this.ctx.createGain();
        this.seaGain.gain.value = 0;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 120;
        lfo.connect(lfoGain);
        lfoGain.connect(this.seaFilter.frequency);
        src.connect(this.seaFilter);
        this.seaFilter.connect(this.seaGain);
        this.seaGain.connect(this.master);
        src.start();
        lfo.start();
      } catch (err) {
        this.ctx = null;
      }
    }

    setMuted(muted) {
      this.muted = muted;
      writeMuted(muted);
      if (this.master) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.04);
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    /** Sea volume follows how close Betina is to the water (0..1). */
    ambient(on, nearSea) {
      if (!this.ctx || !this.seaGain) return;
      const target = on ? 0.012 + 0.05 * Math.max(0, Math.min(1, nearSea)) : 0;
      this.seaGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
    }

    /* ------------------------------------------------------------ building blocks */
    blip(freq, duration, type, gain, delay) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain || 0.08, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    sweep(f1, f2, duration, type, gain, delay) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(f2, now + duration);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain || 0.09, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    /** A burst of filtered noise: steps, splashes, sand. */
    noise(duration, freq, gain, o) {
      if (!this.ctx || !this.noiseBuf) return;
      const opt = o || {};
      const now = this.ctx.currentTime + (opt.delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = opt.type || 'lowpass';
      f.frequency.setValueAtTime(freq, now);
      if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, now + duration);
      f.Q.value = opt.q || 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + (opt.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 0.5);
      src.stop(now + duration + 0.05);
    }

    /* ------------------------------------------------------------------ effects */
    click() {
      this.blip(520, 0.05, 'triangle', 0.035);
    }

    step(wet, speed) {
      const now = this.ctx ? this.ctx.currentTime : 0;
      if (now - this.lastStep < 0.07) return;
      this.lastStep = now;
      const v = 0.018 + Math.min(0.02, (speed || 0) / 15000);
      if (wet) this.noise(0.12, 1600, v * 1.6, { type: 'bandpass', q: 0.6 });
      else this.noise(0.09, 700 + Math.random() * 300, v, { to: 300 });
    }

    jump() {
      this.sweep(360, 620, 0.14, 'triangle', 0.045);
    }

    land(force, wet) {
      if (wet) this.noise(0.2, 2200, 0.06, { type: 'bandpass', q: 0.5 });
      else this.noise(0.14, 500, Math.min(0.1, 0.03 + force * 0.00008), { to: 200 });
    }

    splash() {
      this.noise(0.28, 2600, 0.07, { type: 'bandpass', q: 0.5, to: 900 });
    }

    scoop() {
      this.noise(0.25, 900, 0.07, { type: 'bandpass', q: 1.2, to: 2400 });
      this.blip(300, 0.12, 'sine', 0.03, 0.04);
    }

    full() {
      this.blip(660, 0.1, 'triangle', 0.05);
      this.blip(990, 0.16, 'triangle', 0.05, 0.08);
    }

    dump() {
      this.noise(0.18, 1100, 0.05, { type: 'highpass', q: 0.4 });
    }

    /** Sand lands on the castle: a soft thump, pitch rising with progress. */
    build(progress) {
      this.sweep(150 + progress * 90, 80, 0.16, 'triangle', 0.07);
      this.blip(520 + progress * 400, 0.13, 'sine', 0.035, 0.05);
    }

    shell() {
      this.blip(880, 0.1, 'sine', 0.06);
      this.blip(1320, 0.16, 'sine', 0.05, 0.055);
    }

    pop() {
      this.sweep(300, 760, 0.3, 'triangle', 0.07);
      this.blip(1100, 0.12, 'sine', 0.04, 0.2);
    }

    cheer() {
      [523, 659, 784].forEach((f, i) => this.blip(f, 0.14, 'triangle', 0.045, i * 0.07));
    }

    crab() {
      this.blip(260, 0.07, 'square', 0.04);
      this.sweep(420, 160, 0.22, 'sawtooth', 0.035, 0.06);
    }

    wave() {
      this.noise(0.9, 380, 0.09, { to: 1800, attack: 0.35 });
    }

    warn() {
      this.blip(392, 0.12, 'sine', 0.035);
      this.blip(392, 0.12, 'sine', 0.035, 0.2);
    }

    tick() {
      this.blip(1000, 0.04, 'square', 0.02);
    }

    tired() {
      this.sweep(330, 140, 0.4, 'triangle', 0.05);
    }

    spill() {
      this.noise(0.1, 1800, 0.025, { type: 'bandpass', q: 0.6 });
    }

    levelUp() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.blip(f, 0.2, 'triangle', 0.06, i * 0.1));
    }

    over() {
      this.sweep(420, 140, 0.8, 'triangle', 0.06);
    }
  }

  function readMuted() {
    try {
      return root.localStorage.getItem(KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function writeMuted(v) {
    try {
      root.localStorage.setItem(KEY, v ? '1' : '0');
    } catch (err) {
      /* ignore */
    }
  }

  root.HCR.GameAudio = GameAudio;
})(typeof window !== 'undefined' ? window : globalThis);
