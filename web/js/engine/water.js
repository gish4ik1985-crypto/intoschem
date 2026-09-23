'use strict';
// Водяной вид платы: та же цепь, нарисованная водопроводом.
//
// Ничего не считает сам. Скорость воды — это ток, яркость воды — давление
// (потенциал узла), направление — знак тока: всё берётся у того же решателя и
// тем же путём, что бегущие огоньки у медных дорожек. Поэтому вода течёт ровно
// так, как течёт настоящий ток, а не «для красоты».
//
// Вода в трубах ЗАМКНУТА: насос гонит её по кольцу, она нигде не вытекает и
// не расходуется. Это важно для урока: кран на кухне учит ровно обратному
// («вода ушла в раковину» = «ток израсходовался в лампе»). Поэтому у
// лопнувшей трубы нет капель — она просто сухая, и вода встаёт во всём кольце.
//
// Детали: батарейка — насос, лампа — водяное колесо с фонариком на оси,
// ключ — вентиль, гнездо — заглушки (пусто) / труба (перемычка) / узкая
// труба (резистор), повреждённая дорожка — лопнувшая труба. Для всего
// остального Water.drawPart возвращает false, и деталь рисуется как обычно.

const Water = (() => {
  const WALL = 'rgba(8,14,22,0.85)';
  const RIM = '#5d6f80';
  const RIM_HI = 'rgba(210,225,240,0.35)';

  function waterColor(pressure, a) {
    // Давление 0 — глубокая синева, высокое — насыщенный голубой.
    const p = clamp(pressure, 0, 1);
    const r = Math.round(lerp(22, 70, p)), g = Math.round(lerp(60, 170, p)), b = Math.round(lerp(125, 255, p));
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (a === undefined ? 1 : a) + ')';
  }

  // Труба по ломаной. o: { flow 0..1, reverse, pressure 0..1, width }.
  function drawPipe(ctx, pts, o) {
    if (pts.length < 2) return;
    const w = o.width || 16;
    const flow = clamp(o.flow || 0, 0, 1);
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = WALL; ctx.lineWidth = w + 10;
    tracePath(ctx, pts, 16); ctx.stroke();
    ctx.strokeStyle = RIM; ctx.lineWidth = w + 6;
    tracePath(ctx, pts, 16); ctx.stroke();
    ctx.strokeStyle = waterColor(o.pressure === undefined ? 0.4 : o.pressure);
    ctx.lineWidth = w;
    tracePath(ctx, pts, 16); ctx.stroke();
    // Блик по верху трубы — чтобы читалась как объём, а не полоса.
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = w * 0.35;
    tracePath(ctx, pts, 16); ctx.stroke();
    if (flow > 0.003) {
      const vis = Math.pow(flow, 0.45);
      const speed = lerp(25, 210, flow) * (o.reverse ? -1 : 1);
      // Струи вдоль течения.
      ctx.strokeStyle = 'rgba(190,235,255,' + (0.25 + 0.4 * vis).toFixed(3) + ')';
      ctx.lineWidth = w * 0.3;
      ctx.setLineDash([lerp(10, 26, vis), lerp(40, 18, vis)]);
      ctx.lineDashOffset = -clockNow() * speed;
      tracePath(ctx, pts, 16); ctx.stroke();
      // Пузырьки — чуть медленнее струй, чтобы вода казалась густой.
      ctx.strokeStyle = 'rgba(235,250,255,' + (0.35 + 0.45 * vis).toFixed(3) + ')';
      ctx.lineWidth = w * 0.28;
      ctx.setLineDash([0.1, lerp(46, 22, vis)]);
      ctx.lineDashOffset = -clockNow() * speed * 0.8 + 11;
      tracePath(ctx, pts, 16); ctx.stroke();
    }
    ctx.restore();
  }

  function joint(ctx, p) {
    fillCircle(ctx, p, 15, WALL);
    fillCircle(ctx, p, 12, RIM);
    fillCircle(ctx, p, 7, 'rgba(20,40,60,0.9)');
  }

  // Заглушка на конце трубы: вода дальше не идёт.
  function cap(ctx, p, dirX) {
    fillRound(ctx, p.x - 6, p.y - 15, 12, 30, 3, RIM);
    fillRound(ctx, p.x - 3 + dirX * 2, p.y - 12, 5, 24, 2, RIM_HI);
  }

  // Отрезок трубы a→b внутри детали. rev — вода течёт от b к a. По
  // умолчанию: ток детали положителен от вывода «a» к «b» (nets[0] → nets[1]).
  function seg(ctx, a, b, view, width, rev) {
    const r = rev === undefined ? (view.i || 0) < 0 : rev;
    drawPipe(ctx, [a, b], { flow: view.flow, reverse: r, pressure: view.pressure, width });
  }

  function impeller(ctx, c, r, angle, color) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(angle);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.5, -r * 0.35, r, 0); ctx.stroke();
    }
    ctx.restore();
    fillCircle(ctx, c, 4, '#dfe8f0');
  }

  // Угол вращения копится по времени с текущей скоростью: если брать
  // clockNow() * speed, колесо дёргается при каждом изменении тока.
  function spin(part, speed) {
    const now = clockNow();
    const dt = part._wT === undefined ? 0 : clamp(now - part._wT, 0, 0.1);
    part._wT = now;
    part._wA = (part._wA || 0) + speed * dt;
    return part._wA;
  }

  function label(ctx, s, p, color) {
    text(ctx, s, p, { size: 13, color: color || 'rgba(215,230,245,0.9)', weight: '600', shadow: true });
  }

  function pumpBody(ctx, c, r, part, view) {
    fillCircle(ctx, c, r + 5, WALL);
    fillCircle(ctx, c, r, '#3b4b5c');
    fillCircle(ctx, c, r - 5, waterColor(0.8));
    impeller(ctx, c, r - 8, spin(part, 3 + 22 * view.flow), 'rgba(230,245,255,0.9)');
  }

  const draw = {
    // Блок питания стенда: оба вывода справа, плюс сверху (b), минус снизу (a).
    supply(ctx, part, view) {
      const t = Parts.supply.terminals(part);
      // Отдаёт ток — его ток отрицателен (MNA считает внутрь ветви): из плюса
      // вода выходит наружу, в минус входит.
      const giving = (view.i || 0) < 0;
      seg(ctx, vec(8, t.b.y), t.b, view, 14, !giving);
      seg(ctx, vec(8, t.a.y), t.a, Object.assign({}, view, { pressure: 0.1 }), 14, giving);
      pumpBody(ctx, vec(-14, 0), 32, part, view);
      label(ctx, 'НАСОС ' + (part.label || ''), vec(-14, 52));
      text(ctx, '+', vec(t.b.x - 14, t.b.y - 18), { size: 16, color: '#ffd166', weight: '700' });
      return true;
    },
    // Пальчиковая батарейка — маленький насос в разрыве трубы.
    cell(ctx, part, view) {
      const t = Parts.cell.terminals(part);
      // Плюс нарисован справа (вывод «b»), у перевёрнутой — слева. Отдающая
      // батарейка гонит воду внутри себя от минуса к плюсу.
      const giving = (view.i || 0) < 0;
      seg(ctx, t.a, t.b, view, 14, part.flipped ? giving : !giving);
      pumpBody(ctx, vec(0, 0), 22, part, view);
      label(ctx, 'насос ' + (part.label || ''), vec(0, 40));
      const plusX = part.flipped ? t.a.x + 12 : t.b.x - 12;
      text(ctx, '+', vec(plusX, -20), { size: 16, color: '#ffd166', weight: '700' });
      return true;
    },
    // Лампа — водяное колесо: крутится от потока, на оси фонарик.
    lamp(ctx, part, view) {
      const t = Parts.lamp.terminals(part);
      seg(ctx, t.a, t.b, view, 14);
      const c = vec(0, -4), r = 26;
      const burnt = view.burnt;
      if (!burnt && view.bright > 0.02) glowSpot(ctx, c, 60 + 40 * view.bright, hex(0xffd27a), 0.35 * view.bright + 0.1);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(burnt ? 0.3 : spin(part, 2 + 16 * view.flow));
      ctx.strokeStyle = burnt ? '#6b6b6b' : '#c9d7e3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 8; k++) {
        if (burnt && k % 3 === 0) continue;
        const a = k * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7)); ctx.stroke();
        fillRound(ctx, Math.cos(a) * (r + 3) - 4, Math.sin(a) * (r + 3) - 4, 8, 8, 2, burnt ? '#555' : '#8fb4d0');
      }
      ctx.restore();
      fillCircle(ctx, c, 9, burnt ? '#333' : (view.bright > 0.02 ? 'rgba(255,220,130,' + (0.5 + 0.5 * view.bright) + ')' : '#4a5563'));
      label(ctx, burnt ? 'колесо сломано' : 'колесо + фонарик', vec(0, 44), burnt ? '#ff8a70' : undefined);
      return true;
    },
    // Гнездо: пусто — концы заглушены; перемычка — сплошная труба; резистор —
    // узкая труба, тем уже, чем больше ом.
    socket(ctx, part, view) {
      const t = Parts.socket.terminals(part);
      const c = part.content;
      if (!c) {
        seg(ctx, t.a, vec(-18, 0), view, 14);
        seg(ctx, vec(18, 0), t.b, view, 14);
        cap(ctx, vec(-18, 0), -1); cap(ctx, vec(18, 0), 1);
        label(ctx, 'заглушено', vec(0, 32), '#ffd166');
        return true;
      }
      if (c.kind === 'jumper') {
        seg(ctx, t.a, t.b, view, 14);
        label(ctx, 'труба', vec(0, 32));
        return true;
      }
      if (c.kind === 'resistor') {
        const narrow = clamp(12 - Math.log10(Math.max(c.value, 1)) * 2.6, 3, 11);
        seg(ctx, t.a, vec(-22, 0), view, 14);
        seg(ctx, vec(22, 0), t.b, view, 14);
        seg(ctx, vec(-24, 0), vec(24, 0), view, narrow);
        label(ctx, 'узкая труба · ' + fmtOhms(c.value), vec(0, 32));
        return true;
      }
      return false;
    },
    // Повреждённая дорожка — лопнувшая труба. Сухая: вода замкнута и не
    // вытекает, она просто встаёт во всём кольце.
    gap(ctx, part, view) {
      const t = Parts.gap.terminals(part);
      if (part.repaired) {
        seg(ctx, t.a, t.b, view, 14);
        fillRound(ctx, -9, -14, 18, 28, 3, '#8a9aa8');
        label(ctx, 'заделано', vec(0, 32));
        return true;
      }
      seg(ctx, t.a, vec(-12, 0), view, 14);
      seg(ctx, vec(12, 0), t.b, view, 14);
      ctx.save();
      ctx.strokeStyle = '#ff8a70'; ctx.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 12, -12); ctx.lineTo(s * 7, -5); ctx.lineTo(s * 13, 1); ctx.lineTo(s * 7, 7); ctx.lineTo(s * 12, 12);
        ctx.stroke();
      }
      ctx.restore();
      label(ctx, 'труба лопнула', vec(0, 32), '#ff8a70');
      return true;
    },
    // Ключ — вентиль с маховиком. Закрыт — заслонка поперёк трубы.
    toggle(ctx, part, view) {
      const t = Parts.toggle.terminals(part);
      seg(ctx, t.a, t.b, view, 14);
      const c = vec(0, t.a.y);
      fillCircle(ctx, c, 17, WALL);
      fillCircle(ctx, c, 14, '#4b5a68');
      line(ctx, vec(0, c.y - 14), vec(0, c.y - 30), '#9aa9b6', 4);
      ctx.save();
      ctx.translate(0, c.y - 32);
      ctx.rotate(part.closed ? Math.PI / 4 : 0);
      ctx.strokeStyle = part.closed ? '#6ee7a8' : '#ff8a70'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
      line(ctx, vec(-11, 0), vec(11, 0), ctx.strokeStyle, 3);
      line(ctx, vec(0, -11), vec(0, 11), ctx.strokeStyle, 3);
      ctx.restore();
      // Заслонка: закрыт вентиль — поперёк трубы, открыт — вдоль.
      ctx.save();
      ctx.translate(c.x, c.y);
      // Ключ замкнут — вода идёт — заслонка повёрнута вдоль трубы.
      if (part.closed) ctx.rotate(Math.PI / 2);
      fillRound(ctx, -3, -11, 6, 22, 2, part.closed ? '#9ab' : '#c96a55');
      ctx.restore();
      // Надпись о состоянии: «закрыт» — это когда вода стоит, то есть ключ
      // разомкнут. Слово «открыт» у вентиля значит ровно обратное, чем у
      // ключа, и это главная путаница аналогии — говорим прямо, что делает вода.
      label(ctx, part.closed ? 'вентиль: вода идёт' : 'вентиль: перекрыт', vec(0, 34), part.closed ? '#6ee7a8' : '#ffd166');
      return true;
    },
  };

  function drawPart(ctx, part, view) {
    const f = draw[part.kind];
    return f ? f(ctx, part, view) : false;
  }

  // Как деталь называется в водяном виде — строка подсказки под курсором.
  const ALIAS = {
    supply: 'насос — это батарейка: гонит воду по кольцу',
    cell: 'насос — это батарейка: гонит воду по кольцу',
    lamp: 'водяное колесо — это лампа: крутится от потока',
    toggle: 'вентиль — это ключ',
    gap: 'лопнувшая труба — это обрыв дорожки',
    socket: 'гнездо: заглушка, труба или узкая труба',
  };
  function alias(part) { return ALIAS[part.kind] || null; }

  return { drawPipe, drawPart, joint, alias };
})();
