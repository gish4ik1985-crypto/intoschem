'use strict';
// Уровень 17 · Верстак.
// Единственный уровень без готовой платы. Тут не чинят чужую разводку —
// ставят детали из палитры на пустое место и сами тянут провода между
// выводами. Задача та же, что в самом первом задании (светодиод 15–26 мА),
// но теперь всю схему, включая источник, собирает игрок, а не автор уровня.

const Level17 = createLevel(LevelRegistry.register({
  id: 'workbench',
  index: 31,
  title: 'Верстак',
  teaches: 'вся схема целиком',
  silk: 'BENCH-17',
  diag: 'МОНТАЖ · Плата пуста, участок ждёт полной сборки с нуля.',
  brief: 'Пустая плата и ящик деталей. Собери сам: батарея, резистор, светодиод.',
  lesson: 'Готовая плата не нужна: резистор и провода работают одинаково, где их ни поставь. Ты собрал схему сам.',
  hints: [
    'Возьми батарею из палитры слева, поставь на плату. Потом резистор и светодиод — рядом. Промахнулся или поставил криво — просто возьми деталь мышью и перетащи, куда нужно.',
    'Кнопка «Провод»: кликни по одному выводу, потом по другому — между ними ляжет дорожка. Собери замкнутый круг: от плюса батареи через резистор и светодиод обратно на минус.',
    'Светодиод сгорает без резистора. Начни с большого резистора и уменьшай, пока светит тускло.',
  ],
  codex: ['ohm', 'circuit', 'resistor', 'led', 'battery', 'wire'],
  vmax: 9.0,
  hold: 2.0,
  scale: 1.05,
  // Плата в 10 раз больше по площади, чем на остальных 16 уровнях
  // (740×370 → 2340×1170: линейный множитель sqrt(10), а не 10 на
  // каждую сторону — иначе доска перестала бы целиком помещаться в
  // экран даже на минимальном зуме). Проверено арифметикой: на ZOOM_MIN
  // (0.5, см. level.js) effScale = 1.05*0.5 = 0.525, видимая область —
  // 1600/0.525×900/0.525 ≈ 3048×1714 игровых единиц, что покрывает новую
  // плату целиком (2340×1170) без обрезки. Никакие другие константы
  // движка (ZOOM_MIN/MAX, панорама платы) от размера не зависят и правки
  // не требуют — панорама внутри уровня всегда была безграничной.
  board: { x: -1170, y: -585, w: 2340, h: 1170 },
  map: { pos: vec(-967, -135), radius: 900, color: hex(0xffe08a), needs: ['garland'], icon: { kind: 'resistor', value: 220 } },
  goalText: 'Собери цепь, чтобы светодиод горел ровно и не сгорел.',
  scope: { label: 'Ток через светодиод', get: (m) => m.bestI, min: 0, max: 0.045, band: [0.015, 0.026], fmt: fmtAmps },

  freeform: true,
  parts: [],
  wires: [],

  sandbox: {
    // Функция, не массив: список открытых блоков известен только на входе
    // на уровень (GameConfig.hasBlock), не на момент разбора файла. Кнопка
    // блока в палитре ставит placeKind = id блока (не 'block' — иначе
    // make() не знал бы, КАКОЙ блок ставить), а make() ниже разворачивает
    // его в настоящую деталь kind:'block' с нужным blockId.
    palette: () => [
      { kind: 'krona', label: 'Батарея 9 В' },
      { kind: 'resistor', label: 'Резистор' },
      { kind: 'led', label: 'Светодиод' },
      { kind: 'lamp', label: 'Лампа' },
      { kind: 'toggle', label: 'Ключ' },
      { kind: 'diode', label: 'Диод' },
      { kind: 'capacitor', label: 'Конденсатор' },
      { kind: 'motor', label: 'Мотор' },
      { kind: 'ground', label: 'Земля' },
    ].concat(BlockRegistry.list
      .filter((b) => GameConfig.hasBlock(b.id))
      .map((b) => ({ kind: b.id, label: b.title }))),

    // Свежая деталь из палитры: только то, что специфично для вида —
    // номинал, тепловая модель, как её крутить/переключать. Каркас сам
    // допишет id, kind, pos и электрические сети (level.js, finalizePart).
    make(kind) {
      const block = BlockRegistry.byId(kind);
      if (block) return { kind: 'block', blockId: block.id, silk: block.silk, name: block.title };
      switch (kind) {
        case 'krona':
          return {
            name: 'Батарея 9 В', silk: 'BAT', label: '9 В',
            value: 9.0, rInt: SUPPLY_R.KRONA,
          };
        case 'resistor':
          return {
            name: 'Резистор', silk: 'R', value: 220, showValue: true,
            rated: { pMax: 1.0, tau: 1.0 },
            interact: {
              type: 'pick', title: 'Номинал резистора', hint: 'Нажми, чтобы сменить номинал',
              // Не socketOptions()/resistorOptions(): те кладут номинал в
              // opt.content (для гнезда), а у самостоятельной детали
              // значение лежит прямо в part.value.
              options: () => RESISTOR_KIT.map((r) => ({ label: fmtOhms(r), value: r })),
            },
          };
        case 'led':
          return {
            name: 'Светодиод', silk: 'VD', color: hex(0xff4a2c), vf: 1.8,
            rated: { pNom: 0.036, pMax: 0.075, iNom: 0.02, tau: 0.45 },
          };
        case 'lamp':
          return {
            name: 'Лампа', silk: 'HL', value: 30, showValue: true,
            rated: { pNom: 1.3, pMax: 2.2, tau: 0.9 },
          };
        case 'toggle':
          return {
            name: 'Ключ', silk: 'SW', closed: false,
            interact: { type: 'toggle', hint: 'Нажми, чтобы замкнуть или разомкнуть' },
          };
        case 'diode':
          return { name: 'Диод', silk: 'VD' };
        case 'capacitor':
          return {
            name: 'Конденсатор', silk: 'C', value: 1000e-6, vMax: 16,
            showValue: true, valueText: (p) => fmtFarads(p.value),
          };
        case 'motor':
          return {
            name: 'Мотор', silk: 'M', value: 47, showValue: true,
            rated: { iNom: 0.064, pMax: 1.2, tau: 0.8 },
          };
        case 'ground':
          return { name: 'Земля', noPads: true };
        default:
          return {};
      }
    },

    // Как деталь превращается в компонент решателя. a/b — уже готовые
    // имена сетей её собственных выводов (см. netNameFor в level.js).
    add(circuit, a, b, part) {
      switch (part.kind) {
        case 'resistor': return circuit.addResistor(a, b, part.value, part.comp);
        case 'lamp': return addLamp(circuit, a, b, part.value, part.comp);
        case 'motor': return addMotor(circuit, a, b, part.value, part.comp);
        case 'led': return addLed(circuit, a, b, part.comp, part.vf || 1.8);
        case 'diode': return circuit.addDiode(a, b, part.comp);
        case 'capacitor': return circuit.addCapacitor(a, b, part.value, part.comp);
        case 'toggle': return circuit.addSwitch(a, b, part.closed, part.comp);
        // krona: a = минус, b = плюс (см. Parts.krona.terminals) — addSupply
        // хочет (плюс, минус).
        case 'krona': return addSupply(circuit, b, a, part.value, part.comp, part.rInt);
        default: return null;
      }
    },
  },

  read(sol, refs, P) {
    let bestI = 0, ledCount = 0, anyBurnt = false;
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind !== 'led') continue;
      ledCount += 1;
      if (part.burnt) anyBurnt = true;
      bestI = Math.max(bestI, Math.abs(part.i || 0));
    }
    return { bestI, ledCount, anyBurnt, total: Object.keys(P).length };
  },

  status(m) {
    if (m.total === 0) return ['Плата пуста. Возьми деталь из палитры слева и поставь на плату.', 'neutral'];
    if (m.ledCount === 0) return ['Схема есть, а светодиода в ней нет — цели без него не достичь.', 'neutral'];
    if (m.anyBurnt) return ['Светодиод сгорел: ток был слишком большой. Замени его и ограничь ток резистором посерьёзнее.', 'bad'];
    if (m.bestI > 0.026) return ['Горит, но ток выше нормы — светодиод греется. Сопротивление резистора маловато.', 'warn'];
    if (m.bestI < 0.001) return ['Тока почти нет. Цепь разомкнута или резистор слишком большой.', 'warn'];
    if (m.bestI < 0.015) return ['Горит тускло. Сопротивление резистора многовато.', 'warn'];
    return ['Горит ровно. Схема собрана верно.', 'good'];
  },

  goal(m) {
    if (m.anyBurnt) return { ok: false, note: 'Светодиод сгорел — замени и собери цепь заново.' };
    if (!m.ledCount) return { ok: false, note: 'В схеме нет светодиода.' };
    return {
      ok: m.bestI >= 0.015 && m.bestI <= 0.026,
      note: 'Ток через светодиод ' + fmtAmps(m.bestI) + ', нужно 15–26 мА.',
    };
  },

  score(m) { return m.anyBurnt ? 0 : clamp(m.bestI / 0.02, 0, 1); },
  scoreNote(m) { return 'Ток через светодиод ' + fmtAmps(m.bestI) + ' · деталей на плате ' + m.total; },

  meter(m) {
    return [
      ['Деталей на плате', String(m.total)],
      ['Светодиодов в схеме', String(m.ledCount)],
      ['Ток через светодиод', m.ledCount ? fmtAmps(m.bestI) : '—',
        m.bestI >= 0.015 && m.bestI <= 0.026 ? 'good' : (m.ledCount ? 'warn' : '')],
    ];
  },
}));
