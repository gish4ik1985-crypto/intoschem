'use strict';
// Решатель, который реально крутится в игре. Раньше тесты были только у
// Godot-сборки, которая не запускается, — а правка в circuit.js не роняла
// ничего. Правило проекта: «сходится» не значит «верно», поэтому нелинейные
// компоненты проверяются во ВСЕХ режимах, а не только в рабочем.

const { Circuit } = require('./_harness.js');
const { makeSuite } = require('./_assert.js');

module.exports = function run() {
  const t = makeSuite('Решатель');

  t.group('Линейные цепи');
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 10, 'V');
    c.addResistor('A', 'B', 1000); c.addResistor('B', 'GND', 1000);
    t.near('делитель пополам', c.solve().nodeVoltage.B, 5, 1e-6);
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 12, 'V');
    c.addResistor('A', 'B', 100, 'R1'); c.addResistor('B', 'GND', 200, 'R2');
    t.near('последовательно: ток общий', Math.abs(c.solve().componentCurrent.R1), 12 / 300, 1e-8);
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 6, 'V');
    c.addResistor('A', 'GND', 100, 'R1'); c.addResistor('A', 'GND', 300, 'R2');
    t.near('параллельно: токи складываются', Math.abs(c.solve().componentCurrent.V), 6 / 100 + 6 / 300, 1e-8);
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 9, 'V');
    c.addSwitch('A', 'B', false, 'S'); c.addResistor('B', 'GND', 100, 'R');
    t.ok('разомкнутый ключ не пропускает ток', Math.abs(c.solve().componentCurrent.R) < 1e-7);
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 5, 'V');
    c.addResistor('A', 'B', 100); c.addResistor('C', 'D', 100);
    const s = c.solve();
    t.ok('плавающий узел не роняет матрицу (gmin)', s.ok);
    t.near('на плавающем узле ноль', s.nodeVoltage.C, 0, 1e-6);
  }

  t.group('Реактивные компоненты против аналитики');
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 10, 'V');
    c.addResistor('A', 'B', 1000, 'R'); c.addCapacitor('B', 'GND', 1e-6, 'C');
    const dt = 1e-6; let v = 0;
    for (let n = 0; n < 1000; n++) v = c.step(dt).nodeVoltage.B;
    t.near('заряд RC за одну постоянную времени', v, 10 * (1 - Math.exp(-1)), 0.05);
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 10, 'V');
    c.addResistor('A', 'B', 10, 'R'); c.addInductor('B', 'GND', 0.01, 'L');
    const dt = 1e-6; let i = 0;
    for (let n = 0; n < 1000; n++) i = c.step(dt).componentCurrent.L;
    t.near('нарастание тока в RL за одну постоянную', i, 1 - Math.exp(-1), 0.02);
  }

  t.group('Диод — оба направления');
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', 5, 'V');
    c.addResistor('A', 'B', 1000, 'R'); c.addDiode('B', 'GND', 'D');
    const vd = c.solve().nodeVoltage.B;
    const ir = (5 - vd) / 1000;
    const id = 1e-12 * (Math.exp(vd / 0.02585) - 1);
    t.near('ток резистора равен току диода', ir, id, 1e-9);
    t.ok('прямое падение в разумных пределах', vd > 0.4 && vd < 0.8, 'получено ' + vd.toFixed(4) + ' В');
  }
  {
    const c = new Circuit();
    c.addVoltageSource('A', 'GND', -5, 'V');
    c.addResistor('A', 'B', 1000, 'R'); c.addDiode('B', 'GND', 'D');
    t.ok('обратно ток почти нулевой', Math.abs(c.solve().componentCurrent.D) < 1e-11);
  }

  t.group('Транзистор — закрыт, активный, насыщение');
  const npn = (rb) => {
    const c = new Circuit();
    c.addVoltageSource('VCC', 'GND', 12, 'V');
    c.addResistor('VCC', 'B', rb, 'RB');
    c.addResistor('VCC', 'C', 1000, 'RC');
    c.addTransistor('B', 'C', 'GND', 'Q');
    return c.solve();
  };
  {
    const s = npn(470000);
    const beta = Math.abs(s.componentCurrent.RC) / Math.abs(s.componentCurrent.RB);
    t.near('в активном режиме усиление равно BF', beta, 100, 0.5);
    t.ok('коллектор внутри питания', s.nodeVoltage.C > 0 && s.nodeVoltage.C < 12);
  }
  {
    const s = npn(10000);
    t.ok('в насыщении коллектор садится почти на землю', s.nodeVoltage.C < 0.4,
      'получено ' + s.nodeVoltage.C.toFixed(4) + ' В');
    t.ok('и не проваливается ниже земли', s.nodeVoltage.C > -1e-6);
  }
  {
    // Развёртка по управляющему параметру: ни один узел пассивной цепи не
    // может оказаться выше плюса источника или ниже земли. Именно эта
    // проверка ловит развёрнутый эквивалентный источник перехода.
    let bad = 0;
    for (let rb = 1000; rb <= 1e6; rb *= 1.3) {
      const s = npn(rb);
      for (const k of Object.keys(s.nodeVoltage)) {
        const v = s.nodeVoltage[k];
        if (!isFinite(v) || v < -1e-4 || v > 12.0001) bad += 1;
      }
    }
    t.ok('развёртка по базе: узлы не выходят за питание', bad === 0, bad + ' нарушений');
  }

  return t.result();
};
