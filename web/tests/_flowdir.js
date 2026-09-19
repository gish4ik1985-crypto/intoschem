// Направление бега заряда по дорожкам. Отдельный прогон, не входит в набор:
// он отвечает на вопрос, которого раньше никто не задавал, — «в ту ли сторону
// нарисовано движение тока».
//
// Как считается. У любой двухвыводной детали ток `componentCurrent[comp]`
// положителен, когда он течёт от `nets[0]` к `nets[1]`. Значит ток, ВЫТЕКАЮЩИЙ
// из вывода со стороны `nets[0]`, равен −I, а из вывода со стороны `nets[1]`
// равен +I. Это верно и для источника: `addSupply` кладёт плюс на `nets[0]`,
// и его ток отрицателен, когда он отдаёт, — то есть из плюсовой клеммы
// вытекает −I > 0, ровно как у резистора.
//
// Дорожка нарисована от `pts[0]` к последней точке; каркас пускает огоньки в
// обратную сторону, если ток детали-«via» отрицателен. Значит правильно, когда
// знак тока, вытекающего из вывода в точке `pts[0]`, совпадает с нарисованным
// направлением.
//
//   node web/tests/_flowdir.js [префикс id]

const H = require('./_harness.js');
const { makeSuite } = require('./_assert.js');
const { LevelRegistry, Circuit, Parts, vec, fixedWirePoints, wireReverse } = H;

const TOL = 24;
const polarity = [];
const polarityHits = {};
const polarChecked = new Set();
const polarSkipped = [];

// Полярность деталей, у которых она нарисована на корпусе: батарейка, крона,
// блок питания, электролит. Правило одно: вывод, помеченный на картинке
// ПЛЮСОМ, обязан сидеть на узле с БОЛЬШИМ напряжением. Иначе картинка говорит
// игроку прямо противоположное тому, что считает решатель, — а на электролите
// это ещё и способ его взорвать в жизни.
const POLARIZED = { capacitor: 1, cell: 1, krona: 1, supply: 1 };


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

