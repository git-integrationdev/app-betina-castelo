/* ============================================================================
 * CASTELO DA BETINA — camera
 * Smooth follow with look-ahead in the walking direction, gentle zoom and
 * shake. Frame the target with follow(); the rest is bookkeeping.
 * ========================================================================== */
(function (root) {
  'use strict';

  const { clamp, damp } = root.HCR.math;

  class Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
      this.baseZoom = 1;
      this.viewW = 1280;
      this.viewH = 720;
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    setViewport(w, h) {
      this.viewW = w;
      this.viewH = h;
      // Betina is small: frame roughly 900×560 world px, a bit wider on tall screens.
      this.baseZoom = clamp(Math.min(w / 880, h / 520), 0.7, 1.6);
      this.zoom = this.baseZoom;
    }

    snap(target) {
      this.x = target.x + target.facing * 60;
      this.y = target.y - 90;
      this.zoom = this.baseZoom;
      this.shake = 0;
    }

    kick(amount) {
      this.shake = Math.min(14, this.shake + amount);
    }

    follow(dt, target, mode) {
      const speed = clamp(target.vx, -320, 320);
      const targetX = target.x + speed * 0.38 + target.facing * 70;
      const targetY = target.y - 92;
      const rate = mode === 'menu' ? 3 : 5.2;
      this.x = damp(this.x, targetX, rate, dt);
      this.y = damp(this.y, targetY, rate * 0.8, dt);

      const run = clamp(Math.abs(target.vx) / 300, 0, 1);
      this.zoom = damp(this.zoom, this.baseZoom * (1 - 0.06 * run), 3, dt);

      this.shake = Math.max(0, this.shake - dt * 30);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake * 0.7;
    }

    get left() { return this.x - this.viewW / (2 * this.zoom); }
    get right() { return this.x + this.viewW / (2 * this.zoom); }
    get top() { return this.y - this.viewH / (2 * this.zoom); }
    get bottom() { return this.y + this.viewH / (2 * this.zoom); }

    applyTransform(ctx) {
      ctx.translate(this.viewW / 2 + this.shakeX, this.viewH * 0.6 + this.shakeY);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x, -this.y);
    }
  }

  root.HCR.Camera = Camera;
})(typeof window !== 'undefined' ? window : globalThis);
