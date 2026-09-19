'use strict';
// Примитивы отрисовки. Всё, что рисует свет, металл и провода, живёт
// здесь — детали и сцены только вызывают.

let _clock = 0;
function tickClock(dt) { _clock += dt; }
function clockNow() { return _clock; }

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rr);
  else {
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

function fillRound(ctx, x, y, w, h, r, style) {
  ctx.save(); ctx.fillStyle = style; roundRectPath(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
}
function strokeRound(ctx, x, y, w, h, r, style, width = 1) {
  ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; roundRectPath(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
}
function fillCircle(ctx, c, r, style) {
  if (r <= 0) return;
  ctx.save(); ctx.fillStyle = style; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function strokeCircle(ctx, c, r, style, width = 1) {
  if (r <= 0) return;
  ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function line(ctx, a, b, style, width = 2) {
  ctx.save(); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
}

function text(ctx, str, pos, opts = {}) {
  ctx.save();
  ctx.font = (opts.weight ? opts.weight + ' ' : '') + (opts.size || 12) + 'px ' + (opts.font || '"Segoe UI", system-ui, sans-serif');
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5; }
  ctx.fillStyle = opts.color || colorToCss(Pal.TEXT);
  ctx.fillText(str, pos.x, pos.y);
  ctx.restore();
}

function textWidth(ctx, str, size = 12, weight = '') {
  ctx.save();
  ctx.font = (weight ? weight + ' ' : '') + size + 'px "Segoe UI", system-ui, sans-serif';
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Свет — размытое гало под чёткой сердцевиной, а не крашеная фигура.
function withGlow(ctx, color, intensity, blur, drawFn) {
  ctx.save();
  if (intensity > 0.02) {
    ctx.shadowColor = colorToCss(color, clamp(intensity, 0, 1));
    ctx.shadowBlur = blur * clamp(intensity, 0, 1);
  }
  drawFn();
  ctx.restore();
}

// Мягкое пятно света. Отдельно от withGlow: то — обводка вокруг фигуры,
// это — сам источник, который освещает вокруг себя.
function glowSpot(ctx, pos, radius, color, alpha) {
  if (radius <= 0 || alpha <= 0.002) return;
  const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
  g.addColorStop(0, colorToCss(color, alpha));
  g.addColorStop(0.45, colorToCss(color, alpha * 0.35));
  g.addColorStop(1, colorToCss(color, 0));
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Холодный мёртвый металл: блик сверху-слева, тень снизу-справа.
function metalFill(ctx, x, y, w, h, base = 0.2, tint = [1, 1, 1]) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
  const hi = clamp(base + 0.17, 0, 1), lo = clamp(base - 0.1, 0, 1);
  g.addColorStop(0, rgba(hi * tint[0], hi * tint[1], hi * tint[2]));
  g.addColorStop(0.42, rgba(base * tint[0], base * tint[1], base * tint[2]));
  g.addColorStop(1, rgba(lo * tint[0], lo * tint[1], lo * tint[2]));
  return g;
}

// Цилиндр: блик идёт полосой вдоль оси, а не по диагонали — иначе
// батарейка и конденсатор читаются плоскими наклейками.
function cylinderFill(ctx, x, y, w, h, base = 0.24, tint = [1, 1, 1], axisVertical = true) {
  const g = axisVertical
    ? ctx.createLinearGradient(x, y, x + w, y)
    : ctx.createLinearGradient(x, y, x, y + h);
  const shade = (k) => rgba(base * k * tint[0], base * k * tint[1], base * k * tint[2]);
  g.addColorStop(0.0, shade(0.45));
  g.addColorStop(0.22, shade(1.0));
  g.addColorStop(0.38, shade(1.55));
  g.addColorStop(0.62, shade(1.05));
  g.addColorStop(1.0, shade(0.4));
  return g;
}

// --- Провода-дорожки ------------------------------------------------------
// Дорожки на плате идут по прямым со скруглениями, а не случайными дугами:
// схема должна читаться как схема. Путь задаётся точками излома.

// Короткая перемычка-«зиг» между двумя параллельными участками одной оси
// (вправо, короткий шаг вниз, снова вправо) — обычное дело для соседних
// рядов на плате: их разделяет стандартный шаг сетки Rig, около 60-70
// единиц. При обычном скруглении оба угла такого зига стоят так близко
// друг к другу, что зрительно сливаются в одну дугу — ровная короткая
// S-образная дорожка на глаз читается как случайная диагональ, а не как
// две прямые под прямым углом (поймано игроком на делителе: два гнезда
// рядом, соединяющий зиг короче типичного прогона провода). Прямые углы
// там, где обычный радиус давал бы кривую, читаются однозначно лучше —
// проверено рядом на той же паре вершин. Поэтому оба угла короткого зига
// рисуются БЕЗ скругления, а не по общей формуле «радиус не больше
// половины соседнего звена»: та формула защищает от артефактов на совсем
// коротких отрезках, но не знает, сливаются ли два скругления зрительно
// в один смазанный изгиб.
function segAxis(a, b) {
  return Math.abs(a.x - b.x) < 0.5 ? 'v' : 'h';
}
const ZIG_MAX = 120; // мировых единиц — с запасом больше стандартного шага ряда (~68)

// Короткое звено между pts[i] и pts[i+1] — «зиг», если оно короче ZIG_MAX,
// а звенья ДО и ПОСЛЕ него идут по одной и той же оси, отличной от его
// собственной (иначе это просто длинный прогон с обычным изломом).
function isJogSegment(pts, i) {
  const a = pts[i], b = pts[i + 1];
  if (distV(a, b) >= ZIG_MAX) return false;
  const before = i > 0 ? segAxis(pts[i - 1], a) : null;
  const after = i + 2 < pts.length ? segAxis(b, pts[i + 2]) : null;
  if (!before || !after || before !== after) return false;
  return before !== segAxis(a, b);
}

function tracePath(ctx, pts, radius = 10) {
  ctx.beginPath();
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const prev = pts[i - 1], next = pts[i + 1];
    let r = Math.min(radius, distV(prev, p) / 2, distV(p, next) / 2);
    // Угол в p сглажен звеньями (i-1,i) и (i,i+1). Если любое из них — зиг
    // (короткая перемычка одной оси между двумя длинными участками другой),
    // этот угол — один из двух углов того зига, и его лучше не скруглять.
    if (isJogSegment(pts, i - 1) || isJogSegment(pts, i)) r = 0;
    ctx.arcTo(p.x, p.y, next.x, next.y, r);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

function pathLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += distV(pts[i - 1], pts[i]);
  return l;
}

// Ближайшее расстояние от точки до ломаной — нужно, чтобы навести
// мультиметр на дорожку, а не только на деталь.
function distToPath(pts, p) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

// Дорожка: медь + поверх неё свет, если по ней реально идёт ток.
// `flow` — уже нормированная доля 0..1 (ток / номинал), а не сырые амперы:
// так скорость огоньков читается одинаково и в миллиамперах, и в амперах.
// `potential` 0..1 — потенциал более высокого конца, красит свет.
function drawTrace(ctx, pts, opts = {}) {
  if (pts.length < 2) return;
  const width = opts.width || 6;
  const flow = clamp(opts.flow || 0, 0, 1);
  const radius = opts.radius === undefined ? 12 : opts.radius;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Тень-подложка — дорожка должна лежать НА плате, а не быть врезанной.
  ctx.strokeStyle = rgba(0, 0, 0, 0.5);
  ctx.lineWidth = width + 3;
  tracePath(ctx, pts, radius); ctx.stroke();

  // Мёртвая медь.
  ctx.strokeStyle = colorToCss(opts.baseColor || Pal.COPPER);
  ctx.lineWidth = width;
  tracePath(ctx, pts, radius); ctx.stroke();

  if (flow > 0.004 || opts.energized) {
    const lit = opts.litColor || potentialColor(opts.potential === undefined ? 0.5 : opts.potential);
    const strength = clamp(Math.max(flow, opts.energized ? 0.16 : 0), 0, 1);

    // Ровное свечение «в дорожке есть напряжение».
    ctx.save();
    ctx.shadowColor = colorToCss(lit, 0.75 * strength);
    ctx.shadowBlur = 14 * strength + 4;
    ctx.strokeStyle = colorToCss(lit, 0.18 + 0.5 * strength);
    ctx.lineWidth = width * 0.62;
    tracePath(ctx, pts, radius); ctx.stroke();
    ctx.restore();

    // Бегущий заряд — только там, где ток действительно течёт.
    //
    // Цвет у него СВОЙ, с нижним пределом по потенциалу, и это важно: ток в
    // последовательной цепи одинаков везде, а потенциал — нет. Обратный
    // провод сидит на нуле вольт, и если красить огоньки по потенциалу без
    // предела, вся вторая половина кольца выглядит мёртвой при том же самом
    // токе. Ровное свечение «здесь есть напряжение» по-прежнему честно
    // гаснет на земле — гаснуть не должно именно движение.
    if (flow > 0.004) {
      // Заметность движения — по НЕЛИНЕЙНОЙ шкале, а скорость — по линейной.
      // Причина: предел дорожки задан по пиковому току (у разрядной цепи это
      // почти два ампера), и в спокойном режиме та же дорожка несёт единицы
      // миллиампер. При линейной шкале это давало один пунктир на полсотни
      // пикселей — то есть «тока нет» там, где он есть. Теперь редкий ток
      // виден, просто ползёт медленно, а частота и яркость по-прежнему
      // растут вместе с ним.
      const vis = Math.pow(flow, 0.45);
      const dashLen = lerp(6, 15, vis);
      const gapLen = lerp(34, 15, vis);
      const speed = lerp(30, 260, flow);
      const moving = potentialColor(Math.max(opts.potential === undefined ? 0.5 : opts.potential, 0.34));
      ctx.save();
      ctx.shadowColor = colorToCss(moving, 0.9);
      ctx.shadowBlur = 10;
      ctx.strokeStyle = colorToCss(lerpColor(moving, [1, 1, 1], 0.45), 0.5 + 0.45 * vis);
      ctx.lineWidth = width * 0.48;
      ctx.setLineDash([dashLen, gapLen]);
      // Знак тока задаёт направление бега — реверс полярности видно глазом.
      ctx.lineDashOffset = -clockNow() * speed * (opts.reverse ? -1 : 1);
      tracePath(ctx, pts, radius); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// Паяный пятак — место, где деталь садится на плату.
function solderPad(ctx, pos, r = 5) {
  fillCircle(ctx, pos, r + 1.5, rgba(0, 0, 0, 0.55));
  fillCircle(ctx, pos, r, colorToCss(Pal.PAD));
  fillCircle(ctx, pos, r * 0.42, rgba(0.05, 0.05, 0.06, 1));
  ctx.save();
  ctx.strokeStyle = rgba(1, 1, 1, 0.22); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(pos.x - r * 0.2, pos.y - r * 0.2, r * 0.62, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
}

// Вывод детали: короткая металлическая ножка от корпуса к пятаку.
function lead(ctx, from, to, width = 3) {
  line(ctx, from, to, rgba(0, 0, 0, 0.5), width + 2);
  line(ctx, from, to, rgba(0.62, 0.64, 0.68, 1), width);
  line(ctx, from, to, rgba(0.85, 0.87, 0.9, 0.5), width * 0.35);
}
