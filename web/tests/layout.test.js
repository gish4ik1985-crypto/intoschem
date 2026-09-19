'use strict';
// Разводка фиксированных уровней. Провода здесь ДЕКОРАТИВНЫ — топологию задаёт
// build(), — поэтому «схема работает» ничего не говорит о том, правильно ли она
// нарисована. Эти две вещи расходятся молча, и сверять их надо отдельно.
//
// Семь признаков, каждый ловился в проекте живьём:
//   1 разворот назад     — дорожка пошла обратно по себе, сверху торчит отросток
//   2 конец в пустоте    — провод оканчивается там, где ничего нет
//   3 вывод без провода  — к выводу детали не подходит ни одна дорожка
//   4 наложение          — два провода лежат на одной линии и сливаются в один
//   5 ложный узел        — конец провода одной сети лежит на пути провода ДРУГОЙ:
//                          картинка ставит там пятак, то есть утверждает
//                          соединение, которого нет
//   6 сквозь корпус      — дорожка проходит через корпус чужой детали
//   7 габариты           — детали наезжают друг на друга, вылезают за плату или
//                          лежат на шелкографии платы
//
// Проверяется КАЖДОЕ состояние переключателей: `wires(P)` — функция, и при
// другом положении селектора картинка другая.

const H = require('./_harness.js');
const { makeSuite } = require('./_assert.js');
const { LevelRegistry, Parts, vec, distV } = H;

const TOL_TERM = 22;   // конец провода может уходить на пару пикселей внутрь корпуса
const TOL_NEAR = 20;
const OVERLAP_MAX = 6; // короткое совпадение у самого пятака неизбежно

function partsOf(spec) {
  const P = {};
  for (const raw of spec.parts) P[raw.id] = Object.assign({}, raw);
  return P;
}

function termOf(P) {
  return (ref) => {
    const [pid, t] = ref.split('.');
    const p = P[pid];
    const ts = p.terminals || Parts[p.kind].terminals(p);
    const o = ts[t || 'a'] || vec(0, 0);
    return vec(p.pos.x + o.x, p.pos.y + o.y);
  };
}

function d2seg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
function d2path(pts, p) {
  let m = Infinity;
  for (let i = 1; i < pts.length; i++) m = Math.min(m, d2seg(p, pts[i - 1], pts[i]));
  return m;
}
// Длина участка, на котором два ОСЕВЫХ звена лежат на одной линии.
function overlapLen(p, q, r, s) {
  const pH = Math.abs(p.y - q.y) < 0.5, rH = Math.abs(r.y - s.y) < 0.5;
  const pV = Math.abs(p.x - q.x) < 0.5, rV = Math.abs(r.x - s.x) < 0.5;
  if (pH && rH && Math.abs(p.y - r.y) < 3) {
    return Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x));
  }
  if (pV && rV && Math.abs(p.x - r.x) < 3) {
    return Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) - Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y));
  }
  return 0;
}
function segHitsRect(p, q, r) {
  return Math.max(p.x, q.x) > r.x0 && Math.min(p.x, q.x) < r.x1
    && Math.max(p.y, q.y) > r.y0 && Math.min(p.y, q.y) < r.y1;
}

// Все состояния переключателей, которые игрок может выставить.
function states(spec) {
  const axes = spec.parts.filter((p) => p.interact && p.interact.type === 'cycle')
    .map((p) => ({ id: p.id, field: p.interact.field, values: p.interact.values }));
  let out = [{}];
  for (const a of axes) {
    const nx = [];
    for (const c of out) for (const v of a.values) nx.push(Object.assign({}, c, { [a.id]: v }));
    out = nx;
  }
  return { axes, combos: out.slice(0, 64) };
}

