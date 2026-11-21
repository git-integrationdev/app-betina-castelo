/* ============================================================================
 * RIDGE RUSH — effects
 * World-space particles (dust, smoke, clods, sparks, rings, score text) and
 * screen-space atmosphere (speed lines, floating motes). Soft particles are
 * blits of one pre-blurred blob per colour; text is cached as sprites.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, hash } = HCR.math;
  const TAU = Math.PI * 2;

  const MAX_PARTICLES = 340;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  class Effects {
    constructor() {
      this.items = [];
      this.lineAlpha = 0;
    }

    clear() {
      this.items.length = 0;
      this.lineAlpha = 0;
    }

    get budget() {
      return MAX_PARTICLES * R.quality.particles;
    }

    push(p) {
      if (this.items.length < this.budget) this.items.push(p);
    }

    update(dt) {
      const items = this.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life -= dt;
        if (p.life <= 0) {
          items[i] = items[items.length - 1];
          items.pop();
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        const k = 1 - p.drag * dt;
        p.vx *= k;
        p.vy *= k;
        if (p.type === 'ring') p.radius += p.growth * dt;
        if (p.type === 'confetti') p.angle += p.spin * dt;
      }
    }

    /* ------------------------------------------------------------ emitters */
    /** Wheel dust: soft puffs drifting opposite to the direction of travel. */
    dust(x, y, dirX, color, amount) {
      const count = amount || 2;
      for (let i = 0; i < count; i++) {
        this.push({
          type: 'puff',
          x: x + rand(-5, 5),
          y: y + rand(-4, 3),
          vx: -dirX * rand(20, 70) + rand(-18, 18),
          vy: rand(-46, -10),
          gravity: 14,
          drag: 1.7,
          size: rand(5, 10),
          growth: rand(14, 24),
          life: rand(0.5, 0.95),
          maxLife: 0.95,
          color,
          alpha: 0.55
        });
      }
    }

    /** Landing burst: a low, wide cloud proportional to the impact. */
    burst(x, y, color, power) {
      const count = Math.round(clamp(power, 3, 14));
      for (let i = 0; i < count; i++) {
        const side = i % 2 ? 1 : -1;
        this.push({
          type: 'puff',
          x: x + rand(-10, 10),
          y: y + rand(-3, 3),
          vx: side * rand(40, 150) * (0.6 + power * 0.05),
          vy: rand(-70, -12),
          gravity: 30,
          drag: 2.6,
          size: rand(7, 13),
          growth: rand(18, 34),
          life: rand(0.55, 1.05),
          maxLife: 1.05,
          color,
          alpha: 0.6
        });
      }
    }

    /** Clods of earth flung off the driven wheel. */
    clods(x, y, dirX, color, count) {
      for (let i = 0; i < (count || 2); i++) {
        this.push({
          type: 'clod',
          x: x + rand(-4, 4),
          y,
          vx: -dirX * rand(60, 190) + rand(-30, 30),
          vy: rand(-230, -70),
          gravity: 620,
          drag: 0.4,
          size: rand(1.4, 3.4),
          growth: 0,
          life: rand(0.4, 0.8),
          maxLife: 0.8,
          color,
          alpha: 1
        });
      }
    }

    /** Water droplets thrown up by feet, scooping or a wave. */
    splash(x, y, color, count, power) {
      const n = count || 8;
      for (let i = 0; i < n; i++) {
        this.push({
          type: 'clod',
          x: x + rand(-8, 8),
          y,
          vx: rand(-1, 1) * (power || 120),
          vy: -rand(0.4, 1) * (power || 120) * 1.5,
          gravity: 620,
          drag: 0.5,
          size: rand(1.3, 3),
          growth: 0,
          life: rand(0.4, 0.8),
          maxLife: 0.8,
          color,
          alpha: 1
        });
      }
    }

    /** A thin stream of sand grains falling from (x, y). */
    grains(x, y, color, count, spread) {
      for (let i = 0; i < (count || 3); i++) {
        this.push({
          type: 'clod',
          x: x + rand(-(spread || 6), spread || 6),
          y: y + rand(-3, 3),
          vx: rand(-14, 14),
          vy: rand(10, 80),
          gravity: 520,
          drag: 0.3,
          size: rand(1.2, 2.6),
          growth: 0,
          life: rand(0.35, 0.6),
          maxLife: 0.6,
          color,
          alpha: 1
        });
      }
    }

    confetti(x, y, colors, count) {
      for (let i = 0; i < (count || 40); i++) {
        const a = -Math.PI / 2 + rand(-1, 1) * 1.1;
        const v = rand(160, 460);
        this.items.push({
          type: 'confetti',
          x: x + rand(-30, 30),
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          gravity: 360,
          drag: 1.1,
          size: rand(3, 6),
          growth: 0,
          spin: rand(-9, 9),
          angle: rand(0, 6.28),
          life: rand(1.4, 2.4),
          maxLife: 2.4,
          color: colors[i % colors.length],
          alpha: 1
        });
      }
    }

    smoke(x, y, vx, vy, color) {
      this.push({
        type: 'puff',
        x,
        y,
        vx: vx + rand(-12, 12),
        vy: vy + rand(-14, 4),
        gravity: -34,
        drag: 1.4,
        size: rand(3.5, 6),
        growth: rand(12, 20),
        life: rand(0.45, 0.8),
        maxLife: 0.8,
        color,
        alpha: 0.34
      });
    }

    sparks(x, y, color, count, speed) {
      const n = count || 10;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const v = rand(40, speed || 150);
        this.push({
          type: 'spark',
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 40,
          gravity: 300,
          drag: 0.9,
          size: rand(1.6, 3.2),
          growth: 0,
          life: rand(0.35, 0.75),
          maxLife: 0.75,
          color,
          alpha: 1
        });
      }
    }

    text(x, y, label, color, size) {
      this.items.push({
        type: 'text',
        x,
        y,
        vx: 0,
        vy: -46,
        gravity: 0,
        drag: 1.1,
        size: size || 17,
        growth: 0,
        life: 1.05,
        maxLife: 1.05,
        color,
        alpha: 1,
        label
      });
    }

    ring(x, y, color) {
      this.items.push({
        type: 'ring',
        x,
        y,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        size: 6,
        radius: 8,
        growth: 120,
        life: 0.45,
        maxLife: 0.45,
        color,
        alpha: 1
      });
    }

    /* ---------------------------------------------------------------- draw */
    textSprite(p) {
      const w = Math.ceil(p.label.length * p.size * 0.72 + 16);
      const h = Math.ceil(p.size * 1.7);
      return R.sprites.get(`fx:text:${p.label}:${p.color}:${p.size}`, { x: -w / 2, y: -h / 2, w, h }, (ctx) => {
        ctx.font = `800 ${p.size}px "Archivo Black", "Trebuchet MS", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = 'rgba(10,14,18,.8)';
        ctx.strokeText(p.label, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.label, 0, 1);
      });
    }

    draw(ctx) {
      const items = this.items;
      ctx.lineCap = 'round';
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        const t = clamp(p.life / p.maxLife, 0, 1);

        if (p.type === 'puff') {
          const age = 1 - t;
          const radius = p.size + p.growth * age;
          ctx.globalAlpha = p.alpha * Math.min(1, age * 9) * t;
          R.blitScaled(ctx, R.softBlob(R.sprites, p.color, 32), p.x, p.y, radius / 22);
        } else if (p.type === 'confetti') {
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(1, Math.cos(p.angle * 1.7));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
        } else if (p.type === 'clod') {
          ctx.globalAlpha = Math.min(1, t * 3);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        } else if (p.type === 'spark') {
          ctx.globalAlpha = Math.min(1, t * 2.4);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (0.4 + t * 0.6);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
        } else if (p.type === 'ring') {
          ctx.globalAlpha = t;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, TAU);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4 * t + 0.6;
          ctx.stroke();
        } else if (p.type === 'text') {
          const pop = 1 + Math.max(0, t - 0.82) * 2.6;
          ctx.globalAlpha = Math.min(1, t * 2.6);
          R.blitScaled(ctx, this.textSprite(p), p.x, p.y, pop);
        }
      }
      ctx.globalAlpha = 1;
    }

    /**
     * Screen-space layer drawn over the world: speed streaks and drifting
     * motes (pollen / spray) that sell depth and velocity.
     */
    drawScreen(ctx, w, h, dt, o) {
      const q = R.quality;

      // Motes.
      const count = Math.round(16 * q.motes);
      if (count && o.motes) {
        const mote = R.softBlob(R.sprites, o.motes, 32);
        for (let i = 0; i < count; i++) {
          const depth = 0.4 + hash(i * 5.3) * 0.9;
          const span = w + 80;
          const x = ((hash(i * 1.7) * span - o.camX * 0.5 * depth + o.time * 9 * depth) % span + span) % span - 40;
          const y = ((hash(i * 3.1) * h + Math.sin(o.time * 0.5 + i * 2.1) * 26 - o.camY * 0.3 * depth) % h + h) % h;
          ctx.globalAlpha = (0.3 + 0.35 * Math.sin(o.time * 1.3 + i * 1.9)) * depth;
          R.blitScaled(ctx, mote, x, y, (2.2 + depth * 3.4) / 32);
        }
        ctx.globalAlpha = 1;
      }

    }
  }

  R.Effects = Effects;
  HCR.Effects = Effects;
})(typeof window !== 'undefined' ? window : globalThis);
