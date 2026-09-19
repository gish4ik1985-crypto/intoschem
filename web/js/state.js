'use strict';
// Прогресс игрока. Хранится в localStorage.
//
// Две разные вещи, и путать их нельзя:
//   deviceOutput — НАСКОЛЬКО ХОРОШО прибор в итоге настроен (лучшее из
//     достигнутого). Из этого числа берётся радиус света на карте:
//     сделал вполсилы — открыл вдвое меньший кусок платы.
//   levelState — в каком положении игрок оставил детали. Нужно, чтобы
//     возврат на уже настроенный прибор не начинал всё заново.

const GameConfig = {
  deviceOutput: {},
  levelState: {},
  // Блоки (композиция узлов, см. BLOCKS.md) — какие уже открыты игроку.
  // Список id из BlockRegistry, не объект: блоков мало и порядок не важен.
  unlockedBlocks: [],
  seenIntro: false,
  // Режим обзора карты: показывает ВСЕ узлы, не трогая прогресс. Нужен, чтобы
  // посмотреть, сколько их и как они разложены, — а не чтобы пройти игру
  // кнопкой. Поэтому он ничего не «открывает»: названия по-прежнему скрыты,
  // журнал по-прежнему пуст, отдача узлов не меняется.
  revealAll: false,
  REPAIRED_THRESHOLD: 0.05,
  // Звук
  soundEnabled: true,
  soundVolume: 0.3,

  getDeviceOutput(deviceId) {
    const v = this.deviceOutput[deviceId];
    return clamp(v === undefined ? 0 : v, 0, 1);
  },

  isRepaired(deviceId) { return this.getDeviceOutput(deviceId) > this.REPAIRED_THRESHOLD; },

  // Запоминаем только лучшее достигнутое: сломать уже починенное
  // случайным тыком в детали нельзя.
  setDeviceOutput(deviceId, value) {
    const v = clamp(value, 0, 1);
    if (v <= this.getDeviceOutput(deviceId)) return;
    this.deviceOutput[deviceId] = v;
    this.save();
  },

  repairedCount() {
    return LevelRegistry.list.filter((s) => this.isRepaired(s.id)).length;
  },

  hasBlock(blockId) { return this.unlockedBlocks.indexOf(blockId) >= 0; },
  // Разблокировка не расходуется и не повторяется — второй вызов для уже
  // открытого блока просто ничего не делает (см. «Без экономики» в
  // BLOCKS.md: блок либо открыт, либо нет, третьего состояния не бывает).
  unlockBlock(blockId) {
    if (this.hasBlock(blockId)) return false;
    this.unlockedBlocks.push(blockId);
    this.save();
    return true;
  },

  getLevelState(deviceId) { return this.levelState[deviceId]; },
  setLevelState(deviceId, state) { this.levelState[deviceId] = state; this.save(); },

  setRevealAll(on) { this.revealAll = !!on; this.save(); },

  resetProgress() {
    this.deviceOutput = {};
    this.levelState = {};
    this.unlockedBlocks = [];
    this.seenIntro = false;
    this.revealAll = false;
    this.save();
  },

  save() {
    try {
      localStorage.setItem('into-schem-v2', JSON.stringify({
        deviceOutput: this.deviceOutput,
        levelState: this.levelState,
        unlockedBlocks: this.unlockedBlocks,
        seenIntro: this.seenIntro,
        revealAll: this.revealAll,
        soundEnabled: this.soundEnabled,
        soundVolume: this.soundVolume,
      }));
    } catch (e) { /* localStorage недоступен — прогресс просто не сохранится */ }
  },

  load() {
    try {
      const raw = localStorage.getItem('into-schem-v2');
      if (!raw) return;
      const data = JSON.parse(raw);
      this.deviceOutput = data.deviceOutput || {};
      this.levelState = data.levelState || {};
      this.unlockedBlocks = data.unlockedBlocks || [];
      this.seenIntro = !!data.seenIntro;
      this.revealAll = !!data.revealAll;
      this.soundEnabled = data.soundEnabled !== undefined ? !!data.soundEnabled : true;
      this.soundVolume = data.soundVolume !== undefined ? data.soundVolume : 0.3;
    } catch (e) { /* битый сейв — начинаем с чистого состояния */ }
  },
};
