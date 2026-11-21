/* ============================================================================
 * RIDGE RUSH — terrain renderer + decor sets
 * Draws the ground from cached height samples:
 *   textured soil (one pattern fill) → strata that follow the relief →
 *   surface cap (grass / sand) → baked props, tufts, stones and markers.
 *
 * A decor set describes how one kind of ground looks:
 *
 *   HCR.render.decor.register('mySet', {
 *     cap(c)            → { layers:[{dy,width,color}], scallop?, shadow? }
 *     soil(ctx, S, c, rnd)          // tileable S×S soil texture
 *     props:  [{ name, box, sink, maxSlope, weight, paint(ctx, c, rnd) }]
 *     tufts:  [{ name, box, paint(ctx, c, rnd) }]   // drawn over the wheels
 *     stones: [{ name, box, paint(ctx, c, rnd) }]   // buried in the soil
 *     marker: { box, sink, paint(ctx, c), text:{ x, y, font, color } }
 *   });
 *
 * `c` is theme.terrain. Painters work in local units with the origin on the
 * ground line (y up is negative).
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, hash, mulberry32 } = HCR.math;
  const { shade, mix, alpha } = R.color;
  const TAU = Math.PI * 2;

  const STEP = 10;               // px between surface vertices
  const VARIANTS = 3;            // baked variations per prop/tuft/stone

  /* ------------------------------------------------------- shared painters */
  function blob(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function paintStone(ctx, c, rnd, size) {
    const n = 7;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = size * (0.72 + rnd() * 0.36);
      pts.push([Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.82]);
    }
    const trace = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    };
    trace();
    ctx.fillStyle = rnd() > 0.5 ? c.pebble1 : c.pebble2;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(-size * 2, -size * 2, size * 4, size * 1.55);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(-size * 2, size * 0.25, size * 4, size * 2);
    ctx.restore();
    trace();
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function paintBoulder(ctx, c, rnd, w, h) {
    const pts = [
      [-w, 4], [-w * 0.92, -h * 0.45], [-w * 0.5, -h * (0.85 + rnd() * 0.15)],
      [w * 0.1, -h], [w * 0.62, -h * (0.7 + rnd() * 0.2)], [w, -h * 0.25], [w * 1.02, 4]
    ];
    const trace = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
    };
    trace();
    const g = ctx.createLinearGradient(-w, -h, w, 4);
    g.addColorStop(0, c.rockDark);
    g.addColorStop(0.55, c.rock);
    g.addColorStop(1, shade(c.rock, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Facets.
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h);
    ctx.lineTo(w * 0.62, -h * 0.8);
    ctx.lineTo(w, -h * 0.25);
    ctx.lineTo(w * 0.3, -h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath();
    ctx.moveTo(-w, 4);
    ctx.lineTo(-w * 0.5, -h * 0.9);
    ctx.lineTo(-w * 0.2, -h * 0.3);
    ctx.lineTo(-w * 0.4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    trace();
    ctx.strokeStyle = alpha(shade(c.rockDark, -0.4), 0.7);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  function paintBlades(ctx, rnd, count, height, colors, spread) {
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x0 = (t - 0.5) * spread;
      const lean = (t - 0.5) * 12 + (rnd() - 0.5) * 6;
      const h = height * (0.55 + rnd() * 0.45);
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 2.6 - rnd() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, 3);
      ctx.quadraticCurveTo(x0 + lean * 0.25, -h * 0.55, x0 + lean, -h);
      ctx.stroke();
    }
  }

  function tileable(S, draw) {
    // Runs `draw(ox, oy)` on a 3×3 grid so features wrap across tile edges.
    for (let gx = -1; gx <= 1; gx++) {
      for (let gy = -1; gy <= 1; gy++) draw(gx * S, gy * S);
    }
  }

  function paintSoil(ctx, S, c, rnd, o) {
    ctx.fillStyle = c.soilTop;
    ctx.fillRect(0, 0, S, S);
    const specks = [];
    for (let i = 0; i < o.specks; i++) {
      specks.push([rnd() * S, rnd() * S, 0.8 + rnd() * 2.4, rnd()]);
    }
    const dashes = [];
    for (let i = 0; i < o.dashes; i++) {
      dashes.push([rnd() * S, rnd() * S, 8 + rnd() * 22, rnd()]);
    }
    tileable(S, (ox, oy) => {
      for (const [x, y, r, k] of specks) {
        ctx.fillStyle = k > 0.6 ? alpha(c.soilDeep, 0.22) : k > 0.25 ? alpha(c.soilMid, 0.32) : alpha('#ffffff', 0.1);
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, r * 1.3, r, 0, 0, TAU);
        ctx.fill();
      }
      ctx.lineCap = 'round';
      for (const [x, y, len, k] of dashes) {
        ctx.strokeStyle = k > 0.5 ? alpha(c.soilDeep, 0.16) : alpha('#ffffff', 0.07);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + len / 2, y + oy + (k - 0.5) * 6, x + ox + len, y + oy);
        ctx.stroke();
      }
    });
  }

  /* ====================================================== DECOR SET: meadow */
  R.decor.register('meadow', {
    propEvery: 170,
    propChance: 0.66,
    tuftEvery: 30,
    tuftChance: 0.74,
    stoneEvery: 96,
    stoneChance: 0.6,

    cap(c) {
      return {
        shadow: { dy: 19, width: 15, color: 'rgba(20,10,0,.24)' },
        layers: [
          { dy: 5.5, width: 22, color: c.surfaceDark },
          { dy: 2.5, width: 14.5, color: c.surface },
          { dy: -2.4, width: 4, color: c.surfaceLight }
        ],
        scallop: { dy: 15.5, step: 12, rMin: 4, rMax: 8.5, color: c.surfaceDark }
      };
    },

    soil(ctx, S, c, rnd) {
      paintSoil(ctx, S, c, rnd, { specks: 190, dashes: 22 });
    },

    props: [
      {
        name: 'pine', weight: 3, sink: 5, maxSlope: 0.5,
        box: { x: -38, y: -128, w: 76, h: 140 },
        paint(ctx, c, rnd) {
          const h = 92 + rnd() * 30;
          ctx.fillStyle = c.trunk;
          ctx.fillRect(-4, -h * 0.3, 8, h * 0.3 + 8);
          ctx.fillStyle = 'rgba(0,0,0,.22)';
          ctx.fillRect(-4, -h * 0.3, 3, h * 0.3 + 8);
          const tiers = 4;
          for (let i = 0; i < tiers; i++) {
            const ty = -h * (0.2 + i * 0.19);
            const tw = 34 * (1 - i * 0.2);
            const th = h * 0.4;
            ctx.beginPath();
            ctx.moveTo(0, ty - th);
            ctx.quadraticCurveTo(-tw * 0.45, ty - th * 0.35, -tw, ty);
            ctx.quadraticCurveTo(0, ty + 5, tw, ty);
            ctx.quadraticCurveTo(tw * 0.45, ty - th * 0.35, 0, ty - th);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? c.foliage : c.foliageDark;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, ty - th);
            ctx.quadraticCurveTo(tw * 0.45, ty - th * 0.35, tw, ty);
            ctx.quadraticCurveTo(tw * 0.5, ty + 2, tw * 0.25, ty - 1);
            ctx.closePath();
            ctx.fillStyle = alpha(c.foliageLight, 0.7);
            ctx.fill();
          }
        }
      },
      {
        name: 'oak', weight: 2, sink: 5, maxSlope: 0.45,
        box: { x: -52, y: -122, w: 104, h: 134 },
        paint(ctx, c, rnd) {
          const h = 62 + rnd() * 18;
          ctx.strokeStyle = c.trunk;
          ctx.lineCap = 'round';
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.quadraticCurveTo(-2, -h * 0.5, 2, -h * 0.8);
          ctx.stroke();
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(1, -h * 0.5);
          ctx.lineTo(16, -h * 0.82);
          ctx.moveTo(0, -h * 0.55);
          ctx.lineTo(-14, -h * 0.85);
          ctx.stroke();
          const puffs = [];
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU + rnd();
            puffs.push([Math.cos(a) * 22, -h - 8 + Math.sin(a) * 15, 17 + rnd() * 8]);
          }
          puffs.push([0, -h - 10, 24]);
          for (const [x, y, r] of puffs) blob(ctx, x, y + 4, r, c.foliageDark);
          for (const [x, y, r] of puffs) blob(ctx, x + 1, y, r * 0.92, c.foliage);
          for (const [x, y, r] of puffs) blob(ctx, x + r * 0.28, y - r * 0.3, r * 0.5, alpha(c.foliageLight, 0.6));
        }
      },
      {
        name: 'bush', weight: 3, sink: 4, maxSlope: 0.7,
        box: { x: -38, y: -40, w: 76, h: 50 },
        paint(ctx, c, rnd) {
          const puffs = [[-18, -9, 13], [-2, -17, 17], [16, -10, 14], [4, -5, 14]];
          for (const [x, y, r] of puffs) blob(ctx, x, y + 3, r, c.foliageDark);
          for (const [x, y, r] of puffs) blob(ctx, x, y, r * 0.9, c.foliage);
          for (const [x, y, r] of puffs) blob(ctx, x + 4, y - 4, r * 0.48, alpha(c.foliageLight, 0.62));
          for (let i = 0; i < 5; i++) {
            blob(ctx, -20 + rnd() * 40, -20 + rnd() * 16, 1.9, i % 2 ? c.flower : c.flowerAlt);
          }
        }
      },
      {
        name: 'rock', weight: 2, sink: 3, maxSlope: 0.8,
        box: { x: -34, y: -34, w: 68, h: 44 },
        paint(ctx, c, rnd) {
          paintBoulder(ctx, c, rnd, 20 + rnd() * 8, 18 + rnd() * 8);
          ctx.strokeStyle = c.decorDark;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-24, 4);
          ctx.lineTo(-28, -8);
          ctx.moveTo(-21, 4);
          ctx.lineTo(-20, -10);
          ctx.stroke();
        }
      },
      {
        name: 'fence', weight: 1.4, sink: 3, maxSlope: 0.3,
        box: { x: -44, y: -34, w: 88, h: 44 },
        paint(ctx, c) {
          ctx.lineCap = 'round';
          for (const y of [-20, -10]) {
            ctx.strokeStyle = c.signDark;
            ctx.lineWidth = 5.5;
            ctx.beginPath();
            ctx.moveTo(-38, y + 1);
            ctx.lineTo(38, y - 2);
            ctx.stroke();
            ctx.strokeStyle = c.sign;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          for (const x of [-30, 0, 30]) {
            ctx.fillStyle = c.signDark;
            ctx.fillRect(x - 3.5, -28, 7, 36);
            ctx.fillStyle = c.sign;
            ctx.fillRect(x - 2, -27, 3.2, 34);
          }
        }
      }
    ],

    tufts: [
      {
        name: 'grass', box: { x: -16, y: -24, w: 32, h: 30 },
        paint(ctx, c, rnd) {
          paintBlades(ctx, rnd, 6, 20, [c.decorDark, c.decorColor, c.surface], 16);
        }
      },
      {
        name: 'grassShort', box: { x: -16, y: -24, w: 32, h: 30 },
        paint(ctx, c, rnd) {
          paintBlades(ctx, rnd, 5, 13, [c.decorColor, c.decorDark], 14);
        }
      },
      {
        name: 'flower', box: { x: -16, y: -26, w: 32, h: 32 },
        paint(ctx, c, rnd) {
          paintBlades(ctx, rnd, 4, 15, [c.decorDark, c.decorColor], 14);
          const fx = (rnd() - 0.5) * 8;
          ctx.strokeStyle = c.decorDark;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(fx * 0.4, 3);
          ctx.quadraticCurveTo(fx, -8, fx, -17);
          ctx.stroke();
          const petal = rnd() > 0.5 ? c.flower : c.flowerAlt;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            blob(ctx, fx + Math.cos(a) * 3, -18 + Math.sin(a) * 3, 2.3, petal);
          }
          blob(ctx, fx, -18, 1.8, '#fff6d8');
        }
      }
    ],

    stones: [
      { name: 'stoneS', box: { x: -12, y: -9, w: 24, h: 18 }, paint: (ctx, c, rnd) => paintStone(ctx, c, rnd, 5) },
      { name: 'stoneM', box: { x: -16, y: -12, w: 32, h: 24 }, paint: (ctx, c, rnd) => paintStone(ctx, c, rnd, 8) },
      {
        name: 'root', box: { x: -18, y: -8, w: 36, h: 22 },
        paint(ctx, c) {
          ctx.strokeStyle = alpha(c.pebble2, 0.8);
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-14, -4);
          ctx.quadraticCurveTo(-2, 6, 6, 2);
          ctx.quadraticCurveTo(12, 0, 14, 8);
          ctx.moveTo(-2, 3);
          ctx.quadraticCurveTo(0, 9, -6, 11);
          ctx.stroke();
        }
      }
    ],

    marker: {
      sink: 4,
      box: { x: -34, y: -70, w: 68, h: 80 },
      text: { x: 0, y: -47, font: '800 15px "Archivo Black", "Trebuchet MS", sans-serif' },
      paint(ctx, c) {
        ctx.fillStyle = c.signDark;
        ctx.fillRect(-4, -40, 8, 48);
        ctx.fillStyle = alpha('#ffffff', 0.18);
        ctx.fillRect(-4, -40, 3, 48);
        ctx.beginPath();
        ctx.roundRect(-30, -62, 60, 30, 5);
        ctx.fillStyle = c.sign;
        ctx.fill();
        ctx.strokeStyle = c.signDark;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = alpha(c.signDark, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-26, -54);
        ctx.lineTo(26, -55);
        ctx.moveTo(-26, -40);
        ctx.lineTo(26, -39);
        ctx.stroke();
        blob(ctx, -24, -47, 1.6, c.signDark);
        blob(ctx, 24, -47, 1.6, c.signDark);
      }
    }
  });

  /* ======================================================= DECOR SET: beach */
  R.decor.register('beach', {
    propEvery: 190,
    propChance: 0.6,
    tuftEvery: 38,
    tuftChance: 0.6,
    stoneEvery: 104,
    stoneChance: 0.55,

    cap(c) {
      return {
        shadow: { dy: 17, width: 13, color: 'rgba(60,30,0,.16)' },
        layers: [
          { dy: 6, width: 21, color: c.surfaceDark },
          { dy: 2.5, width: 14, color: c.surface },
          { dy: -2.2, width: 4.4, color: c.surfaceLight }
        ],
        scallop: { dy: 15, step: 17, rMin: 3, rMax: 6, color: c.surfaceDark }
      };
    },

    soil(ctx, S, c, rnd) {
      paintSoil(ctx, S, c, rnd, { specks: 240, dashes: 34 });
    },

    props: [
      {
        name: 'palm', weight: 3, sink: 6, maxSlope: 0.5,
        box: { x: -70, y: -150, w: 140, h: 164 },
        paint(ctx, c, rnd) {
          const h = 104 + rnd() * 26;
          const lean = (rnd() - 0.4) * 34;
          const tx = lean;
          const ty = -h;
          // Trunk with ring segments.
          ctx.lineCap = 'round';
          ctx.strokeStyle = shade(c.trunk, -0.3);
          ctx.lineWidth = 11;
          ctx.beginPath();
          ctx.moveTo(0, 8);
          ctx.quadraticCurveTo(lean * 0.1, -h * 0.55, tx, ty);
          ctx.stroke();
          ctx.strokeStyle = c.trunk;
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.strokeStyle = alpha('#000000', 0.2);
          ctx.lineWidth = 1.4;
          for (let i = 1; i < 11; i++) {
            const t = i / 11;
            const mt = 1 - t;
            const px = 2 * mt * t * lean * 0.1 + t * t * tx;
            const py = mt * mt * 8 + 2 * mt * t * (-h * 0.55) + t * t * ty;
            ctx.beginPath();
            ctx.moveTo(px - 4.5, py + 1);
            ctx.lineTo(px + 4.5, py - 1);
            ctx.stroke();
          }
          // Fronds: tapered leaves arcing out and drooping at the tip.
          const fronds = 9;
          for (let i = 0; i < fronds; i++) {
            const k = (i * 5) % fronds;                      // interleave sides
            const a = -Math.PI * 0.02 - (k / (fronds - 1)) * Math.PI * 0.96;
            const len = 54 + (k % 3) * 7;
            const ex = tx + Math.cos(a) * len;
            const ey = ty + Math.sin(a) * len * 0.3 + len * 0.5;
            const mx = tx + Math.cos(a) * len * 0.6;
            const my = ty + Math.sin(a) * len * 0.95 - 6;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.quadraticCurveTo(mx - Math.cos(a) * 4, my + 15, tx, ty + 3);
            ctx.closePath();
            ctx.fillStyle = i % 3 === 0 ? c.foliageDark : i % 3 === 1 ? c.foliage : c.foliageLight;
            ctx.fill();
            ctx.strokeStyle = alpha(c.foliageDark, 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(mx, my + 4, ex, ey);
            ctx.stroke();
          }
          blob(ctx, tx - 3, ty + 4, 4.2, shade(c.trunk, -0.35));
          blob(ctx, tx + 4, ty + 5, 3.8, shade(c.trunk, -0.25));
        }
      },
      {
        name: 'searock', weight: 2, sink: 3, maxSlope: 0.8,
        box: { x: -36, y: -36, w: 72, h: 46 },
        paint(ctx, c, rnd) {
          paintBoulder(ctx, c, rnd, 20 + rnd() * 10, 16 + rnd() * 10);
          blob(ctx, -12, -4, 2.2, alpha(c.decorColor, 0.85));
          blob(ctx, 9, -2, 1.7, alpha(c.decorColor, 0.85));
        }
      },
      {
        name: 'umbrella', weight: 1.3, sink: 3, maxSlope: 0.22,
        box: { x: -48, y: -84, w: 96, h: 96 },
        paint(ctx, c) {
          // Towel.
          ctx.beginPath();
          ctx.roundRect(8, -3, 34, 6, 2);
          ctx.fillStyle = c.flowerAlt;
          ctx.fill();
          ctx.fillStyle = alpha('#ffffff', 0.7);
          ctx.fillRect(14, -3, 4, 6);
          ctx.fillRect(26, -3, 4, 6);
          // Pole.
          ctx.strokeStyle = c.sign;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-6, 8);
          ctx.lineTo(4, -62);
          ctx.stroke();
          // Canopy.
          ctx.save();
          ctx.translate(4, -62);
          ctx.rotate(0.14);
          const segs = 6;
          for (let i = 0; i < segs; i++) {
            const x0 = -40 + (i / segs) * 80;
            const x1 = -40 + ((i + 1) / segs) * 80;
            ctx.beginPath();
            ctx.moveTo(0, -18);
            ctx.quadraticCurveTo(x0 * 0.7, -16, x0, 4);
            ctx.quadraticCurveTo((x0 + x1) / 2, 0, x1, 4);
            ctx.quadraticCurveTo(x1 * 0.7, -16, 0, -18);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? c.sign : c.signDark;
            ctx.fill();
          }
          ctx.strokeStyle = alpha('#000000', 0.22);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-40, 4);
          ctx.quadraticCurveTo(-28, -16, 0, -18);
          ctx.quadraticCurveTo(28, -16, 40, 4);
          ctx.stroke();
          ctx.restore();
        }
      },
      {
        name: 'driftwood', weight: 1.6, sink: 2, maxSlope: 0.5,
        box: { x: -40, y: -24, w: 80, h: 32 },
        paint(ctx, c) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = shade(c.trunk, -0.3);
          ctx.lineWidth = 11;
          ctx.beginPath();
          ctx.moveTo(-30, -2);
          ctx.quadraticCurveTo(0, -9, 30, -4);
          ctx.stroke();
          ctx.strokeStyle = shade(c.trunk, 0.25);
          ctx.lineWidth = 7.5;
          ctx.stroke();
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = shade(c.trunk, 0.12);
          ctx.beginPath();
          ctx.moveTo(6, -8);
          ctx.lineTo(16, -19);
          ctx.stroke();
          ctx.strokeStyle = alpha('#000000', 0.16);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-22, -4);
          ctx.quadraticCurveTo(0, -9, 22, -5);
          ctx.stroke();
        }
      },
      {
        name: 'dunegrass', weight: 2.4, sink: 3, maxSlope: 0.8,
        box: { x: -30, y: -46, w: 60, h: 54 },
        paint(ctx, c, rnd) {
          paintBlades(ctx, rnd, 11, 40, [c.foliageDark, c.foliage, c.foliageLight], 30);
        }
      }
    ],

    tufts: [
      {
        name: 'shell', box: { x: -12, y: -14, w: 24, h: 20 },
        paint(ctx, c, rnd) {
          ctx.save();
          ctx.translate(0, -3);
          ctx.rotate(-0.4 + rnd() * 0.8);
          ctx.beginPath();
          ctx.arc(0, 0, 5.4, Math.PI, TAU);
          ctx.lineTo(0, 3);
          ctx.closePath();
          ctx.fillStyle = c.decorColor;
          ctx.fill();
          ctx.strokeStyle = alpha(c.surfaceDark, 0.9);
          ctx.lineWidth = 1;
          ctx.stroke();
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 2.4);
            ctx.lineTo(i * 2.1, -4.2);
            ctx.stroke();
          }
          ctx.restore();
        }
      },
      {
        name: 'starfish', box: { x: -12, y: -14, w: 24, h: 20 },
        paint(ctx, c, rnd) {
          ctx.save();
          ctx.translate(0, -3);
          ctx.rotate(rnd() * 1.2);
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 2.8 : 7.2;
            const a = (i / 10) * TAU;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.62);
          }
          ctx.closePath();
          ctx.fillStyle = c.flower;
          ctx.fill();
          ctx.strokeStyle = shade(c.flower, -0.3);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      },
      {
        name: 'sprout', box: { x: -14, y: -24, w: 28, h: 30 },
        paint(ctx, c, rnd) {
          paintBlades(ctx, rnd, 4, 17, [c.foliage, c.foliageDark], 9);
        }
      }
    ],

    stones: [
      { name: 'stoneS', box: { x: -12, y: -9, w: 24, h: 18 }, paint: (ctx, c, rnd) => paintStone(ctx, c, rnd, 5) },
      { name: 'stoneM', box: { x: -16, y: -12, w: 32, h: 24 }, paint: (ctx, c, rnd) => paintStone(ctx, c, rnd, 7.5) },
      {
        name: 'fossil', box: { x: -12, y: -12, w: 24, h: 24 },
        paint(ctx, c) {
          ctx.strokeStyle = alpha(c.decorColor, 0.5);
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let i = 0; i < 44; i++) {
            const a = i * 0.36;
            const r = 0.8 + i * 0.19;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.stroke();
        }
      }
    ],

    marker: {
      sink: 4,
      box: { x: -36, y: -82, w: 72, h: 92 },
      text: { x: 13, y: -58, font: '800 13px "Archivo Black", "Trebuchet MS", sans-serif' },
      paint(ctx, c) {
        // Striped pole + pennant board.
        ctx.fillStyle = c.sign;
        ctx.fillRect(-13, -74, 7, 82);
        ctx.fillStyle = c.signDark;
        for (let y = -66; y < 6; y += 20) ctx.fillRect(-13, y, 7, 9);
        ctx.fillStyle = 'rgba(0,0,0,.14)';
        ctx.fillRect(-13, -74, 2.4, 82);
        blob(ctx, -9.5, -76, 4.4, c.signDark);
        ctx.beginPath();
        ctx.moveTo(-6, -71);
        ctx.lineTo(34, -68);
        ctx.lineTo(27, -58);
        ctx.lineTo(34, -47);
        ctx.lineTo(-6, -45);
        ctx.closePath();
        ctx.fillStyle = c.sign;
        ctx.fill();
        ctx.strokeStyle = c.signDark;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
  });

  /* The beach set minus things that would clash with the game: the umbrella
   * belongs to the camp, and there are no distance markers on this beach. */
  {
    const beach = R.decor.get('beach');
    R.decor.register('shore', Object.assign({}, beach, {
      props: beach.props.filter((p) => p.name !== 'umbrella'),
      marker: null
    }));
  }

  /* ================================================================ renderer */
  class TerrainRenderer {
    /**
     * @param terrain  HCR.Terrain (height field)
     * @param theme    active theme
     * @param opts     { markerOrigin, markerEvery (px), markerLabel(k) }
     */
    constructor(terrain, theme, opts) {
      this.terrain = terrain;
      this.theme = theme;
      this.c = theme.terrain;
      this.set = R.decor.get(theme.terrain.decorSet);
      this.cap = this.set.cap(this.c);
      this.opts = opts || {};
      this.key = `ter:${theme.id}:`;
      this.pattern = null;
      this.patternRes = 0;
      this.xs = new Float32Array(512);
      this.ys = new Float32Array(512);
      this.n = 0;
      this.left = 0;
      this.right = 0;
      this.bottom = 0;
      this.surface = null;
      this.propWeights = this.set.props.reduce((sum, p) => sum + (p.weight || 1), 0);
      this.tint = alpha(theme.background.sky[2], 0.14);
    }

    /* Sample the visible surface once; every pass reuses it. */
    prepare(camera) {
      const terrain = this.terrain;
      const left = Math.max(Math.floor((camera.left - 30) / STEP) * STEP, terrain.minX);
      const right = camera.right + 30;
      let n = 0;
      const max = this.xs.length;
      for (let x = left; x <= right + STEP && n < max; x += STEP) {
        this.xs[n] = x;
        this.ys[n] = terrain.heightFast(x);
        n++;
      }
      this.n = n;
      this.left = left;
      this.right = n ? this.xs[n - 1] : right;
      this.viewLeft = camera.left;
      this.viewRight = camera.right;
      this.bottom = camera.bottom + 60;

      const surface = new Path2D();
      for (let i = 0; i < n; i++) {
        if (i === 0) surface.moveTo(this.xs[i], this.ys[i]);
        else surface.lineTo(this.xs[i], this.ys[i]);
      }
      this.surface = surface;
    }

    bodyPath(offset, wobble, phase) {
      const path = new Path2D();
      const { xs, ys, n } = this;
      for (let i = 0; i < n; i++) {
        const y = ys[i] + offset + (wobble ? Math.sin(xs[i] * 0.0041 + phase) * wobble + Math.sin(xs[i] * 0.013 + phase * 2.3) * wobble * 0.35 : 0);
        if (i === 0) path.moveTo(xs[i], y);
        else path.lineTo(xs[i], y);
      }
      path.lineTo(this.right, this.bottom);
      path.lineTo(this.left, this.bottom);
      path.closePath();
      return path;
    }

    soilPattern(ctx) {
      const res = R.sprites.res;
      if (this.pattern && this.patternRes === res) return this.pattern;
      const S = 256;
      const tileRes = Math.min(2, res);
      const tile = R.makeCanvas(S * tileRes, S * tileRes);
      const tctx = tile.getContext('2d');
      tctx.scale(tileRes, tileRes);
      this.set.soil(tctx, S, this.c, mulberry32(9001));
      const pattern = ctx.createPattern(tile, 'repeat');
      if (pattern && pattern.setTransform && typeof DOMMatrix !== 'undefined') {
        pattern.setTransform(new DOMMatrix().scale(1 / tileRes));
      }
      this.pattern = pattern || this.c.soilTop;
      this.patternRes = res;
      return this.pattern;
    }

    sprite(kind, def, variant, tinted) {
      const c = this.c;
      const tint = this.tint;
      return R.sprites.get(`${this.key}${kind}:${def.name || 'x'}:${variant}`, def.box, (ctx, box) => {
        def.paint(ctx, c, mulberry32(variant * 7919 + 13));
        if (tinted) {
          // Push scenery slightly into the haze so the car reads on top.
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = tint;
          ctx.fillRect(box.x, box.y, box.w, box.h);
          ctx.globalCompositeOperation = 'source-over';
        }
      });
    }

    pickProp(r) {
      const props = this.set.props;
      let acc = r * this.propWeights;
      for (let i = 0; i < props.length; i++) {
        acc -= props[i].weight || 1;
        if (acc <= 0) return props[i];
      }
      return props[props.length - 1];
    }

    /* ---------------------------------------------------- scenery behind car */
    drawBack(ctx) {
      const set = this.set;
      const terrain = this.terrain;
      const q = R.quality;
      const seed = terrain.seed * 0.00071;
      const every = set.propEvery;
      const i0 = Math.floor((this.viewLeft - 90) / every);
      const i1 = Math.ceil((this.viewRight + 90) / every);

      for (let i = i0; i <= i1; i++) {
        const r = hash(i * 0.731 + seed);
        if (r > set.propChance * q.props) continue;
        const px = i * every + hash(i * 1.933 + 7.1) * every * 0.7;
        if (px < terrain.minX + 60) continue;
        if (px < (this.opts.propsFrom === undefined ? -Infinity : this.opts.propsFrom)) continue;
        if (px > (this.opts.propsUntil === undefined ? Infinity : this.opts.propsUntil)) continue;
        const def = this.pickProp(hash(i * 3.17 + seed * 1.7));
        if (Math.abs(terrain.slopeFast(px)) > (def.maxSlope || 0.6)) continue;
        const variant = Math.floor(hash(i * 5.51 + 2.2) * VARIANTS);
        R.blit(ctx, this.sprite('prop', def, variant, true), px, terrain.heightFast(px) + (def.sink || 0));
      }

      // Distance markers.
      const o = this.opts;
      if (set.marker && o.markerEvery) {
        const m = set.marker;
        const k0 = Math.max(1, Math.floor((this.viewLeft - 60 - o.markerOrigin) / o.markerEvery));
        const k1 = Math.floor((this.viewRight + 60 - o.markerOrigin) / o.markerEvery);
        for (let k = k0; k <= k1; k++) {
          const mx = o.markerOrigin + k * o.markerEvery;
          const my = terrain.heightFast(mx) + (m.sink || 0);
          R.blit(ctx, this.sprite('marker', m, 0, false), mx, my);
          ctx.font = m.text.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = m.text.color || this.c.signInk;
          ctx.fillText(o.markerLabel ? o.markerLabel(k) : String(k), mx + m.text.x, my + m.text.y);
        }
      }
    }

    /* ----------------------------------------------------------------- ground */
    drawGround(ctx) {
      if (this.n < 2) return;
      const c = this.c;
      const q = R.quality;
      const cap = this.cap;
      const terrain = this.terrain;

      // Soil.
      ctx.fillStyle = this.soilPattern(ctx);
      ctx.fill(this.bodyPath(0, 0, 0));

      // Strata: darker beds that follow the relief with a slow drift.
      const beds = [
        [52, 9, 1.3, alpha(c.soilMid, 0.6)],
        [140, 14, 4.1, alpha(c.soilDeep, 0.55)],
        [268, 18, 2.2, alpha(shade(c.soilDeep, -0.35), 0.6)]
      ];
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = c.soilLine;
      for (let i = 0; i < q.strata; i++) {
        const bed = this.bodyPath(beds[i][0], beds[i][1], beds[i][2]);
        ctx.fillStyle = beds[i][3];
        ctx.fill(bed);
        ctx.stroke(bed);
      }

      // Buried stones.
      const set = this.set;
      const seed = terrain.seed * 0.00053;
      const every = set.stoneEvery;
      const s0 = Math.floor((this.viewLeft - 30) / every);
      const s1 = Math.ceil((this.viewRight + 30) / every);
      for (let i = s0; i <= s1; i++) {
        const r = hash(i * 0.913 + seed);
        if (r > set.stoneChance) continue;
        const px = i * every + hash(i * 2.71 + 3.3) * every * 0.8;
        const depth = 34 + hash(i * 4.07 + 1.1) * 230;
        const def = set.stones[Math.floor(hash(i * 6.13 + 5.5) * set.stones.length)];
        const variant = Math.floor(hash(i * 7.77 + 0.4) * VARIANTS);
        R.blit(ctx, this.sprite('stone', def, variant, false), px, terrain.heightFast(px) + depth);
      }

      // Surface cap.
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (cap.shadow) {
        ctx.save();
        ctx.translate(0, cap.shadow.dy);
        ctx.strokeStyle = cap.shadow.color;
        ctx.lineWidth = cap.shadow.width;
        ctx.stroke(this.surface);
        ctx.restore();
      }
      const layer0 = cap.layers[0];
      ctx.save();
      ctx.translate(0, layer0.dy);
      ctx.strokeStyle = layer0.color;
      ctx.lineWidth = layer0.width;
      ctx.stroke(this.surface);
      ctx.restore();

      if (cap.scallop) {
        const sc = cap.scallop;
        const a0 = Math.floor(this.viewLeft / sc.step) - 1;
        const a1 = Math.ceil(this.viewRight / sc.step) + 1;
        ctx.fillStyle = sc.color;
        ctx.beginPath();
        for (let i = a0; i <= a1; i++) {
          const px = i * sc.step;
          const r = sc.rMin + hash(i * 0.577) * (sc.rMax - sc.rMin);
          const py = terrain.heightFast(px) + sc.dy;
          ctx.moveTo(px + r, py);
          ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fill();
      }

      for (let i = 1; i < cap.layers.length; i++) {
        const layer = cap.layers[i];
        ctx.save();
        ctx.translate(0, layer.dy);
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.stroke(this.surface);
        ctx.restore();
      }
    }

    /* ------------------------------------------------- fringe over the wheels */
    drawFront(ctx, time) {
      const set = this.set;
      const terrain = this.terrain;
      const q = R.quality;
      const seed = terrain.seed * 0.00037;
      const every = set.tuftEvery;
      const i0 = Math.floor((this.viewLeft - 20) / every);
      const i1 = Math.ceil((this.viewRight + 20) / every);
      const chance = set.tuftChance * q.tufts;

      for (let i = i0; i <= i1; i++) {
        const r = hash(i * 0.619 + seed);
        if (r > chance) continue;
        const px = i * every + hash(i * 1.37 + 4.4) * every * 0.8;
        if (px < terrain.minX + 20) continue;
        const def = set.tufts[Math.floor(hash(i * 2.93 + 8.8) * set.tufts.length)];
        const variant = Math.floor(hash(i * 4.41 + 6.6) * VARIANTS);
        const sprite = this.sprite('tuft', def, variant, false);
        const py = terrain.heightFast(px) + 2;
        if (q.sway) {
          ctx.save();
          ctx.transform(1, 0, Math.sin(time * 1.9 + px * 0.013) * 0.13, 1, px, py);
          R.blit(ctx, sprite, 0, 0);
          ctx.restore();
        } else {
          R.blit(ctx, sprite, px, py);
        }
      }
    }
  }

  R.TerrainRenderer = TerrainRenderer;
  R.decorKit = { paintStone, paintBoulder, paintBlades, paintSoil, tileable, blob };
})(typeof window !== 'undefined' ? window : globalThis);
