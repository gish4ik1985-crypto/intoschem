'use strict';
// Честность блоков (композиция узлов, см. BLOCKS.md). Правило то же, что
// у решателя: «сходится» не значит «верно» (CLAUDE.md, «Баг в ядре, который
// спит годами») — блок визуально один прямоугольник, но внутри решателя
// обязан быть ровно той же разборкой на настоящие детали, что и ручная
// сборка, ни на каплю приближённой. Плюс — жизненный цикл разблокировки:
// блок не должен быть виден, пока уровень-донор не пройден.

const {
  Circuit, addSupply, BlockRegistry, Blocks, LevelRegistry, GameConfig,
} = require('./_harness.js');
const { makeSuite } = require('./_assert.js');

module.exports = function run() {
  const t = makeSuite('Блоки');

  t.group('Делитель-блок честен против ручной сборки резисторов');
  {
    // Несколько разных внешних условий, не один снимок — тот же приём, что
    // и у проверки направления тока: один кадр слишком мало доверия.
    const cases = [
      { rSrc: 1.7, rLoad: 2200 },
      { rSrc: 0.4, rLoad: 10000 },
      { rSrc: 1.7, rLoad: 47 },
    ];
    for (const cs of cases) {
      const label = 'rИст=' + cs.rSrc + ', rНагр=' + cs.rLoad;

      const manual = new Circuit();
      addSupply(manual, 'VCC', 'GND', 9.0, 'V1', cs.rSrc);
      manual.addResistor('VCC', 'OUT', 150, 'R1');
      manual.addResistor('OUT', 'GND', 100, 'R2');
      manual.addResistor('OUT', 'GND', cs.rLoad, 'LOAD');
      manual.setTimestep(1 / 120);
      let solManual;
      for (let n = 0; n < 60; n++) solManual = manual.step(1 / 120);

      // Тот же граф, но через Blocks.instantiate — реальную функцию,
      // которую зовёт rebuildFreeform в level.js, а не пересчёт формулы
      // рядом (см. историю с wireReverse/_flowdir.js в CLAUDE.md: тест,
      // который зовёт СВОЮ копию логики, может быть зелёным, пока код
      // врёт).
      const viaBlock = new Circuit();
      addSupply(viaBlock, 'VCC', 'GND', 9.0, 'V1', cs.rSrc);
      const part = { id: 'BLK', blockId: 'divider_block', blockNets: { plus: 'VCC', minus: 'GND', out: 'OUT' } };
      Blocks.instantiate(viaBlock, part);
      viaBlock.addResistor('OUT', 'GND', cs.rLoad, 'LOAD');
      viaBlock.setTimestep(1 / 120);
      let solBlock;
      for (let n = 0; n < 60; n++) solBlock = viaBlock.step(1 / 120);

      t.near('напряжение OUT совпадает (' + label + ')',
        solBlock.nodeVoltage.OUT, solManual.nodeVoltage.OUT, 1e-6);
      t.near('ток нагрузки совпадает (' + label + ')',
        Math.abs(solBlock.componentCurrent.LOAD), Math.abs(solManual.componentCurrent.LOAD), 1e-9);
    }
  }

  t.group('Два экземпляра одного блока на одной плате не сталкиваются в решателе');
  {
    // Namespacing внутренних имён (part.id + ':' + name, см. blocks.js) —
    // главный риск композиции: если бы оба экземпляра завели резистор с
    // именем 'R1', решатель бы электрически не соврал (стамп идёт по
    // узлам, не по имени), но componentCurrent затёр бы один результат
    // другим, и показания на плате стали бы врать молча. Поэтому здесь
    // проверяются оба компонента по отдельности, не только итоговое OUT.
    const c = new Circuit();
    addSupply(c, 'VCC', 'GND', 9.0, 'V1', 0.4);
    const part1 = { id: 'BLK1', blockId: 'divider_block', blockNets: { plus: 'VCC', minus: 'GND', out: 'OUT1' } };
    const part2 = { id: 'BLK2', blockId: 'divider_block', blockNets: { plus: 'VCC', minus: 'GND', out: 'OUT2' } };
    Blocks.instantiate(c, part1);
    Blocks.instantiate(c, part2);
    // Разные нагрузки нарочно: если бы блоки делили внутренний узел,
    // разница нагрузок «протекла» бы из одного выхода в другой.
    c.addResistor('OUT1', 'GND', 2200, 'LOAD1');
    c.addResistor('OUT2', 'GND', 47, 'LOAD2');
    c.setTimestep(1 / 120);
    let sol;
    for (let n = 0; n < 60; n++) sol = c.step(1 / 120);

    t.ok('R1 обоих экземпляров существуют в решателе раздельно',
      sol.componentCurrent['BLK1:R1'] !== undefined && sol.componentCurrent['BLK2:R1'] !== undefined);
    t.ok('токи через одноимённые внутренние R1 не совпадают (разные нагрузки)',
      Math.abs(sol.componentCurrent['BLK1:R1'] - sol.componentCurrent['BLK2:R1']) > 1e-6);
    t.ok('лёгкая нагрузка (2,2 кОм) держит выход выше тяжёлой (47 Ом)',
      sol.nodeVoltage.OUT1 > sol.nodeVoltage.OUT2);
  }

  t.group('Блок в реальном Верстаке — mount/update/render не падают');
  {
    // Не пересборка формулы, а прогон через настоящий движок свободной
    // сборки: finalizePart → rebuildFreeform → Blocks.instantiate →
    // measureParts → render. Состояние GameConfig трогаем и обязательно
    // чистим за собой — этот модуль кэшируется require() один раз на весь
    // прогон web/tests/run.js, и другие наборы делят с ним ту же память.
    const savedWorkbenchState = GameConfig.getLevelState('workbench');
    GameConfig.setLevelState('workbench', {
      parts: [
        { id: 'BAT', kind: 'krona', pos: { x: 0, y: 0 }, value: 9.0, rInt: 1.7 },
        { id: 'BLK', kind: 'block', pos: { x: 200, y: 0 }, blockId: 'divider_block' },
        { id: 'LOAD', kind: 'resistor', pos: { x: 400, y: 0 }, value: 2200 },
      ],
      wires: [
        { id: 'w1', a: { p: 'BAT', t: 'b' }, b: { p: 'BLK', t: 'plus' } },
        { id: 'w2', a: { p: 'BAT', t: 'a' }, b: { p: 'BLK', t: 'minus' } },
        { id: 'w3', a: { p: 'BLK', t: 'out' }, b: { p: 'LOAD', t: 'a' } },
        { id: 'w4', a: { p: 'LOAD', t: 'b' }, b: { p: 'BAT', t: 'a' } },
      ],
      nextId: 3,
    });

    const stub = new Proxy(function () {}, {
      get(_t, k) { return k === Symbol.toPrimitive ? () => '' : stub; },
      set() { return true; },
      apply() { return stub; },
    });

    let threw = null;
    try {
      const scene = LevelRegistry.byId('workbench').scene;
      scene.mount();
      for (let i = 0; i < 60; i++) scene.update(1 / 60);
      scene.render(stub);
    } catch (e) { threw = e; }

    t.ok('mount + 60×update + render не бросили исключение', !threw, threw && threw.stack);

    GameConfig.setLevelState('workbench', savedWorkbenchState);
  }

  t.group('Разблокировка: блок закрыт, пока уровень-донор не пройден');
  {
    const savedUnlocked = GameConfig.unlockedBlocks.slice();
    const savedDividerState = GameConfig.getLevelState('divider');
    GameConfig.unlockedBlocks = [];

    const wbPalette = () => LevelRegistry.byId('workbench').sandbox.palette();

    t.ok('divider_block закрыт при пустом прогрессе',
      !wbPalette().some((p) => p.kind === 'divider_block'));

    const spec = LevelRegistry.byId('divider');
    // Номиналы — из lesson/hints самого уровня (отношение 3:2), см. BLOCKS.md.
    GameConfig.setLevelState('divider', {
      R1: { content: { kind: 'resistor', value: 150 } },
      R2: { content: { kind: 'resistor', value: 100 } },
    });
    spec.scene.mount();
    for (let n = 0; n < spec.hold * 60 + 30; n++) spec.scene.update(1 / 60);

    t.ok('прохождение divider открывает divider_block', GameConfig.hasBlock('divider_block'));
    t.ok('блок появляется в палитре Верстака после разблокировки',
      wbPalette().some((p) => p.kind === 'divider_block'));

    GameConfig.unlockedBlocks = savedUnlocked;
    GameConfig.setLevelState('divider', savedDividerState);
  }

  return t.result();
};
