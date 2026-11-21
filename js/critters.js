/* ============================================================================
 * CASTELO DA BETINA — crabs (simulation only)
 * Crabs patrol the sand between the castle and the shore. Touch one on the
 * ground and Betina stumbles; jump over it and nothing happens.
 * ========================================================================== */
(function (root) {
  'use strict';

  const { hash } = root.HCR.math;

  class Crab {
    constructor(x, range, speed, seed) {
      this.home = x;
      this.x = x;
      this.y = 0;
      this.range = range;
      this.speed = speed;
      this.dir = hash(seed * 1.7) > 0.5 ? 1 : -1;
      this.phase = hash(seed) * 6.28;
      this.flee = 0;
      this.size = 0.9 + hash(seed * 3.1) * 0.35;
    }
  }

  class CrabField {
    constructor(world) {
      this.world = world;
      this.crabs = [];
      const from = world.castleX + 280;
      const to = world.shore - 420;
      // Keep a landing strip between neighbours: never more crabs than fit.
      const n = Math.min(world.p.crabs, Math.max(0, Math.floor((to - from) / 330) + 1));
      for (let i = 0; i < n; i++) {
        const x = from + ((i + 0.5) / n) * Math.max(120, to - from) + (hash(i * 7.3 + world.level) - 0.5) * 50;
        this.crabs.push(new Crab(x, 55 + hash(i * 3.9) * 40, 50 + world.level * 5 + hash(i) * 18, i + world.level * 11));
      }
      this.update(0);
    }

    update(dt) {
      const w = this.world;
      for (const c of this.crabs) {
        const sp = c.speed * (c.flee > 0 ? 2.6 : 1);
        c.flee = Math.max(0, c.flee - dt);
        c.x += c.dir * sp * dt;
        if (c.x > c.home + c.range) { c.x = c.home + c.range; c.dir = -1; }
        if (c.x < c.home - c.range) { c.x = c.home - c.range; c.dir = 1; }
        c.phase += sp * dt * 0.16;
        c.y = w.heightAt(c.x);
      }
    }

    /** Returns the crab Betina bumped into, if any. */
    collide(player) {
      if (player.invuln > 0) return null;
      for (const c of this.crabs) {
        const dx = player.x - c.x;
        if (Math.abs(dx) < 21 * c.size && player.y > c.y - 17 * c.size) return c;
      }
      return null;
    }

    scare(crab) {
      crab.flee = 1.6;
      crab.dir = -crab.dir;
    }

    /** The nearest crab ahead of Betina, for the "jump!" hint. */
    nextAhead(player, reach) {
      let best = null;
      for (const c of this.crabs) {
        const d = (c.x - player.x) * player.facing;
        if (d > 0 && d < reach && (!best || d < (best.x - player.x) * player.facing)) best = c;
      }
      return best;
    }
  }

  root.HCR.CrabField = CrabField;
})(typeof window !== 'undefined' ? window : globalThis);
