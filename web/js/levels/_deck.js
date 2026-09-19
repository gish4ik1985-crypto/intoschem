'use strict';
// Общее для узлов, собранных на рельсовой плате (Rig). Держим здесь, чтобы в
// каждом уровне оставалось только то, чем он отличается от остальных.

// Три размера платы. Больше рядов — больше плата и мельче масштаб; авторский
// масштаб подобран так, чтобы плата вместе с самописцем помещалась на экран.
const DB = {
  s: { board: { x: -310, y: -130, w: 620, h: 260 }, scale: 1.30 },
  m: { board: { x: -330, y: -152, w: 660, h: 304 }, scale: 1.20 },
  l: { board: { x: -340, y: -168, w: 680, h: 336 }, scale: 1.10 },
  xl: { board: { x: -340, y: -186, w: 680, h: 372 }, scale: 1.04 },
};

// Попадание в коридор вокруг цели. Доля, а не абсолютные вольты: у номиналов
// из ящика разброс тоже относительный.
function inPct(value, target, pct) {
  return Math.abs(value - target) <= Math.abs(target) * pct;
}

// Отдача узла: 1 в самом центре коридора, 0 — на удвоенной ширине от него.
// Из этого числа берётся радиус света на карте, поэтому оно обязано быть
// заметно больше нуля уже при минимальном ЗАЧТЁННОМ результате.
function bandScore(value, target, pct) {
  const off = Math.abs(value - target) / (Math.abs(target) * pct || 1e-9);
  return clamp(1 - off * 0.45, 0, 1);
}

// Гнездо под резистор из ящика. `kit` сужает ящик, если в уровне важно, чтобы
// перебор был обозримым.
function deckSocket(id, name, opts = {}) {
  return {
    id, kind: 'socket', name, silk: opts.silk || id,
    showValue: true, valueText: socketLabel,
    content: opts.content === undefined ? null : opts.content,
    rated: opts.rated || { pMax: 2.0, tau: 1.0 },
    interact: {
      type: 'pick',
      title: opts.title || name,
      hint: 'Нажми, чтобы выбрать номинал',
      options: () => socketOptions({ empty: opts.empty !== false, jumper: !!opts.jumper, kit: opts.kit }),
    },
  };
}

function deckToggle(id, name, closed, hint) {
  return {
    id, kind: 'toggle', name, silk: opts_silk(id), closed: !!closed,
    interact: { type: 'toggle', hint: hint || 'Нажми, чтобы замкнуть или разомкнуть' },
  };
}
function opts_silk(id) { return id; }

// Строка приборов «величина против цели»: одинаково выглядит во всех узлах,
// поэтому игрок читает её не задумываясь.
function deckRow(label, value, ok) { return [label, value, ok ? 'good' : 'warn']; }

// --- Неучтённый ток -------------------------------------------------------
// Тайна, которую нельзя прочитать: её можно только измерить.
//
// На шести платах из шины уходит немного больше тока, чем берут все ветки
// вместе. Разница маленькая, постоянная и честная: это настоящий резистор,
// припаянный к шине и уходящий куда-то мимо схемы. Ни на одной схеме его нет,
// ни в одном списке деталей он не значится, приборы его видят.
//
// Каждая такая находка — не строчка текста, а число, которое игрок снимает
// сам. Из шести чисел собирается шестой ключ к узлу, которого нет на карте
// (см. `x_logger`): там эти шесть токов надо воспроизвести обратно.
const SECRET_TAPS = [
  { id: 't_ohm', ohms: 4700, tap: 1 },
  { id: 't_bus', ohms: 2200, tap: 2 },
  { id: 'e_listen', ohms: 1000, tap: 3 },
  { id: 'e_leak', ohms: 470, tap: 4 },
  { id: 'e_charge', ohms: 220, tap: 5 },
  { id: 'e_budget', ohms: 150, tap: 6 },
];

function secretTapOf(id) {
  for (const t of SECRET_TAPS) if (t.id === id) return t;
  return null;
}

// Отвод добавляется прямо в цепь уровня — это не украшение и не подсказка,
// а компонент, который реально тянет ток и реально просаживает шину.
function addSecretTap(c, id, from, to) {
  const t = secretTapOf(id);
  if (t) c.addResistor(from || 'VCC', to || 'GND', t.ohms, 'TAP');
  return t;
}

// Строка приборов про него — одна и та же во всех шести узлах, чтобы игрок
// узнал её с первого взгляда, встретив второй раз.
function tapRow(leak) {
  return ['Ток мимо схемы', leak > 1e-5 ? fmtAmps(leak) : '—', leak > 1e-5 ? 'warn' : ''];
}
