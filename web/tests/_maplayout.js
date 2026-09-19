// Раскладка карты. Это ГЕНЕРАТОР, а не проверка: он переписывает `map.pos` и
// `map.from` прямо в файлах уровней.
//
//   node web/tests/_maplayout.js          — показать, что получится
//   node web/tests/_maplayout.js --write  — записать в файлы
//
// Зачем он есть. Раскладка карты набиралась руками, по одному узлу за раз, и
// от этого получила два свойства, которые игрок и назвал: узлы разъехались по
// трём разным местам, а связи выродились в один длинный коридор — «сделай так,
// чтобы можно было идти с нескольких сторон».
//
// Здесь и то, и другое считается: секторы раскладываются блоками в одном
// месте, а связи НЕ задаются руками — каждый узел берёт в родители ближайшие к
// нему узлы, пройденные раньше. Из геометрии сама собой получается сеть с
// развилками и схождениями: там, где рядом оказались два ранних соседа, к узлу
// подходят две линии с разных сторон.

const fs = require('fs');
const path = require('path');
const H = require('./_harness.js');
const { LevelRegistry, SECTORS } = H;

const DX = 215;            // шаг по горизонтали: карточка 168 плюс просвет
const DY = 165;            // шаг по вертикали: карточка 114 плюс просвет
const LINK = 345;          // на такое расстояние ещё дотягивается свет соседа
const MAX_PARENTS = 2;

// Блок сектора: сколько колонок, где стоит ПЕРВЫЙ узел и куда идёт первая
// строка. Дальше змейка: дошли до края — спустились на строку и назад.
const BLOCKS = {
  'Т': { cols: 5, firstX: -430, dir: 1, y0: -1250 },
  'A': { cols: 4, firstX: -322, dir: 1, y0: -700 },
  'Б': { cols: 6, firstX: -322, dir: -1, y0: -300 },
  'В': { cols: 4, firstX: -107, dir: 1, y0: -300 },
  'Г': { cols: 4, firstX: -322, dir: -1, y0: 250 },
  'Д': { cols: 4, firstX: -107, dir: 1, y0: 100 },
  'Е': { cols: 5, firstX: -430, dir: 1, y0: 630 },
  'Ж': { cols: 3, firstX: 430, dir: -1, y0: 1180 },
  'Х': { cols: 1, firstX: 0, dir: 1, y0: 1345 },
};

function layout() {
  const pos = {};
  for (const sec of SECTORS) {
    const b = BLOCKS[sec.id];
    if (!b) { console.log('нет блока для сектора ' + sec.id); continue; }
    let col = b.dir > 0 ? 0 : b.cols - 1;
    let row = 0;
    let dir = b.dir;
    const originX = b.dir > 0 ? b.firstX : b.firstX - (b.cols - 1) * DX;
    for (const id of sec.levels) {
      pos[id] = { x: originX + col * DX, y: b.y0 + row * DY };
      col += dir;
      if (col < 0 || col > b.cols - 1) { dir = -dir; col += dir; row += 1; }
    }
  }
  return pos;
}

// Родители — ближайшие уже пройденные узлы. Именно отсюда берутся развилки:
// узел, рядом с которым оказались два ранних соседа, получает две линии.
function parents(order, pos) {
  const out = {};
  order.forEach((id, i) => {
    if (i === 0) return;
    const me = pos[id];
    const near = order.slice(0, i)
      .map((pid) => ({ pid, d: Math.hypot(pos[pid].x - me.x, pos[pid].y - me.y) }))
      .filter((e) => e.d <= LINK)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_PARENTS);
    out[id] = near.map((e) => e.pid);
  });
  return out;
}

const pos = layout();
const order = [];
for (const sec of SECTORS) for (const id of sec.levels) order.push(id);
const par = parents(order, pos);

// --- проверки, без которых записывать нельзя ------------------------------
const problems = [];
for (let i = 0; i < order.length; i++) {
  for (let j = i + 1; j < order.length; j++) {
    const a = pos[order[i]], b = pos[order[j]];
    if (Math.abs(a.x - b.x) < 178 && Math.abs(a.y - b.y) < 124) {
      problems.push('карточки налезают: ' + order[i] + ' и ' + order[j]);
    }
  }
}
for (const id of order) {
  const spec = LevelRegistry.byId(id);
  if (!spec) { problems.push('нет уровня ' + id); continue; }
  if (spec.map && spec.map.start) continue;
  if (spec.map && spec.map.needs) continue;
  if (!par[id] || !par[id].length) problems.push('некому открыть узел ' + id + ': нет соседа ближе ' + LINK);
}

const xs = order.map((id) => pos[id].x), ys = order.map((id) => pos[id].y);
console.log('узлов: ' + order.length
  + ', поле ' + (Math.max.apply(null, xs) - Math.min.apply(null, xs))
  + ' x ' + (Math.max.apply(null, ys) - Math.min.apply(null, ys)));
const links = order.reduce((n, id) => n + ((par[id] || []).length), 0);
const forks = order.filter((id) => (par[id] || []).length > 1).length;
console.log('связей: ' + links + ', узлов с несколькими подводящими линиями: ' + forks);
if (problems.length) {
  console.log('\nПРОБЛЕМЫ:');
  for (const p of problems) console.log('  · ' + p);
}

// --- запись ---------------------------------------------------------------
if (process.argv.indexOf('--write') >= 0 && !problems.length) {
  const dir = path.join(__dirname, '..', 'js', 'levels');
  let touched = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /^l\d\d/.test(x))) {
    const file = path.join(dir, f);
    let src = fs.readFileSync(file, 'utf8');
    const m = src.match(/id:\s*'([a-z_0-9]+)',\s*\n\s*index:/);
    if (!m) continue;
    const id = m[1];
    if (!pos[id]) continue;
    // Править можно ТОЛЬКО внутри блока `map: { ... }`. И `pos:`, и `from:`
    // встречаются в файле уровня ещё в двух местах — у деталей на плате и у
    // рядов генератора, — и замена «первого совпадения по файлу» молча
    // переставила бы деталь или переподключила ряд к другой шине.
    const at = src.indexOf('map: {');
    if (at < 0) { console.log('у ' + id + ' нет блока map'); continue; }
    let depth = 0, end = at;
    for (let k = src.indexOf('{', at); k < src.length; k++) {
      if (src[k] === '{') depth += 1;
      else if (src[k] === '}') { depth -= 1; if (depth === 0) { end = k + 1; break; } }
    }
    const before = src;
    let block = src.slice(at, end);
    block = block.replace(/pos:\s*vec\(-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\)/,
      'pos: vec(' + Math.round(pos[id].x) + ', ' + Math.round(pos[id].y) + ')');
    const ps = par[id] || [];
    if (ps.length && /from:\s*(\[[^\]]*\]|'[a-z_0-9]+')/.test(block)) {
      const val = ps.length === 1 ? "'" + ps[0] + "'" : '[' + ps.map((x) => "'" + x + "'").join(', ') + ']';
      block = block.replace(/from:\s*(\[[^\]]*\]|'[a-z_0-9]+')/, 'from: ' + val);
    }
    src = src.slice(0, at) + block + src.slice(end);
    if (src !== before) { fs.writeFileSync(file, src); touched += 1; }
  }
  console.log('\nзаписано файлов: ' + touched);
} else if (problems.length) {
  console.log('\nничего не записано: сначала надо поправить раскладку');
}
