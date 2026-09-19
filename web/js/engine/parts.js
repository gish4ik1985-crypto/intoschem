'use strict';
// Как выглядит каждая деталь. Всё рисуется в локальных координатах
// детали (0,0 — её центр), поворот и перенос делает уровень.
//
// Правило картинки: деталь должна узнаваться по силуэту, без подписи.
// Резистор — керамика с цветными кольцами (настоящими, посчитанными по
// номиналу), лампа — стекло с нитью, которая калится по мощности,
// конденсатор — банка, наливающаяся зарядом. Подпись — подтверждение,
// а не единственный способ понять, что перед тобой.

const BAND_COLORS = [
  hex(0x14161a), hex(0x6b4324), hex(0xd0342c), hex(0xe08a2e), hex(0xe8c93a),
  hex(0x3f9e50), hex(0x2f6fc4), hex(0x8b5fbf), hex(0x9aa0a6), hex(0xf0f0f0),
];

// Кольца настоящие: две значащие цифры + множитель, как на живом резисторе.
// 47 Ом -> жёлтый, фиолетовый, чёрный. 4,7 кОм -> жёлтый, фиолетовый, красный.
function resistorBands(ohms) {
  if (!(ohms > 0)) return [];
  let exp = Math.floor(Math.log10(ohms)) - 1;
  let mant = Math.round(ohms / Math.pow(10, exp));
  if (mant >= 100) { mant = Math.round(mant / 10); exp += 1; }
  if (mant < 10) { mant *= 10; exp -= 1; }
  const bands = [Math.floor(mant / 10), mant % 10, exp];
  return bands.map((d) => BAND_COLORS[clamp(d, 0, 9)]);
}

// Нагрев корпуса от рассеиваемой мощности — металл, а не поток.
function heatOverlay(ctx, drawShape, heat) {
  if (heat <= 0.04) return;
  const c = heatColor(clamp(heat, 0, 1));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(heat, 0, 1) * 0.75;
  ctx.fillStyle = colorToCss(c);
  ctx.shadowColor = colorToCss(c, 0.9);
  ctx.shadowBlur = 18 * clamp(heat, 0, 1);
  drawShape();
  ctx.restore();
}

const Parts = {};

// --- Резистор -------------------------------------------------------------
Parts.resistor = {
  hit: () => ({ w: 76, h: 30 }),
  terminals: () => ({ a: vec(-38, 0), b: vec(38, 0) }),
  draw(ctx, part, st) {
    const bw = 52, bh = 20;
    lead(ctx, vec(-38, 0), vec(-bw / 2 + 2, 0));
    lead(ctx, vec(bw / 2 - 2, 0), vec(38, 0));

    const body = () => roundRectPath(ctx, -bw / 2, -bh / 2, bw, bh, 9);
    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -bw / 2, -bh / 2, bw, bh, 0.5, [1.35, 1.12, 0.82], false);
    body(); ctx.fill();
    ctx.restore();

    const bands = resistorBands(part.value);
    bands.forEach((c, i) => {
      const x = -bw / 2 + 11 + i * 9;
      ctx.save();
      body(); ctx.clip();
      ctx.fillStyle = colorToCss(c);
      ctx.fillRect(x - 2.5, -bh / 2, 5, bh);
      ctx.fillStyle = rgba(0, 0, 0, 0.22);
      ctx.fillRect(x - 2.5, bh * 0.16, 5, bh * 0.34);
      ctx.restore();
    });
    // Кольцо допуска у дальнего края — так же, как на живой детали.
    ctx.save();
    body(); ctx.clip();
    ctx.fillStyle = rgba(0.78, 0.62, 0.24, 1);
    ctx.fillRect(bw / 2 - 10, -bh / 2, 4, bh);
    ctx.restore();

    ctx.save(); ctx.strokeStyle = rgba(0, 0, 0, 0.5); ctx.lineWidth = 1; body(); ctx.stroke(); ctx.restore();
    heatOverlay(ctx, () => { body(); ctx.fill(); }, st.heat);
  },
};

// --- Перемычка: голый провод вместо детали -------------------------------
Parts.jumper = {
  hit: () => ({ w: 76, h: 24 }),
  terminals: () => ({ a: vec(-38, 0), b: vec(38, 0) }),
  draw(ctx) {
    lead(ctx, vec(-38, 0), vec(-14, -7), 3);
    lead(ctx, vec(-14, -7), vec(14, -7), 3);
    lead(ctx, vec(14, -7), vec(38, 0), 3);
  },
};

// --- Светодиод (вид сверху: купол со срезом у катода) ---------------------
Parts.led = {
  hit: () => ({ w: 60, h: 40 }),
  terminals: () => ({ a: vec(-30, 0), b: vec(30, 0) }),
  draw(ctx, part, st) {
    const r = 15;
    const tint = part.color || hex(0xff4b30);
    lead(ctx, vec(-30, 0), vec(-r + 2, 0));
    lead(ctx, vec(r - 2, 0), vec(30, 0));

    if (st.bright > 0.01) glowSpot(ctx, vec(0, 0), r * lerp(2.4, 7.5, st.bright), tint, 0.55 * st.bright);

    // Юбочка у основания — по ней светодиод и опознаётся.
    ctx.save();
    ctx.fillStyle = colorToCss(brighten(tint, 0.32), 0.85);
    ctx.beginPath(); ctx.ellipse(0, 0, r + 4, r * 0.55 + 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Купол. Срез со стороны катода — плоская грань справа.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.72, Math.PI * 0.72);
    ctx.lineTo(r * 0.72, r * 0.66);
    ctx.lineTo(r * 0.72, -r * 0.66);
    ctx.closePath();
    ctx.clip();
    const core = lerpColor(brighten(tint, 0.34), [1, 1, 1], st.bright * 0.72);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r * 1.15);
    g.addColorStop(0, colorToCss(lerpColor(core, [1, 1, 1], 0.4), 0.95));
    g.addColorStop(0.55, colorToCss(core));
    g.addColorStop(1, colorToCss(brighten(core, 0.35)));
    ctx.fillStyle = g;
    ctx.fillRect(-r - 6, -r - 6, (r + 6) * 2, (r + 6) * 2);
    ctx.restore();

    // Кристалл внутри — точка, где свет реально рождается.
    if (st.bright > 0.01) {
      withGlow(ctx, [1, 1, 1], st.bright, 26, () => {
        fillCircle(ctx, vec(-1, -2), lerp(1.5, 5, st.bright), rgba(1, 1, 1, 0.4 + 0.6 * st.bright));
      });
    }
    strokeCircle(ctx, vec(0, 0), r, rgba(0, 0, 0, 0.45), 1.2);
    // Блик стекла.
    ctx.save();
    ctx.strokeStyle = rgba(1, 1, 1, 0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
    ctx.restore();

    if (st.burnt) drawBurnt(ctx, vec(0, 0), r);
  },
};

