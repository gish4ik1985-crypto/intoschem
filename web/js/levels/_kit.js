'use strict';
// Общий набор деталей. Один на всю игру: игрок не «открывает новые
// номиналы» — у него всегда один и тот же ящик, а меняются требования
// приборов. Ряд — стандартный E12, тот же, что лежит в реальном ящике.

const RESISTOR_KIT = [10, 22, 33, 47, 68, 100, 150, 220, 470, 1000, 2200, 4700];
const CAP_KIT = [100e-6, 220e-6, 470e-6, 1000e-6, 2200e-6, 4700e-6];

function resistorOptions(kit = RESISTOR_KIT) {
  return kit.map((r) => ({ label: fmtOhms(r), content: { kind: 'resistor', value: r } }));
}

// Гнездо: пусто / перемычка / любой резистор из ящика. Пункт «оставить
// пустым» нужен именно как выбор — разомкнутая цепь это тоже решение,
// просто неправильное, и игрок должен иметь возможность его вернуть.
function socketOptions(opts = {}) {
  const list = [];
  if (opts.empty !== false) list.push({ label: 'пусто', note: 'разомкнуть', content: null });
  if (opts.jumper !== false) list.push({ label: 'перемычка', note: 'голый провод', content: { kind: 'jumper' } });
  return list.concat(resistorOptions(opts.kit || RESISTOR_KIT));
}

// Сопротивление того, что вставлено в гнездо: пусто — разрыв, перемычка —
// почти ноль, резистор — свой номинал.
function socketOhms(part) {
  if (!part.content) return 1e9;
  if (part.content.kind === 'jumper') return 1e-3;
  return part.content.value;
}

function socketLabel(part) {
  if (!part.content) return '';
  if (part.content.kind === 'jumper') return 'перемычка';
  if (part.content.kind === 'diode') return part.content.flipped ? 'диод ◄' : 'диод ►';
  if (part.content.kind === 'led') return part.content.flipped ? 'светодиод ◄' : 'светодиод ►';
  return fmtOhms(part.content.value);
}

// Гнездо под направленную деталь: два одинаковых диода, отличающихся только
// стороной. Полоска катода на корпусе — единственное, чем они различаются и
// в жизни, поэтому подпись говорит про сторону, а не про номинал.
function diodeOptions(opts = {}) {
  const list = [];
  if (opts.empty !== false) list.push({ label: 'пусто', note: 'разомкнуть', content: null });
  if (opts.jumper) list.push({ label: 'перемычка', note: 'голый провод', content: { kind: 'jumper' } });
  list.push({ label: 'диод ►', note: 'полоской вправо', content: { kind: 'diode', flipped: false } });
  list.push({ label: 'диод ◄', note: 'полоской влево', content: { kind: 'diode', flipped: true } });
  return list;
}
