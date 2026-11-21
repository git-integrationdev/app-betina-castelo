/* ============================================================================
 * CASTELO DA BETINA — height field
 * The ground as a function y = h(x) (y grows downwards, like the canvas).
 * Subclasses override rawHeight(); everything that draws asks heightFast(),
 * a cached, linearly interpolated copy, so the noise stack runs once per
 * sample instead of hundreds of times per frame.
 * ========================================================================== */
(function (root) {
  'use strict';

  const SAMPLE_STEP = 6;   // px between cached render samples
  const CHUNK = 128;       // samples per cache chunk

  class HeightField {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.minX = -1400;   // left edge the renderer may draw to
      this.chunks = new Map();
    }

    rawHeight() {
      return 0;
    }

    /** Exact height — used by simulation and spawning. */
    heightAt(x) {
      return this.rawHeight(x);
    }

    /** Cached height — used by everything that draws. */
    heightFast(x) {
      const f = x / SAMPLE_STEP;
      const i = Math.floor(f);
      const a = this.sample(i);
      return a + (this.sample(i + 1) - a) * (f - i);
    }

    sample(i) {
      const ci = Math.floor(i / CHUNK);
      let chunk = this.chunks.get(ci);
      if (!chunk) {
        chunk = new Float32Array(CHUNK);
        const base = ci * CHUNK;
        for (let k = 0; k < CHUNK; k++) chunk[k] = this.heightAt((base + k) * SAMPLE_STEP);
        this.chunks.set(ci, chunk);
      }
      return chunk[i - ci * CHUNK];
    }

    slopeAt(x) {
      const d = 7;
      return (this.heightAt(x + d) - this.heightAt(x - d)) / (d * 2);
    }

    angleAt(x) {
      return Math.atan(this.slopeAt(x));
    }

    /** Cheap slope for rendering (cached samples). */
    slopeFast(x) {
      return (this.heightFast(x + 9) - this.heightFast(x - 9)) / 18;
    }

    /** Endless worlds free what is far behind the camera; finite ones ignore it. */
    prune() {}
  }

  HeightField.SAMPLE_STEP = SAMPLE_STEP;
  root.HCR.HeightField = HeightField;
})(typeof window !== 'undefined' ? window : globalThis);