// --- Лампа накаливания: стекло с нитью, нить калится по мощности ---------
Parts.lamp = {
  hit: () => ({ w: 68, h: 52 }),
  terminals: () => ({ a: vec(-34, 0), b: vec(34, 0) }),
  draw(ctx, part, st) {
    const r = 19;
    lead(ctx, vec(-34, 0), vec(-r + 3, 0));
    lead(ctx, vec(r - 3, 0), vec(34, 0));

    const heat = clamp(st.heat, 0, 1);
    if (st.bright > 0.01) glowSpot(ctx, vec(0, 0), r * lerp(2, 8, st.bright), Pal.LAMP_GLOW, 0.5 * st.bright);

    // Колба.
    ctx.save();
    const glass = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    glass.addColorStop(0, rgba(0.5, 0.55, 0.6, 0.35));
    glass.addColorStop(0.7, rgba(0.16, 0.18, 0.21, 0.35));
    glass.addColorStop(1, rgba(0.08, 0.09, 0.11, 0.5));
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Держатели и нить. Нить — зигзаг, её цвет и есть температура металла.
    const filColor = st.burnt ? hex(0x2a2226) : heatColor(heat);
    ctx.save();
    ctx.strokeStyle = rgba(0.42, 0.44, 0.48, 1); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r + 4, 0); ctx.lineTo(-7, 0);
    ctx.moveTo(r - 4, 0); ctx.lineTo(7, 0);
    ctx.stroke();

    if (!st.burnt) {
      ctx.strokeStyle = colorToCss(filColor);
      ctx.lineWidth = 2.2;
      ctx.shadowColor = colorToCss(filColor, heat);
      ctx.shadowBlur = 16 * heat;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      for (let i = 0; i < 6; i++) ctx.lineTo(-7 + (i + 0.5) * (14 / 6), (i % 2 ? 5 : -5));
      ctx.lineTo(7, 0);
      ctx.stroke();
    } else {
      // Перегорела: нить оборвана посередине, концы оплавлены.
      ctx.strokeStyle = colorToCss(filColor);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-3, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, 4); ctx.stroke();
      ctx.fillStyle = rgba(0.1, 0.08, 0.08, 0.6);
      ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    strokeCircle(ctx, vec(0, 0), r, rgba(0.55, 0.6, 0.66, 0.55), 1.4);
    ctx.save();
    ctx.strokeStyle = rgba(1, 1, 1, 0.3); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, Math.PI * 1.02, Math.PI * 1.46); ctx.stroke();
    ctx.restore();
  },
};

// --- Батарейка АА в держателе (пропорции живого элемента ~50×14 мм) ------
Parts.cell = {
  hit: () => ({ w: 104, h: 44 }),
  terminals: () => ({ a: vec(-52, 0), b: vec(52, 0) }), // a = минус, b = плюс
  draw(ctx, part) {
    const bw = 76, bh = 28;
    const flip = part.flipped ? -1 : 1;
    ctx.save();
    ctx.scale(flip, 1);

    // Держатель: основание и две прижимные щёчки по краям.
    fillRound(ctx, -47, -20, 94, 40, 4, rgba(0.075, 0.085, 0.1, 1));
    strokeRound(ctx, -47, -20, 94, 40, 4, rgba(1, 1, 1, 0.06), 1);
    for (const sx of [-1, 1]) {
      fillRound(ctx, sx * 40 - 4, -20, 8, 40, 2, metalFill(ctx, sx * 40 - 4, -20, 8, 40, 0.17));
    }

    const body = () => roundRectPath(ctx, -bw / 2, -bh / 2, bw, bh, 3);

    // Корпус: тёмная обёртка с золотой этикеткой посередине — силуэт
    // читается батарейкой без подписи.
    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -bw / 2, -bh / 2, bw, bh, 0.19, [0.9, 0.95, 1.05], false);
    body(); ctx.fill();
    ctx.restore();

    ctx.save();
    body(); ctx.clip();
    ctx.fillStyle = cylinderFill(ctx, -20, -bh / 2, 46, bh, 0.42, [1.3, 1.02, 0.5], false);
    ctx.fillRect(-20, -bh / 2, 46, bh);
    ctx.fillStyle = rgba(0.85, 0.87, 0.92, 0.5);
    ctx.fillRect(-24, -bh / 2, 3, bh);
    ctx.fillRect(27, -bh / 2, 3, bh);
    ctx.restore();
    strokeRound(ctx, -bw / 2, -bh / 2, bw, bh, 3, rgba(0, 0, 0, 0.75), 1);

    // Минус — плоский контакт, к нему прижимается пружина держателя.
    ctx.fillStyle = rgba(0.07, 0.07, 0.08, 1);
    ctx.fillRect(-bw / 2 - 2, -bh * 0.44, 3, bh * 0.88);
    ctx.save();
    ctx.strokeStyle = rgba(0.5, 0.52, 0.56, 1); ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-bw / 2 - 7, 0, 3 + i * 2.2, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
    }
    ctx.restore();

    // Плюс — воротничок и узкая кнопка, а не «пупырь во всю ширину».
    fillRound(ctx, bw / 2, -8, 4, 16, 1, rgba(0.14, 0.14, 0.16, 1));
    fillRound(ctx, bw / 2 + 3, -5, 8, 10, 2, metalFill(ctx, bw / 2 + 3, -5, 8, 10, 0.56, [1.15, 0.94, 0.62]));
    ctx.restore();

    text(ctx, part.label || '1,5 В', vec(3 * flip, 1), { size: 12, color: rgba(0.12, 0.1, 0.06, 0.95), weight: '700' });
    text(ctx, '−', vec(-52 * flip, -2), { size: 18, color: colorToCss(Pal.TEXT_DIM) });
    text(ctx, '+', vec(52 * flip, -1), { size: 16, color: colorToCss(Pal.WARN) });
  },
};

