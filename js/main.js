/* ============================================================================
 * CASTELO DA BETINA — bootstrap
 * ========================================================================== */
(function () {
  'use strict';

  // Small roundRect fallback for older Safari/Chromium.
  if (
    typeof window.CanvasRenderingContext2D !== 'undefined' &&
    !window.CanvasRenderingContext2D.prototype.roundRect
  ) {
    window.CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.lineTo(x + w, y + h - radius);
      this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.lineTo(x + radius, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.lineTo(x, y + radius);
      this.quadraticCurveTo(x, y, x + radius, y);
      this.closePath();
      return this;
    };
  }

  function boot() {
    if (!window.HCR || !window.HCR.Game) return;
    window.betina = new window.HCR.Game();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
