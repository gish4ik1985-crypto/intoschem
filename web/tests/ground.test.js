'use strict';
// Знак земли: стоит ли он там, где он вообще что-то значит.
//
// В этой игре обратный провод нарисован ЦЕЛИКОМ, всегда, до самой клеммы
// источника. Значит главную свою работу — заменить собой ненарисованные
// обратные провода — значок «⏚» здесь не делает никогда. Остаётся ровно одна:
// назвать точку, ОТНОСИТЕЛЬНО которой что-то считают. Она нужна:
//   · когда ноль приходит кабелем снаружи (`feeds`) — своего источника у узла
//     нет, опору приносит сосед, и назвать её больше нечем;
//   · когда об этом сам урок (список LESSON ниже).
//
// Несколько веток на одном обратном проводе значка НЕ требуют: общий провод и
// так нарисован общим проводом. Ровно на это указал игрок, спросив про Т-07,
// где две ветки висят на одной шине, — знак там был, а сказать ему было
// нечего.
//
// Ни решатель, ни разводка на лишний значок не ругаются — цепь считается
// одинаково, дорожки нарисованы одинаково. Видно это только на экране.
//
// Проверяется два разных утверждения:
//   1 наличие значка совпадает с правилом;
//   2 вывод значка лежит на дорожке сети GND — иначе он висит в пустоте.

const H = require('./_harness.js');
const { makeSuite } = require('./_assert.js');
const { LevelRegistry, Circuit, Parts, vec } = H;

// Уровни, где значок нужен: УРОК прямо про землю. Список короткий и обязан
// объяснять себя — иначе он превратится в свалку исключений.
const LESSON = {
  t_ground: 'Т-03 «Обратный провод» — обратный провод и есть тема урока',
  t_divider: 'Т-08: точка меряется ОТНОСИТЕЛЬНО земли, потенциала без опоры не бывает',
  v_share: 'В-07: урок про сопротивление обратного провода — значок отмечает НАСТОЯЩУЮ землю',
  e_highside: 'Е-08: урок про разницу между разрывом в плюсе и разрывом в земле',
};

// Скрытый отвод намеренно НЕ нарисован (см. SECRET_TAPS в _deck.js). Ток он
// тянет настоящий, но значок отвечает за картинку, а на картинке его нет.
const HIDDEN = new Set(['TAP']);

function freshParts(spec) {
  const P = {};
  for (const raw of spec.parts) {
    const c = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      c[k] = (typeof v === 'function') ? v : (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
    }
    P[raw.id] = c;
  }
  return P;
}

function axesOf(spec) {
  const ax = [];
  for (const raw of spec.parts) {
    const it = raw.interact;
    if (!it) continue;
    if (it.type === 'toggle' || it.type === 'press') ax.push({ id: raw.id, f: 'closed', vals: [false, true] });
    else if (it.type === 'cycle') ax.push({ id: raw.id, f: it.field, vals: it.values });
    else if (it.type === 'flag') ax.push({ id: raw.id, f: it.field, vals: [false, true] });
    else if (it.type === 'flip') ax.push({ id: raw.id, f: 'flipped', vals: [false, true] });
    else if (it.type === 'pick') ax.push({ id: raw.id, pick: typeof it.options === 'function' ? it.options(raw, {}) : it.options });
  }
  return ax;
}

function applyState(P, ax, combo) {
  ax.forEach((a, i) => {
    const v = combo[i];
    if (a.pick) {
      const o = a.pick[v];
      for (const f of ['content', 'value', 'choice', 'repaired', 'blown', 'flipped']) {
        if (o[f] !== undefined) P[a.id][f] = o[f];
      }
    } else P[a.id][a.f] = a.vals[v];
  });
}