// --- Крона 9 В ------------------------------------------------------------
Parts.krona = {
  hit: () => ({ w: 74, h: 82 }),
  terminals: () => ({ a: vec(16, -41), b: vec(-16, -41) }), // a = минус, b = плюс
  draw(ctx, part) {
    const w = 56, h = 74;
    // Выводы кроны симметричны относительно центра, поэтому зеркальная
    // отрисовка переносит и штырёк, и подпись на противоположный вывод.
    ctx.save();
    if (part.flipped) ctx.scale(-1, 1);
    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -w / 2, -h / 2, w, h, 0.26, [0.85, 0.9, 1.0], true);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 5, rgba(0, 0, 0, 0.75), 1.2);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colorToCss(Pal.ACCENT_DIM);
    ctx.fillRect(-w / 2 + 3, -6, w - 6, 16);
    ctx.restore();

    // Два разных контакта: плюс — штырёк, минус — кольцевое гнездо.
    lead(ctx, vec(-16, -h / 2), vec(-16, -41), 4);
    fillRound(ctx, -20, -h / 2 - 8, 8, 10, 2, metalFill(ctx, -20, -h / 2 - 8, 8, 10, 0.55, [1.1, 0.9, 0.6]));
    strokeCircle(ctx, vec(16, -h / 2 - 3), 6, rgba(0.42, 0.44, 0.47, 1), 3.2);
    lead(ctx, vec(16, -h / 2), vec(16, -41), 4);
    ctx.restore();

    // Подписи — ПОСЛЕ снятия зеркального преобразования, иначе номинал на
    // корпусе читается задом наперёд. Знаки при этом обязаны переехать
    // вместе с контактами, поэтому у них координата умножена на flip.
    const flip = part.flipped ? -1 : 1;
    text(ctx, part.label || '9 В', vec(0, 2), { size: 14, weight: '700', color: rgba(0.95, 0.97, 1, 0.95) });
    text(ctx, '+', vec(-16 * flip, -h / 2 - 16), { size: 13, color: colorToCss(Pal.WARN) });
    text(ctx, '−', vec(16 * flip, -h / 2 - 16), { size: 15, color: colorToCss(Pal.TEXT_DIM) });
  },
};

// --- Ввод питания от соседнего узла --------------------------------------
// Не источник. Это клеммник на кромке платы, к которому приходит кабель
// откуда-то ещё: у самого узла питания нет и не будет. В цепи он всё равно
// становится источником — потому что за ним стоит настоящий источник соседа,
// — но его внутреннее сопротивление включает и сопротивление кабеля, поэтому
// «дальний» ввод всегда мягче «ближнего». Это и есть весь урок таких узлов.
Parts.feed = {
  // Вывод ОДИН — плюсовой. Земля приходит тем же кабелем и сразу садится на
  // общую землю платы: рисовать её отдельной клеммой значило бы обещать, что
  // её можно подключить куда-то ещё, а её нельзя.
  hit: () => ({ w: 92, h: 56 }),
  terminals: () => ({ b: vec(46, 0) }),
  draw(ctx, part, st) {
    const w = 80, h = 44;
    // Кабель уходит за левую кромку платы — видно, что питание приходит
    // снаружи, а не рождается здесь.
    lead(ctx, vec(-w / 2 - 26, -6), vec(-w / 2 + 4, -6), 5);
    lead(ctx, vec(-w / 2 - 26, 8), vec(-w / 2 + 4, 8), 5);

    ctx.save();
    ctx.fillStyle = metalFill(ctx, -w / 2, -h / 2, w, h, 0.15);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 4, rgba(0, 0, 0, 0.7), 1.2);

    // Винтовой зажим плюса на правом боку.
    fillRound(ctx, w / 2 - 12, -7, 14, 14, 3, metalFill(ctx, w / 2 - 12, -7, 14, 14, 0.5));
    strokeRound(ctx, w / 2 - 12, -7, 14, 14, 3, rgba(0, 0, 0, 0.55), 1);
    line(ctx, vec(w / 2 - 9, 0), vec(w / 2 - 1, 0), rgba(0, 0, 0, 0.5), 1.6);
    lead(ctx, vec(w / 2 + 2, 0), vec(46, 0), 3);

    // Земля кабеля садится прямо здесь — значок под корпусом.
    lead(ctx, vec(-10, h / 2), vec(-10, h / 2 + 8), 3);
    for (let i = 0; i < 3; i++) {
      const half = 9 - i * 3;
      line(ctx, vec(-10 - half, h / 2 + 8 + i * 3.5), vec(-10 + half, h / 2 + 8 + i * 3.5), rgba(0.55, 0.6, 0.66, 0.85), 1.6);
    }

    if (st && st.energized) {
      withGlow(ctx, potentialColor(clamp(st.potential || 0.6, 0, 1)), 0.7, 12, () => {
        line(ctx, vec(-w / 2 + 6, -6), vec(w / 2 - 14, -6),
          colorToCss(potentialColor(clamp(st.potential || 0.6, 0, 1)), 0.55), 2);
      });
    }

    text(ctx, part.tag || 'ввод', vec(0, -h / 2 - 11), { size: 10, color: colorToCss(Pal.TEXT_DIM, 0.9), font: '"Consolas", monospace' });
    text(ctx, part.label || '', vec(-2, -2), { size: 14, weight: '700', color: colorToCss(Pal.TEXT, 0.9) });
    text(ctx, '+', vec(w / 2 + 12, -2), { size: 13, color: colorToCss(Pal.WARN) });
  },
};

