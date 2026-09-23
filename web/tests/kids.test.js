'use strict';
// Детская дорога (concept.md, раздел 01 «Для кого»): двадцать уровней, по
// которым «Дальше» ведёт ребёнка. Список живёт строками id в
// LevelRegistry.kidsPath — переименовали уровень, и дорога молча рвётся:
// «Дальше» уходит в старый порядок, а на карте следующий узел не открывается.
//
// Проверяется: каждый id существует; тексты в пределах детских норм (задача
// до 15 слов, урок до 25); «Дальше» после каждого уровня ведёт на следующий.

const H = require('./_harness.js');
const { makeSuite } = require('./_assert.js');
const { LevelRegistry, GameConfig } = H;

module.exports = function run() {
  const t = makeSuite('Детская дорога');
  const kp = LevelRegistry.kidsPath;
  const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

  t.group('Список и тексты');
  for (const id of kp) {
    const s = LevelRegistry.list.find((x) => x.id === id);
    if (!t.ok(id + ': уровень существует', !!s)) continue;
    t.ok(id + ': задача до 15 слов', words(s.brief) <= 15, words(s.brief) + ' слов');
    t.ok(id + ': урок до 25 слов', words(s.lesson) <= 25, words(s.lesson) + ' слов');
  }

  t.group('«Дальше» ведёт по дороге');
  const saved = GameConfig.deviceOutput;
  GameConfig.deviceOutput = {};
  GameConfig.save = GameConfig.save || (() => {});
  for (let i = 0; i < kp.length - 1; i++) {
    GameConfig.deviceOutput[kp[i]] = 1;
    const nxt = LevelRegistry.nextToPlay(kp[i]);
    t.ok(kp[i] + ' → ' + kp[i + 1], nxt && nxt.id === kp[i + 1], nxt ? 'ведёт на ' + nxt.id : 'никуда');
  }
  GameConfig.deviceOutput = saved;
  return t.result();
};