// Состояние, в котором по схеме заведомо идёт ток: гнёзда заполнены, ключи
// замкнуты, разрывы запаяны. Проверять направление на разомкнутой схеме
// бессмысленно — там тока нет нигде.
function energize(spec, P) {
  for (const raw of spec.parts) {
    const p = P[raw.id];
    const it = raw.interact;
    if (!it) continue;
    if (it.type === 'toggle' || it.type === 'press') p.closed = true;
    else if (it.type === 'flag') p[it.field] = true;
    else if (it.type === 'pick') {
      const opts = typeof it.options === 'function' ? it.options(raw, P) : it.options;
      // Берём последний непустой вариант: «пусто» стоит первым и оставляет
      // ветку разомкнутой.
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

function termOf(P) {
  return (ref) => {
    const [pid, t] = ref.split('.');
    const p = P[pid];
    const ts = p.terminals || Parts[p.kind].terminals(p);
    const o = ts[t || 'a'] || vec(0, 0);
    return vec(p.pos.x + o.x, p.pos.y + o.y);
  };
}

// Все выводы всех деталей в мировых координатах.
//
// Какой вывод какой сети соответствует, УГАДЫВАТЬ НЕЛЬЗЯ: у резистора вывод
// «a» — это nets[0], у блока питания плюс сидит на «b», у элемента в ряду
// генератора всё наоборот, а `flipped` переворачивает картинку, но не сеть.
// Поэтому сторона определяется не по виду детали, а по самой дорожке: у неё
// известна сеть, и достаточно посмотреть, какой из двух сетей детали она
// равна (см. sideOf ниже).
function terminals(P) {
  const out = [];
  for (const id of Object.keys(P)) {
    const p = P[id];
    if (!p.nets || !p.comp) continue;
    const ts = p.terminals || Parts[p.kind].terminals(p);
    const keys = Object.keys(ts);
    if (keys.length !== 2) continue;
    for (const k of keys) {
      out.push({ id, comp: p.comp, nets: p.nets, pos: vec(p.pos.x + ts[k].x, p.pos.y + ts[k].y) });
    }
  }
  return out;
}

function sideOf(t, net) {
  if (t.nets[0] === net) return 0;
  if (t.nets[1] === net) return 1;
  return null;
}

function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= TOL; }

module.exports = function run() {
  const t = makeSuite('Направление тока');
  const only = process.argv[2];
  let checked = 0;
  const bad = [];
  polarity.length = 0;

  for (const spec of LevelRegistry.list) {
  if (spec.freeform) continue;
  if (only && !spec.id.startsWith(only)) continue;
  const P = freshParts(spec);
  energize(spec, P);
  let ci = new Circuit();
  let refs;
  try { refs = spec.build(ci, P) || {}; } catch (e) { console.log(spec.id + ': build упал — ' + e.message); continue; }
  ci.setTimestep(1 / 120);

  // Одного мгновения мало. Уровень может сам щёлкать ключом, переворачивать
  // полярность ввода или разряжать накопитель — и в каждой такой фазе ток
  // идёт по-своему. Поэтому смотрим несколько моментов на протяжении пяти
  // секунд, а не один кадр после включения.
  const SAMPLES = [4, 60, 200, 420, 600];
  const steps = SAMPLES[SAMPLES.length - 1];
  const term = termOf(P);
  let seen = 0;
  let sol = null;
  for (let n = 1; n <= steps; n++) {
    spec.apply(refs, P, ci);
    sol = ci.step(1 / 120);
    if (!sol.ok) break;
    const m = spec.read(sol, refs, P) || {};
    if (spec.tick) spec.tick(1 / 120, P, m, refs, ci, { flash() {} });
    if (SAMPLES.indexOf(n) < 0) continue;
    checkAt(spec, P, sol, term, n / 120);
    // Полярность смотрим на каждом срезе и ругаемся только на то, что врёт
    // ВО ВСЕХ: уровень «Обратная полярность» переворачивает ввод нарочно, и
    // в такие моменты плюс на минусе — это не дефект, а задача уровня.
    seen += 1;
    checkPolarity(spec, P, sol, term);
  }
  if (!sol || !sol.ok) console.log(spec.id + ': схема не решается в проверочном состоянии');
  for (const k of Object.keys(polarityHits)) {
    if (polarityHits[k] === seen) polarity.push(k);
    delete polarityHits[k];
  }
}

function checkPolarity(spec, P, sol, term) {
  const wires = typeof spec.wires === 'function' ? spec.wires(P) : spec.wires;
  for (const id of Object.keys(P)) {
    const p = P[id];
    if (!POLARIZED[p.kind] || !p.nets) continue;
    const ts = p.terminals || Parts[p.kind].terminals(p);
    if (!ts.a || !ts.b) continue;
    // Какой вывод к какой сети подходит — берём из самой разводки, а не из
    // соглашения: у разных деталей оно разное.
    const netAt = {};
    for (const k of ['a', 'b']) {
      const pos = vec(p.pos.x + ts[k].x, p.pos.y + ts[k].y);
      for (const w of wires) {
        const wp = fixedWirePoints(w, term);
        if (!wp || wp.length < 2) continue;
        const d = Math.min(Math.hypot(wp[0].x - pos.x, wp[0].y - pos.y),
          Math.hypot(wp[wp.length - 1].x - pos.x, wp[wp.length - 1].y - pos.y));
        if (d <= TOL && (w.net === p.nets[0] || w.net === p.nets[1])) { netAt[k] = w.net; break; }
      }
    }
    if (!netAt.a || !netAt.b || netAt.a === netAt.b) {
      // Проверка, которая молча ничего не проверила, хуже отсутствующей:
      // считаем и такие детали тоже, чтобы было видно охват.
      polarSkipped.push(spec.index + ' · ' + spec.id + ' · ' + p.kind + ' ' + id);
      continue;
    }
    polarChecked.add(spec.id + '.' + id);
    // Перевёрнутая деталь рисуется зеркально: плюс уезжает на другой вывод.
    const plusKey = p.flipped ? 'a' : 'b';
    const vPlus = sol.nodeVoltage[netAt[plusKey]] || 0;
    const vMinus = sol.nodeVoltage[netAt[plusKey === 'a' ? 'b' : 'a']] || 0;
    if (vPlus - vMinus < -0.05) {
      const key = spec.index + ' · ' + spec.id + ' · ' + p.kind + ' ' + id
        + ': плюс нарисован на «' + netAt[plusKey] + '», минус на «'
        + netAt[plusKey === 'a' ? 'b' : 'a'] + '»';
      polarityHits[key] = (polarityHits[key] || 0) + 1;
    }
  }
}

function checkAt(spec, P, sol, term, when) {
  const terms = terminals(P);
  const wires = typeof spec.wires === 'function' ? spec.wires(P) : spec.wires;

  wires.forEach((w, wi) => {
    // Ток дорожки: одна деталь или сумма со знаками (участок шины).
    let i;
    const cur = (name) => {
      const v = sol.componentCurrent[name];
      if (v === undefined) return undefined;
      for (const id of Object.keys(P)) if (P[id].comp === name && P[id].iSign === -1) return -v;
      return v;
    };
    if (w.viaSum) i = w.viaSum.reduce((a, v) => a + v.sign * (cur(v.comp) || 0), 0);
    else if (w.via) i = cur(w.via);
    if (i === undefined || Math.abs(i) < 1e-4) return;
    const pts = fixedWirePoints(w, term);
    if (!pts || pts.length < 2) return;

    // Нарисованное направление — зовём ровно ту же функцию, что и рендер
    // (wireReverse в level.js), а не пересчитываем формулу параллельно:
    // разошедшаяся копия уже один раз молча провалила эту же проверку —
    // тест был зелёным, а огоньки в игре бежали не в ту сторону.
    const drawnForward = !wireReverse(i, w.dir);

    // Дорожка бывает короче допуска (отвод от шины к соседнему выводу — это
    // полтора десятка пикселей), и тогда ОДИН И ТОТ ЖЕ вывод оказывается
    // рядом с обоими её концами. Поэтому мало «близко» — надо ещё, чтобы
    // вывод был ближе именно к тому концу, за который мы его считаем.
    const last = pts[pts.length - 1];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // В точке, где сходятся три и больше дорожек, ток РАЗДЕЛЯЕТСЯ, и по току
    // детали на этом конце нельзя судить, сколько его ушло именно в эту
    // дорожку. Такие концы пропускаем: иначе проверка ругается на совершенно
    // исправную развилку (ловилось на накопителе с реле).
    const busy = (pt) => wires.reduce((n, o) => {
      if (o === w) return n;
      const op = fixedWirePoints(o, term);
      if (!op || op.length < 2) return n;
      return n + ((dist(op[0], pt) <= TOL || dist(op[op.length - 1], pt) <= TOL) ? 1 : 0);
    }, 0);
    const hit = busy(pts[0]) > 1 ? null : terms.find((t) => near(t.pos, pts[0])
      && dist(t.pos, pts[0]) < dist(t.pos, last) && sideOf(t, w.net) !== null);
    const hitEnd = busy(last) > 1 ? null : terms.find((t) => near(t.pos, last)
      && dist(t.pos, last) <= dist(t.pos, pts[0]) && sideOf(t, w.net) !== null);
    let outAtStart = null;
    if (hit) {
      const ic = cur(hit.comp);
      if (ic !== undefined) outAtStart = sideOf(hit, w.net) === 0 ? -ic : ic;
    } else if (hitEnd) {
      const ic = cur(hitEnd.comp);
      // Ток, ВТЕКАЮЩИЙ в дальний вывод, — это ток, идущий по дорожке вперёд.
      if (ic !== undefined) outAtStart = sideOf(hitEnd, w.net) === 0 ? ic : -ic;
    }
    if (outAtStart === null || Math.abs(outAtStart) < 1e-4) return;

    checked += 1;
    const shouldForward = outAtStart > 0;
    if (shouldForward !== drawnForward) {
      bad.push(spec.index + ' · ' + spec.id + ' · дорожка #' + wi + ' сети «' + w.net + '» (via ' + (w.via || 'сумма')
        + ') от (' + Math.round(pts[0].x) + ',' + Math.round(pts[0].y) + '): нарисована '
        + (drawnForward ? 'вперёд' : 'назад') + ', ток идёт ' + (shouldForward ? 'вперёд' : 'назад')
        + ' [на ' + when.toFixed(2) + ' с]');
    }
  });
}

  t.group('Бег заряда идёт от плюса к минусу');
  t.note('дорожек под током проверено: ' + checked);
  if (!bad.length) t.ok('направление везде верное', true);
  else for (const b of bad) t.ok(b, false);

  t.group('Полярность нарисована той же стороной, какой считается');
  t.note('деталей с нарисованной полярностью проверено: ' + polarChecked.size
    + (polarSkipped.length ? ', не удалось определить: ' + [...new Set(polarSkipped)].join('; ') : ''));
  const uniq = [...new Set(polarity)];
  if (!uniq.length) t.ok('плюс на картинке совпадает с плюсом в цепи', true);
  else for (const b of uniq) t.ok(b, false);
  return t.result();
};

if (require.main === module) {
  const r = module.exports();
  console.log('проверено дорожек: ' + checked_note(r));
  process.exit(r.fails.length ? 1 : 0);
}

function checked_note(r) { return r.pass + ' прошло, ' + r.fails.length + ' неверных'; }
