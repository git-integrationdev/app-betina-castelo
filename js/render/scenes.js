/* ============================================================================
 * RIDGE RUSH — scenes (parallax backgrounds)
 * A scene is baked once per theme/viewport into a low-res sky and a few
 * tileable strips. Each frame then costs ~10 drawImage calls no matter how
 * much detail the strips contain — richer art, less work than drawing live.
 *
 *   HCR.render.scenes.register('myScene', {
 *     build(theme, view) {              // view = { w, h, scale, res }
 *       return { draw(ctx, camera, time) {} };
 *     }
 *   });
 *
 * Helpers exported on HCR.render.sceneKit do the heavy lifting: makeSky,
 * makeStrip (seamless tile), drawStrip, clouds, birds.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, hash, mulberry32 } = HCR.math;
  const { shade, mix, alpha } = R.color;
  const TAU = Math.PI * 2;

  /* -------------------------------------------------------------------- kit */

  /** Smooth, exactly periodic 1D noise on t ∈ [0,1) → roughly [-1, 1]. */
  function periodic(seed, harmonics) {
    const rnd = mulberry32(seed);
    let norm = 0;
    const terms = harmonics.map((k) => {
      const a = (0.55 + rnd() * 0.45) / Math.sqrt(k);
      norm += a;
      return { k, a, p: rnd() * TAU };
    });
    return (t) => {
      let v = 0;
      for (let i = 0; i < terms.length; i++) v += terms[i].a * Math.sin(TAU * terms[i].k * t + terms[i].p);
      return v / norm;
    };
  }

  /**
   * Bake a horizontally seamless strip. `paint(ctx, W, H)` works in design
   * units and is run three times (x−W, x, x+W) so anything crossing an edge
   * wraps; a small duplicated margin hides sub-pixel seams between tiles.
   */
  function makeStrip(view, o, paint) {
    const cssW = Math.max(4, Math.round((o.width * view.scale) / 4) * 4);
    const k = (cssW * view.res) / o.width;            // device px per design unit
    const margin = 4;
    const canvas = R.makeCanvas(cssW * view.res + margin * view.res, o.height * k);
    const ctx = canvas.getContext('2d');
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    for (const shift of [-o.width, 0, o.width]) {
      ctx.save();
      ctx.translate(shift, 0);
      paint(ctx, o.width, o.height);
      ctx.restore();
    }
    if (o.haze) {
      // Aerial perspective: the base of each layer melts into the haze.
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createLinearGradient(0, o.height * (o.hazeFrom || 0.35), 0, o.height);
      g.addColorStop(0, alpha(o.haze, 0));
      g.addColorStop(1, alpha(o.haze, o.hazeAmount === undefined ? 0.55 : o.hazeAmount));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, o.width * 2, o.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    return {
      canvas,
      w: cssW,
      drawW: cssW + margin,
      h: canvas.height / view.res,
      unit: (cssW / o.width),                 // css px per design unit
      parallax: o.parallax,
      yParallax: o.yParallax || 0,
      anchor: o.anchor || 0,                  // design y that sits on `at`
      at: o.at,                               // fraction of the view height
      fill: o.fill || null                    // colour below the strip
    };
  }

  function drawStrip(ctx, strip, camera, w, h) {
    const y = h * strip.at - strip.anchor * strip.unit - camera.y * strip.yParallax;
    const scroll = camera.x * strip.parallax;
    let x = -(((scroll % strip.w) + strip.w) % strip.w);
    for (; x < w; x += strip.w) {
      ctx.drawImage(strip.canvas, x, y, strip.drawW, strip.h);
    }
    if (strip.fill && y + strip.h < h) {
      ctx.fillStyle = strip.fill;
      ctx.fillRect(0, y + strip.h - 1, w, h - (y + strip.h) + 2);
    }
  }

  /** Low-res vertical gradient backdrop (smooth content upscales for free). */
  function makeBackdrop(view, height, paint) {
    const res = 0.5;
    const canvas = R.makeCanvas(view.w * res, height * res);
    const ctx = canvas.getContext('2d');
    ctx.scale(res, res);
    paint(ctx, view.w, height);
    return { canvas, w: view.w, h: height };
  }

  function paintSunGlow(ctx, x, y, radius, bg) {
    const glow = ctx.createRadialGradient(x, y, 4, x, y, radius);
    glow.addColorStop(0, bg.sunGlow);
    glow.addColorStop(0.2, alpha(bg.sunGlow, 0.22));
    glow.addColorStop(0.55, alpha(bg.sunGlow, 0.07));
    glow.addColorStop(1, alpha(bg.sunGlow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    // Faint god rays.
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = alpha(bg.sun, 0.045);
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * TAU + 0.2;
      const spread = 0.05 + hash(i * 3.7) * 0.06;
      const len = radius * (0.7 + hash(i * 9.1) * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - spread) * len, Math.sin(a - spread) * len);
      ctx.lineTo(Math.cos(a + spread) * len, Math.sin(a + spread) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSun(ctx, x, y, r, bg) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, TAU);
    ctx.fillStyle = alpha(bg.sun, 0.28);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = bg.sun;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.24, r * 0.62, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fill();
  }

  /* ----------------------------------------------------------------- clouds */
  function makeClouds(view, bg, count) {
    const sprites = [];
    for (let v = 0; v < count; v++) {
      const box = { w: 300, h: 130 };
      const k = view.scale * view.res;
      const canvas = R.makeCanvas(box.w * k, box.h * k);
      const ctx = canvas.getContext('2d');
      ctx.scale(k, k);
      ctx.translate(box.w / 2, box.h - 28);
      const rnd = mulberry32(771 + v * 97);
      const n = 6 + Math.floor(rnd() * 3);
      const half = 86 + rnd() * 26;

      ctx.fillStyle = bg.cloud;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = -half + t * half * 2 + (rnd() - 0.5) * 12;
        const r = 17 + (1 - Math.abs(t - 0.5) * 1.7) * (20 + rnd() * 16);
        ctx.moveTo(x + r, -r * 0.55);
        ctx.arc(x, -r * 0.55, r, 0, TAU);
      }
      ctx.roundRect(-half - 12, -17, half * 2 + 24, 26, 13);
      ctx.fill();

      // Shade the belly, light the sun-facing shoulder.
      ctx.globalCompositeOperation = 'source-atop';
      const belly = ctx.createLinearGradient(0, -52, 0, 10);
      belly.addColorStop(0, alpha(bg.cloudShade, 0));
      belly.addColorStop(1, bg.cloudShade);
      ctx.fillStyle = belly;
      ctx.fillRect(-box.w / 2, -box.h, box.w, box.h + 40);
      const lit = ctx.createRadialGradient(half * 0.5, -64, 4, half * 0.5, -64, 110);
      lit.addColorStop(0, 'rgba(255,255,255,.75)');
      lit.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lit;
      ctx.fillRect(-box.w / 2, -box.h, box.w, box.h + 40);
      ctx.globalCompositeOperation = 'source-over';

      sprites.push({ canvas, w: box.w * view.scale, h: box.h * view.scale });
    }
    return sprites;
  }

  function drawClouds(ctx, clouds, camera, w, h, time, o) {
    const span = w + 700;
    for (let i = 0; i < o.count; i++) {
      const seed = i * 137.13;
      const depth = 0.5 + hash(seed + 1) * 0.7;
      const sprite = clouds[i % clouds.length];
      const size = 0.55 + hash(seed + 4) * 0.75;
      const y = h * (o.top + hash(seed + 2) * o.band) - camera.y * 0.012 * depth;
      let x = (i * span) / o.count + hash(seed + 3) * 180 - camera.x * o.parallax * depth - time * 3.5 * depth;
      x = ((x % span) + span) % span - 350;
      ctx.globalAlpha = o.alpha * (0.5 + depth * 0.42);
      ctx.drawImage(sprite.canvas, x, y, sprite.w * size, sprite.h * size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, camera, w, h, time, color, count) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const span = w + 240;
    for (let i = 0; i < count; i++) {
      const speed = 12 + i * 4;
      const x = ((i * 280 + time * speed - camera.x * 0.09) % span + span) % span - 120;
      const y = h * (0.16 + i * 0.05) + Math.sin(time * 0.8 + i) * 6;
      const wing = Math.sin(time * 5 + i * 2) * 4.5;
      const s = 0.8 + (i % 3) * 0.2;
      ctx.moveTo(x - 9 * s, y + wing);
      ctx.quadraticCurveTo(x - 4 * s, y - 3.5 * s, x, y);
      ctx.quadraticCurveTo(x + 4 * s, y - 3.5 * s, x + 9 * s, y + wing);
    }
    ctx.stroke();
  }

  /* ---------------------------------------------------------- shape helpers */
  function ridgePath(ctx, W, H, fn, step) {
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += step) ctx.lineTo(x, fn(x));
    ctx.lineTo(W + 10, H);
    ctx.closePath();
  }

  function paintPine(ctx, x, y, h, dark, light) {
    const w = h * 0.4;
    for (let tier = 0; tier < 3; tier++) {
      const ty = y - h * (0.16 + tier * 0.25);
      const tw = w * (1 - tier * 0.25);
      const th = h * 0.44;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(x, ty - th);
      ctx.lineTo(x - tw, ty);
      ctx.lineTo(x + tw, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(x, ty - th);
      ctx.lineTo(x + tw, ty);
      ctx.lineTo(x + tw * 0.2, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintPalm(ctx, x, y, h, color, light) {
    const lean = h * 0.18;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, h * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
    const tx = x + lean;
    const ty = y - h;
    ctx.lineWidth = Math.max(1, h * 0.045);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.08 - (i / 6) * Math.PI * 0.84;
      const len = h * (0.42 + (i % 2) * 0.1);
      ctx.strokeStyle = i % 3 === 0 ? light : color;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(
        tx + Math.cos(a) * len * 0.6,
        ty + Math.sin(a) * len * 0.75,
        tx + Math.cos(a) * len,
        ty + Math.sin(a) * len * 0.35 + len * 0.3
      );
      ctx.stroke();
    }
  }

  /* ============================================================ SCENE: hills */
  R.scenes.register('hills', {
    build(theme, view) {
      const bg = theme.background;
      const q = R.quality;
      const { w, h } = view;
      const sunX = w * 0.77;
      const sunY = h * 0.2;

      const sky = makeBackdrop(view, h, (ctx, W, H) => {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, bg.sky[0]);
        g.addColorStop(0.5, bg.sky[1]);
        g.addColorStop(0.78, bg.sky[2]);
        g.addColorStop(1, bg.sky[2]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        paintSunGlow(ctx, sunX, sunY, H * 0.62, bg);
        // Warm haze sitting on the horizon.
        const haze = ctx.createLinearGradient(0, H * 0.34, 0, H * 0.7);
        haze.addColorStop(0, alpha(bg.haze, 0));
        haze.addColorStop(0.6, bg.haze);
        haze.addColorStop(1, alpha(bg.haze, 0.2));
        ctx.fillStyle = haze;
        ctx.fillRect(0, H * 0.34, W, H * 0.36);
      });

      const clouds = makeClouds(view, bg, 3);
      const strips = [];

      /* 1 — jagged far range with snow caps. */
      strips.push(makeStrip(view, {
        width: 2048, height: 300, parallax: 0.045, yParallax: 0.02,
        anchor: 232, at: 0.535, fill: mix(bg.far, bg.haze, 0.45),
        haze: bg.sky[2], hazeFrom: 0.3, hazeAmount: 0.7
      }, (ctx, W, H) => {
        const rnd = mulberry32(4242);
        const base = 232;
        const low = periodic(77, [1, 2, 3, 5]);
        ridgePath(ctx, W, H, (x) => base - 34 + low(x / W) * 22, 16);
        ctx.fillStyle = mix(bg.far, bg.sky[1], 0.35);
        ctx.fill();

        const peaks = [];
        const n = 9;
        for (let i = 0; i < n; i++) {
          peaks.push({
            x: ((i + 0.2 + rnd() * 0.6) / n) * W,
            h: 92 + rnd() * 112,
            w: 120 + rnd() * 90,
            seed: rnd()
          });
        }
        peaks.sort((a, b) => a.h - b.h);
        for (const p of peaks) {
          const pr = mulberry32(Math.floor(p.seed * 1e6));
          const apexY = base - p.h;
          const left = [];
          const right = [];
          const steps = 5;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            left.push([p.x - p.w * t + (pr() - 0.5) * 14, apexY + p.h * t + (pr() - 0.5) * 12 * (1 - t)]);
            right.push([p.x + p.w * t + (pr() - 0.5) * 14, apexY + p.h * t + (pr() - 0.5) * 12 * (1 - t)]);
          }
          const spineX = p.x + (pr() - 0.5) * p.w * 0.3;

          const body = ctx.createLinearGradient(0, apexY, 0, base + 20);
          body.addColorStop(0, bg.farTop);
          body.addColorStop(1, bg.far);
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(p.x, apexY);
          for (const pt of right) ctx.lineTo(pt[0], pt[1]);
          ctx.lineTo(p.x + p.w, H);
          ctx.lineTo(p.x - p.w, H);
          for (let s = left.length - 1; s >= 0; s--) ctx.lineTo(left[s][0], left[s][1]);
          ctx.closePath();
          ctx.fill();

          // Shadow face (sun is on the right).
          ctx.fillStyle = alpha(shade(bg.far, -0.45), 0.22);
          ctx.beginPath();
          ctx.moveTo(p.x, apexY);
          ctx.lineTo(p.x + (spineX - p.x) * 0.5 + 6, apexY + p.h * 0.5);
          ctx.lineTo(spineX, base + 20);
          ctx.lineTo(p.x - p.w, base + 20);
          for (let s = left.length - 1; s >= 0; s--) ctx.lineTo(left[s][0], left[s][1]);
          ctx.closePath();
          ctx.fill();

          // Snow cap.
          if (p.h > 120) {
            const capT = 0.3;
            ctx.fillStyle = alpha(bg.snow, 0.9);
            ctx.beginPath();
            ctx.moveTo(p.x, apexY - 1);
            ctx.lineTo(p.x + p.w * capT, apexY + p.h * capT);
            ctx.lineTo(p.x + p.w * capT * 0.55, apexY + p.h * capT * 0.72);
            ctx.lineTo(p.x + p.w * capT * 0.2, apexY + p.h * capT * 1.05);
            ctx.lineTo(p.x - p.w * capT * 0.15, apexY + p.h * capT * 0.7);
            ctx.lineTo(p.x - p.w * capT * 0.5, apexY + p.h * capT * 1.0);
            ctx.lineTo(p.x - p.w * capT, apexY + p.h * capT);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = alpha(shade(bg.far, -0.2), 0.2);
            ctx.beginPath();
            ctx.moveTo(p.x, apexY - 1);
            ctx.lineTo(p.x - p.w * capT * 0.15, apexY + p.h * capT * 0.7);
            ctx.lineTo(p.x - p.w * capT * 0.5, apexY + p.h * capT * 1.0);
            ctx.lineTo(p.x - p.w * capT, apexY + p.h * capT);
            ctx.closePath();
            ctx.fill();
          }
        }
      }));

      /* 2 — rolling mid hills with a soft canopy. */
      if (q.id !== 'low') {
        strips.push(makeStrip(view, {
          width: 2048, height: 250, parallax: 0.11, yParallax: 0.035,
          anchor: 96, at: 0.575, fill: mix(bg.mid, bg.haze, 0.3),
          haze: bg.haze, hazeFrom: 0.35, hazeAmount: 0.42
        }, (ctx, W, H) => {
          const f = periodic(1201, [1, 2, 3, 5, 8]);
          const crest = (x) => 96 + f(x / W) * 56;
          ridgePath(ctx, W, H, crest, 12);
          const g = ctx.createLinearGradient(0, 30, 0, H);
          g.addColorStop(0, bg.midTop);
          g.addColorStop(1, bg.mid);
          ctx.fillStyle = g;
          ctx.fill();

          const rnd = mulberry32(88);
          // Bumpy canopy along the crest.
          ctx.fillStyle = mix(bg.midTop, bg.tree, 0.2);
          ctx.beginPath();
          for (let x = 0; x < W; x += 7) {
            const r = 4 + rnd() * 5;
            const y = crest(x) + 3;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
          }
          ctx.fill();
          // Woodland patches and sunlit fields on the slopes.
          for (let i = 0; i < 70; i++) {
            const x = rnd() * W;
            const y = crest(x) + 14 + rnd() * 110;
            const rw = 26 + rnd() * 70;
            ctx.fillStyle = rnd() > 0.45
              ? alpha(bg.tree, 0.16)
              : alpha(bg.sun, 0.1);
            ctx.beginPath();
            ctx.ellipse(x, y, rw, rw * 0.22, 0, 0, TAU);
            ctx.fill();
          }
        }));
      }

      /* 3 — pine forest ridge. */
      strips.push(makeStrip(view, {
        width: 2048, height: 280, parallax: 0.22, yParallax: 0.055,
        anchor: 108, at: 0.635, fill: mix(bg.near, bg.haze, 0.22),
        haze: bg.haze, hazeFrom: 0.42, hazeAmount: 0.42
      }, (ctx, W, H) => {
        const f = periodic(5150, [1, 2, 4, 7]);
        const crest = (x) => 112 + f(x / W) * 46;
        const rnd = mulberry32(3);
        const dark = bg.tree;
        const light = bg.treeLight;

        // Back row of pines standing on the crest.
        for (let x = 6; x < W; x += 15) {
          if (hash(x * 0.171) < 0.22) continue;
          const px = x + (rnd() - 0.5) * 8;
          paintPine(ctx, px, crest(px) + 5, 20 + rnd() * 24, dark, light);
        }
        ridgePath(ctx, W, H, crest, 12);
        const g = ctx.createLinearGradient(0, 60, 0, H);
        g.addColorStop(0, mix(bg.near, bg.midTop, 0.35));
        g.addColorStop(1, bg.near);
        ctx.fillStyle = g;
        ctx.fill();

        // Scattered trees and clearings down the slope.
        for (let i = 0; i < 46; i++) {
          const x = rnd() * W;
          const y = crest(x) + 12 + rnd() * 90;
          ctx.fillStyle = alpha(bg.sun, 0.07);
          ctx.beginPath();
          ctx.ellipse(x, y, 40 + rnd() * 60, 7 + rnd() * 7, 0, 0, TAU);
          ctx.fill();
        }
        const rows = [];
        for (let i = 0; i < 120; i++) {
          const x = rnd() * W;
          rows.push([x, crest(x) + 16 + Math.pow(rnd(), 1.4) * 105, rnd()]);
        }
        rows.sort((a, b) => a[1] - b[1]);
        for (const [x, y, r] of rows) {
          const depth = clamp((y - 110) / 140, 0, 1);
          paintPine(ctx, x, y, 24 + depth * 26 + r * 12, shade(dark, -0.06 * depth), light);
        }
      }));

      /* 4 — dark near ridge with tall pines. */
      if (q.id === 'high') {
        strips.push(makeStrip(view, {
          width: 2304, height: 260, parallax: 0.4, yParallax: 0.08,
          anchor: 120, at: 0.74, fill: shade(bg.near, -0.22)
        }, (ctx, W, H) => {
          const f = periodic(909, [1, 2, 3, 5]);
          const crest = (x) => 124 + f(x / W) * 40;
          const rnd = mulberry32(17);
          const dark = shade(bg.tree, -0.2);
          const light = shade(bg.treeLight, -0.12);
          for (let x = 10; x < W; x += 34) {
            if (hash(x * 0.093) < 0.35) continue;
            const px = x + (rnd() - 0.5) * 18;
            paintPine(ctx, px, crest(px) + 8, 52 + rnd() * 56, dark, light);
          }
          ridgePath(ctx, W, H, crest, 12);
          const g = ctx.createLinearGradient(0, 80, 0, H);
          g.addColorStop(0, shade(bg.near, -0.08));
          g.addColorStop(1, shade(bg.near, -0.24));
          ctx.fillStyle = g;
          ctx.fill();
          // Shrubs on the crest.
          ctx.fillStyle = shade(bg.near, -0.16);
          ctx.beginPath();
          for (let x = 0; x < W; x += 21) {
            if (hash(x * 0.61) < 0.45) continue;
            const r = 7 + rnd() * 10;
            const y = crest(x) + 3;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
          }
          ctx.fill();
        }));
      }

      const cloudCount = q.id === 'low' ? 4 : 7;
      const birdColor = alpha(bg.tree, 0.45);

      return {
        draw(ctx, camera, time) {
          ctx.drawImage(sky.canvas, 0, 0, w, h);
          drawSun(ctx, sunX, sunY - camera.y * 0.006, 30 * view.scale, bg);
          drawClouds(ctx, clouds, camera, w, h, time, {
            count: cloudCount, parallax: 0.03, top: 0.03, band: 0.3, alpha: 0.95
          });
          for (let i = 0; i < strips.length; i++) drawStrip(ctx, strips[i], camera, w, h);
          drawBirds(ctx, camera, w, h, time, birdColor, 4);
        }
      };
    }
  });

  /* ============================================================== SCENE: sea */
  R.scenes.register('sea', {
    build(theme, view) {
      const bg = theme.background;
      const q = R.quality;
      const { w, h } = view;
      const margin = Math.round(70 * view.scale);
      const horizonBase = h * 0.5;
      const sunX = w * 0.74;
      const sunY = horizonBase * 0.44;

      // Sky and sea share one tall backdrop that slides with the camera.
      const backdrop = makeBackdrop(view, h + margin * 2, (ctx, W, H) => {
        const hz = horizonBase + margin;
        const sky = ctx.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, bg.sky[0]);
        sky.addColorStop(0.6, bg.sky[1]);
        sky.addColorStop(1, bg.sky[2]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, hz);
        paintSunGlow(ctx, sunX, sunY + margin, H * 0.5, bg);

        const sea = ctx.createLinearGradient(0, hz, 0, H);
        sea.addColorStop(0, mix(bg.seaFar, bg.sky[2], 0.28));
        sea.addColorStop(0.08, bg.seaFar);
        sea.addColorStop(0.45, bg.seaMid);
        sea.addColorStop(1, bg.seaNear);
        ctx.fillStyle = sea;
        ctx.fillRect(0, hz, W, H - hz);

        // Bright seam on the horizon + the sun's column of light.
        const seam = ctx.createLinearGradient(0, hz - 14, 0, hz + 46);
        seam.addColorStop(0, 'rgba(255,247,205,0)');
        seam.addColorStop(0.3, 'rgba(255,247,205,.5)');
        seam.addColorStop(1, 'rgba(255,247,205,0)');
        ctx.fillStyle = seam;
        ctx.fillRect(0, hz - 14, W, 60);
        const column = ctx.createLinearGradient(sunX - 170, 0, sunX + 170, 0);
        column.addColorStop(0, 'rgba(255,243,190,0)');
        column.addColorStop(0.5, 'rgba(255,243,190,.3)');
        column.addColorStop(1, 'rgba(255,243,190,0)');
        ctx.fillStyle = column;
        ctx.fillRect(sunX - 170, hz, 340, H - hz);
      });

      const clouds = makeClouds(view, bg, 3);

      function paintIsland(ctx, cx, waterY, width, height, seed, body, top, palms) {
        const rnd = mulberry32(seed);
        const prof = periodic(seed + 5, [1, 2, 3]);
        const half = width / 2;
        const yAt = (t) => {
          // t ∈ [-1, 1]; a dome with a little noise.
          const dome = Math.pow(Math.max(0, 1 - t * t), 0.8);
          return waterY - height * dome * (0.78 + prof((t + 1) / 2) * 0.22);
        };
        const outline = () => {
          ctx.beginPath();
          ctx.moveTo(cx - half, waterY);
          for (let i = 0; i <= 40; i++) {
            const t = -1 + (i / 40) * 2;
            ctx.lineTo(cx + t * half, yAt(t));
          }
          ctx.closePath();
        };

        // Reflection first.
        ctx.save();
        ctx.translate(0, waterY);
        ctx.scale(1, -0.42);
        ctx.translate(0, -waterY);
        outline();
        ctx.fillStyle = alpha(shade(body, -0.25), 0.26);
        ctx.fill();
        ctx.restore();

        outline();
        const g = ctx.createLinearGradient(0, waterY - height, 0, waterY);
        g.addColorStop(0, top);
        g.addColorStop(1, body);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        ctx.clip();
        // Sunlit flank (sun on the right) + a sandy shore.
        const lit = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
        lit.addColorStop(0, alpha('#00222a', 0.2));
        lit.addColorStop(0.55, 'rgba(0,0,0,0)');
        lit.addColorStop(1, alpha(bg.sun, 0.26));
        ctx.fillStyle = lit;
        ctx.fillRect(cx - half, waterY - height - 10, width, height + 20);
        ctx.fillStyle = alpha(bg.sand, 0.85);
        ctx.fillRect(cx - half, waterY - 4.5, width, 6);
        // Canopy texture.
        ctx.fillStyle = alpha(shade(body, -0.3), 0.18);
        for (let i = 0; i < 26; i++) {
          const t = -0.9 + rnd() * 1.8;
          const y = yAt(t) + 6 + rnd() * height * 0.6;
          ctx.beginPath();
          ctx.ellipse(cx + t * half, y, 8 + rnd() * 16, 3 + rnd() * 4, 0, 0, TAU);
          ctx.fill();
        }
        ctx.restore();

        // Foam line where the island meets the water.
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - half - 4, waterY + 1);
        ctx.lineTo(cx + half + 4, waterY + 1);
        ctx.stroke();

        if (palms) {
          for (let i = 0; i < palms; i++) {
            const t = -0.55 + rnd() * 1.1;
            paintPalm(ctx, cx + t * half, yAt(t) + 3, 22 + rnd() * 16, bg.palm, bg.palmLight);
          }
        }
      }

      const strips = [];
      strips.push(makeStrip(view, {
        width: 2400, height: 190, parallax: 0.03, yParallax: 0.02,
        anchor: 140, at: 0.5
      }, (ctx) => {
        const far = mix(bg.islandFar, bg.sky[2], 0.3);
        const farTop = mix(far, bg.sky[1], 0.35);
        paintIsland(ctx, 380, 140, 520, 92, 11, far, farTop, 0);
        paintIsland(ctx, 1220, 140, 330, 58, 23, far, farTop, 0);
        paintIsland(ctx, 1920, 140, 640, 118, 37, far, farTop, 0);
      }));
      strips.push(makeStrip(view, {
        width: 3000, height: 230, parallax: 0.075, yParallax: 0.02,
        anchor: 172, at: 0.5
      }, (ctx) => {
        paintIsland(ctx, 620, 172, 560, 128, 51, bg.islandNear, mix(bg.islandNear, bg.palmLight, 0.5), 5);
        paintIsland(ctx, 1700, 172, 250, 62, 67, bg.islandDark, bg.islandNear, 3);
        paintIsland(ctx, 2500, 172, 420, 98, 79, bg.islandNear, mix(bg.islandNear, bg.palmLight, 0.5), 4);
      }));

      const cloudCount = q.id === 'low' ? 4 : 6;
      const glints = q.id === 'low' ? 8 : 16;
      const waveLayers = q.id === 'low' ? 3 : 5;

      function drawBoat(ctx, x, y, s, time) {
        const bob = Math.sin(time * 1.3 + x * 0.01) * 0.05;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.rotate(bob);
        // Reflection.
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(-1, 7);
        ctx.lineTo(12, 9);
        ctx.lineTo(0, 22);
        ctx.closePath();
        ctx.fill();
        // Hull.
        ctx.fillStyle = bg.hull;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(16, 0);
        ctx.lineTo(10, 6.5);
        ctx.lineTo(-10, 6.5);
        ctx.closePath();
        ctx.fill();
        // Sails.
        ctx.fillStyle = bg.sail;
        ctx.beginPath();
        ctx.moveTo(1, -2);
        ctx.lineTo(1, -30);
        ctx.quadraticCurveTo(12, -16, 15, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(bg.sail, -0.12);
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-2, -24);
        ctx.quadraticCurveTo(-10, -13, -13, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      return {
        draw(ctx, camera, time) {
          const shift = clamp(-camera.y * 0.02, -margin, margin);
          const horizon = horizonBase + shift;
          ctx.drawImage(backdrop.canvas, 0, shift - margin, w, h + margin * 2);
          drawSun(ctx, sunX, sunY + shift, 28 * view.scale, bg);
          drawClouds(ctx, clouds, camera, w, h, time, {
            count: cloudCount, parallax: 0.028, top: 0.02, band: 0.27, alpha: 0.92
          });

          const seaCam = { x: camera.x, y: -shift / 0.02 };
          for (let i = 0; i < strips.length; i++) drawStrip(ctx, strips[i], seaCam, w, h);

          // Sun glitter.
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = '#fff3bb';
          const depth = h - horizon;
          for (let i = 0; i < glints; i++) {
            const t = i / glints;
            const y = horizon + 5 + Math.pow(t, 1.3) * depth * 0.72;
            const spread = 8 + t * 62;
            const wob = Math.sin(time * 1.8 + i * 1.7) * (3 + t * 10);
            ctx.globalAlpha = (1 - t) * 0.34 * (0.6 + 0.4 * Math.sin(time * 3.1 + i * 2.3));
            ctx.beginPath();
            ctx.ellipse(sunX + wob, y, spread, 1.3 + t * 2.6, 0, 0, TAU);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';

          // Swell lines with broken whitecaps.
          ctx.strokeStyle = bg.wave;
          ctx.lineCap = 'round';
          for (let layer = 0; layer < waveLayers; layer++) {
            const t = (layer + 1) / waveLayers;
            const yBase = horizon + Math.pow(t, 1.9) * depth;
            const amp = 1.2 + t * 5.5;
            const scroll = camera.x * (0.06 + t * 0.14);
            ctx.globalAlpha = 0.14 + t * 0.2;
            ctx.lineWidth = 1 + t * 2;
            ctx.setLineDash([30 + t * 70, 18 + t * 46]);
            ctx.lineDashOffset = scroll + layer * 37;
            ctx.beginPath();
            for (let x = -30; x <= w + 30; x += 20) {
              const y = yBase + Math.sin((scroll + x) * 0.013 + time * (0.7 + t) + layer * 1.7) * amp;
              if (x === -30) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Sailboats crossing the horizon.
          const period = w + 500;
          let bx = 300 - camera.x * 0.13 + time * 4;
          bx = ((bx % period) + period) % period - 250;
          drawBoat(ctx, bx, horizon + 3, 1 * view.scale, time);
          let bx2 = 900 - camera.x * 0.06 - time * 2.5;
          bx2 = ((bx2 % period) + period) % period - 250;
          drawBoat(ctx, bx2, horizon + 1.5, 0.55 * view.scale, time);

          drawBirds(ctx, camera, w, h, time, bg.gull, 4);
        }
      };
    }
  });

  R.sceneKit = {
    periodic, makeStrip, drawStrip, makeBackdrop, paintSunGlow, drawSun,
    makeClouds, drawClouds, drawBirds, ridgePath, paintPine, paintPalm
  };

  /** Build the scene a theme asks for, at the current viewport + quality. */
  R.buildScene = function (theme, w, h) {
    const q = R.quality;
    const view = {
      w,
      h,
      scale: clamp(h / 720, 0.62, 1.5),
      res: q.layerRes
    };
    return R.scenes.get(theme.background.scene).build(theme, view);
  };
})(typeof window !== 'undefined' ? window : globalThis);
