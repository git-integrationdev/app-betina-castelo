/* ============================================================================
 * CASTELO DA BETINA — pickups (simulation only)
 * Shells ("coin") and popsicles ("fuel": energy) scattered along the path to
 * the sea. A fresh batch appears after every delivery.
 * ========================================================================== */
(function (root) {
  'use strict';

  const { hash } = root.HCR.math;

  class PickupField {
    constructor(world, theme, callbacks) {
      this.world = world;
      this.theme = theme;
      this.cb = callbacks || {};
      this.items = [];
      this.trip = 0;
      this.respawn();
    }

    /** Lay out a new batch of shells and (usually) one popsicle. */
    respawn() {
      const w = this.world;
      const seed = w.level * 97 + this.trip * 13;
      this.trip += 1;
      this.items.length = 0;

      const from = w.castleX + 190;
      const to = Math.max(from + 300, w.edge - 220);
      const clusters = Math.max(2, Math.floor((to - from) / 330));
      for (let k = 0; k < clusters; k++) {
        const x0 = from + ((k + 0.3 + hash(seed + k * 2.3) * 0.4) / clusters) * (to - from);
        const n = 3 + Math.floor(hash(seed + k * 5.1) * 3);
        const arc = hash(seed + k * 7.7) > 0.5;
        for (let i = 0; i < n; i++) {
          const x = x0 + i * 38;
          const lift = 30 + (arc ? Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 52 : 0);
          this.items.push({
            type: 'coin',
            x,
            y: w.heightAt(x) - lift,
            phase: hash(x * 0.043) * Math.PI * 2,
            scale: 0.9 + hash(x * 0.093) * 0.2
          });
        }
      }
      if (this.theme.rules.energy) {
        // One popsicle per ~1000 px of beach, so long levels stay fair.
        const pops = Math.max(1, Math.round((to - from) / 1000));
        for (let k = 0; k < pops; k++) {
          if (hash(seed + 91 + k) > 0.85) continue;
          const x = from + (to - from) * ((k + 0.35 + hash(seed + 17 + k) * 0.3) / pops);
          this.items.push({
            type: 'fuel',
            x,
            y: w.heightAt(x) - 42,
            phase: hash(x * 0.051) * Math.PI * 2,
            scale: 1
          });
        }
      }
    }

    update(player) {
      const r = this.theme.physics.pickupRadius;
      const r2 = r * r;
      const cy = player.y - 34;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        if (Math.abs(item.x - player.x) > r) continue;
        const dx = player.x - item.x;
        const dy = cy - item.y;
        if (dx * dx + dy * dy < r2) {
          this.items.splice(i, 1);
          if (item.type === 'coin' && this.cb.onCoin) this.cb.onCoin(item);
          if (item.type === 'fuel' && this.cb.onFuel) this.cb.onFuel(item);
        }
      }
    }
  }

  root.HCR.PickupField = PickupField;
})(typeof window !== 'undefined' ? window : globalThis);
