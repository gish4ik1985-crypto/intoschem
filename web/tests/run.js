'use strict';
// Все проверки веб-сборки одной командой:
//
//   node web/tests/run.js
//
// Замечания, которые уже записаны в AUDIT.md как задачи на правку, лежат в
// known-issues.json и не роняют прогон: иначе набор был бы красным всегда и
// новая поломка в нём потерялась бы. Как только известное замечание исчезает,
// прогон об этом говорит — строку из списка надо убрать.

const fs = require('fs');
const path = require('path');

const KNOWN_PATH = path.join(__dirname, 'known-issues.json');
const known = fs.existsSync(KNOWN_PATH) ? JSON.parse(fs.readFileSync(KNOWN_PATH, 'utf8')) : [];
const knownSet = new Set(known);
const seen = new Set();

const suites = [
  require('./solver.test.js'),
  require('./levels.test.js'),
  require('./layout.test.js'),
  require('./ground.test.js'),
  require('./_flowdir.js'),
  require('./blocks.test.js'),
  require('./kids.test.js'),
];

let pass = 0;
const fresh = [];
for (const run of suites) {
  const r = run();
  const newOnes = r.fails.filter((f) => !knownSet.has(r.title + ' · ' + f));
  console.log('\n=== ' + r.title + ': ' + r.pass + ' прошло, ' + r.fails.length + ' замечаний ('
    + (r.fails.length - newOnes.length) + ' известных)');
  pass += r.pass;
  for (const f of r.fails) {
    const key = r.title + ' · ' + f;
    seen.add(key);
    if (!knownSet.has(key)) fresh.push(key);
  }
}

const fixed = known.filter((k) => !seen.has(k));

console.log('\n' + '-'.repeat(64));
console.log('ИТОГО: ' + pass + ' прошло · ' + fresh.length + ' НОВЫХ замечаний · '
  + (known.length - fixed.length) + ' известных из AUDIT.md');
if (fresh.length) {
  console.log('\nНовое (этого раньше не было):');
  for (const f of fresh) console.log('  · ' + f);
}
if (fixed.length) {
  console.log('\nИсправлено — убрать из known-issues.json:');
  for (const f of fixed) console.log('  · ' + f);
}
process.exit(fresh.length ? 1 : 0);
