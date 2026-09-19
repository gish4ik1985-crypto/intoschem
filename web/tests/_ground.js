'use strict';
// Разовый разбор: где на плате знак земли осмыслен, а где он просто украшение.
//   node web/tests/_ground.js
const H = require('./_harness.js');
const { LevelRegistry, Circuit, Parts } = H;

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
function energize(spec, P) {
  for (const raw of spec.parts) {
    const p = P[raw.id];
    const it = raw.interact;
    if (!it) continue;
    if (it.type === 'toggle' || it.type === 'press') p.closed = true;
    else if (it.type === 'flag') p[it.field] = true;
    else if (it.type === 'pick') {
      const opts = typeof it.options === 'function' ? it.options(raw, P) : it.options;
      for (let i = opts.length - 1; i >= 0; i--) {
        const o = opts[i];
        if (o.content === null) continue;
        for (const f of ['content', 'value', 'choice', 'repaired', 'blown', 'flipped']) {
          if (o[f] !== undefined) p[f] = o[f];
        }
        break;
      }
    }
  }
}

const rows = [];
for (const spec of LevelRegistry.list) {
  const P = freshParts(spec);
  energize(spec, P);
  const c = new Circuit();
  let built = true;
  try { spec.build(c, P); } catch (e) { built = false; }
  // сколько ВЕТОК сходится на земле: считаем выводы компонентов на узле GND
  let gndPins = 0;
  const gndComps = [];
  if (built) {
    for (const comp of c.components) {
      let n = 0;
      for (const k of ['a', 'b', 'base', 'collector', 'emitter', 'nodeA', 'nodeB', 'p', 'n']) {
        if (comp[k] === -1) n += 1;
      }
      if (n) { gndPins += n; gndComps.push((comp.name || comp.constructor.name) + '×' + n); }
    }
  }
  const hasSym = spec.parts.some((p) => p.kind === 'ground');
  const rig = /Rig\.build/.test(String(spec.build));
  const txt = [spec.brief, spec.lesson, spec.goalText, spec.teaches, (spec.hints || []).join(' ')].join(' ');
  const mentions = /земл|обратн(ый|ого|ом) провод|общий провод/i.test(txt);
  rows.push({
    id: spec.id, idx: spec.index, title: spec.title,
    sym: hasSym, rig, gndPins, comps: gndComps.join(' '), mentions,
    feeds: /feeds/.test(String(spec.build)) || spec.parts.some((p) => p.kind === 'feed'),
  });
}
rows.sort((a, b) => a.idx - b.idx);
console.log('idx  id                 знак  ветвей-на-земле  текст-про-землю  ввод');
for (const r of rows) {
  console.log(
    String(r.idx).padStart(3) + '  ' + r.id.padEnd(18)
    + (r.sym ? ' есть' : ' нет ').padEnd(6)
    + String(r.gndPins).padStart(6) + '           '
    + (r.mentions ? 'да ' : '—  ') + '            '
    + (r.feeds ? 'да' : '—') + '   ' + r.comps);
}