function* enumerate(ax, limit) {
  const sizes = ax.map((a) => (a.pick ? a.pick.length : a.vals.length));
  const total = sizes.reduce((a, b) => a * b, 1);
  if (total <= limit) {
    const idx = new Array(sizes.length).fill(0);
    for (let n = 0; n < total; n++) {
      yield idx.slice();
      for (let i = sizes.length - 1; i >= 0; i--) { if (++idx[i] < sizes[i]) break; idx[i] = 0; }
    }
  } else {
    for (let n = 0; n < limit; n++) yield sizes.map((s) => Math.floor(Math.random() * s));
  }
}

// Сколько НАРИСОВАННЫХ ветвей сходится на земле. Транзистор считается за две:
// у него через эмиттер возвращается и ток базы, и ток коллектора, то есть
// заземлённый эмиттер — это уже общая точка двух контуров.
function groundBranches(spec, P) {
  const c = new Circuit();
  try { spec.build(c, P); } catch (e) { return 0; }
  let deg = 0;
  for (const comp of c.components) {
    if (HIDDEN.has(comp.name)) continue;
    const pins = comp.constructor.name === 'Transistor'
      ? [comp.nodeA, comp.nodeB, comp.nodeC, comp.nodeB]
      : [comp.nodeA, comp.nodeB];
    for (const n of pins) if (n === -1) deg += 1;
  }
  return deg;
}

function d2seg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function termOf(P) {
  return (ref) => {
    const [pid, k] = ref.split('.');
    const p = P[pid];
    const ts = p.terminals || Parts[p.kind].terminals(p);
    const o = ts[k || 'a'] || vec(0, 0);
    return vec(p.pos.x + o.x, p.pos.y + o.y);
  };
}

module.exports = function run() {
  const t = makeSuite('Земля');
  let checked = 0;

  for (const spec of LevelRegistry.list) {
    if (spec.freeform) continue;
    const gnd = spec.parts.find((p) => p.kind === 'ground');
    const feeds = spec.parts.some((p) => p.kind === 'feed');

    let deg = 0;
    for (const combo of enumerate(axesOf(spec), 400)) {
      const P = freshParts(spec);
      applyState(P, axesOf(spec), combo);
      deg = Math.max(deg, groundBranches(spec, P));
    }

    const lesson = LESSON[spec.id];
    const want = feeds || !!lesson;
    checked += 1;

    t.group(spec.index + ' · ' + spec.id);
    if (!!gnd === want) {
      t.ok('знак земли на месте по правилу', true);
    } else if (gnd) {
      t.ok('лишний знак земли: ни урока про неё, ни ввода снаружи — назвать нечего', false);
    } else {
      t.ok('нет знака земли, хотя ноль приходит снаружи или урок про него', false);
    }
    // Число сходящихся ветвей само по себе значка НЕ оправдывает — но если
    // на землю приходит одна ветвь, то и опорой её называть незачем даже в
    // уровне-исключении: проверяем, что список LESSON не разъехался со
    // смыслом.
    if (gnd && lesson && deg < 2) {
      t.ok('исключение «' + spec.id + '»: на земле нет вообще ни одной ветви — ' + lesson, false);
    }

    // Значок обязан сидеть НА обратном проводе, а не рядом с ним: иначе он
    // ничего не отмечает, а просто нарисован в углу платы.
    if (gnd) {
      const P = freshParts(spec);
      const term = termOf(P);
      const ts = gnd.terminals || Parts.ground.terminals();
      const gp = vec(gnd.pos.x + ts.a.x, gnd.pos.y + ts.a.y);
      const list = typeof spec.wires === 'function' ? spec.wires(P) : (spec.wires || []);
      let best = Infinity;
      for (const w of list) {
        if (w.net !== 'GND') continue;
        const pts = H.fixedWirePoints(w, term);
        for (let i = 1; i < pts.length; i++) best = Math.min(best, d2seg(gp, pts[i - 1], pts[i]));
      }
      t.ok('знак сидит на обратном проводе', best < 2,
        'до ближайшей дорожки GND ' + Math.round(best) + ' px');
    }
  }

  t.note('уровней проверено: ' + checked);
  return t.result();
};
