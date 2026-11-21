/* ============================================================================
 * CASTELO DA BETINA — characters
 * Betina (animated run cycle, pigtails, a bucket that sloshes and tips) and
 * the beach crabs. Heads, torsos and buckets are baked once into sprites;
 * only limbs and pendulums are drawn live.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp, damp } = HCR.math;
  const { shade, alpha, mix } = R.color;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ limbs */
  function limb(ctx, pts, width, fill, outline) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineWidth = width + 2.6;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = fill;
    ctx.stroke();
  }

  /* ---------------------------------------------------------------- painters */
  function paintHead(ctx, c, mood) {
    const r = 11.5;
    // Pigtail bases / ears are drawn by the renderer; this is face + hair cap.
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, r + 1);
    g.addColorStop(0, shade(c.skin, 0.14));
    g.addColorStop(1, c.skin);
    ctx.fillStyle = g;
    ctx.fill();

    // Hair: cap on the back and top, fringe over the forehead.
    ctx.beginPath();
    ctx.moveTo(-r - 0.4, 3);
    ctx.bezierCurveTo(-r - 2, -r - 3, r * 0.4, -r - 4, r * 0.95, -r * 0.2);
    ctx.bezierCurveTo(r * 0.55, -r * 0.62, r * 0.05, -r * 0.5, -r * 0.4, -r * 0.36);
    ctx.bezierCurveTo(-r * 0.8, -r * 0.15, -r * 0.7, r * 0.35, -r * 0.4, r * 0.55);
    ctx.bezierCurveTo(-r * 0.9, r * 0.45, -r - 0.4, 3, -r - 0.4, 3);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, -r, 0, r * 0.5);
    hg.addColorStop(0, c.hairLight);
    hg.addColorStop(1, c.hair);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Face outline (front half only so the hair reads).
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.42, Math.PI * 0.62);
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    // Cheek.
    ctx.beginPath();
    ctx.ellipse(4.6, 4.6, 3.2, 2.2, 0, 0, TAU);
    ctx.fillStyle = c.blush;
    ctx.fill();

    // Eye.
    if (mood === 'oops') {
      ctx.beginPath();
      ctx.ellipse(5.3, -0.8, 2.9, 3.5, 0, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5.8, -0.6, 1.4, 0, TAU);
      ctx.fillStyle = c.outline;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(5.4, -0.6, 1.9, 2.7, 0.05, 0, TAU);
      ctx.fillStyle = c.outline;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5.9, -1.6, 0.8, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    // Brow + lash.
    ctx.strokeStyle = c.hair;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(3.4, mood === 'oops' ? -5.8 : -4.2);
    ctx.quadraticCurveTo(5.6, mood === 'oops' ? -7.2 : -5.4, 8, mood === 'oops' ? -5.2 : -4);
    ctx.stroke();

    // Nose.
    ctx.beginPath();
    ctx.arc(9.4, 1.8, 1.1, 0, TAU);
    ctx.fillStyle = c.skinDark;
    ctx.fill();

    // Mouth.
    ctx.strokeStyle = shade(c.outline, 0.1);
    ctx.fillStyle = '#b3243c';
    ctx.lineWidth = 1.4;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.moveTo(4.6, 5.8);
      ctx.quadraticCurveTo(7.4, 10.6, 10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'oops') {
      ctx.beginPath();
      ctx.ellipse(7.3, 7.4, 1.5, 2, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(4.8, 6.4);
      ctx.quadraticCurveTo(7.6, 8.6, 9.8, 6.2);
      ctx.stroke();
    }
  }

  function paintTorso(ctx, c) {
    // Swimsuit top + short skirt, origin at the hip.
    const skirt = () => {
      ctx.beginPath();
      ctx.moveTo(-6.5, -3);
      ctx.quadraticCurveTo(-11, 4, -12.5, 8);
      ctx.lineTo(12.5, 8);
      ctx.quadraticCurveTo(11, 4, 6.5, -3);
      ctx.closePath();
    };
    skirt();
    const sg = ctx.createLinearGradient(0, -3, 0, 8);
    sg.addColorStop(0, c.skirt);
    sg.addColorStop(1, c.skirtDark);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    // Skirt frill.
    ctx.strokeStyle = alpha('#ffffff', 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11.4, 6);
    ctx.quadraticCurveTo(0, 9.2, 11.4, 6);
    ctx.stroke();

    // Body.
    ctx.beginPath();
    ctx.moveTo(-6.6, 0);
    ctx.quadraticCurveTo(-8.6, -10, -7.4, -19);
    ctx.quadraticCurveTo(-6, -22, 0, -22);
    ctx.quadraticCurveTo(6, -22, 7.4, -19);
    ctx.quadraticCurveTo(8.6, -10, 6.6, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(-8, 0, 8, 0);
    g.addColorStop(0, c.suit);
    g.addColorStop(0.65, shade(c.suit, 0.12));
    g.addColorStop(1, c.suitDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c.suitDot;
    for (const [x, y] of [[-3, -16], [3, -12], [-2, -8], [4, -4], [-4, -2], [1, -19]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    // Waist band.
    ctx.fillStyle = c.suitDark;
    ctx.fillRect(-6.8, -2.6, 13.6, 2.6);
  }

  function paintPigtail(ctx, c) {
    // Origin at the band, hanging down (+y).
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.bezierCurveTo(-9, 6, -8, 17, -3, 23);
    ctx.bezierCurveTo(1, 19, 5, 12, 3, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(-6, 0, 4, 22);
    g.addColorStop(0, c.hairLight);
    g.addColorStop(1, c.hair);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = alpha(c.hairLight, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1.5, 4);
    ctx.quadraticCurveTo(-3.5, 12, -1.5, 19);
    ctx.stroke();
    // Bow.
    ctx.fillStyle = c.bow;
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 7, -5, s * 6.5, 1.5);
      ctx.quadraticCurveTo(s * 6, 5, 0, 0);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, TAU);
    ctx.fillStyle = shade(c.bow, -0.12);
    ctx.fill();
  }

  function paintBucket(ctx, c) {
    // Origin = where the hand grips the handle. Body hangs below.
    const top = 8;     // rim height below the grip
    const h = 22;
    const tw = 11.5;   // half width at the rim
    const bw = 8.6;    // half width at the base
    // Handle.
    ctx.beginPath();
    ctx.moveTo(-tw + 1, top);
    ctx.bezierCurveTo(-tw + 1, -6, tw - 1, -6, tw - 1, top);
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.strokeStyle = c.bucketHandle;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // Body.
    ctx.beginPath();
    ctx.moveTo(-tw, top);
    ctx.lineTo(tw, top);
    ctx.lineTo(bw, top + h);
    ctx.quadraticCurveTo(0, top + h + 3, -bw, top + h);
    ctx.closePath();
    const g = ctx.createLinearGradient(-tw, 0, tw, 0);
    g.addColorStop(0, c.bucketDark);
    g.addColorStop(0.35, shade(c.bucket, 0.1));
    g.addColorStop(0.7, c.bucket);
    g.addColorStop(1, c.bucketDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Stripes + star.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = alpha(c.bucketRim, 0.9);
    ctx.fillRect(-tw, top + 9, tw * 2, 3.4);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 1.8 : 4.2;
      const a = -Math.PI / 2 + (i / 10) * TAU;
      ctx.lineTo(Math.cos(a) * rr, top + 16.5 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    // Highlight.
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-tw + 3.2, top + 4);
    ctx.lineTo(-bw + 1.6, top + h - 3);
    ctx.stroke();
  }

  function paintBucketRim(ctx, c) {
    // Opening seen slightly from above: dark inside + yellow rim ring.
    const top = 8;
    const tw = 11.5;
    ctx.beginPath();
    ctx.ellipse(0, top, tw, 3.7, 0, 0, TAU);
    ctx.fillStyle = shade(c.bucketDark, -0.35);
    ctx.fill();
  }

  function paintBucketLip(ctx, c) {
    const top = 8;
    const tw = 11.5;
    ctx.beginPath();
    ctx.ellipse(0, top, tw, 3.7, 0, 0, Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.outline;
    ctx.stroke();
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = c.bucketRim;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, top, tw, 3.7, 0, Math.PI, TAU);
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = shade(c.bucketRim, -0.25);
    ctx.stroke();
  }

  /* ----------------------------------------------------------------- Betina */
  class BetinaRenderer {
    constructor(theme) {
      this.theme = theme;
      this.c = theme.colors;
      this.key = `betina:${theme.id}:`;
      this.tilt = 0;          // bucket tipping while dumping
      this.crouch = 0;        // dipping while scooping
      this.lean = 0;
      this.pigA = 0;
      this.pigB = 0;
      this.pigV = [0, 0];
      this.lastX = null;
      this.grainTimer = 0;
    }

    sprite(name, box, paint) {
      return R.sprites.get(this.key + name, box, paint);
    }

    draw(ctx, pl, time, state, dt, fx) {
      const c = this.c;
      const k = this.theme.player.scale;
      const p = this.theme.physics;
      const runAmt = pl.grounded ? clamp(Math.abs(pl.vx) / p.runSpeed, 0, 1) : 0.3;
      const ph = pl.phase;
      const air = !pl.grounded;
      const f = pl.facing;

      // Smooth the dynamic bits.
      this.tilt = damp(this.tilt, pl.dumping ? 1.5 : 0, 12, dt);
      this.crouch = damp(this.crouch, pl.scooping ? 1 : 0, 10, dt);
      this.lean = damp(this.lean, clamp(pl.vx / 300, -1, 1) * 0.16 * f + this.crouch * 0.3, 9, dt);
      const lean = this.lean;

      // Soft contact shadow (world space).
      const shadow = R.softBlob(R.sprites, 'rgba(40,20,0,.5)', 32);
      const lift = air ? clamp((this.theme.player.height * 1.8 + pl.vy * 0.0) * 0, 0, 0) : 0;
      ctx.save();
      ctx.translate(pl.x, pl.y + 1.5);
      ctx.globalAlpha = air ? 0.35 : 0.8;
      R.blitScaled(ctx, shadow, 0, lift, 0.85 * k, 0.2 * k);
      ctx.restore();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.scale(f * k, k);
      if (pl.invuln > 0 && Math.floor(time * 12) % 2 === 0 && pl.stun <= 0) ctx.globalAlpha = 0.55;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const bob = -Math.abs(Math.sin(ph)) * 2.4 * runAmt + (air ? -2 : 0) + this.crouch * 4;
      const hipX = -0.5 + lean * 8;
      const hipY = -30 + bob + this.crouch * 4;
      const legW = 6.2;

      /* legs ------------------------------------------------------------ */
      const legs = [];
      for (let i = 0; i < 2; i++) {
        let a1;
        let a2;
        if (air) {
          if (i === 1) { a1 = 0.75; a2 = -0.15; }
          else { a1 = -0.35; a2 = -1.15; }
          if (pl.vy > 200) { a1 *= 0.5; a2 = a1 - 0.2; }   // stretch for landing
        } else {
          const th = ph + i * Math.PI;
          a1 = Math.sin(th) * 0.85 * runAmt;
          a2 = a1 - (0.12 + Math.max(0, Math.cos(th)) * 1.0 * runAmt);
          if (this.crouch > 0.1) { a1 += (i ? 0.45 : -0.1) * this.crouch; a2 = a1 - 0.5 * this.crouch; }
        }
        const kx = hipX + Math.sin(a1) * 15.5;
        const ky = hipY + Math.cos(a1) * 15.5;
        const fx2 = kx + Math.sin(a2) * 15.5;
        let fy2 = ky + Math.cos(a2) * 15.5;
        legs.push({ hx: hipX, hy: hipY, kx, ky, fx: fx2, fy: fy2 });
      }

      const drawLeg = (L, dark) => {
        const skin = dark ? c.skinDark : c.skin;
        limb(ctx, [L.hx, L.hy, L.kx, L.ky, L.fx, L.fy], legW, skin, c.outline);
        // Foot.
        ctx.save();
        ctx.translate(L.fx, L.fy);
        ctx.rotate(0.12);
        ctx.beginPath();
        ctx.ellipse(2.4, 0.4, 5.2, 2.7, 0, 0, TAU);
        ctx.fillStyle = skin;
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      };

      /* arms (shoulder anchors) ----------------------------------------- */
      const shX = hipX + 1.4 + lean * 10;
      const shY = hipY - 17;
      const backSwing = -Math.sin(ph) * 0.9 * runAmt;
      let backUpper = 0.15 + backSwing;
      let backFore = backUpper - 0.35 - Math.max(0, -Math.sin(ph)) * 0.5 * runAmt;
      if (air) { backUpper = -1.9; backFore = -2.2; }
      const bkx = shX + Math.sin(backUpper) * 10.5;
      const bky = shY + Math.cos(backUpper) * 10.5;
      const bhx = bkx + Math.sin(backFore) * 9.5;
      const bhy = bky + Math.cos(backFore) * 9.5;

      // far pieces
      drawLeg(legs[0], true);
      limb(ctx, [shX - 1, shY, bkx - 1, bky, bhx - 1, bhy], 5, c.skinDark, c.outline);

      /* pigtails (behind the head) -------------------------------------- */
      const headX = hipX + 3 + lean * 20;
      const headY = hipY - 31 + this.crouch * 1.5;
      const wind = clamp(-pl.vx / 300, -1, 1);
      this.pigV[0] += ((-this.pigA) * 70 - this.pigV[0] * 9 + wind * 28 + (air ? -pl.vy * 0.004 : 0) + Math.sin(ph * 2) * 5 * runAmt) * dt;
      this.pigA += this.pigV[0] * dt;
      this.pigV[1] += ((-this.pigB) * 58 - this.pigV[1] * 8 + wind * 24 + Math.sin(ph * 2 + 1.3) * 6 * runAmt) * dt;
      this.pigB += this.pigV[1] * dt;
      this.pigA = clamp(this.pigA, -1.3, 1.3);
      this.pigB = clamp(this.pigB, -1.3, 1.3);
      const pig = this.sprite('pigtail', { x: -10, y: -8, w: 20, h: 34 }, (g) => paintPigtail(g, c));
      for (const [ang, ox, oy, sc] of [[this.pigB + 0.2, -9.5, -4.5, 0.9], [this.pigA - 0.1, -8.8, -0.5, 1]]) {
        ctx.save();
        ctx.translate(headX + ox, headY + oy);
        ctx.rotate(ang);
        ctx.scale(sc, sc);
        R.blit(ctx, pig, 0, 0);
        ctx.restore();
      }

      /* torso ----------------------------------------------------------- */
      const torso = this.sprite('torso', { x: -16, y: -28, w: 32, h: 40 }, (g) => paintTorso(g, c));
      ctx.save();
      ctx.translate(hipX, hipY + 1);
      ctx.rotate(lean);
      R.blit(ctx, torso, 0, 0);
      ctx.restore();

      /* head ------------------------------------------------------------ */
      const mood = pl.stun > 0 ? 'oops' : (air || pl.dumping ? 'happy' : 'normal');
      const head = this.sprite('head:' + mood, { x: -16, y: -16, w: 32, h: 32 }, (g) => paintHead(g, c, mood));
      ctx.save();
      ctx.translate(headX, headY);
      ctx.rotate(lean * 0.9 + (air ? -0.08 : 0) + Math.sin(ph * 2) * 0.03 * runAmt);
      R.blit(ctx, head, 0, 0);
      ctx.restore();

      /* near leg -------------------------------------------------------- */
      drawLeg(legs[1], false);

      /* bucket arm ------------------------------------------------------ */
      const tilt = this.tilt;
      const reach = 0.32 + tilt * 0.5 + this.crouch * 0.9;
      const upper = reach + Math.sin(ph) * 0.1 * runAmt - (air ? 0.3 : 0);
      const fore = upper - 0.28 + tilt * 0.4 - this.crouch * 0.25;
      const ekx = shX + 1 + Math.sin(upper) * 10.5;
      const eky = shY + Math.cos(upper) * 10.5;
      const hx = ekx + Math.sin(fore) * 9.5;
      const hy = eky + Math.cos(fore) * 9.5 + this.crouch * 3;

      // Pendulum angle: swings against acceleration, follows the slosh.
      const swing = -pl.slosh * 0.45 + Math.sin(ph) * 0.1 * runAmt + (air ? -pl.vy * 0.0002 : 0);
      const bAng = clamp(swing, -0.8, 0.8) + tilt;
      ctx.save();
      ctx.translate(hx + 0.5, hy + 1);
      ctx.rotate(bAng);
      const bucket = this.sprite('bucket', { x: -16, y: -10, w: 32, h: 46 }, (g) => paintBucket(g, c));
      const rimBack = this.sprite('rimBack', { x: -16, y: -10, w: 32, h: 46 }, (g) => paintBucketRim(g, c));
      const lip = this.sprite('lip', { x: -16, y: -10, w: 32, h: 46 }, (g) => paintBucketLip(g, c));
      R.blit(ctx, bucket, 0, 0);
      R.blit(ctx, rimBack, 0, 0);

      // Contents: a wet-sand mound that tilts with the slosh.
      if (pl.fill > 0.02) {
        const heap = pl.fill * 7.5;
        const sl = clamp(pl.slosh, -1.4, 1.4) * 2.2;
        ctx.beginPath();
        ctx.moveTo(-10.4, 8);
        ctx.quadraticCurveTo(-5, 8 - heap * 1.6 - sl, sl * 0.3, 8 - heap * 1.4 + sl * 0.5);
        ctx.quadraticCurveTo(6, 8 - heap * 1.3 + sl, 10.4, 8);
        ctx.ellipse(0, 8, 10.4, 3.2, 0, 0, Math.PI);
        ctx.closePath();
        const sg = ctx.createLinearGradient(0, 8 - heap * 1.5, 0, 10);
        sg.addColorStop(0, shade(c.sandWet, 0.12));
        sg.addColorStop(1, c.sandWetDark);
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.fillStyle = alpha(c.waterDrop, 0.5);
        ctx.beginPath();
        ctx.ellipse(-2.6, 8 - heap * 0.7, 3.4, 1.1, 0, 0, TAU);
        ctx.fill();
      }
      R.blit(ctx, lip, 0, 0);

      ctx.restore();

      // Hand over the handle, then the arm.
      limb(ctx, [shX + 1, shY, ekx, eky, hx, hy], 5.2, c.skin, c.outline);
      ctx.beginPath();
      ctx.arc(hx, hy, 3.3, 0, TAU);
      ctx.fillStyle = c.skin;
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.restore();

      // World-space bucket mouth (the lip that points at the ground while
      // tipping), for particles and for the stream of sand.
      const cos = Math.cos(bAng);
      const sin = Math.sin(bAng);
      const lx = tilt > 0.8 ? 8 : 0;
      const mx = hx + 0.5 + lx * cos - 8 * sin;
      const my = hy + 1 + lx * sin + 8 * cos;
      pl.bucketX = pl.x + f * k * mx;
      pl.bucketY = pl.y + k * my;
      pl.headY = pl.y + k * headY;

      if (pl.dumping && this.tilt > 1.2 && pl.fill > 0.01) {
        // The stream falls straight down in world space.
        const x0 = pl.bucketX + f * k * 9;
        const y0 = pl.bucketY;
        const y1 = pl.y - 4;
        const wob = Math.sin(time * 40) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x0 - 3.4, y0);
        ctx.lineTo(x0 + 3.4, y0);
        ctx.lineTo(x0 + 2 + wob, y1);
        ctx.lineTo(x0 - 2 + wob, y1);
        ctx.closePath();
        const sg = ctx.createLinearGradient(x0 - 3, 0, x0 + 3, 0);
        sg.addColorStop(0, c.sandWetDark);
        sg.addColorStop(1, c.sandWet);
        ctx.fillStyle = sg;
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------------- crabs */
  function paintCrab(ctx) {
    const out = '#6e1a10';
    const body = ctx.createRadialGradient(-3, -5, 2, 0, 0, 16);
    body.addColorStop(0, '#ff9a6b');
    body.addColorStop(0.55, '#ee5a3a');
    body.addColorStop(1, '#bd3a24');
    ctx.beginPath();
    ctx.ellipse(0, -9, 15.5, 10, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    // Shell highlight + spots.
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, -9, 11.5, Math.PI * 1.1, Math.PI * 1.55);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,20,10,.3)';
    for (const [x, y, r] of [[-6, -6, 1.6], [3, -4, 1.9], [7, -9, 1.3]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    // Eyes on stalks.
    for (const x of [-5.5, 5.5]) {
      ctx.strokeStyle = out;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x, -16);
      ctx.lineTo(x * 1.1, -22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x * 1.1, -23.5, 3.6, 0, TAU);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x * 1.1 + 0.7, -23.4, 1.7, 0, TAU);
      ctx.fillStyle = '#1a0a08';
      ctx.fill();
    }
  }

  function paintClaw(ctx) {
    const out = '#6e1a10';
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0.45, TAU - 0.45);
    ctx.lineTo(7.2, -1.8);
    ctx.lineTo(3.6, 0);
    ctx.lineTo(7.2, 1.8);
    ctx.closePath();
    ctx.fillStyle = '#ee5a3a';
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath();
    ctx.arc(-1.5, -2, 2, 0, TAU);
    ctx.fill();
  }

  class CrabRenderer {
    constructor(theme) {
      this.key = `crab:${theme.id}:`;
    }

    draw(ctx, crabs, camera, time) {
      const body = R.sprites.get(this.key + 'body', { x: -22, y: -32, w: 44, h: 38 }, paintCrab);
      const claw = R.sprites.get(this.key + 'claw', { x: -9, y: -9, w: 18, h: 18 }, paintClaw);
      const shadow = R.softBlob(R.sprites, 'rgba(40,20,0,.5)', 32);
      for (const c of crabs) {
        if (c.x < camera.left - 50 || c.x > camera.right + 50) continue;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.size, c.size);
        ctx.globalAlpha = 0.6;
        R.blitScaled(ctx, shadow, 0, 1, 0.6, 0.14);
        ctx.globalAlpha = 1;

        // Legs skitter in alternating pairs.
        ctx.strokeStyle = '#8c2414';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const s = Math.sin(c.phase * 2 + i * 1.9);
          const lift = Math.max(0, s) * 3.4;
          for (const side of [-1, 1]) {
            const ox = side * (7 + i * 3);
            ctx.moveTo(ox * 0.8, -6 + i);
            ctx.lineTo(side * (13 + i * 3.4), -4 - lift);
            ctx.lineTo(side * (16 + i * 3.8), 0);
          }
        }
        ctx.stroke();

        R.blit(ctx, body, 0, 0);

        // Claws wave; they snap upward when scared.
        const snap = c.flee > 0 ? 1 : 0;
        for (const side of [-1, 1]) {
          const wave = Math.sin(time * 5 + side + c.phase) * (snap ? 5 : 2.4);
          const cx = side * 19;
          const cy = -15 - snap * 7 + wave;
          ctx.strokeStyle = '#d54a2e';
          ctx.lineWidth = 3.4;
          ctx.beginPath();
          ctx.moveTo(side * 12, -9);
          ctx.lineTo(cx, cy + 4);
          ctx.stroke();
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(side, 1);
          ctx.rotate(-0.5);
          R.blit(ctx, claw, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  R.BetinaRenderer = BetinaRenderer;
  R.CrabRenderer = CrabRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
