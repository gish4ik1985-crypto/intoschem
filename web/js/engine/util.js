'use strict';
// Мелочи, которые нужны всем: числа, вектора, цвет, формат величин.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); }
function approach(current, target, rate, dt) {
  // Экспоненциальное сближение, независимое от частоты кадров.
  return target + (current - target) * Math.exp(-rate * dt);
}

function vec(x, y) { return { x, y }; }
function addV(a, b) { return vec(a.x + b.x, a.y + b.y); }
function subV(a, b) { return vec(a.x - b.x, a.y - b.y); }
function scaleV(a, s) { return vec(a.x * s, a.y * s); }
function midV(a, b) { return vec((a.x + b.x) * 0.5, (a.y + b.y) * 0.5); }
function lenV(a) { return Math.hypot(a.x, a.y); }
function distV(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normV(a) { const l = lenV(a) || 1; return vec(a.x / l, a.y / l); }

// --- Цвет. Внутри всё в 0..1 (как Color в Godot-версии), наружу — css. ---

function rgba(r, g, b, a = 1.0) {
  return `rgba(${Math.round(clamp(r, 0, 1) * 255)}, ${Math.round(clamp(g, 0, 1) * 255)}, ${Math.round(clamp(b, 0, 1) * 255)}, ${a})`;
}
function colorToCss(c, alphaOverride) {
  const a = alphaOverride === undefined ? (c[3] === undefined ? 1.0 : c[3]) : alphaOverride;
  return rgba(c[0], c[1], c[2], a);
}
function lerpColor(c1, c2, t) {
  const a1 = c1[3] === undefined ? 1 : c1[3];
  const a2 = c2[3] === undefined ? 1 : c2[3];
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), lerp(a1, a2, t)];
}
function hex(h) {
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}
function brighten(c, k) { return [c[0] * k, c[1] * k, c[2] * k, c[3] === undefined ? 1 : c[3]]; }

// Плавная многоточечная шкала — база и для потенциала, и для накала нити.
function gradientAt(stops, ratio) {
  const t = clamp(ratio, 0, 1) * (stops.length - 1);
  const i0 = Math.floor(t);
  const i1 = Math.min(stops.length - 1, i0 + 1);
  return lerpColor(stops[i0], stops[i1], t - i0);
}

// --- Формат величин: игрок читает «4,7 кОм», а не «4700 Ом». ---
// NaN/undefined вместо числа — это «детали нет» или «показание не
// считается»: честное «—», а не «NaN В», которое выглядит как поломка
// прибора, а не как отсутствие детали.

function isBadNum(v) { return v === undefined || v === null || (typeof v === 'number' && !isFinite(v)); }

function fmtOhms(ohms) {
  if (isBadNum(ohms)) return '—';
  if (ohms >= 1e6) return `${trimNum(ohms / 1e6)} МОм`;
  if (ohms >= 1000) return `${trimNum(ohms / 1000)} кОм`;
  return `${trimNum(ohms)} Ом`;
}
function fmtVolts(v) {
  if (isBadNum(v)) return '—';
  const a = Math.abs(v);
  if (a < 0.995) return `${trimNum(v * 1000, 0)} мВ`;
  return `${trimNum(v, 2)} В`;
}
function fmtAmps(a) {
  if (isBadNum(a)) return '—';
  const m = Math.abs(a);
  if (m < 1e-3) return `${trimNum(a * 1e6, 0)} мкА`;
  if (m < 1) return `${trimNum(a * 1000, m < 0.01 ? 2 : 1)} мА`;
  return `${trimNum(a, 2)} А`;
}
function fmtWatts(w) {
  if (isBadNum(w)) return '—';
  const m = Math.abs(w);
  if (m < 1e-3) return `${trimNum(w * 1e6, 0)} мкВт`;
  if (m < 1) return `${trimNum(w * 1000, m < 0.01 ? 2 : 1)} мВт`;
  return `${trimNum(w, 2)} Вт`;
}
function fmtFarads(f) {
  if (isBadNum(f)) return '—';
  if (f >= 1e-6) return `${trimNum(f * 1e6, 0)} мкФ`;
  return `${trimNum(f * 1e9, 0)} нФ`;
}
function fmtSeconds(s) { return isBadNum(s) ? '—' : `${trimNum(s, 2)} с`; }

// Убирает хвостовые нули: 4.70 -> «4,7», 100.0 -> «100». Запятая — как в
// русских номиналах на корпусах деталей.
function trimNum(v, digits = 2) {
  let s = v.toFixed(digits);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}
