'use strict';
// Жест двумя пальцами (щипок и сдвиг) для сцен, которые раньше понимали
// только мышь. Мышь здесь не отслеживается вовсе — у неё есть колесо.
//
// Правило, которое нельзя нарушать: как только жест начался, он «съедает»
// оставшиеся пальцы до тех пор, пока не оторвут ВСЕ. Иначе палец, который
// остался на экране после щипка, при отрыве сработал бы как обычный клик и
// щёлкнул бы ключом или открыл список номиналов под собой.
//
//   const pinch = createPinch({ start() {…}, change(ratio, mid, shift) {…} });
//   pinch.down(e) → true, если событие уже часть жеста (обычное действие
//                   по нажатию делать не надо);
//   pinch.move(e), pinch.up(e) — то же самое.
// `ratio` — во сколько раз пальцы разошлись с прошлого события, `mid` —
// середина между ними (clientX/clientY), `shift` — на сколько она сдвинулась.

function createPinch(handlers) {
  const pts = new Map();
  let consumed = false;
  let lastDist = 1;
  let lastMid = { x: 0, y: 0 };

  function measure() {
    const [a, b] = Array.from(pts.values());
    return {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  return {
    down(e) {
      if (e.pointerType === 'mouse') return false;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        consumed = true;
        const m = measure();
        lastDist = m.dist; lastMid = m.mid;
        if (handlers.start) handlers.start();
      }
      return consumed;
    },
    move(e) {
      if (!pts.has(e.pointerId)) return consumed;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (consumed && pts.size === 2) {
        const m = measure();
        handlers.change(m.dist / lastDist, m.mid, { x: m.mid.x - lastMid.x, y: m.mid.y - lastMid.y });
        lastDist = m.dist; lastMid = m.mid;
      }
      return consumed;
    },
    up(e) {
      const was = consumed;
      pts.delete(e.pointerId);
      if (pts.size === 0) consumed = false;
      return was;
    },
    reset() { pts.clear(); consumed = false; },
  };
}