module.exports = function run() {
  const t = makeSuite('Разводка');

  for (const spec of LevelRegistry.list) {
    if (spec.freeform) continue;
    const board = Object.assign({ x: -300, y: -110, w: 600, h: 220 }, spec.board || {});
    const { axes, combos } = states(spec);
    const found = new Set();

    for (const combo of combos) {
      const P = partsOf(spec);
      for (const a of axes) if (combo[a.id] !== undefined) P[a.id][a.field] = combo[a.id];
      const term = termOf(P);
      const list = typeof spec.wires === 'function' ? spec.wires(P) : spec.wires;
      const polys = list.map((w) => ({ w, pts: H.fixedWirePoints ? H.fixedWirePoints(w, term) : fallbackPts(w, term) }));

      const allTerms = [];
      for (const id of Object.keys(P)) {
        const p = P[id];
        const ts = p.terminals || Parts[p.kind].terminals(p);
        for (const k of Object.keys(ts)) allTerms.push({ id, k, pos: vec(p.pos.x + ts[k].x, p.pos.y + ts[k].y) });
      }

      polys.forEach(({ w, pts }, wi) => {
        for (let i = 2; i < pts.length; i++) {
          const d1 = vec(pts[i - 1].x - pts[i - 2].x, pts[i - 1].y - pts[i - 2].y);
          const d2 = vec(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          if (d1.x * d2.x + d1.y * d2.y < -1) {
            found.add('1 разворот назад: провод #' + wi + ' (' + w.net + ') в точке '
              + Math.round(pts[i - 1].x) + ',' + Math.round(pts[i - 1].y));
          }
        }
        for (const e of [pts[0], pts[pts.length - 1]]) {
          const nearT = allTerms.some((x) => distV(x.pos, e) < TOL_TERM);
          const nearW = polys.some((o, oi) => oi !== wi && d2path(o.pts, e) < TOL_NEAR);
          if (!nearT && !nearW) {
            found.add('2 конец в пустоте: провод #' + wi + ' (' + w.net + ') в '
              + Math.round(e.x) + ',' + Math.round(e.y));
          }
        }
      });

      for (const x of allTerms) {
        const p = P[x.id];
        if (p.noPads || p.kind === 'ground' || (spec.unwired || []).indexOf(x.id) >= 0) continue;
        if (!polys.some((o) => d2path(o.pts, x.pos) < TOL_TERM)) {
          found.add('3 вывод без провода: ' + x.id + '.' + x.k);
        }
      }

      for (let i = 0; i < polys.length; i++) {
        for (let j = i + 1; j < polys.length; j++) {
          let mx = 0;
          const A = polys[i].pts, B = polys[j].pts;
          for (let a = 1; a < A.length; a++) {
            for (let b = 1; b < B.length; b++) mx = Math.max(mx, overlapLen(A[a - 1], A[a], B[b - 1], B[b]));
          }
          if (mx > OVERLAP_MAX) {
            found.add('4 наложение ' + Math.round(mx) + 'px: #' + i + '(' + polys[i].w.net
              + ') и #' + j + '(' + polys[j].w.net + ')');
          }
        }
      }

      polys.forEach(({ w, pts }, wi) => {
        for (const e of [pts[0], pts[pts.length - 1]]) {
          polys.forEach((o, oi) => {
            if (oi === wi || o.w.net === w.net) return;
            if (d2path(o.pts, e) < 2) {
              found.add('5 ложный узел: конец #' + wi + '(' + w.net + ') лежит на #' + oi
                + '(' + o.w.net + ') в ' + Math.round(e.x) + ',' + Math.round(e.y));
            }
          });
        }
      });

      for (const { w, pts } of polys) {
        for (const id of Object.keys(P)) {
          const p = P[id];
          if (p.kind === 'ground' || p.kind === 'node') continue;
          const h = Parts[p.kind].hit(p);
          const ts = p.terminals || Parts[p.kind].terminals(p);
          const own = Object.keys(ts).some((k) => {
            const g = vec(p.pos.x + ts[k].x, p.pos.y + ts[k].y);
            return distV(g, pts[0]) < 12 || distV(g, pts[pts.length - 1]) < 12;
          });
          if (own) continue;
          const r = { x0: p.pos.x - h.w / 2 + 4, x1: p.pos.x + h.w / 2 - 4, y0: p.pos.y - h.h / 2 + 4, y1: p.pos.y + h.h / 2 - 4 };
          for (let i = 1; i < pts.length; i++) {
            if (segHitsRect(pts[i - 1], pts[i], r)) {
              found.add('6 сквозь корпус: дорожка (' + w.net + ') проходит через ' + id + ' (' + p.kind + ')');
              break;
            }
          }
        }
      }
    }

    // Габариты не зависят от состояния переключателей — считаем один раз.
    const P0 = partsOf(spec);
    const ids = Object.keys(P0);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = P0[ids[i]], b = P0[ids[j]];
        const ha = Parts[a.kind].hit(a), hb = Parts[b.kind].hit(b);
        const ox = Math.min(a.pos.x + ha.w / 2, b.pos.x + hb.w / 2) - Math.max(a.pos.x - ha.w / 2, b.pos.x - hb.w / 2);
        const oy = Math.min(a.pos.y + ha.h / 2, b.pos.y + hb.h / 2) - Math.max(a.pos.y - ha.h / 2, b.pos.y - hb.h / 2);
        if (ox > 0 && oy > 0) found.add('7 наезд деталей ' + Math.round(ox) + 'x' + Math.round(oy) + ': ' + ids[i] + ' и ' + ids[j]);
      }
    }
    // Шелкография платы печатается по фиксированному месту в правом нижнем углу.
    const silk = {
      x0: board.x + board.w - 110, x1: board.x + board.w - 30,
      y0: board.y + board.h - 32, y1: board.y + board.h - 14,
    };
    for (const id of ids) {
      const p = P0[id];
      const h = Parts[p.kind].hit(p);
      if (p.pos.x - h.w / 2 < board.x || p.pos.x + h.w / 2 > board.x + board.w
        || p.pos.y - h.h / 2 < board.y || p.pos.y + h.h / 2 > board.y + board.h) {
        found.add('7 за краем платы: ' + id + ' (' + p.kind + ')');
      }
      if (p.pos.x + h.w / 2 > silk.x0 && p.pos.x - h.w / 2 < silk.x1
        && p.pos.y + h.h / 2 > silk.y0 && p.pos.y - h.h / 2 < silk.y1) {
        found.add('7 деталь на шелкографии платы: ' + id);
      }
    }
    {
      const P = partsOf(spec);
      const term = termOf(P);
      const list = typeof spec.wires === 'function' ? spec.wires(P) : spec.wires;
      for (const w of list) {
        const pts = H.fixedWirePoints ? H.fixedWirePoints(w, term) : fallbackPts(w, term);
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i - 1], q = pts[i];
          if (Math.max(p.x, q.x) > silk.x0 && Math.min(p.x, q.x) < silk.x1
            && Math.max(p.y, q.y) > silk.y0 && Math.min(p.y, q.y) < silk.y1) {
            found.add('7 провод по шелкографии платы: (' + w.net + ')');
          }
        }
      }
    }

    t.group(spec.index + ' · ' + spec.id);
    if (!found.size) t.ok('разводка чистая', true);
    else for (const f of found) t.ok(f, false);
  }

  return t.result();
};

function fallbackPts(w, term) {
  if (w.pts) return w.pts;
  const a = term(w.from), b = term(w.to);
  if (w.y !== undefined) return [a, vec(a.x, w.y), vec(b.x, w.y), b];
  if (w.x !== undefined) return [a, vec(w.x, a.y), vec(w.x, b.y), b];
  if (Math.abs(a.y - b.y) < 2) return [a, b];
  const mx = (a.x + b.x) / 2;
  return [a, vec(mx, a.y), vec(mx, b.y), b];
}
