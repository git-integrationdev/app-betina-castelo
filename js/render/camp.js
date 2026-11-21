/* ============================================================================
 * CASTELO DA BETINA — the camp
 * The beach umbrella with Betina's dad and a couple of friends sitting under
 * it: chair, towel, cooler, bag. People are baked in two poses (relaxing /
 * cheering) and bob a little; speech bubbles pop up when she delivers sand.
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = root.HCR;
  const R = HCR.render;
  const { clamp } = HCR.math;
  const { shade, alpha } = R.color;
  const TAU = Math.PI * 2;

  /* -------------------------------------------------------------- umbrella */
  function paintCanopy(ctx, cp) {
    const panels = cp.panels;
    const n = 8;
    const R0 = 125;
    const apexY = -44;
    const hemY = 8;
    const edge = (x, t) => [x * t, apexY + (hemY - apexY) * Math.pow(t, 1.7)];
    const gores = [];
    for (let i = 0; i < n; i++) {
      const xl = -R0 + (i / n) * R0 * 2;
      const xr = -R0 + ((i + 1) / n) * R0 * 2;
      gores.push([xl, xr]);
    }
    // Underside first (seen through the hem).
    ctx.beginPath();
    ctx.ellipse(0, hemY - 1, R0 - 4, 9, 0, 0, Math.PI);
    ctx.fillStyle = shade(panels[0], -0.45);
    ctx.fill();

    gores.forEach(([xl, xr], i) => {
      ctx.beginPath();
      ctx.moveTo(0, apexY);
      for (let k = 1; k <= 10; k++) ctx.lineTo(...edge(xl, k / 10));
      // Scalloped hem.
      ctx.quadraticCurveTo((xl + xr) / 2, hemY + 9, xr, hemY);
      for (let k = 10; k >= 1; k--) ctx.lineTo(...edge(xr, k / 10));
      ctx.closePath();
      ctx.fillStyle = panels[i % panels.length];
      ctx.fill();
    });

    // Lighting: sun on the right, shade on the left, soft top sheen.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-R0, hemY);
    for (let k = 1; k <= 20; k++) {
      const x = -R0 + (k / 20) * R0 * 2;
      ctx.lineTo(x, apexY + (hemY - apexY) * Math.pow(Math.abs(x) / R0, 1.7));
    }
    ctx.lineTo(R0, hemY + 4);
    ctx.lineTo(-R0, hemY + 4);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(-R0, 0, R0, 0);
    g.addColorStop(0, 'rgba(60,20,60,.30)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(255,255,255,.22)');
    g.addColorStop(1, 'rgba(255,255,255,.05)');
    ctx.fillStyle = g;
    ctx.fillRect(-R0, apexY - 4, R0 * 2, 70);
    ctx.restore();

    // Seams + trim.
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1.2;
    gores.forEach(([xl], i) => {
      if (i === 0) return;
      ctx.beginPath();
      ctx.moveTo(0, apexY);
      for (let k = 1; k <= 10; k++) ctx.lineTo(...edge(xl, k / 10));
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(58,36,24,.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-R0, hemY);
    gores.forEach(([xl, xr]) => ctx.quadraticCurveTo((xl + xr) / 2, hemY + 9, xr, hemY));
    ctx.stroke();

    // Finial.
    ctx.beginPath();
    ctx.arc(0, apexY - 3, 4.4, 0, TAU);
    ctx.fillStyle = cp.pole;
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,36,24,.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ----------------------------------------------------------------- props */
  function paintChair(ctx, cp) {
    const out = '#3a2418';
    // Back legs + front legs.
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[-4, -22, -22, 0], [14, -22, 24, 0], [-10, -26, -30, -2]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = out;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = cp.chairDark;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    // Seat sling + reclined back, striped.
    const stripe = (pts, i) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#fff4e0' : cp.chair;
      ctx.fill();
    };
    const back = [];
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const t1 = (i + 1) / 6;
      const p = (t) => [-12 - t * 17, -22 - t * 38];
      const a = p(t0);
      const b = p(t1);
      stripe([a, b, [b[0] + 11, b[1] - 1], [a[0] + 11, a[1] - 1]], i);
    }
    stripe([[-12, -22], [18, -22], [18, -17], [-12, -17]], 0);
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.lineTo(-29, -60);
    ctx.moveTo(-1, -23);
    ctx.lineTo(-18, -61);
    ctx.moveTo(-12, -17);
    ctx.lineTo(18, -17);
    ctx.stroke();
  }

  function paintTowel(ctx, cp) {
    const w = 124;
    const stripes = [cp.towelA, cp.towelB, cp.towelC, cp.towelB];
    const sw = w / 8;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = stripes[i % stripes.length];
      ctx.fillRect(-w / 2 + i * sw, -4.5, sw + 0.6, 6.5);
    }
    ctx.strokeStyle = 'rgba(58,36,24,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-w / 2, -4.5, w, 6.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(-w / 2, 0, w, 2);
    // Fringe.
    ctx.strokeStyle = 'rgba(255,244,224,.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = -3.5; y < 1.5; y += 1.6) {
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(-w / 2 - 4, y + 0.4);
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 + 4, y + 0.4);
    }
    ctx.stroke();
  }

  function paintCooler(ctx, cp) {
    const out = '#3a2418';
    ctx.beginPath();
    ctx.roundRect(-20, -26, 40, 26, 4);
    const g = ctx.createLinearGradient(0, -26, 0, 0);
    g.addColorStop(0, cp.cooler);
    g.addColorStop(1, cp.coolerDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-22, -32, 44, 9, 4);
    ctx.fillStyle = '#fff4e0';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = out;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -33);
    ctx.quadraticCurveTo(0, -42, 8, -33);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(-16, -22, 3, 16);
  }

  function paintBag(ctx, cp) {
    const out = '#3a2418';
    ctx.strokeStyle = out;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -22);
    ctx.bezierCurveTo(-10, -42, 10, -42, 9, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-14, -24);
    ctx.lineTo(14, -24);
    ctx.lineTo(16, 0);
    ctx.quadraticCurveTo(0, 4, -16, 0);
    ctx.closePath();
    ctx.fillStyle = cp.bag;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(-14.6, -17, 29, 4);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.fillRect(-15, -6, 30, 6);
  }

  /* ---------------------------------------------------------------- people */
  function paintPerson(ctx, c, spec, pose, seat) {
    const out = c.outline;
    const cheer = pose === 'cheer';
    const hip = seat === 'chair' ? [-3, -24] : [0, -9];
    const sh = [hip[0] - 2, hip[1] - 33];
    const head = [sh[0] + 1, sh[1] - 14];
    const knee = seat === 'chair' ? [17, -27] : [19, -26];
    const foot = seat === 'chair' ? [20, -2] : [37, -5];

    const arm = (ex, ey, hx, hy, w, col) => {
      ctx.beginPath();
      ctx.moveTo(sh[0], sh[1] + 2);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = out;
      ctx.lineWidth = w + 2.6;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, w * 0.62, 0, TAU);
      ctx.fillStyle = spec.skin;
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };

    // Back arm.
    if (cheer) arm(sh[0] - 3, sh[1] - 16, sh[0] - 7, sh[1] - 38, 6, spec.skin);
    else arm(sh[0] + 3, sh[1] + 11, sh[0] + 7, sh[1] + 3, 6, spec.skin);

    // Hair (long) behind the head.
    if (spec.hairStyle === 'long') {
      ctx.beginPath();
      ctx.moveTo(head[0] - 6, head[1] - 8);
      ctx.bezierCurveTo(head[0] - 20, head[1] - 2, head[0] - 15, head[1] + 24, head[0] - 7, head[1] + 27);
      ctx.lineTo(head[0] + 1, head[1] + 12);
      ctx.closePath();
      ctx.fillStyle = spec.hair;
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Legs.
    const leg = (w, col, pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      ctx.lineTo(pts[2], pts[3]);
      if (pts.length > 4) ctx.lineTo(pts[4], pts[5]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = out;
      ctx.lineWidth = w + 2.6;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    leg(8, spec.skin, [knee[0], knee[1], foot[0], foot[1]]);
    leg(10, spec.bottom, [hip[0], hip[1], knee[0], knee[1]]);
    // Foot.
    ctx.beginPath();
    ctx.ellipse(foot[0] + 3, foot[1] + 1, 6, 3, 0, 0, TAU);
    ctx.fillStyle = spec.skin;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Torso.
    ctx.beginPath();
    ctx.moveTo(hip[0] - 7, hip[1] + 1);
    ctx.quadraticCurveTo(sh[0] - 11, hip[1] - 16, sh[0] - 7, sh[1] + 2);
    ctx.quadraticCurveTo(sh[0], sh[1] - 4, sh[0] + 8, sh[1] + 2);
    ctx.quadraticCurveTo(sh[0] + 11, hip[1] - 14, hip[0] + 8, hip[1] + 1);
    ctx.closePath();
    const tg = ctx.createLinearGradient(sh[0] - 8, 0, sh[0] + 10, 0);
    tg.addColorStop(0, shade(spec.top, -0.14));
    tg.addColorStop(0.6, spec.top);
    tg.addColorStop(1, shade(spec.top, 0.14));
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    if (spec.pattern === 'palm') {
      ctx.fillStyle = alpha('#ffffff', 0.55);
      for (const [x, y] of [[-4, -12], [3, -21], [-1, -26]]) {
        ctx.beginPath();
        ctx.arc(sh[0] + x, hip[1] + y + 6, 1.8, 0, TAU);
        ctx.fill();
      }
    }

    // Head.
    const r = 11.5;
    ctx.beginPath();
    ctx.arc(head[0], head[1], r, 0, TAU);
    const hg = ctx.createRadialGradient(head[0] - 3, head[1] - 4, 2, head[0], head[1], r + 1);
    hg.addColorStop(0, shade(spec.skin, 0.12));
    hg.addColorStop(1, spec.skin);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Hair on top.
    if (spec.hairStyle !== 'bald') {
      ctx.beginPath();
      ctx.moveTo(head[0] - r - 0.5, head[1] + 2);
      ctx.bezierCurveTo(head[0] - r - 2, head[1] - r - 4, head[0] + 4, head[1] - r - 5, head[0] + r * 0.9, head[1] - r * 0.3);
      ctx.bezierCurveTo(head[0] + 4, head[1] - r * 0.7, head[0] - 3, head[1] - r * 0.5, head[0] - r * 0.4, head[1] - r * 0.2);
      ctx.bezierCurveTo(head[0] - r * 0.7, head[1] + 2, head[0] - r * 0.5, head[1] + 4, head[0] - r - 0.5, head[1] + 2);
      ctx.fillStyle = spec.hair;
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Cap.
    if (spec.cap) {
      ctx.beginPath();
      ctx.arc(head[0] - 0.5, head[1] - 2, r + 1.2, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = spec.cap;
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(head[0] + 4, head[1] - 4.6, 15, 4, 2);
      ctx.fillStyle = shade(spec.cap, -0.18);
      ctx.fill();
      ctx.stroke();
    }

    // Sunglasses + smile.
    if (spec.shades) {
      ctx.beginPath();
      ctx.roundRect(head[0] + 1.5, head[1] - 3.2, 11, 5.6, 2.4);
      ctx.fillStyle = '#1a1218';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillRect(head[0] + 3, head[1] - 2.4, 3, 1.2);
      ctx.strokeStyle = '#1a1218';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(head[0] + 1.5, head[1] - 1);
      ctx.lineTo(head[0] - r, head[1] - 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(head[0] + 6, head[1] - 1.5, 1.7, 2.4, 0, 0, TAU);
      ctx.fillStyle = out;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(head[0] + 10.4, head[1] + 1.8, 1.3, 0, TAU);
    ctx.fillStyle = shade(spec.skin, -0.14);
    ctx.fill();
    ctx.fillStyle = '#a3203a';
    ctx.strokeStyle = out;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (cheer) {
      ctx.moveTo(head[0] + 4, head[1] + 5);
      ctx.quadraticCurveTo(head[0] + 7.6, head[1] + 12, head[0] + 11, head[1] + 5.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(head[0] + 4.4, head[1] + 5.6);
      ctx.quadraticCurveTo(head[0] + 7.6, head[1] + 8.6, head[0] + 10.4, head[1] + 5.4);
      ctx.stroke();
    }

    // Front arm.
    if (cheer) {
      arm(sh[0] + 6, sh[1] - 14, sh[0] + 10, sh[1] - 36, 6, spec.skin);
    } else {
      arm(sh[0] + 8, sh[1] + 11, sh[0] + 17, sh[1] + 5, 6, spec.skin);
      // Cold drink with a straw.
      ctx.beginPath();
      ctx.roundRect(sh[0] + 13, sh[1] - 5, 9, 13, 2);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = spec.drink || '#ff8a65';
      ctx.fillRect(sh[0] + 14, sh[1] + 1, 7, 6);
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sh[0] + 19, sh[1] - 4);
      ctx.lineTo(sh[0] + 22, sh[1] - 12);
      ctx.stroke();
    }
  }

  /* --------------------------------------------------------------- renderer */
  class CampRenderer {
    constructor(theme, world) {
      this.theme = theme;
      this.world = world;
      this.cp = theme.camp;
      this.c = theme.colors;
      this.key = `camp:${theme.id}:`;
      this.cheerTimer = 0;
      this.cheerLen = 1;
      this.bubble = null;
      this.bubbleT = 0;
      this.who = 0;
      const pp = this.cp.people;
      const x = this.cp.x;
      this.people = [
        { id: 'dad', seat: 'chair', dx: -52, spec: Object.assign({ hairStyle: 'short', shades: true, drink: '#ffb74d', pattern: 'palm' }, pp.dad) },
        { id: 'friendA', seat: 'towel', dx: 38, spec: Object.assign({ hairStyle: 'long', shades: true, drink: '#f06292' }, pp.friendA) },
        { id: 'friendB', seat: 'towel', dx: 96, spec: Object.assign({ hairStyle: 'short', shades: false, drink: '#81c784' }, pp.friendB) }
      ];
      this.x = x;
    }

    sprite(name, box, paint) {
      return R.sprites.get(this.key + name, box, paint);
    }

    /** Everybody jumps up for `seconds`; one of them says `text`. */
    cheer(text, seconds) {
      this.cheerTimer = seconds || 1.3;
      this.cheerLen = this.cheerTimer;
      this.bubble = text;
      this.bubbleT = Math.max(1.8, (seconds || 1.3) + 0.5);
      this.who = (this.who + 1) % this.people.length;
    }

    update(dt) {
      this.cheerTimer = Math.max(0, this.cheerTimer - dt);
      this.bubbleT = Math.max(0, this.bubbleT - dt);
    }

    draw(ctx, camera, time) {
      const cp = this.cp;
      const w = this.world;
      const ux = cp.x;
      if (ux + 160 < camera.left || ux - 200 > camera.right) return;
      const gy = (x) => w.heightFast(x);
      const c = this.c;

      // Shade under the canopy.
      const blob = R.softBlob(R.sprites, 'rgba(30,20,50,.55)', 32);
      ctx.globalAlpha = 0.8;
      R.blitScaled(ctx, blob, ux + 70, gy(ux + 70) + 2, 5.2, 0.33);
      ctx.globalAlpha = 1;

      // Pole + canopy.
      const poleH = 176;
      const tilt = -0.045;
      const topX = ux + Math.sin(-tilt) * poleH;
      const topY = gy(ux) - Math.cos(tilt) * poleH;
      ctx.save();
      ctx.translate(ux, gy(ux) + 2);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a2418';
      ctx.lineWidth = 7.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(topX - ux, topY - gy(ux) - 2);
      ctx.stroke();
      ctx.strokeStyle = cp.pole;
      ctx.lineWidth = 4.4;
      ctx.stroke();
      ctx.strokeStyle = cp.poleDark;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(1.4, -4);
      ctx.lineTo(topX - ux + 1.4, topY - gy(ux) - 6);
      ctx.stroke();
      ctx.restore();

      const sway = Math.sin(time * 0.9) * 0.006;
      const canopy = this.sprite('canopy', { x: -134, y: -62, w: 268, h: 88 }, (g) => paintCanopy(g, cp));
      ctx.save();
      ctx.translate(topX, topY + 6);
      ctx.rotate(tilt * 0.6 + sway);
      R.blit(ctx, canopy, 0, 0);
      ctx.restore();

      // Ground props.
      const towel = this.sprite('towel', { x: -70, y: -8, w: 140, h: 16 }, (g) => paintTowel(g, cp));
      R.blit(ctx, towel, ux + 70, gy(ux + 70) + 3);
      const cooler = this.sprite('cooler', { x: -26, y: -46, w: 52, h: 50 }, (g) => paintCooler(g, cp));
      R.blit(ctx, cooler, ux - 112, gy(ux - 112) + 1);
      const bag = this.sprite('bag', { x: -20, y: -46, w: 40, h: 50 }, (g) => paintBag(g, cp));
      R.blit(ctx, bag, ux + 168, gy(ux + 168) + 1);
      const chair = this.sprite('chair', { x: -36, y: -66, w: 74, h: 70 }, (g) => paintChair(g, cp));
      const dad = this.people[0];
      R.blit(ctx, chair, ux + dad.dx, gy(ux + dad.dx) + 1);

      // People.
      const cheering = this.cheerTimer > 0;
      this.people.forEach((p, i) => {
        const px = ux + p.dx;
        const py = gy(px) + (p.seat === 'chair' ? 1 : 3);
        const pose = cheering ? 'cheer' : 'idle';
        const spr = this.sprite(`${p.id}:${pose}`, { x: -34, y: -112, w: 80, h: 118 }, (g) => paintPerson(g, c, p.spec, pose, p.seat));
        const hop = cheering ? -Math.abs(Math.sin((time + i * 0.17) * 9)) * 9 : Math.sin(time * 1.6 + i * 2) * 0.7;
        ctx.save();
        ctx.translate(px, py + hop);
        const squash = cheering ? 1 + Math.sin((time + i * 0.17) * 9) * 0.02 : 1;
        ctx.scale(1, squash);
        R.blit(ctx, spr, 0, 0);
        ctx.restore();
      });

      // Speech bubble.
      if (this.bubble && this.bubbleT > 0) {
        const p = this.people[this.who];
        const text = this.bubble;
        const bw = Math.ceil(text.length * 7.6 + 26);
        const spr = this.sprite(`bubble:${text}`, { x: -bw / 2, y: -40, w: bw, h: 48 }, (g) => {
          g.beginPath();
          g.roundRect(-bw / 2 + 2, -36, bw - 4, 28, 11);
          g.moveTo(-8, -9);
          g.lineTo(-13, 3);
          g.lineTo(4, -9);
          g.fillStyle = '#fffdf5';
          g.fill();
          g.strokeStyle = '#3a2418';
          g.lineWidth = 2.2;
          g.stroke();
          g.font = '800 13.5px "Archivo Black", "Trebuchet MS", sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = '#3a2418';
          g.fillText(text, 0, -22);
        });
        const a = clamp(this.bubbleT / 0.4, 0, 1);
        const rise = Math.sin(clamp((1.9 - this.bubbleT) * 3, 0, 1.5)) * 0;
        const px = ux + p.dx + 14;
        const py = gy(px) - (p.seat === 'chair' ? 112 : 100) - (this.cheerTimer > 0 ? 12 : 0) + rise;
        ctx.globalAlpha = a;
        const pop = 1 + Math.max(0, this.bubbleT - (this.cheerLen + 0.35)) * 2;
        R.blitScaled(ctx, spr, px, py, pop);
        ctx.globalAlpha = 1;
      }
    }
  }

  R.CampRenderer = CampRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
