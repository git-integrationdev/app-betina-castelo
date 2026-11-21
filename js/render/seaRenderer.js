/* ============================================================================
 * CASTELO DA BETINA — the shallows
 * Wet sand at the waterline and the translucent water drawn over the sand to
 * the right of it. Both follow the live tide computed in js/world.js, so the
 * waterline creeps in and out and big waves visibly rush up the beach.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp } = HCR.math;
  const { alpha } = R.color;
  const TAU = Math.PI * 2;

  class SeaRenderer {
    constructor(theme, world) {
      this.theme = theme;
      this.world = world;
      this.w = theme.terrain.water;
    }

    /** Darker, damp sand just above the waterline. Draw right after the ground. */
    drawWet(ctx, camera) {
      const world = this.world;
      const edge = world.edge;
      if (edge - 170 > camera.right || edge < camera.left - 20) return;
      const from = edge - 170;
      const to = edge + 30;
      const g = ctx.createLinearGradient(from, 0, edge, 0);
      g.addColorStop(0, alpha(this.w.wet, 0));
      g.addColorStop(1, this.w.wet);
      ctx.save();
      ctx.beginPath();
      for (let x = from; x <= to; x += 10) {
        const y = world.heightFast(x) + 4;
        if (x === from) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = g;
      ctx.lineWidth = 17;
      ctx.stroke();
      ctx.restore();
    }

    /** The water itself, over everything standing in it. */
    drawWater(ctx, camera, time) {
      const world = this.world;
      const w = this.w;
      const edge = world.edge;
      const right = camera.right + 40;
      if (edge > right) return;
      const waterY = world.waterY;
      const q = R.quality;
      const x0 = Math.max(edge - 2, camera.left - 40);
      const ripple = (x) =>
        Math.sin(x * 0.03 + time * 2.1) * 1.5 + Math.sin(x * 0.011 - time * 1.3) * 2 + world.wave * Math.sin(x * 0.05 - time * 6) * 1.5;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, waterY + ripple(x0));
      for (let x = x0 + 14; x <= right; x += 14) ctx.lineTo(x, waterY + ripple(x));
      ctx.lineTo(right, world.heightFast(right) + 2);
      for (let x = right - 14; x >= x0; x -= 14) ctx.lineTo(x, world.heightFast(x) + 2);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, waterY - 4, 0, waterY + 170);
      g.addColorStop(0, w.top);
      g.addColorStop(0.35, w.mid);
      g.addColorStop(1, w.deep);
      ctx.fillStyle = g;
      ctx.fill();

      // Light bands inside the water.
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = alpha(w.ripple, 0.35);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const y = waterY + 14 + i * 22 + Math.sin(time * 1.2 + i) * 2;
        for (let x = x0 - 30 + ((i * 53 + time * 18) % 90); x < right; x += 90) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 12, y - 3, x + 26, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // Surface line.
      ctx.beginPath();
      ctx.moveTo(x0, waterY + ripple(x0));
      for (let x = x0 + 14; x <= right; x += 14) ctx.lineTo(x, waterY + ripple(x));
      ctx.strokeStyle = alpha(w.foam, 0.62);
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // Foam where the sea meets the sand: bubbly, breathing with the swell.
      const foamN = q.id === 'low' ? 8 : 14;
      const power = 1 + world.wave * 1.6 + world.warn * 0.4;
      ctx.fillStyle = w.foam;
      ctx.beginPath();
      for (let i = 0; i < foamN; i++) {
        const t = i / foamN;
        const fx = edge - 34 * power + t * 52 * power + Math.sin(time * 1.7 + i * 1.9) * 4;
        const fy = world.heightFast(fx) + 1.5;
        const r = (2.4 + (Math.sin(time * 2.6 + i * 2.7) + 1) * 2.1) * (0.8 + power * 0.25);
        ctx.moveTo(fx + r, fy);
        ctx.arc(fx, fy, r, 0, TAU);
      }
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      // A swell building out at sea warns of the next big wave.
      if (world.warn > 0.02 || world.wave > 0.02) {
        const a = Math.max(world.warn, world.wave);
        ctx.strokeStyle = alpha(w.foam, 0.35 + a * 0.5);
        ctx.lineWidth = 3 + a * 3;
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const cx = edge + 90 + k * 95 - world.wave * 70 + Math.sin(time * 2 + k) * 6;
          const cy = waterY - 3 - a * 8;
          if (cx > right) continue;
          ctx.beginPath();
          ctx.moveTo(cx - 34, cy + 4);
          ctx.quadraticCurveTo(cx, cy - 12 - a * 8, cx + 34, cy + 4);
          ctx.stroke();
        }
      }

      // Glitter.
      if (q.glows) {
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        for (let i = 0; i < 7; i++) {
          const tw = Math.sin(time * 3 + i * 5.3);
          if (tw < 0.6) continue;
          const gx = edge + 40 + ((i * 97 + time * 8) % Math.max(60, right - edge - 20));
          const gy = waterY + 4 + (i * 13) % 26;
          ctx.fillRect(gx, gy, 2.4, 1.4);
        }
      }
    }
  }

  R.SeaRenderer = SeaRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
