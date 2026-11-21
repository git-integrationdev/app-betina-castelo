/* ============================================================================
 * RIDGE RUSH — pickup renderer + collectible sprites
 * Every collectible is baked into a short sprite strip (spin frames) and
 * blitted; glow and ground shadow reuse one soft blob.
 *
 *   HCR.render.pickups.register('gem', {
 *     box: { x, y, w, h },      // local units, origin = centre
 *     frames: 1,                // > 1 for a baked spin animation
 *     spinSpeed: 0.33,          // spin cycles per second (frames > 1)
 *     sway: 0.05,               // rocking amplitude in radians (frames = 1)
 *     glow: 30,                 // glow radius, 0 to disable
 *     sparkle: true,
 *     paint(ctx, p, phase) {}   // p = theme.pickups, phase ∈ [0, 1)
 *   });
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { shade, alpha } = R.color;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ shell */
  R.pickups.register('shell', {
    box: { x: -20, y: -20, w: 40, h: 40 },
    frames: 1,
    sway: 0.14,
    glow: 30,
    sparkle: true,
    paint(ctx, p) {
      const outline = shade(p.coinIcon, -0.42);
      // Scallop fan: a rounded wedge with ridges and a small hinge.
      ctx.save();
      ctx.translate(0, 4);
      const lobes = 7;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      for (let i = 0; i <= lobes; i++) {
        const a = Math.PI + 0.22 + (i / lobes) * (Math.PI - 0.44);
        const r = 17;
        const a2 = Math.PI + 0.22 + ((i + 0.5) / lobes) * (Math.PI - 0.44);
        ctx.quadraticCurveTo(Math.cos(a2) * (r + 3.6), Math.sin(a2) * (r + 3.6) + 0, Math.cos(a) * r, Math.sin(a) * r + 0);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-14, -14, 14, 10);
      g.addColorStop(0, p.coinLight);
      g.addColorStop(0.5, p.coin);
      g.addColorStop(1, p.coinDark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.clip();
      ctx.strokeStyle = alpha(p.coinIcon, 0.55);
      ctx.lineWidth = 1.4;
      for (let i = 1; i < lobes; i++) {
        const a = Math.PI + 0.22 + (i / lobes) * (Math.PI - 0.44);
        ctx.beginPath();
        ctx.moveTo(0, 7);
        ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
        ctx.stroke();
      }
      ctx.restore();
      // Hinge.
      ctx.beginPath();
      ctx.roundRect(-5.2, 8, 10.4, 5, 2);
      ctx.fillStyle = p.coinDark;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Highlight.
      ctx.strokeStyle = alpha('#ffffff', 0.85);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-1, 6, 12.5, Math.PI * 1.15, Math.PI * 1.42);
      ctx.stroke();
    }
  });

  /* ---------------------------------------------------------------- popsicle */
  R.pickups.register('popsicle', {
    box: { x: -20, y: -32, w: 40, h: 62 },
    frames: 1,
    sway: 0.09,
    glow: 40,
    sparkle: true,
    paint(ctx, p) {
      const outline = shade(p.fuelDark, -0.45);
      // Stick.
      ctx.beginPath();
      ctx.roundRect(-3.6, 8, 7.2, 21, 3.4);
      ctx.fillStyle = '#e8c48a';
      ctx.fill();
      ctx.strokeStyle = '#8a5f2c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Body with a bite taken out of the corner.
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(-12, 8);
        ctx.lineTo(-12, -14);
        ctx.quadraticCurveTo(-12, -28, 0, -28);
        ctx.quadraticCurveTo(12, -28, 12, -14);
        ctx.lineTo(12, 8);
        ctx.quadraticCurveTo(12, 11, 9, 11);
        ctx.lineTo(-9, 11);
        ctx.quadraticCurveTo(-12, 11, -12, 8);
        ctx.closePath();
      };
      body();
      const g = ctx.createLinearGradient(0, -28, 0, 11);
      g.addColorStop(0, p.fuelLight);
      g.addColorStop(0.5, p.fuel);
      g.addColorStop(1, p.fuelDark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // Cream band + drips.
      ctx.fillStyle = alpha('#fff7ec', 0.92);
      ctx.fillRect(-14, -9, 28, 9);
      ctx.beginPath();
      ctx.arc(-5, 0, 3, 0, Math.PI);
      ctx.arc(4, 0, 3.4, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.45);
      ctx.fillRect(-9.4, -24, 3.2, 28);
      ctx.restore();
      body();
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Sprinkles.
      const dots = [[-5, -20], [3, -22], [6, -15], [-3, -14], [5, -5]];
      ctx.fillStyle = p.fuelCap;
      for (const [x, y] of dots) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, TAU);
        ctx.fill();
      }
    }
  });

  /* ---------------------------------------------------------------- renderer */
  function paintSparkle(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 1.2 : 6;
      const a = (i / 8) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  class PickupRenderer {
    constructor(field, terrain, theme) {
      this.field = field;
      this.terrain = terrain;
      this.theme = theme;
      this.defs = {
        coin: R.pickups.get(theme.pickups.coinSprite),
        fuel: R.pickups.get(theme.pickups.fuelSprite)
      };
      this.key = `pick:${theme.id}:`;
    }

    frame(def, index) {
      const p = this.theme.pickups;
      const frames = def.frames || 1;
      return R.sprites.get(`${this.key}${def.id}:${index}`, def.box, (ctx) => def.paint(ctx, p, index / frames));
    }

    draw(ctx, camera, time) {
      const left = camera.left - 60;
      const right = camera.right + 60;
      const q = R.quality;
      const p = this.theme.pickups;
      const shadow = R.softBlob(R.sprites, 'rgba(10,8,4,.5)', 32);
      const glow = q.glows ? R.softBlob(R.sprites, p.glow, 32) : null;
      const sparkle = R.sprites.get('pick:sparkle', { x: -7, y: -7, w: 14, h: 14 }, paintSparkle);
      const items = this.field.items;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.x < left || item.x > right) continue;
        const def = this.defs[item.type];
        const frames = def.frames || 1;
        const y = item.y + Math.sin(time * 2.3 + item.phase) * 4;
        const groundY = this.terrain.heightFast(item.x);

        // Contact shadow, tighter the closer the item floats to the ground.
        const lift = Math.max(0, groundY - y);
        ctx.globalAlpha = Math.max(0.15, 0.6 - lift * 0.005);
        R.blitScaled(ctx, shadow, item.x, groundY + 3, def.box.w / 64 * 0.9, 0.12);
        ctx.globalAlpha = 1;

        if (glow && def.glow) {
          const pulse = 1 + Math.sin(time * 3 + item.phase) * 0.12;
          R.blitScaled(ctx, glow, item.x, y, (def.glow / 32) * pulse);
        }

        if (frames > 1) {
          const cycle = (time * (def.spinSpeed || 0.33) + item.phase / TAU) % 1;
          const sprite = this.frame(def, Math.floor(cycle * frames) % frames);
          R.blitScaled(ctx, sprite, item.x, y, item.scale);
        } else if (def.sway) {
          ctx.save();
          ctx.translate(item.x, y);
          ctx.rotate(Math.sin(time * 1.5 + item.phase) * def.sway);
          R.blitScaled(ctx, this.frame(def, 0), 0, 0, item.scale);
          ctx.restore();
        } else {
          R.blitScaled(ctx, this.frame(def, 0), item.x, y, item.scale);
        }

        if (def.sparkle) {
          const tw = Math.sin(time * 4.2 + item.phase * 3);
          if (tw > 0) {
            ctx.globalAlpha = tw;
            R.blitScaled(ctx, sparkle, item.x - 11, y - 10, 0.5 + tw * 0.7);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  R.PickupRenderer = PickupRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
