/* ============================================================================
 * CASTELO DA BETINA — castle model
 * Just the numbers: how much of the castle exists. The renderer decides what
 * that looks like.
 * ========================================================================== */
(function (root) {
  'use strict';

  class Castle {
    constructor(buckets, scale, x) {
      this.buckets = buckets;
      this.scale = scale;
      this.x = x;
      this.progress = 0;   // 0..1, the truth
      this.shown = 0;      // eases towards progress, what is drawn
      this.pop = 0;        // 1 right after a delivery, decays to 0
      this.complete = false;
    }

    /** A bucket's worth (0..1) of sand arrives. Returns the progress gained. */
    add(amount) {
      const before = this.progress;
      this.progress = Math.min(1, this.progress + amount / this.buckets);
      this.pop = Math.min(1, this.pop + amount * 2);
      if (this.progress >= 0.9995) {
        this.progress = 1;
        this.complete = true;
      }
      return this.progress - before;
    }

    update(dt) {
      this.shown += (this.progress - this.shown) * Math.min(1, dt * 2.8);
      if (Math.abs(this.progress - this.shown) < 0.0004) this.shown = this.progress;
      this.pop = Math.max(0, this.pop - dt * 2.4);
    }
  }

  root.HCR.Castle = Castle;
})(typeof window !== 'undefined' ? window : globalThis);