// --- Блок питания прибора: то, что уже стоит внутри устройства -----------
// Игрок его не выбирает и не носит с собой: какой источник в приборе
// есть, тот и есть — это свойство прибора, а не награда.
Parts.supply = {
  hit: () => ({ w: 128, h: 78 }),
  terminals: () => ({ b: vec(64, -18), a: vec(64, 18) }), // b = плюс, a = минус
  draw(ctx, part, st) {
    const w = 112, h = 66;
    ctx.save();
    ctx.fillStyle = metalFill(ctx, -w / 2, -h / 2, w, h, 0.17);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 5, rgba(0, 0, 0, 0.7), 1.2);
    strokeRound(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 3, rgba(1, 1, 1, 0.05), 1);

    // Вентиляционные щели — корпус, а не плашка.
    ctx.save();
    ctx.fillStyle = rgba(0, 0, 0, 0.45);
    for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 12, -h / 2 + 12 + i * 8, 26, 3);
    ctx.restore();

    text(ctx, part.label || '12 В', vec(6, -8), { size: 16, weight: '700', color: colorToCss(Pal.TEXT, 0.9) });
    text(ctx, 'питание прибора', vec(6, 10), { size: 9, color: colorToCss(Pal.TEXT_DIM, 0.8) });

    lead(ctx, vec(w / 2 - 2, -18), vec(64, -18), 3);
    lead(ctx, vec(w / 2 - 2, 18), vec(64, 18), 3);
    text(ctx, '+', vec(w / 2 - 10, -18), { size: 14, color: colorToCss(Pal.WARN) });
    text(ctx, '−', vec(w / 2 - 10, 18), { size: 16, color: colorToCss(Pal.TEXT_DIM) });

    // Индикатор «питание подано» — светится только когда есть ток.
    const on = clamp(st.flow * 3, 0, 1);
    if (on > 0.02) withGlow(ctx, Pal.ACCENT, on, 14, () => fillCircle(ctx, vec(-w / 2 + 52, h / 2 - 12), 3.4, colorToCss(Pal.ACCENT)));
    else fillCircle(ctx, vec(-w / 2 + 52, h / 2 - 12), 3.4, rgba(0.15, 0.17, 0.19, 1));
  },
};

// --- Ключ: настоящий рычаг, который видно в каком положении --------------
Parts.toggle = {
  hit: () => ({ w: 76, h: 56 }),
  terminals: () => ({ a: vec(-38, 8), b: vec(38, 8) }),
  draw(ctx, part, st) {
    lead(ctx, vec(-38, 8), vec(-22, 8));
    lead(ctx, vec(22, 8), vec(38, 8));
    fillRound(ctx, -28, 2, 56, 12, 3, metalFill(ctx, -28, 2, 56, 12, 0.16));
    solderPad(ctx, vec(-22, 8), 5);
    solderPad(ctx, vec(22, 8), 5);

    const closed = st.anim === undefined ? (part.closed ? 1 : 0) : st.anim;
    const angle = lerp(-0.85, 0, closed);
    ctx.save();
    ctx.translate(-22, 8);
    ctx.rotate(angle);
    ctx.fillStyle = metalFill(ctx, 0, -4, 46, 8, 0.42);
    roundRectPath(ctx, -2, -4, 48, 8, 4); ctx.fill();
    ctx.strokeStyle = rgba(0, 0, 0, 0.5); ctx.lineWidth = 1;
    roundRectPath(ctx, -2, -4, 48, 8, 4); ctx.stroke();
    ctx.restore();

    fillCircle(ctx, vec(-22, 8), 5, rgba(0.55, 0.57, 0.6, 1));
    if (closed > 0.9 && st.energized) {
      withGlow(ctx, Pal.ACCENT, 0.8, 12, () => fillCircle(ctx, vec(22, 8), 3.5, colorToCss(Pal.ACCENT)));
    }
    text(ctx, part.closed ? 'замкнут' : 'разомкнут', vec(0, -22), {
      size: 11, color: part.closed ? colorToCss(Pal.ACCENT) : colorToCss(Pal.TEXT_DIM),
    });
  },
};

// --- Кнопка без фиксации (нажал — есть контакт) --------------------------
Parts.button = {
  hit: () => ({ w: 60, h: 52 }),
  terminals: () => ({ a: vec(-30, 6), b: vec(30, 6) }),
  draw(ctx, part, st) {
    lead(ctx, vec(-30, 6), vec(-16, 6));
    lead(ctx, vec(16, 6), vec(30, 6));
    fillRound(ctx, -20, -2, 40, 16, 3, metalFill(ctx, -20, -2, 40, 16, 0.14));
    const down = part.closed ? 4 : 0;
    fillRound(ctx, -13, -16 + down, 26, 18, 5, metalFill(ctx, -13, -16 + down, 26, 18, part.closed ? 0.34 : 0.46, [1.2, 0.7, 0.6]));
    strokeRound(ctx, -13, -16 + down, 26, 18, 5, rgba(0, 0, 0, 0.5), 1);
    if (part.closed && st.energized) withGlow(ctx, Pal.ACCENT, 0.7, 10, () => fillCircle(ctx, vec(0, -8 + down), 3, colorToCss(Pal.ACCENT)));
  },
};

// --- Предохранитель: стеклянная трубка, внутри видно проволоку -----------
Parts.fuse = {
  hit: () => ({ w: 88, h: 34 }),
  terminals: () => ({ a: vec(-44, 0), b: vec(44, 0) }),
  draw(ctx, part, st) {
    const w = 62, h = 20;
    lead(ctx, vec(-44, 0), vec(-w / 2, 0));
    lead(ctx, vec(w / 2, 0), vec(44, 0));

    ctx.save();
    ctx.fillStyle = rgba(0.2, 0.22, 0.25, 0.32);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.restore();

    // Колпачки.
    for (const sx of [-1, 1]) {
      const x = sx > 0 ? w / 2 - 13 : -w / 2;
      fillRound(ctx, x, -h / 2 - 1, 13, h + 2, 2, metalFill(ctx, x, -h / 2 - 1, 13, h + 2, 0.42));
    }

    if (st.burnt) {
      ctx.save();
      ctx.fillStyle = rgba(0.12, 0.1, 0.1, 0.75);
      roundRectPath(ctx, -w / 2 + 12, -h / 2 + 1, w - 24, h - 2, 3); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = rgba(0.45, 0.4, 0.38, 0.9); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 13, 0); ctx.lineTo(-8, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 - 13, 0); ctx.lineTo(8, 3); ctx.stroke();
      ctx.restore();
    } else {
      const heat = clamp(st.heat, 0, 1);
      const c = heatColor(heat * 0.85);
      ctx.save();
      ctx.strokeStyle = colorToCss(c);
      ctx.lineWidth = 1.8;
      ctx.shadowColor = colorToCss(c, heat); ctx.shadowBlur = 12 * heat;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 13, 0); ctx.lineTo(w / 2 - 13, 0); ctx.stroke();
      ctx.restore();
    }
    strokeRound(ctx, -w / 2, -h / 2, w, h, 4, rgba(0.6, 0.65, 0.7, 0.4), 1.2);
    text(ctx, part.label || '', vec(0, -h / 2 - 12), { size: 11, color: colorToCss(Pal.TEXT_DIM) });
  },
};

