'use strict';
// Плата, на которой стоит схема, и общий фон сцены.
// Смысл: обесточенная плата — холодная и тёмная, и единственное, что её
// освещает, — детали, через которые реально идёт ток.

const Board = (() => {
  let texture = null;

  // Текстура текстолита делается один раз: попиксельный шум каждый кадр
  // съедал бы весь бюджет отрисовки.
  function buildTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 118 + Math.random() * 28;
      img.data[i] = n * 0.36;
      img.data[i + 1] = n * 0.44;
      img.data[i + 2] = n * 0.48;
      img.data[i + 3] = 16;
    }
    g.putImageData(img, 0, 0);
    // Волокна стеклотекстолита — редкие светлые полосы под углом.
    g.globalAlpha = 0.05;
    g.strokeStyle = '#cfe3e8';
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * size;
      g.beginPath(); g.moveTo(0, y); g.lineTo(size, y + (Math.random() * 8 - 4)); g.stroke();
    }
    texture = c;
  }

  // Глубокий фон: не плоская заливка, а слабое поле «вокруг платы темно».
  function drawBackdrop(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colorToCss(brighten(Pal.BG_DEEP, 1.5)));
    g.addColorStop(1, colorToCss(Pal.BG_DEEP));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function vignette(ctx, w, h, strength = 0.6) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Сама плата. `lit` 0..1 — сколько на ней сейчас света (от деталей);
  // тёмная плата почти сливается с фоном, живая — читается.
  function drawPlate(ctx, rect, opts = {}) {
    if (!texture) buildTexture();
    const { x, y, w, h } = rect;
    const lit = clamp(opts.lit === undefined ? 0.25 : opts.lit, 0, 1);

    ctx.save();
    // Плата отбрасывает тень — лежит НАД фоном, а не нарисована на нём.
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    fillRound(ctx, x, y, w, h, 14, colorToCss(brighten(Pal.BOARD, lerp(0.55, 1.15, lit))));
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, x, y, w, h, 14);
    ctx.clip();

    const pat = ctx.createPattern(texture, 'repeat');
    ctx.globalAlpha = lerp(0.35, 0.85, lit);
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    // Сетка шага монтажа — тот же ритм, по которому расставлены детали.
    ctx.strokeStyle = rgba(1, 1, 1, 0.022 + 0.03 * lit);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x + 20; gx < x + w; gx += 40) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
    for (let gy = y + 20; gy < y + h; gy += 40) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
    ctx.stroke();

    // Мёртвые дорожки-декорации, чтобы плата не выглядела пустым листом.
    ctx.strokeStyle = colorToCss(Pal.COPPER, 0.07 + 0.05 * lit);
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const seedRows = opts.decorSeed || 7;
    for (let i = 0; i < 9; i++) {
      const yy = y + 26 + ((i * 97 + seedRows * 31) % (h - 52));
      const x0 = x + 18 + ((i * 53) % (w * 0.3));
      const len = 60 + ((i * 71) % (w * 0.42));
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + len * 0.5, yy);
      ctx.lineTo(x0 + len * 0.5 + 16, yy + (i % 2 ? 16 : -16));
      ctx.lineTo(x0 + len, yy + (i % 2 ? 16 : -16));
      ctx.stroke();
    }
    ctx.restore();

    // Кант и монтажные отверстия.
    strokeRound(ctx, x, y, w, h, 14, colorToCss(Pal.BOARD_EDGE, 0.9), 2);
    strokeRound(ctx, x + 7, y + 7, w - 14, h - 14, 10, colorToCss(Pal.SILK, 0.1 + 0.1 * lit), 1);
    for (const [hx, hy] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]) {
      fillCircle(ctx, vec(hx, hy), 7, rgba(0, 0, 0, 0.75));
      strokeCircle(ctx, vec(hx, hy), 7, colorToCss(Pal.PAD, 0.55), 2);
    }

    if (opts.silk) {
      text(ctx, opts.silk, vec(x + w - 34, y + h - 22), {
        size: 12, align: 'right', color: colorToCss(Pal.SILK, 0.22 + 0.18 * lit), font: '"Consolas", monospace',
      });
    }
  }

  // Шелкография вокруг детали — белый контур и позиционное обозначение.
  function silkOutline(ctx, pos, w, h, label, lit = 0.4) {
    ctx.save();
    ctx.strokeStyle = colorToCss(Pal.SILK, 0.14 + 0.16 * lit);
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, pos.x - w / 2, pos.y - h / 2, w, h, 4);
    ctx.stroke();
    ctx.restore();
    if (label) {
      text(ctx, label, vec(pos.x - w / 2 + 2, pos.y - h / 2 - 8), {
        size: 10, align: 'left', color: colorToCss(Pal.SILK, 0.3 + 0.2 * lit), font: '"Consolas", monospace',
      });
    }
  }

  return { drawBackdrop, drawPlate, vignette, silkOutline };
})();
