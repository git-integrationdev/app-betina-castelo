/* ============================================================================
 * CASTELO DA BETINA — castle renderer
 * The sandcastle is a stack of baked parts (walls, gate, towers, keep,
 * turrets…). Each part appears when the castle's progress passes its
 * threshold, growing up out of the sand. Add a part to `PARTS` and it just
 * works — the model (js/castle.js) only knows a number between 0 and 1.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, mulberry32 } = HCR.math;
  const { shade, mix, alpha } = R.color;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------- sand paint */
  function sandFill(ctx, k, x, y, w, h) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, mix(k.sandDark, k.sand, 0.35));
    g.addColorStop(0.45, k.sand);
    g.addColorStop(0.82, k.sandLight);
    g.addColorStop(1, mix(k.sandLight, k.sand, 0.4));
    ctx.fillStyle = g;
    return g;
  }

  /** Grainy, layered texture clipped to the current path. */
  function sandTexture(ctx, k, x, y, w, h, seed, layer) {
    const rnd = mulberry32(seed);
    ctx.save();
    ctx.clip();
    // Packed layers, as left by a bucket.
    ctx.strokeStyle = k.sandLine;
    ctx.lineWidth = 1.3;
    for (let ly = y + h - layer; ly > y; ly -= layer) {
      ctx.beginPath();
      ctx.moveTo(x - 4, ly);
      for (let lx = x; lx <= x + w + 6; lx += 9) ctx.lineTo(lx, ly + (rnd() - 0.5) * 2.4);
      ctx.stroke();
    }
    // Bottom wetness.
    const wet = ctx.createLinearGradient(0, y + h - 26, 0, y + h);
    wet.addColorStop(0, 'rgba(120,80,30,0)');
    wet.addColorStop(1, 'rgba(120,80,30,.24)');
    ctx.fillStyle = wet;
    ctx.fillRect(x, y + h - 26, w, 26);
    // Grains.
    const n = Math.round((w * h) / 70);
    for (let i = 0; i < n; i++) {
      const gx = x + rnd() * w;
      const gy = y + rnd() * h;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.32)' : 'rgba(110,70,25,.2)';
      ctx.fillRect(gx, gy, 1.3, 1.3);
    }
    ctx.restore();
  }

  function outline(ctx, k) {
    ctx.strokeStyle = alpha(shade(k.sandDark, -0.45), 0.9);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function battlements(ctx, x, y, w, merlon) {
    const n = Math.max(2, Math.round(w / (merlon * 1.9)));
    const mw = w / (n * 2 - 1);
    // Continues the current subpath: the caller has already moved to (x, y).
    for (let i = 0; i < n; i++) {
      const mx = x + i * mw * 2;
      ctx.lineTo(mx, y - merlon);
      ctx.lineTo(mx + mw, y - merlon);
      ctx.lineTo(mx + mw, y);
      if (i < n - 1) ctx.lineTo(mx + mw * 2, y);
    }
  }

  /** A crenellated tower or wall block, origin at the bottom centre. */
  function paintBlock(ctx, k, o) {
    const { w, h, merlon, seed, layer } = o;
    const x = -w / 2;
    const y = -h;
    ctx.beginPath();
    ctx.moveTo(x - 2, 0);
    ctx.lineTo(x, y);
    battlements(ctx, x, y, w, merlon);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + 2, 0);
    ctx.closePath();
    sandFill(ctx, k, x, y, w, h);
    ctx.fill();
    sandTexture(ctx, k, x, y - merlon, w, h + merlon, seed, layer || 13);
    outline(ctx, k);

    // Shadow under the battlements.
    ctx.fillStyle = 'rgba(110,70,25,.2)';
    ctx.fillRect(x + 1, y, w - 2, 5);

    if (o.cone) {
      const ch = o.cone;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - merlon);
      ctx.lineTo(0, y - merlon - ch);
      ctx.lineTo(x + w + 5, y - merlon);
      ctx.closePath();
      const cg = ctx.createLinearGradient(x, 0, x + w, 0);
      cg.addColorStop(0, shade(k.sandDark, -0.05));
      cg.addColorStop(0.6, k.sand);
      cg.addColorStop(1, k.sandLight);
      ctx.fillStyle = cg;
      ctx.fill();
      sandTexture(ctx, k, x - 5, y - merlon - ch, w + 10, ch, seed + 5, 9);
      outline(ctx, k);
    }
    if (o.windows) {
      for (const [wx, wy] of o.windows) {
        ctx.beginPath();
        ctx.moveTo(wx - 4.2, wy + 11);
        ctx.lineTo(wx - 4.2, wy);
        ctx.arc(wx, wy, 4.2, Math.PI, 0);
        ctx.lineTo(wx + 4.2, wy + 11);
        ctx.closePath();
        ctx.fillStyle = '#6d4a26';
        ctx.fill();
        ctx.strokeStyle = alpha(shade(k.sandDark, -0.5), 0.9);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillRect(wx + 1, wy + 2, 2, 8);
      }
    }
    if (o.shells) {
      for (const [sx, sy, sr] of o.shells) paintShell(ctx, k, sx, sy, sr);
    }
  }

  function paintShell(ctx, k, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, TAU);
    ctx.lineTo(r * 0.5, r * 0.55);
    ctx.lineTo(-r * 0.5, r * 0.55);
    ctx.closePath();
    ctx.fillStyle = k.shellA;
    ctx.fill();
    ctx.strokeStyle = alpha(k.shellB, 0.95);
    ctx.lineWidth = 1.1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.5);
      ctx.lineTo(i * r * 0.42, -r * 0.85);
      ctx.stroke();
    }
    ctx.strokeStyle = alpha(shade(k.shellB, -0.35), 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function paintGate(ctx, k) {
    const w = 66;
    const h = 78;
    paintBlock(ctx, k, { w, h, merlon: 9, seed: 31, shells: [[-20, -62, 5], [21, -58, 4.4]] });
    // Arched door.
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-12, -28);
    ctx.arc(0, -28, 12, Math.PI, 0);
    ctx.lineTo(12, 0);
    ctx.closePath();
    const dg = ctx.createLinearGradient(0, -40, 0, 0);
    dg.addColorStop(0, '#6d4a26');
    dg.addColorStop(1, '#3f2a14');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = alpha(shade(k.sandDark, -0.5), 0.95);
    ctx.lineWidth = 2;
    ctx.stroke();
    // Plank lines + shell latch.
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(0, 0);
    ctx.stroke();
    paintShell(ctx, k, 0, -46, 6);
  }

  function paintMound(ctx, k) {
    const w = 288;
    const h = 28;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 2);
    ctx.bezierCurveTo(-w / 2 + 10, -h * 0.95, -w / 2 + 50, -h, -w / 2 + 90, -h);
    ctx.lineTo(w / 2 - 90, -h);
    ctx.bezierCurveTo(w / 2 - 50, -h, w / 2 - 10, -h * 0.95, w / 2, 2);
    ctx.closePath();
    sandFill(ctx, k, -w / 2, -h, w, h);
    ctx.fill();
    sandTexture(ctx, k, -w / 2, -h, w, h + 4, 7, 11);
    outline(ctx, k);
    // Pressed shells along the base.
    for (const [x, y, r] of [[-118, -8, 4.6], [-76, -5, 4], [-20, -4, 3.6], [44, -6, 4.4], [96, -5, 4.2], [126, -9, 3.8]]) {
      paintShell(ctx, k, x, y, r);
    }
  }

  function paintFlagPole(ctx, k) {
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 4.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -46);
    ctx.stroke();
    ctx.strokeStyle = k.flagPole;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -48, 3.4, 0, TAU);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /* Draw order: back to front. `at` is the progress where the part starts to
   * rise and `span` how much progress it takes to finish. */
  const PARTS = [
    { name: 'mound', x: 0, h: 28, at: 0.0, span: 0.14, box: { x: -150, y: -34, w: 300, h: 40 }, paint: (g, k) => paintMound(g, k) },
    { name: 'keep', x: 0, h: 168, at: 0.58, span: 0.24, box: { x: -60, y: -230, w: 120, h: 236 },
      paint: (g, k) => paintBlock(g, k, { w: 84, h: 168, merlon: 11, seed: 3, cone: 0, windows: [[-16, -112], [16, -112], [0, -76]], shells: [[0, -146, 5.4]] }) },
    { name: 'turretL', x: -38, h: 196, at: 0.74, span: 0.16, box: { x: -30, y: -262, w: 60, h: 270 },
      paint: (g, k) => paintBlock(g, k, { w: 30, h: 196, merlon: 8, seed: 11, cone: 40, layer: 11, windows: [[0, -150]] }) },
    { name: 'turretR', x: 38, h: 206, at: 0.78, span: 0.16, box: { x: -30, y: -272, w: 60, h: 280 },
      paint: (g, k) => paintBlock(g, k, { w: 30, h: 206, merlon: 8, seed: 12, cone: 40, layer: 11, windows: [[0, -160]] }) },
    { name: 'wallL', x: -82, h: 66, at: 0.1, span: 0.18, box: { x: -52, y: -82, w: 104, h: 90 },
      paint: (g, k) => paintBlock(g, k, { w: 78, h: 66, merlon: 9, seed: 21, shells: [[-14, -34, 4.6], [14, -40, 4]] }) },
    { name: 'wallR', x: 82, h: 66, at: 0.2, span: 0.18, box: { x: -52, y: -82, w: 104, h: 90 },
      paint: (g, k) => paintBlock(g, k, { w: 78, h: 66, merlon: 9, seed: 22, shells: [[-10, -40, 4.2], [16, -32, 4.8]] }) },
    { name: 'gate', x: 0, h: 78, at: 0.3, span: 0.16, box: { x: -44, y: -96, w: 88, h: 104 }, paint: (g, k) => paintGate(g, k) },
    { name: 'towerL', x: -122, h: 118, at: 0.4, span: 0.18, box: { x: -44, y: -190, w: 88, h: 198 },
      paint: (g, k) => paintBlock(g, k, { w: 52, h: 118, merlon: 9, seed: 41, cone: 38, windows: [[0, -78]], shells: [[0, -40, 4.6]] }) },
    { name: 'towerR', x: 122, h: 134, at: 0.5, span: 0.18, box: { x: -44, y: -206, w: 88, h: 214 },
      paint: (g, k) => paintBlock(g, k, { w: 52, h: 134, merlon: 9, seed: 42, cone: 38, windows: [[0, -94]], shells: [[0, -48, 4.6]] }) }
  ];

  /* ---------------------------------------------------------------- renderer */
  class CastleRenderer {
    constructor(theme, world, castle) {
      this.theme = theme;
      this.k = theme.castle;
      this.world = world;
      this.castle = castle;
      this.key = `castle:${theme.id}:`;
      this.sparkle = 0;
    }

    sprite(part) {
      return R.sprites.get(this.key + part.name, part.box, (g) => part.paint(g, this.k), 1.35);
    }

    /** Top of the tallest visible part (for particles). */
    topY() {
      const gy = this.world.heightFast(this.castle.x);
      const s = this.castle.scale;
      let best = 30;
      for (const part of PARTS) {
        const r = clamp((this.castle.shown - part.at) / part.span, 0, 1);
        if (r > 0) best = Math.max(best, part.h * r);
      }
      return gy - best * s;
    }

    draw(ctx, camera, time, state) {
      const castle = this.castle;
      const k = this.k;
      const s = castle.scale;
      const x0 = castle.x;
      if (x0 + 200 * s < camera.left || x0 - 200 * s > camera.right) return;
      const gy = this.world.heightFast(x0);

      // Golden glow when finished.
      if (castle.complete) {
        const glow = R.softBlob(R.sprites, 'rgba(255,226,140,.8)', 32);
        ctx.globalAlpha = 0.5 + Math.sin(time * 3) * 0.12;
        R.blitScaled(ctx, glow, x0, gy - 90 * s, 7.5 * s, 6 * s);
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(x0, gy + 2);
      const pop = castle.pop;
      ctx.scale(s * (1 + pop * 0.015), s * (1 - pop * 0.02));

      // Little sign to mark the building site.
      this.drawSign(ctx);

      for (const part of PARTS) {
        const r = clamp((castle.shown - part.at) / part.span, 0, 1);
        if (r <= 0) continue;
        const ease = 1 - Math.pow(1 - r, 3);
        const sprite = this.sprite(part);
        const reveal = ease * part.h;
        ctx.save();
        ctx.translate(part.x, 0);
        if (ease < 1) {
          ctx.beginPath();
          ctx.rect(-80, -reveal, 160, reveal + 14);
          ctx.clip();
        }
        R.blit(ctx, sprite, 0, ease < 1 ? 0 : 0);
        ctx.restore();
      }

      // Flag on the keep.
      if (castle.shown > 0.9) {
        const r = clamp((castle.shown - 0.9) / 0.1, 0, 1);
        const keep = PARTS[1];
        const top = -keep.h - 11;
        const pole = R.sprites.get(this.key + 'pole', { x: -8, y: -60, w: 16, h: 66 }, (g) => paintFlagPole(g, k));
        ctx.save();
        ctx.translate(0, top + 46 * (1 - r) );
        R.blit(ctx, pole, 0, 0);
        const wave = Math.sin(time * (castle.complete ? 9 : 5));
        ctx.beginPath();
        ctx.moveTo(1.5, -44);
        ctx.quadraticCurveTo(14, -48 + wave * 3, 26, -42 + wave * 2.4);
        ctx.quadraticCurveTo(15, -38 + wave * 2, 26 - wave * 1.4, -31 + wave * 1.2);
        ctx.lineTo(1.5, -33);
        ctx.closePath();
        ctx.fillStyle = k.flag;
        ctx.fill();
        ctx.strokeStyle = '#3a2418';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Sparkles on the finished castle.
      if (castle.complete) {
        ctx.fillStyle = '#fff6c4';
        for (let i = 0; i < 9; i++) {
          const a = time * 1.6 + i * 2.1;
          const tw = Math.sin(a * 2.3);
          if (tw <= 0) continue;
          const px = x0 + Math.cos(a * 0.7 + i) * 130 * s;
          const py = gy - (30 + ((i * 53) % 150)) * s;
          const r = 2 + tw * 3.4;
          ctx.globalAlpha = tw;
          ctx.beginPath();
          for (let q = 0; q < 8; q++) {
            const rr = q % 2 ? r * 0.3 : r;
            const aa = (q / 8) * TAU - Math.PI / 2;
            ctx.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    drawSign(ctx) {
      const spr = R.sprites.get(this.key + 'sign', { x: -34, y: -50, w: 68, h: 56 }, (g) => {
        g.lineCap = 'round';
        g.strokeStyle = '#3a2418';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(0, 2);
        g.lineTo(0, -22);
        g.stroke();
        g.strokeStyle = '#a9794a';
        g.lineWidth = 3.2;
        g.stroke();
        g.beginPath();
        g.roundRect(-29, -48, 58, 26, 5);
        g.fillStyle = '#f4e4c0';
        g.fill();
        g.strokeStyle = '#3a2418';
        g.lineWidth = 2.2;
        g.stroke();
        g.font = '800 11px "Archivo Black", "Trebuchet MS", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#e2563f';
        g.fillText('BETINA', 0, -38);
        g.fillStyle = '#2f7fd6';
        g.fillText('CASTELO', 0, -28);
      });
      R.blit(ctx, spr, -170, 4);
      // Shovel stuck in the sand on the other side.
      const shovel = R.sprites.get(this.key + 'shovel', { x: -12, y: -46, w: 24, h: 52 }, (g) => {
        g.lineCap = 'round';
        g.strokeStyle = '#3a2418';
        g.lineWidth = 5.6;
        g.beginPath();
        g.moveTo(0, 4);
        g.lineTo(0, -34);
        g.stroke();
        g.strokeStyle = '#2b7bd6';
        g.lineWidth = 3;
        g.stroke();
        g.beginPath();
        g.roundRect(-6, -44, 12, 13, 4);
        g.fillStyle = '#ffd23f';
        g.fill();
        g.strokeStyle = '#3a2418';
        g.lineWidth = 1.8;
        g.stroke();
      });
      ctx.save();
      ctx.translate(162, 4);
      ctx.rotate(0.22);
      R.blit(ctx, shovel, 0, 0);
      ctx.restore();
    }
  }

  CastleRenderer.PARTS = PARTS;
  R.CastleRenderer = CastleRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
