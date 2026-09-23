'use strict';
// Процедурные звуки среды для Into Schem.
// Все звуки генерируются через Web Audio API — без внешних файлов.
// Нулевой размер сборки, мгновенная загрузка, контекст ленивый.

const Audio = (() => {
  let ctx = null;
  let enabled = true;
  let masterGain = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.3; // общая громкость — не кричим
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Синхронизация с GameConfig (может быть загружен после audio.js)
  function syncState() {
    if (typeof GameConfig === 'undefined') return;
    enabled = GameConfig.soundEnabled !== false; // true по умолчанию
    if (masterGain) {
      masterGain.gain.value = enabled ? (GameConfig.soundVolume || 0.3) : 0;
    }
  }

  // Однократная инициализация при загрузке страницы
  if (typeof GameConfig !== 'undefined') {
    syncState();
  }

  // Шум (белый) — для треска, жужжания, сгорания.
  function noiseBuffer(duration) {
    const c = ensureCtx();
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // --- Утилиты ---

  function playTone(freq, duration, type, vol, ramp = true) {
    if (!enabled) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.15;
    if (ramp) {
      gain.gain.setValueAtTime(vol || 0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  function playNoise(duration, vol, filterFreq, filterType) {
    if (!enabled) return;
    const c = ensureCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = c.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.1, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(c.currentTime + duration);
  }

  // --- Звуки ---

  // Щелчок переключателя / клика по детали
  function click() {
    playTone(800, 0.04, 'square', 0.08);
    playNoise(0.03, 0.06, 3000, 'highpass');
  }

  // Щелчок реле — более глубокий, с «магнитным» звуком
  function relayClick() {
    playTone(180, 0.08, 'sawtooth', 0.12);
    playNoise(0.06, 0.08, 1200, 'bandpass');
    // Второй тон — «щелчок якоря»
    setTimeout(() => playTone(400, 0.03, 'square', 0.06), 30);
  }

  // Жужжание мотора — низкий гул с вариацией
  function motorHum(freq) {
    if (!enabled) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq || 60;
    osc2.type = 'sine';
    osc2.frequency.value = (freq || 60) * 2;

    filter.type = 'lowpass';
    filter.frequency.value = 300;

    gain.gain.value = 0.06;

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc2.start();

    // LFO для вариации — как у настоящего мотора
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 2 + Math.random() * 3;
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    return { stop: () => {
      const stopTime = c.currentTime + 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
      osc.stop(stopTime);
      osc2.stop(stopTime);
      lfo.stop(stopTime);
    }};
  }

  // Заряд конденсатора — нарастающий писк
  function capCharge() {
    playTone(200, 0.3, 'sine', 0.04);
    // Писк нарастает
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.03, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + 0.3);
  }

  // Вспышка — короткий мощный «хлопок»
  function flash() {
    playNoise(0.15, 0.25, 5000, 'highpass');
    playTone(100, 0.1, 'sine', 0.15);
  }

  // Сгорание — треск + низкий гул
  function burn() {
    playNoise(0.4, 0.15, 2000, 'bandpass');
    playTone(80, 0.3, 'sawtooth', 0.08);
    // Второй треск через 100мс
    setTimeout(() => playNoise(0.15, 0.12, 3000, 'highpass'), 100);
  }

  // Победа — мягкий аккорд (три тона)
  function win() {
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.5, 'sine', 0.08), i * 80);
    });
  }

  // Прибор ожил на карте: гул, который набирает частоту, и аккорд сверху.
  function powerUp() {
    if (!enabled) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.9);
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + 1.1);
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.7, 'triangle', 0.07), 850 + i * 90);
    });
  }

  // Открылся новый узел — короткий «динь».
  function chime() {
    playTone(1319, 0.35, 'sine', 0.06);
    setTimeout(() => playTone(1760, 0.45, 'sine', 0.05), 70);
  }

  // Ошибка / предупреждение — низкий бип
  function error() {
    playTone(200, 0.2, 'square', 0.1);
    setTimeout(() => playTone(150, 0.25, 'square', 0.08), 150);
  }

  // Ток в проводе — очень тихий фон, когда цепь жива
  function liveWire(current) {
    // current — ток в амперах, от 0 до максимума
    if (!enabled || current < 0.001) return;
    const vol = Math.min(current * 2, 0.03); // тихонько
    playTone(50 + current * 100, 0.5, 'sine', vol);
  }

  // Кнопка (press) — короче клика
  function buttonPress() {
    playTone(600, 0.03, 'square', 0.06);
  }

  // Ручка (knob) — мягкий щелчок потенциометра
  function knobTurn() {
    playNoise(0.02, 0.04, 4000, 'highpass');
  }

  // Перегоревший предохранитель — короткий «пшш»
  function fuseBlow() {
    playNoise(0.2, 0.15, 4000, 'bandpass');
    playTone(120, 0.15, 'sawtooth', 0.06);
  }

  // Звук среды — фоновый гул платы (очень тихий, 60Hz)
  let boardHum = null;
  function boardHumOn() {
    if (!enabled || boardHum) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 50; // 50 Гц — частота сети
    gain.gain.value = 0.015;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    boardHum = { stop: () => {
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
      osc.stop(c.currentTime + 0.5);
      boardHum = null;
    }};
  }
  function boardHumOff() {
    if (boardHum) { boardHum.stop(); boardHum = null; }
  }

  // Переключатель звука вкл/выкл
  function toggle() {
    enabled = !enabled;
    if (typeof GameConfig !== 'undefined') GameConfig.soundEnabled = enabled;
    if (!enabled && ctx) {
      masterGain.gain.value = 0;
    } else if (enabled && ctx) {
      masterGain.gain.value = GameConfig ? (GameConfig.soundVolume || 0.3) : 0.3;
    }
    return enabled;
  }

  // Установить громкость 0..1
  function setVolume(v) {
    const vol = clamp(v, 0, 1);
    if (typeof GameConfig !== 'undefined') GameConfig.soundVolume = vol;
    if (masterGain && enabled) {
      masterGain.gain.value = vol;
    }
  }

  // Инициализация по клику (браузеры требуют пользовательского жеста)
  function initOnInteraction(element) {
    if (element) {
      element.addEventListener('click', ensureCtx, { once: true });
      element.addEventListener('mousedown', ensureCtx, { once: true });
    } else {
      document.addEventListener('click', ensureCtx, { once: true });
      document.addEventListener('mousedown', ensureCtx, { once: true });
      // Планшет: iOS считает пользовательским жестом только отрыв пальца
      // (touchend) и click, а не pointerdown, — без этого звука не будет.
      document.addEventListener('touchend', ensureCtx, { once: true });
    }
  }

  return {
    click, relayClick, motorHum, capCharge, flash, burn,
    win, powerUp, chime, error, liveWire, buttonPress, knobTurn, fuseBlow,
    boardHumOn, boardHumOff,
    toggle, setVolume,
    initOnInteraction,
    get enabled() { return enabled; },
    get volume() { return masterGain ? masterGain.gain.value : 0.3; },
  };
})();

// Автоинициализация при первом взаимодействии
if (typeof document !== 'undefined') {
  Audio.initOnInteraction();
}
