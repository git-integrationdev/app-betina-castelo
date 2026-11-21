/* ============================================================================
 * RIDGE RUSH — render kit
 * Shared rendering foundations:
 *   · color helpers        (shade / mix / alpha — painters derive tones)
 *   · SpriteCache          (procedural art is painted ONCE into offscreen
 *                           canvases, then blitted every frame)
 *   · quality presets      (resolution + detail budget, auto-governed)
 *   · painter registries   (skins, scenes, decor sets, pickup sprites)
 *
 * A theme in themeConfig.js only *references* painters by id. To add new art,
 * register a painter here-style from any file loaded after this one:
 *
 *   HCR.render.skins.register('moonRover', { box, paintBack, paintFront });
 * ========================================================================== */
(function (root) {
  'use strict';

  const HCR = (root.HCR = root.HCR || {});
  const { clamp } = HCR.math;

  /* ------------------------------------------------------------------ color */
  const parsed = new Map();

  function parse(color) {
    let out = parsed.get(color);
    if (out) return out;
    out = [0, 0, 0, 1];
    if (typeof color === 'string' && color[0] === '#') {
      let hex = color.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex.split('').map((ch) => ch + ch).join('');
      }
      const num = parseInt(hex.slice(0, 6), 16);
      out = [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
      if (hex.length === 8) out[3] = parseInt(hex.slice(6, 8), 16) / 255;
    } else if (typeof color === 'string') {
      const m = color.match(/-?\d*\.?\d+/g);
      if (m && m.length >= 3) {
        out = [Number(m[0]), Number(m[1]), Number(m[2]), m.length > 3 ? Number(m[3]) : 1];
      }
    }
    parsed.set(color, out);
    return out;
  }

  function css(r, g, b, a) {
    const R = Math.round(clamp(r, 0, 255));
    const G = Math.round(clamp(g, 0, 255));
    const B = Math.round(clamp(b, 0, 255));
    return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${Math.round(clamp(a, 0, 1) * 1000) / 1000})`;
  }

  /** Blend two colors. t = 0 → a, t = 1 → b. */
  function mix(a, b, t) {
    const A = parse(a);
    const B = parse(b);
    return css(
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t,
      A[3] + (B[3] - A[3]) * t
    );
  }

  /** amount > 0 lightens toward white, amount < 0 darkens toward black. */
  function shade(color, amount) {
    const c = parse(color);
    const target = amount >= 0 ? 255 : 0;
    const t = Math.abs(amount);
    return css(
      c[0] + (target - c[0]) * t,
      c[1] + (target - c[1]) * t,
      c[2] + (target - c[2]) * t,
      c[3]
    );
  }

  /** Same color with a new opacity. */
  function alpha(color, a) {
    const c = parse(color);
    return css(c[0], c[1], c[2], a);
  }

  /* ----------------------------------------------------------------- canvas */
  function makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    return canvas;
  }

  /**
   * Sprites are described in local units by a bounding `box` {x, y, w, h}
   * (x/y may be negative: the origin is the sprite's anchor). They are
   * rasterised at `res` device pixels per unit so they stay crisp at any zoom.
   */
  class SpriteCache {
    constructor() {
      this.map = new Map();
      this.res = 2;
    }

    setResolution(res) {
      const snapped = clamp(Math.round(res * 2) / 2, 1, 3);
      if (snapped !== this.res) {
        this.res = snapped;
        this.map.clear();
      }
    }

    clear() {
      this.map.clear();
    }

    get(key, box, paint, resScale) {
      let sprite = this.map.get(key);
      if (sprite) return sprite;
      const res = this.res * (resScale || 1);
      const canvas = makeCanvas(box.w * res, box.h * res);
      const ctx = canvas.getContext('2d');
      ctx.scale(res, res);
      ctx.translate(-box.x, -box.y);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      paint(ctx, box);
      sprite = { canvas, x: box.x, y: box.y, w: box.w, h: box.h, res };
      this.map.set(key, sprite);
      return sprite;
    }
  }

  /** Draw a sprite with its anchor at (x, y). */
  function blit(ctx, sprite, x, y) {
    ctx.drawImage(sprite.canvas, x + sprite.x, y + sprite.y, sprite.w, sprite.h);
  }

  /** Draw a sprite scaled around its anchor. */
  function blitScaled(ctx, sprite, x, y, sx, sy) {
    const ky = sy === undefined ? sx : sy;
    ctx.drawImage(
      sprite.canvas,
      x + sprite.x * sx,
      y + sprite.y * ky,
      sprite.w * sx,
      sprite.h * ky
    );
  }

  /** Soft radial blob — the base of shadows, glows, dust and smoke. */
  function softBlob(sprites, color, radius) {
    const r = radius || 32;
    return sprites.get(`blob:${color}:${r}`, { x: -r, y: -r, w: r * 2, h: r * 2 }, (ctx) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, alpha(color, parse(color)[3]));
      g.addColorStop(0.45, alpha(color, parse(color)[3] * 0.55));
      g.addColorStop(1, alpha(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }, 0.5);
  }

  /* ---------------------------------------------------------------- quality */
  /* Everything that costs fill-rate or draw calls is scaled by one preset.   */
  const QUALITY = {
    low: {
      id: 'low', label: 'BAIXO',
      pixelRatio: 1, maxPixels: 1.1e6,
      layerRes: 0.75, strata: 1, particles: 0.45,
      props: 0.6, tufts: 0.45, sway: false, wheelBlur: false,
      glows: false, motes: 0, cssBlur: false
    },
    medium: {
      id: 'medium', label: 'MÉDIO',
      pixelRatio: 1.5, maxPixels: 2.4e6,
      layerRes: 1, strata: 2, particles: 0.75,
      props: 1, tufts: 0.8, sway: false, wheelBlur: true,
      glows: true, motes: 0.6, cssBlur: false
    },
    high: {
      id: 'high', label: 'ALTO',
      pixelRatio: 2, maxPixels: 4.2e6,
      layerRes: 1.5, strata: 3, particles: 1,
      props: 1, tufts: 1, sway: true, wheelBlur: true,
      glows: true, motes: 1, cssBlur: true
    }
  };
  const QUALITY_ORDER = ['low', 'medium', 'high'];

  /* ------------------------------------------------------------- registries */
  function createRegistry(kind) {
    const items = Object.create(null);
    return {
      kind,
      register(id, def) {
        items[id] = def;
        def.id = id;
        return def;
      },
      has(id) {
        return !!items[id];
      },
      get(id) {
        const def = items[id];
        if (!def) {
          throw new Error(
            `[HCR] ${kind} "${id}" não está registrado. Disponíveis: ${Object.keys(items).join(', ') || '(nenhum)'}`
          );
        }
        return def;
      },
      ids() {
        return Object.keys(items);
      }
    };
  }

  HCR.render = {
    color: { parse, mix, shade, alpha },
    makeCanvas,
    SpriteCache,
    sprites: new SpriteCache(),
    blit,
    blitScaled,
    softBlob,
    QUALITY,
    QUALITY_ORDER,
    quality: QUALITY.high,
    /** vehicle bodies — referenced by theme.vehicle.skin */
    skins: createRegistry('skin de veículo'),
    /** parallax backgrounds — referenced by theme.background.scene */
    scenes: createRegistry('cenário'),
    /** ground texture, props and markers — referenced by theme.terrain.decorSet */
    decor: createRegistry('decorSet de terreno'),
    /** collectibles — referenced by theme.pickups.coinSprite / fuelSprite */
    pickups: createRegistry('sprite de coletável')
  };
})(typeof window !== 'undefined' ? window : globalThis);
