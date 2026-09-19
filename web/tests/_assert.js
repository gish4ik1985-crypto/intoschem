'use strict';
// Крошечная обвязка: считает прошедшее и упавшее, печатает по-русски.

function makeSuite(title) {
  let pass = 0;
  const fails = [];
  let group = '';
  return {
    group(name) { group = name; console.log('\n  ' + name); },
    ok(label, condition, detail) {
      if (condition) { pass += 1; return true; }
      fails.push((group ? group + ' · ' : '') + label + (detail ? ' — ' + detail : ''));
      console.log('    УПАЛО  ' + label + (detail ? ' — ' + detail : ''));
      return false;
    },
    near(label, actual, expected, tol) {
      const d = Math.abs(actual - expected);
      return this.ok(label, d <= tol, 'получено ' + actual + ', ожидалось ' + expected + ' (Δ' + d.toExponential(2) + ')');
    },
    note(text) { console.log('    · ' + text); },
    result() { return { title, pass, fails }; },
  };
}

module.exports = { makeSuite };