// --- Конденсатор: банка, которая наливается зарядом ----------------------
Parts.capacitor = {
  hit: () => ({ w: 58, h: 84 }),
  terminals: () => ({ a: vec(-14, 42), b: vec(14, 42) }), // a = минус, b = плюс
  draw(ctx, part, st) {
    const w = 44, h = 62;
    // У электролита полярность нарисована на корпусе минусовой полосой, и
    // сторона у неё не декоративная: перепутанный электролит в жизни
    // вздувается. Выводы симметричны относительно центра, поэтому зеркальная
    // отрисовка честно переносит полосу на вывод «a».
    ctx.save();
    if (part.flipped) ctx.scale(-1, 1);
    lead(ctx, vec(-14, h / 2 - 4), vec(-14, 42), 3);
    lead(ctx, vec(14, h / 2 - 4), vec(14, 42), 3);

    const charge = clamp(st.charge || 0, 0, 1);
    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -w / 2, -h / 2, w, h, 0.22, [0.7, 0.85, 1.15], true);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.restore();

    // Уровень заряда — мембрана натягивается и наливается светом.
    if (charge > 0.01) {
      ctx.save();
      roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.clip();
      const c = potentialColor(charge);
      const g = ctx.createLinearGradient(0, h / 2, 0, h / 2 - h * charge);
      g.addColorStop(0, colorToCss(c, 0.75));
      g.addColorStop(1, colorToCss(c, 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, h / 2 - h * charge, w, h * charge);
      ctx.restore();
      withGlow(ctx, potentialColor(charge), charge, 20, () => {
        line(ctx, vec(-w / 2, h / 2 - h * charge), vec(w / 2, h / 2 - h * charge), colorToCss(potentialColor(charge), 0.9), 2);
      });
    }

    // Минусовая полоса вдоль корпуса — как на настоящем электролите.
    ctx.save();
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.clip();
    ctx.fillStyle = rgba(0.85, 0.88, 0.92, 0.75);
    ctx.fillRect(-w / 2, -h / 2, 11, h);
    ctx.fillStyle = rgba(0.1, 0.12, 0.16, 0.9);
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + 3, -h / 2 + 10 + i * 14, 5, 2.5);
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 5, rgba(0, 0, 0, 0.7), 1.2);

    // Крестовина клапана сверху.
    ctx.save();
    ctx.strokeStyle = rgba(0, 0, 0, 0.4); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -h / 2 + 3); ctx.lineTo(10, -h / 2 + 3);
    ctx.moveTo(0, -h / 2 + 3); ctx.lineTo(0, -h / 2 + 3);
    ctx.stroke();
    ctx.restore();

    if (st.burnt) drawBurnt(ctx, vec(0, 0), w * 0.5);
    ctx.restore();
  },
};

// --- Диод -----------------------------------------------------------------
Parts.diode = {
  hit: () => ({ w: 72, h: 28 }),
  terminals: () => ({ a: vec(-36, 0), b: vec(36, 0) }), // a = анод, b = катод
  draw(ctx, part, st) {
    const w = 42, h = 18;
    // Диод — деталь направленная, и сторона у него видна только по полоске
    // катода. Значит перевёрнутый диод обязан и рисоваться перевёрнутым:
    // иначе картинка утверждает одно, а решатель считает другое.
    ctx.save();
    if (part.flipped) ctx.scale(-1, 1);
    lead(ctx, vec(-36, 0), vec(-w / 2, 0));
    lead(ctx, vec(w / 2, 0), vec(36, 0));
    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -w / 2, -h / 2, w, h, 0.16, [1, 1, 1], false);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.restore();
    // Полоса катода — единственный способ отличить, куда он пропускает.
    ctx.save();
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.clip();
    ctx.fillStyle = rgba(0.85, 0.87, 0.9, 0.9);
    ctx.fillRect(w / 2 - 10, -h / 2, 5, h);
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 4, rgba(0, 0, 0, 0.6), 1);
    if (st.flow > 0.02) {
      withGlow(ctx, potentialColor(0.6), st.flow, 14, () => {
        line(ctx, vec(-w / 2 + 4, 0), vec(w / 2 - 12, 0), colorToCss(potentialColor(0.6), 0.5 * st.flow), 3);
      });
    }
    heatOverlay(ctx, () => { roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill(); }, st.heat);
    ctx.restore();
  },
};

// --- Мотор: банка с валом, вал реально крутится по току ------------------
Parts.motor = {
  hit: () => ({ w: 86, h: 78 }),
  terminals: () => ({ a: vec(-43, 22), b: vec(43, 22) }),
  draw(ctx, part, st) {
    const r = 30;
    lead(ctx, vec(-43, 22), vec(-18, 22));
    lead(ctx, vec(18, 22), vec(43, 22));

    ctx.save();
    ctx.fillStyle = cylinderFill(ctx, -r, -r, r * 2, r * 2, 0.26, [1, 1, 1], true);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    strokeCircle(ctx, vec(0, 0), r, rgba(0, 0, 0, 0.6), 1.4);
    strokeCircle(ctx, vec(0, 0), r - 5, rgba(1, 1, 1, 0.07), 1);

    // Крыльчатка. Направление вращения = знак тока: реверс видно глазом.
    const spin = st.spin || 0;
    ctx.save();
    ctx.rotate(spin);
    const blur = clamp(Math.abs(st.rpm || 0), 0, 1);
    ctx.globalAlpha = lerp(1, 0.55, blur);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 3);
      ctx.fillStyle = metalFill(ctx, -4, -r + 7, 8, r - 8, 0.4);
      roundRectPath(ctx, -4, -r + 7, 8, r - 8, 3); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    if (blur > 0.05) {
      ctx.save();
      ctx.globalAlpha = blur * 0.35;
      strokeCircle(ctx, vec(0, 0), r - 9, colorToCss(Pal.ACCENT, 0.8), 3);
      ctx.restore();
    }
    fillCircle(ctx, vec(0, 0), 7, metalFill(ctx, -7, -7, 14, 14, 0.5));
    strokeCircle(ctx, vec(0, 0), 7, rgba(0, 0, 0, 0.5), 1);
    heatOverlay(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }, st.heat);
    text(ctx, 'M', vec(0, -r - 12), { size: 12, color: colorToCss(Pal.TEXT_DIM) });
  },
};

