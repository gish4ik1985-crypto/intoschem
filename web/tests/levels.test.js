'use strict';
// Уровень как задача: можно ли его в принципе пройти, честные ли при этом
// числа и не врёт ли карта.
//
//   · перебор состояний, которые игрок реально может выставить (гнёзда,
//     ключи, селекторы, ручки) — победа должна быть достижима хотя бы в одном;
//   · ни один узел пассивной цепи не может оказаться выше плюса источника или
//     ниже земли: если оказался, врёт модель, а не физика;
//   · матрица не должна вырождаться ни в одном состоянии;
//   · минимальный ЗАЧТЁННЫЙ результат обязан открывать соседа по кабелю —
//     иначе игрок честно проходит уровень и не видит на карте ничего нового;
//   · деталь, которая портится сама, без действия игрока, обязана делать это
//     медленнее, чем читается бриф уровня;
//   · каждая ссылка на статью кодекса должна вести в существующую статью.

const H = require('./_harness.js');
const { makeSuite } = require('./_assert.js');
const { LevelRegistry, Circuit, distV, clamp } = H;

const DT = 1 / 120;
const MAX_STATES = 2400;
const READ_WPS = 2.5; // слов в секунду спокойного чтения игрового текста

function freshParts(spec) {
  const P = {};
  for (const raw of spec.parts) {
    const copy = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (typeof v === 'function') copy[k] = v;
      else if (v && typeof v === 'object') copy[k] = JSON.parse(JSON.stringify(v));
      else copy[k] = v;
    }
    P[raw.id] = copy;
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
    else if (it.type === 'knob') {
      const vals = [];
      for (let k = 0; k <= 1.0001; k += 0.05) vals.push(it.map ? it.map(k) : k);
      ax.push({ id: raw.id, f: 'value', vals });
    }
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

// Один прогон уровня в заданном состоянии. Повторяет то, что делает
// level.js: шаг решателя 1/120, нагрев от реальной мощности, пик тока внутри
// шагов, а не раз в кадр.
function play(spec, P, seconds) {
  let circuit = new Circuit();
  let refs = spec.build(circuit, P) || {};
  let topo = spec.topologyKey ? spec.topologyKey(P) : '';
  circuit.setTimestep(DT);
  let ok = false, best = 0, worst = 1, maxNode = -1e9, minNode = 1e9, singular = 0;
  const burns = [];
  const steps = Math.round(seconds / DT);
  for (let n = 0; n < steps; n++) {
    if (spec.topologyKey && spec.topologyKey(P) !== topo) {
      circuit = new Circuit(); refs = spec.build(circuit, P) || {};
      circuit.setTimestep(DT); topo = spec.topologyKey(P);
    }
    spec.apply(refs, P, circuit);
    for (const id of Object.keys(P)) {
      const p = P[id];
      if (p.burnt && p.comp && refs[p.comp] && refs[p.comp].resistance !== undefined) {
        circuit.setResistance(refs[p.comp], 1e9);
      }
    }
    const sol = circuit.step(DT);
    if (!sol.ok) singular += 1;
    for (const k of Object.keys(sol.nodeVoltage)) {
      const v = sol.nodeVoltage[k];
      if (!isFinite(v)) { singular += 1; continue; }
      if (v > maxNode) maxNode = v;
      if (v < minNode) minNode = v;
    }
    for (const id of Object.keys(P)) {
      const p = P[id];
      if (p.nets) {
        p.u = (sol.nodeVoltage[p.nets[0]] || 0) - (sol.nodeVoltage[p.nets[1]] || 0);
        p.i = p.comp ? (sol.componentCurrent[p.comp] || 0) : 0;
        p.p = Math.abs(p.u * p.i);
      } else { p.u = 0; p.i = 0; p.p = 0; }
      if (p.comp) {
        const i = Math.abs(sol.componentCurrent[p.comp] || 0);
        if (i > (p.iMax || 0)) p.iMax = i;
      }
      if (p.rated && p.rated.pMax && !p.burnt) {
        const target = p.p / p.rated.pMax;
        p.heat = target + ((p.heat || 0) - target) * Math.exp(-DT / (p.rated.tau || 0.7));
        if (p.heat > 1) { p.burnt = true; p.heat = 1; burns.push([id, n * DT]); }
      }
      if (p.rated && p.rated.pNom) p.bright = p.burnt ? 0 : Math.min(1, Math.pow(Math.min(1, p.p / p.rated.pNom), 0.85));
    }
    const m = spec.read(sol, refs, P) || {};
    if (spec.tick) spec.tick(DT, P, m, refs, circuit, { flash() {} });
    const g = spec.goal(m, P);
    if (g.ok) {
      ok = true;
      const sc = clamp(spec.score(m, P), 0, 1);
      if (sc > best) best = sc;
      if (sc < worst) worst = sc;
    }
  }
  return { ok, best, worst, maxNode, minNode, singular, burns };
}

module.exports = function run() {
  const t = makeSuite('Уровни');
  const minWin = {};

  for (const spec of LevelRegistry.list) {
    t.group(spec.index + ' · ' + spec.id + ' — ' + spec.title);

    // Полнота описания: каркас молча полагается на каждое из этих полей.
    const need = ['id', 'index', 'title', 'teaches', 'brief', 'lesson', 'hints', 'parts',
      'read', 'status', 'goal', 'score', 'meter', 'map', 'vmax', 'goalText', 'codex', 'silk', 'diag'];
    const miss = need.filter((k) => spec[k] === undefined && !(spec.freeform && ['build', 'apply', 'wires'].includes(k)));
    t.ok('описание полное', miss.length === 0, 'нет полей: ' + miss.join(', '));

    if (spec.freeform) { minWin[spec.id] = 0.75; continue; }

    const ax = axesOf(spec);
    let anyWin = false, lo = 1, singular = 0, worstMax = -1e9, worstMin = 1e9;
    for (const combo of enumerate(ax, MAX_STATES)) {
      const P = freshParts(spec);
      applyState(P, ax, combo);
      let r;
      try { r = play(spec, P, spec.testSeconds || Math.max(1.2, (spec.hold || 0) + 0.8)); }
      catch (e) { t.ok('уровень считается без исключений', false, e.message); break; }
      singular += r.singular;
      worstMax = Math.max(worstMax, r.maxNode);
      worstMin = Math.min(worstMin, r.minNode);
      if (r.ok) { anyWin = true; lo = Math.min(lo, r.worst); }
    }
    minWin[spec.id] = spec.sequenced ? (spec.minScore || 0) : (anyWin ? lo : 0);

    t.ok('победа достижима', anyWin || !!spec.sequenced,
      spec.sequenced ? '' : 'ни одно из состояний не засчитывается');
    t.ok('матрица нигде не вырождается', singular === 0, singular + ' случаев');
    t.ok('узлы не выходят за питание', worstMax <= spec.vmax + 1e-3 && worstMin >= -spec.vmax - 1e-3,
      'диапазон ' + worstMin.toFixed(2) + '..' + worstMax.toFixed(2) + ' В при vmax ' + spec.vmax);

    // Поломка, которая происходит сама, обязана быть видимой: у игрока должно
    // быть время прочитать бриф прежде, чем деталь сгорит.
    const P0 = freshParts(spec);
    const solo = play(spec, P0, 30);
    if (solo.burns.length) {
      const first = solo.burns[0];
      const words = String(spec.brief || '').split(/\s+/).length;
      t.ok('сгорает не раньше, чем читается бриф: ' + first[0],
        first[1] > words / READ_WPS,
        'сгорает на ' + first[1].toFixed(1) + ' с, бриф ' + words + ' слов ≈ '
        + (words / READ_WPS).toFixed(1) + ' с чтения');
    }
  }

  // Свет открывает только соседа по кабелю, и минимальный зачтённый результат
  // обязан до него дотягиваться — иначе после честной победы карта пуста.
  t.group('Карта: свет дотягивается до соседа');
  for (const d of LevelRegistry.list) {
    if (!d.map || !d.map.from) continue;
    // Родителей может быть несколько. Дотягиваться обязан КАЖДЫЙ: кабель к
    // узлу рисуется от всех, и линия, которая нарисована, но не открывает, —
    // это обещание, которого карта не выполняет.
    const ids = Array.isArray(d.map.from) ? d.map.from : [d.map.from];
    for (const pid of ids) {
      const p = LevelRegistry.byId(pid);
      if (!t.ok('родитель «' + pid + '» существует у ' + d.id, !!(p && p.map))) continue;
      const dist = distV(d.map.pos, p.map.pos);
      const need = dist / (p.map.radius * 1.13);
      t.ok(p.id + ' -> ' + d.id, minWin[p.id] >= need,
        'нужен score ' + need.toFixed(2) + ', минимальный зачтённый ' + (minWin[p.id] || 0).toFixed(2));
    }
  }

  // Узел без своего питания подписывает вводы обозначениями соседей. Если
  // раскладку карты переложить, а подписи не поправить, узел будет ссылаться
  // на соседа, которого рядом больше нет, — и никто об этом не узнает.
  t.group('Вводы названы теми, кто рядом на карте');
  {
    let checked = 0;
    for (const spec of LevelRegistry.list) {
      const feeds = (spec.parts || []).filter((p) => p.kind === 'feed' && p.tag);
      if (!feeds.length) continue;
      const ids = Array.isArray(spec.map.from) ? spec.map.from : [spec.map.from];
      const codes = ids.map((id) => { const s = LevelRegistry.byId(id); return s ? s.codename : '?'; });
      for (const f of feeds) {
        checked += 1;
        t.ok(spec.id + ': ввод «' + f.tag + '» ссылается на соседа по карте',
          codes.some((c) => f.tag.indexOf(c) >= 0),
          'соседи на карте: ' + codes.join(', '));
      }
    }
    if (!checked) t.ok('узлов с вводами нет — проверять нечего', true);
  }

  t.group('Журнал изделия');
  {
    const seen = {};
    for (const s of H.SECTORS) for (const id of s.levels) seen[id] = (seen[id] || 0) + 1;
    const dup = Object.keys(seen).filter((k) => seen[k] > 1);
    t.ok('ни один узел не числится в двух секторах сразу', dup.length === 0, dup.join(', '));
    const ghosts = Object.keys(seen).filter((k) => !LevelRegistry.byId(k));
    t.ok('в секторах нет несуществующих узлов', ghosts.length === 0, ghosts.join(', '));
    const homeless = LevelRegistry.list.filter((sp) => !seen[sp.id]).map((sp) => sp.id);
    t.ok('каждый узел приписан к сектору', homeless.length === 0, homeless.join(', '));
    const codes = {};
    for (const sp of LevelRegistry.list) codes[sp.codename] = (codes[sp.codename] || 0) + 1;
    const clash = Object.keys(codes).filter((k) => codes[k] > 1 || k.indexOf('?') === 0);
    t.ok('обозначения узлов уникальны и не заглушки', clash.length === 0, clash.join(', '));
    const noReveal = LevelRegistry.list.filter((sp) => !H.Journal.revealOf(sp)).map((sp) => sp.id);
    t.ok('у каждого узла есть строка журнала', noReveal.length === 0, noReveal.join(', '));
  }

  t.group('Кодекс');
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/scenes/codex.js'), 'utf8');
  const ids = [...src.matchAll(/sec:\s*'[a-z]+',\s*id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  const used = new Set();
  for (const s of LevelRegistry.list) for (const k of (s.codex || [])) used.add(k);
  const orphanRefs = [...used].filter((u) => !ids.includes(u));
  t.ok('все ссылки уровней ведут в существующие статьи', orphanRefs.length === 0, orphanRefs.join(', '));

  return t.result();
};
