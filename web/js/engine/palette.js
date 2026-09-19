'use strict';
// Палитра. Единственный источник цвета на весь проект — иначе каждый
// уровень заводит свои «почти такие же» оттенки и картинка расползается.
// База — шкала потенциала из визуального языка проекта.

const Pal = {
  // Шкала потенциала: холодное = близко к земле, горячее = высокое напряжение.
  POTENTIAL: [hex(0x182a5c), hex(0x1a7fa8), hex(0x2fd4c8), hex(0xffd166), hex(0xff5b3d)],

  // Накал металла от рассеиваемой мощности: мёртвый металл → вишнёвый →
  // оранжевый → белый. Отдельная шкала от потенциала: это разная физика.
  HEAT: [hex(0x2a2a2e), hex(0x5c1e12), hex(0xc23b12), hex(0xff9a3c), hex(0xfff2d0)],

  BG_DEEP: hex(0x07080b),
  BOARD: hex(0x101419),
  BOARD_EDGE: hex(0x1d252d),
  SILK: hex(0x8f9aa6),
  COPPER: hex(0x453424),
  COPPER_LIT: hex(0xd9a05b),
  PAD: hex(0xb99154),

  ACCENT: hex(0x2fd4c8),
  ACCENT_DIM: hex(0x1a7fa8),
  WARN: hex(0xffd166),
  DANGER: hex(0xff5b3d),
  TEXT: hex(0xd9e6f2),
  TEXT_DIM: hex(0x8c99ad),

  LAMP_GLOW: hex(0xffc46b),
};

function potentialColor(ratio) { return gradientAt(Pal.POTENTIAL, ratio); }
function heatColor(ratio) { return gradientAt(Pal.HEAT, ratio); }