// --- Переменный резистор: ручка, которую крутят мышью --------------------
Parts.pot = {
  hit: () => ({ w: 86, h: 86 }),
  terminals: () => ({ a: vec(-43, 26), b: vec(43, 26) }),
  draw(ctx, part, st) {
    const r = 26;
    lead(ctx, vec(-43, 26), vec(-16, 26));
    lead(ctx, vec(16, 26), vec(43, 26));
    fillRound(ctx, -22, 18, 44, 14, 3, metalFill(ctx, -22, 18, 44, 14, 0.16));

    // Шкала.
    ctx.save();
    ctx.strokeStyle = rgba(1, 1, 1, 0.16); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 7, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    ctx.restore();
    const t = clamp(part.knob === undefined ? 0.5 : part.knob, 0, 1);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    ctx.save();
    ctx.strokeStyle = colorToCss(Pal.ACCENT, 0.85); ctx.lineWidth = 3;
    ctx.shadowColor = colorToCss(Pal.ACCENT, 0.6); ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, r + 7, a0, lerp(a0, a1, t)); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = metalFill(ctx, -r, -r, r * 2, r * 2, 0.24);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    strokeCircle(ctx, vec(0, 0), r, rgba(0, 0, 0, 0.6), 1.4);
    // Насечки по ободу — ручку видно, что её можно крутить.
    ctx.save();
    ctx.strokeStyle = rgba(1, 1, 1, 0.1); ctx.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();

    const ang = lerp(a0, a1, t);
    ctx.save();
    ctx.strokeStyle = colorToCss(Pal.WARN); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.shadowColor = colorToCss(Pal.WARN, 0.7); ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * (r - 6), Math.sin(ang) * (r - 6)); ctx.stroke();
    ctx.restore();
    heatOverlay(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }, st.heat);
    text(ctx, fmtOhms(part.value || 0), vec(0, -r - 16), { size: 12, color: colorToCss(Pal.TEXT), weight: '600' });
  },
};

// --- Реле: катушка притягивает якорь, контакт слышно и видно ------------
Parts.relay = {
  hit: () => ({ w: 96, h: 82 }),
  terminals: () => ({ coilA: vec(-48, 32), coilB: vec(-12, 32), comA: vec(14, 32), comB: vec(48, 32) }),
  draw(ctx, part, st) {
    const w = 84, h = 60;
    lead(ctx, vec(-48, 32), vec(-34, 22), 3);
    lead(ctx, vec(-12, 32), vec(-20, 22), 3);
    lead(ctx, vec(14, 32), vec(24, 22), 3);
    lead(ctx, vec(48, 32), vec(34, 22), 3);

    ctx.save();
    ctx.fillStyle = rgba(0.11, 0.12, 0.15, 0.85);
    roundRectPath(ctx, -w / 2, -h / 2 - 4, w, h, 4); ctx.fill();
    ctx.restore();

    // Катушка — витки видно сквозь прозрачную крышку.
    const pull = clamp(st.pull || 0, 0, 1);
    ctx.save();
    ctx.translate(-20, -6);
    fillRound(ctx, -13, -18, 26, 34, 2, metalFill(ctx, -13, -18, 26, 34, 0.2));
    ctx.strokeStyle = colorToCss(lerpColor(Pal.COPPER, Pal.COPPER_LIT, pull), 0.95);
    ctx.lineWidth = 2;
    if (pull > 0.05) { ctx.shadowColor = colorToCss(Pal.COPPER_LIT, pull); ctx.shadowBlur = 10 * pull; }
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(-13, -16 + i * 4.4); ctx.lineTo(13, -14 + i * 4.4); ctx.stroke();
    }
    ctx.restore();

    // Якорь: притянут — контакт замкнут.
    ctx.save();
    ctx.translate(14, -20);
    ctx.rotate(lerp(0.28, 0.0, pull));
    fillRound(ctx, -4, -2, 34, 6, 2, metalFill(ctx, -4, -2, 34, 6, 0.45));
    ctx.restore();
    solderPad(ctx, vec(34, -6), 4);
    if (pull > 0.6) withGlow(ctx, Pal.ACCENT, 0.8, 12, () => fillCircle(ctx, vec(34, -6), 3, colorToCss(Pal.ACCENT)));

    strokeRound(ctx, -w / 2, -h / 2 - 4, w, h, 4, rgba(0.5, 0.55, 0.62, 0.35), 1.2);
  },
};

