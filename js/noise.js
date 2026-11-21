/* ============================================================================
 * RIDGE RUSH — procedural helpers
 * Seeded 1D Perlin noise + small math utilities used by terrain & camera.
 * ========================================================================== */
(function (root) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  class Perlin1D {
    constructor(seed) {
      const rng = mulberry32(seed || 1);
      const p = new Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
      }
      this.perm = new Array(512);
      for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
      this.grad = new Array(256);
      for (let i = 0; i < 256; i++) this.grad[i] = rng() * 2 - 1;
    }

    noise(x) {
      const xi = Math.floor(x);
      const xf = x - xi;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const a = this.perm[xi & 255];
      const b = this.perm[(xi + 1) & 255];
      const ga = this.grad[a] * xf;
      const gb = this.grad[b] * (xf - 1);
      return ga + (gb - ga) * u;
    }

    fbm(x, octaves) {
      let value = 0;
      let amp = 1;
      let freq = 1;
      let total = 0;
      const count = octaves || 4;
      for (let i = 0; i < count; i++) {
        value += this.noise(x * freq + i * 19.19) * amp;
        total += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return value / total;
    }
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));
  const hash = (n) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  root.HCR = root.HCR || {};
  root.HCR.Perlin1D = Perlin1D;
  root.HCR.math = { clamp, lerp, smoothstep, damp, hash, hash2, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
