'use strict';
// Загружает всю веб-сборку в node без браузера: тот же порядок файлов, что в
// index.html, заглушки вместо DOM. Нужен затем, чтобы проверки гонялись из
// командной строки, а не глазами по экрану.
//
//   node web/tests/run.js
//
// Правило проекта: провода в фиксированных уровнях декоративны, топологию
// задаёт build(). Поэтому «схема работает» ничего не говорит о том, правильно
// ли она нарисована, и наоборот — проверять надо и то, и другое.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function bundleFiles() {
  const head = [
    'js/engine/util.js', 'js/engine/palette.js', 'js/engine/draw.js', 'js/engine/board.js',
    'js/engine/parts.js', 'js/circuit.js', 'js/engine/devices.js', 'js/engine/audio.js', 'js/engine/touch.js', 'js/engine/hud.js',
    'js/engine/rig.js', 'js/engine/blocks.js', 'js/engine/water.js', 'js/engine/level.js', 'js/state.js', 'js/scenes/journal.js',
    'js/levels/_kit.js', 'js/levels/_deck.js',
  ].filter((f) => fs.existsSync(path.join(ROOT, f)));
  const levels = fs.readdirSync(path.join(ROOT, 'js/levels'))
    .filter((f) => /^l\d\d/.test(f)).sort().map((f) => 'js/levels/' + f);
  return head.concat(levels);
}

// Заглушка DOM: любое обращение возвращает саму себя, любое присваивание молча
// проходит. Уровням при разборе файла DOM не нужен — он нужен только сценам,
// которых мы не грузим.
const stub = new Proxy(function () {}, {
  get(t, k) { return k === Symbol.toPrimitive ? () => '' : stub; },
  set() { return true; },
  apply() { return stub; },
});

function load() {
  const sandbox = {
    console, Math, JSON, Date, Set, Map, WeakMap, Object, Array, String, Number, Boolean,
    RegExp, Error, Symbol, Proxy, isFinite, isNaN, parseFloat, parseInt, Infinity, NaN,
    document: {
      getElementById: () => stub, createElement: () => stub,
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: stub,
    },
    window: { addEventListener() {}, innerWidth: 1600, innerHeight: 900 },
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Каждый файл — отдельный vm.runInContext, а не один склеенный текст.
  // Разница ощутима: у let/const в браузере отдельные <script>-теги хоть и
  // делят один глобальный лексический скоуп, но связывание конкретного
  // const создаётся непосредственно перед выполнением ЕГО файла — до этого
  // момента `typeof ИмяКонстанты` у файла, загруженного раньше, честно даёт
  // 'undefined'. Склеенный в одну строку текст исполняется одним Script:
  // движок заводит ВСЕ top-level let/const срезу для всего блока (Temporal
  // Dead Zone), и тот же самый `typeof` до места объявления бросает
  // ReferenceError, хотя в браузере на этом же наборе файлов в этом же
  // порядке ошибки нет. Ровно так и поймано: audio.js (грузится раньше
  // state.js что в index.html, что здесь) сам себя защищает через
  // `typeof GameConfig !== 'undefined'` — расчёт на «ещё не выполнялся»,
  // а не на TDZ. Один склеенный скрипт эту защиту ломал ложно.
  for (const f of bundleFiles()) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^'use strict';/m, '');
    vm.runInContext(src, sandbox, { filename: f });
  }
  vm.runInContext(
    'globalThis.__EXPORT = { LevelRegistry, BlockRegistry, Blocks, Parts, Circuit, GameConfig, Rig, Journal, SECTORS,'
    + ' fixedWirePoints, wireReverse, vec, addV, subV, distV, clamp, fmtOhms, fmtAmps, fmtVolts, Pal,'
    + ' addSupply, addLed, addLamp, addMotor, SUPPLY_R, socketOhms, RESISTOR_KIT };',
    sandbox, { filename: 'export.js' },
  );
  return sandbox.__EXPORT;
}

module.exports = load();