// --- Транзистор TO-92 -----------------------------------------------------
Parts.transistor = {
  hit: () => ({ w: 72, h: 76 }),
  terminals: () => ({ b: vec(-24, 34), c: vec(0, 34), e: vec(24, 34) }),
  draw(ctx, part, st) {
    lead(ctx, vec(-24, 34), vec(-11, 12), 3);
    lead(ctx, vec(0, 34), vec(0, 12), 3);
    lead(ctx, vec(24, 34), vec(11, 12), 3);
    // Стрелка на выводе эмиттера — единственное, что в настоящей схеме
    // отличает n-p-n от p-n-p на глаз, а не по подписи. У n-p-n она смотрит
    // НАРУЖУ (по направлению обычного тока из эмиттера); в игре транзистор
    // всегда n-p-n (см. core/components.gd, circuit.js — модель одна на
    // весь проект), поэтому стрелка рисуется только в эту сторону.
    const eFrom = vec(11, 12), eTo = vec(24, 34);
    const eDir = normV(subV(eTo, eFrom));
    const eMid = vec(eFrom.x + (eTo.x - eFrom.x) * 0.55, eFrom.y + (eTo.y - eFrom.y) * 0.55);
    ctx.save();
    ctx.translate(eMid.x, eMid.y);
    ctx.rotate(Math.atan2(eDir.y, eDir.x));
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-3.5, -3.6); ctx.lineTo(-3.5, 3.6); ctx.closePath();
    // Тёмная обводка нужна, иначе стрелка того же светлого оттенка, что и
    // сам провод, и на нём попросту не видна.
    ctx.strokeStyle = rgba(0, 0, 0, 0.8); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = colorToCss(Pal.WARN);
    ctx.fill();
    ctx.restore();
    const r = 21;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.86, Math.PI * 2.14);
    ctx.closePath();
    ctx.fillStyle = metalFill(ctx, -r, -r, r * 2, r * 2, 0.11);
    ctx.fill();
    ctx.strokeStyle = rgba(0, 0, 0, 0.7); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    text(ctx, 'T', vec(0, -6), { size: 13, color: rgba(0.55, 0.58, 0.62, 1), weight: '700' });
    text(ctx, 'n-p-n', vec(0, 6), { size: 8, color: rgba(0.55, 0.58, 0.62, 0.9), weight: '600' });
    text(ctx, 'б  к  э', vec(0, 26), { size: 9, color: colorToCss(Pal.TEXT_DIM) });
    if (st.flow > 0.02) {
      withGlow(ctx, Pal.ACCENT, st.flow, 16, () => fillCircle(ctx, vec(0, 6), 3 * st.flow + 1, colorToCss(Pal.ACCENT, 0.8)));
    }
    heatOverlay(ctx, () => {
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.86, Math.PI * 2.14); ctx.closePath(); ctx.fill();
    }, st.heat);
  },
};

// --- Прибор-потребитель: закрытый модуль, внутрь которого не лезут -------
Parts.device = {
  hit: () => ({ w: 92, h: 56 }),
  terminals: () => ({ a: vec(-46, 0), b: vec(46, 0) }),
  draw(ctx, part, st) {
    const w = 76, h = 44;
    lead(ctx, vec(-46, 0), vec(-w / 2, 0));
    lead(ctx, vec(w / 2, 0), vec(46, 0));
    ctx.save();
    ctx.fillStyle = metalFill(ctx, -w / 2, -h / 2, w, h, part.damaged ? 0.08 : 0.19);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 4, rgba(0, 0, 0, 0.7), 1.2);

    if (part.damaged) {
      // Копоть и трещина — прибор не «выключен», он повреждён.
      ctx.save();
      roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.clip();
      const g = ctx.createRadialGradient(4, 2, 2, 4, 2, w * 0.6);
      g.addColorStop(0, rgba(0.02, 0.02, 0.02, 0.95));
      g.addColorStop(1, rgba(0.05, 0.04, 0.04, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = rgba(0.42, 0.16, 0.1, 0.9); ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-24, -14); ctx.lineTo(-6, 2); ctx.lineTo(-12, 8); ctx.lineTo(14, 18);
      ctx.stroke();
      ctx.restore();
      text(ctx, part.label || 'прибор', vec(0, 0), { size: 11, color: colorToCss(Pal.DANGER, 0.9) });
    } else {
      text(ctx, part.label || 'прибор', vec(0, 0), { size: 11, color: colorToCss(Pal.TEXT_DIM) });
    }
    heatOverlay(ctx, () => { roundRectPath(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill(); }, st.heat);
  },
};

// --- Переключатель источника: галетник на две позиции --------------------
Parts.selector = {
  hit: () => ({ w: 96, h: 84 }),
  terminals: () => ({ a: vec(-48, 26), b: vec(48, 26) }),
  draw(ctx, part) {
    const r = 22;
    // noPads — деталь без физических выводов (просто ручка выбора режима,
    // не впаянная в цепь ни с одной стороны). Рисовать ей торчащие
    // проволочные ножки — значит обещать провод там, где его нет и не
    // будет: ровно то, что floating lead выглядит как «провод в никуда».
    if (!part.noPads) {
      lead(ctx, vec(-48, 26), vec(-16, 26));
      lead(ctx, vec(16, 26), vec(48, 26));
    }
    fillRound(ctx, -22, 18, 44, 14, 3, metalFill(ctx, -22, 18, 44, 14, 0.16));

    const opts = part.interact && part.interact.values ? part.interact.values : ['A', 'B'];
    const idx = Math.max(0, opts.indexOf(part.choice));
    const angles = [-Math.PI * 0.75, -Math.PI * 0.25];
    const ang = angles[idx % 2];

    ctx.save();
    ctx.fillStyle = metalFill(ctx, -r, -r, r * 2, r * 2, 0.26);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    strokeCircle(ctx, vec(0, 0), r, rgba(0, 0, 0, 0.6), 1.4);
    for (let i = 0; i < 2; i++) {
      const p = vec(Math.cos(angles[i]) * (r + 8), Math.sin(angles[i]) * (r + 8));
      fillCircle(ctx, p, 2.5, i === idx ? colorToCss(Pal.ACCENT) : rgba(1, 1, 1, 0.18));
    }
    ctx.save();
    ctx.strokeStyle = colorToCss(Pal.WARN); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.shadowColor = colorToCss(Pal.WARN, 0.7); ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * (r - 5), Math.sin(ang) * (r - 5)); ctx.stroke();
    ctx.restore();
    text(ctx, (part.labels && part.labels[idx]) || String(part.choice), vec(0, -r - 16), {
      size: 12, color: colorToCss(Pal.TEXT), weight: '600',
    });
  },
};

// --- Гнездо: пустое место, куда игрок ставит деталь ----------------------
Parts.socket = {
  hit: (part) => (part.content ? (Parts[part.content.kind].hit(part.content)) : { w: 88, h: 42 }),
  terminals: () => ({ a: vec(-44, 0), b: vec(44, 0) }),
  draw(ctx, part, st) {
    // Пружинные клеммы, между ними — воздух. Видно, что место пустое.
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * 34, 0);
      ctx.scale(sx, 1);
      ctx.fillStyle = metalFill(ctx, -4, -14, 12, 28, 0.34);
      roundRectPath(ctx, -4, -14, 12, 28, 3); ctx.fill();
      ctx.strokeStyle = rgba(0, 0, 0, 0.5); ctx.lineWidth = 1;
      roundRectPath(ctx, -4, -14, 12, 28, 3); ctx.stroke();
      ctx.restore();
      lead(ctx, vec(sx * 44, 0), vec(sx * 36, 0));
    }
    if (part.content) {
      // Сторона направленной детали может быть задана двумя способами: у
      // самого гнезда (когда его переворачивают целиком) и у того, что в
      // нём лежит (когда в ящике два одинаковых диода, отличающихся только
      // полоской). Содержимое главнее: иначе выбранный игроком диод
      // рисуется не той стороной, чем считается в цепи.
      const inner = Object.assign({ flipped: part.flipped }, part.content);
      Parts[part.content.kind].draw(ctx, inner, st);
    } else {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = colorToCss(Pal.WARN, 0.5 + 0.25 * Math.sin(clockNow() * 3));
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, -26, -15, 52, 30, 5);
      ctx.stroke();
      ctx.restore();
      text(ctx, 'пусто', vec(0, 0), { size: 11, color: colorToCss(Pal.WARN, 0.8) });
    }
  },
};

// --- Обрыв дорожки: обугленный разрыв, который надо запаять -------------
Parts.gap = {
  hit: () => ({ w: 80, h: 36 }),
  terminals: () => ({ a: vec(-40, 0), b: vec(40, 0) }),
  draw(ctx, part) {
    if (part.repaired) {
      lead(ctx, vec(-40, 0), vec(-12, -6), 4);
      lead(ctx, vec(-12, -6), vec(12, -6), 4);
      lead(ctx, vec(12, -6), vec(40, 0), 4);
      // Свежая пайка — капли припоя на концах.
      fillCircle(ctx, vec(-12, -6), 4, rgba(0.72, 0.74, 0.78, 1));
      fillCircle(ctx, vec(12, -6), 4, rgba(0.72, 0.74, 0.78, 1));
    } else {
      lead(ctx, vec(-40, 0), vec(-16, 0), 4);
      lead(ctx, vec(40, 0), vec(16, 0), 4);
      ctx.save();
      ctx.fillStyle = rgba(0.07, 0.05, 0.05, 0.85);
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(0.35, 0.16, 0.1, 0.8); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      text(ctx, 'обрыв', vec(0, -20), { size: 11, color: colorToCss(Pal.DANGER, 0.9) });
    }
  },
};

// --- Клемма/узел: просто пятак, к которому сходятся дорожки -------------
Parts.node = {
  hit: () => ({ w: 22, h: 22 }),
  terminals: () => ({ a: vec(0, 0) }),
  draw(ctx, part, st) {
    solderPad(ctx, vec(0, 0), 7);
    if (st.energized) {
      withGlow(ctx, potentialColor(st.potential), 0.8, 12, () => fillCircle(ctx, vec(0, 0), 3, colorToCss(potentialColor(st.potential))));
    }
    if (part.label) text(ctx, part.label, vec(0, -16), { size: 10, color: colorToCss(Pal.TEXT_DIM) });
  },
};

// --- Земля: общая точка отсчёта -----------------------------------------
Parts.ground = {
  hit: () => ({ w: 44, h: 34 }),
  terminals: () => ({ a: vec(0, -14) }),
  draw(ctx) {
    lead(ctx, vec(0, -14), vec(0, -2), 3);
    ctx.save();
    ctx.strokeStyle = colorToCss(Pal.TEXT_DIM, 0.9);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 3 - i * 0.6;
      const w = 18 - i * 6;
      ctx.beginPath(); ctx.moveTo(-w, -2 + i * 6); ctx.lineTo(w, -2 + i * 6); ctx.stroke();
    }
    ctx.restore();
  },
};

// --- Блок: собранный уровень, работающий как готовая деталь --------------
// Игрок не видит разводку внутри — она решена один раз при первом
// прохождении уровня-донора, а сам блок разбирается на настоящие детали
// решателя честно (Blocks.instantiate, web/js/engine/blocks.js). См.
// BLOCKS.md. Число и расположение выводов у каждого блока свои
// (BlockRegistry), поэтому hit/terminals читаются из part.blockId, а не
// зашиты константой, как у большинства деталей.
Parts.block = {
  hit: (part) => BlockRegistry.byId(part.blockId).hit,
  terminals: (part) => BlockRegistry.byId(part.blockId).terminals,
  draw(ctx, part) {
    const def = BlockRegistry.byId(part.blockId);
    const w = def.hit.w - 16, h = def.hit.h - 16;
    // Отвод от каждого вывода до края корпуса по той оси, по которой
    // вывод дальше всего от центра, — тот же приём, что endpointDir в
    // level.js использует для проводов свободной сборки.
    for (const k of Object.keys(def.terminals)) {
      const t = def.terminals[k];
      const edge = Math.abs(t.x) >= Math.abs(t.y)
        ? vec(Math.sign(t.x) * w / 2, t.y)
        : vec(t.x, Math.sign(t.y) * h / 2);
      lead(ctx, t, edge, 3);
      const lx = t.x + (Math.sign(t.x) || 1) * 5;
      const ly = t.y - (t.y ? (Math.sign(t.y) * 9) : 10);
      text(ctx, k, vec(lx, ly), { size: 9, color: colorToCss(Pal.TEXT_DIM, 0.85) });
    }
    ctx.save();
    ctx.fillStyle = metalFill(ctx, -w / 2, -h / 2, w, h, 0.22);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.restore();
    strokeRound(ctx, -w / 2, -h / 2, w, h, 5, rgba(0, 0, 0, 0.7), 1.3);
  },
};

// Обугленная деталь — видимое повреждение, а не «выключено».
function drawBurnt(ctx, pos, radius) {
  withGlow(ctx, hex(0xff3d18), 0.35, 20, () => fillCircle(ctx, pos, radius, rgba(0.06, 0.03, 0.03, 0.92)));
  strokeCircle(ctx, pos, radius, rgba(0.45, 0.14, 0.09, 0.85), 1.5);
  ctx.save();
  ctx.strokeStyle = rgba(0.3, 0.28, 0.28, 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(a) * radius * 1.4, pos.y + Math.sin(a) * radius * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}
