'use strict';
// Журнал изделия — то, ради чего плата вообще чинится.
//
// Правило, из-за которого этот файл выглядит так, а не иначе: **тайна живёт в
// названии, а не в задаче.** Что делать на уровне, написано открытым текстом в
// «Задаче», приборах и подсказках — как и было. Скрыто только одно: ЧТО ЭТО ЗА
// УЗЕЛ и зачем он в изделии. Пока узел не работает, у него есть только
// обозначение («Б-03»); назначение записано в его собственной памяти, и
// прочитать её можно, только вернув узел в работу.
//
// Так тайна ничего не ломает: ни одна механика не спрятана, ни одно число не
// скрыто, обучающая часть на месте целиком. Спрятана ровно та часть, которая
// обучению не нужна, — сюжет.

const SECTORS = [
  {
    id: 'Т', title: 'СТЕНД ПРОВЕРКИ', open: true,
    lead: 'Это ещё не изделие. Это твой собственный стенд: четырнадцать простых сборок, на которых ремонтная подсистема проверяет саму себя, прежде чем лезть в чужую плату.',
    done: 'Стенд проверен целиком. Записка дочитана до конца — и теперь понятно, что человек, который её оставил, знал, что читать её будет не человек.',
    levels: ['t_loop', 't_switch', 't_ground', 't_resist', 't_ohm', 't_series', 't_parallel',
      't_divider', 't_short', 't_power', 't_diode', 't_led', 't_bus', 't_check'],
  },
  {
    id: 'A', title: 'ПЕРИФЕРИЯ',
    lead: 'Всё, что торчит наружу: индикация, свет, приводы, защита.',
    done: 'Периферия восстановлена. Изделие снова видит само себя снаружи — и это первое, что оно сообщает: снаружи темно, и так уже долго.',
    levels: ['led', 'flashlight', 'panel', 'garland', 'fuse_box', 'divider', 'heater', 'motor'],
  },
  {
    id: 'Б', title: 'СИЛОВАЯ ЧАСТЬ',
    lead: 'Откуда в изделии берётся ток и как он делится между всеми.',
    done: 'Силовая часть держит шину. Судя по счётчику наработки, изделие питалось от резерва дольше, чем резерв рассчитан.',
    levels: ['switchboard', 'flash', 'pump', 'beacon', 'sensor', 'fork', 'saturation', 'sag', 'workbench',
      'b_branch', 'b_ballast', 'b_reference', 'b_parallel', 'b_or', 'b_split', 'b_inrush', 'b_derate'],
  },
  {
    id: 'В', title: 'ИЗМЕРЕНИЕ',
    lead: 'Приборы, которыми изделие смотрит наружу и внутрь себя.',
    done: 'Измерительный тракт жив. Все его записи ведут к одной дате, после которой не записано ничего.',
    levels: ['v_shunt', 'v_scale', 'v_trim', 'v_bridge', 'v_match', 'v_leak', 'v_share', 'v_cal'],
  },
  {
    id: 'Г', title: 'УПРАВЛЕНИЕ',
    lead: 'То, что принимает решения: ключи, задержки, пороги, блокировки.',
    done: 'Управление отвечает. Оно всё это время исполняло последнюю команду, потому что новой не поступало.',
    levels: ['g_and', 'g_or', 'g_latch', 'g_delay', 'g_interlock', 'g_dim', 'g_soft'],
  },
  {
    id: 'Д', title: 'ЯДРО',
    lead: 'Что это вообще за изделие и почему ремонтная подсистема осталась одна.',
    done: 'Ядро собрано. Изделие знает, что оно такое, и теперь это знаешь ты.',
    levels: ['d_split', 'd_cascade', 'd_clamp', 'd_pulse', 'd_load', 'd_restore', 'd_core'],
  },
  {
    id: 'Е', title: 'ВОЗВРАТ',
    lead: 'Приёмный тракт, линия наверх, шлюз и свет над люком: всё, что нужно, чтобы сюда мог кто-то вернуться.',
    done: 'Возврат готов. Станция снова умеет принимать, светить и открывать люк — и делает это не для себя.',
    levels: ['e_listen', 'e_polarity', 'e_bleed', 'e_share', 'e_pair', 'e_line', 'e_eff',
      'e_highside', 'e_leak', 'e_buffer', 'e_charge', 'e_fuse', 'e_reserve', 'e_light',
      'e_budget'],
  },
  {
    id: 'Ж', title: 'ПЕРЕМЫЧКИ',
    lead: 'Узлы, у которых нет своего питания. Их кормят кабелями от соседей — и всё, что они умеют, зависит от того, что соседи могут отдать.',
    done: 'Перемычки держат. Изделие больше не набор отдельных узлов: половина его теперь питается друг от друга.',
    levels: ['u_share', 'u_bridge', 'u_transit'],
  },
  {
    id: 'Х', title: 'НЕ ЧИСЛИТСЯ',
    lead: 'Узел, которого нет ни в одной описи. Его нашли не по схеме, а по тому, что из шести шин уходил ток, который некуда было списать.',
    done: 'Шесть отводов сведены обратно. Узел ожил и отдал то, ради чего он всё это время экономил каждый микроампер.',
    levels: ['x_logger'],
  },
];

// Строки журнала для уровней, собранных до появления журнала. Держим здесь, а
// не правкой семнадцати файлов: у старых уровней своя история версий, и лезть
// в них ради одной строки — лишний риск.
const LEGACY_REVEAL = {
  led: 'Узел вернул первую запись: «индикация исправна». Больше в его памяти ничего нет — она рассчитана на одну строку.',
  flashlight: 'Переносной светильник. В памяти — счётчик включений: четыре. Последнее включение длилось одиннадцать минут.',
  panel: 'Панель приборов рабочего места. Кто-то сидел здесь и смотрел на эти показания.',
  garland: 'Ряд сигнальных ламп периметра. Их зажигали, когда снаружи работали люди.',
  fuse_box: 'Щит защиты. Одна из веток была перегружена и отключена вручную — задолго до того, как всё остановилось.',
  divider: 'Опорный делитель. От него питалось что-то, чему нужна была не шина, а точное напряжение.',
  heater: 'Обогрев смотрового стекла. Значит, снаружи бывает достаточно холодно, чтобы стекло замерзало.',
  motor: 'Привод заслонки. Заслонка закрыта. В памяти — команда «закрыть», отданная вручную и не отменённая.',
  switchboard: 'Распределительный щиток жилого контура. Две шины: одна для приборов, одна для света.',
  flash: 'Импульсный осветитель. Он снимал что-то снаружи — по одному кадру за раз, экономя заряд.',
  pump: 'Насос откачки. Он включался сам, когда уровень поднимался. Последний раз — очень давно.',
  beacon: 'Проблесковый маячок. Его никто не выключал: он просто перестал получать питание.',
  sensor: 'Датчик протечки. Он сработал. Сигнал ушёл в управление и остался без ответа.',
  fork: 'Развилка бытовой шины. Три потребителя, и один из них давно снят с учёта.',
  saturation: 'Силовой ключ нагревателя. Он работал в полуоткрытом режиме и грелся годами.',
  sag: 'Пусковой контур. Кто-то пытался запустить изделие на просевшем аккумуляторе. Не вышло.',
  workbench: 'Ремонтное место. Здесь чинили всё остальное. Судя по нему, ремонтом занимались до самого конца.',
};

const Journal = (() => {
  function sectorOf(id) {
    for (const s of SECTORS) if (s.levels.indexOf(id) >= 0) return s;
    return null;
  }

  // Обозначение узла: буква сектора и порядковый номер внутри сектора. Именно
  // оно видно игроку вместо названия, пока узел не работает. Уровень, не
  // попавший ни в один сектор, получает честную заглушку — и ловится
  // проверкой в web/tests, а не молча сливается с чужим обозначением.
  function codenameOf(spec) {
    const s = sectorOf(spec.id);
    if (!s) return '?-' + String(spec.index).padStart(2, '0');
    return s.id + '-' + String(s.levels.indexOf(spec.id) + 1).padStart(2, '0');
  }

  function isKnown(spec) { return GameConfig.isRepaired(spec.id); }

  // Имя узла бывает скрыто, а бывает и нет. Стенд — не изделие, а твоё
  // собственное хозяйство: прятать от себя названия своих же сборок незачем,
  // да и вредно — первые уровни игрок и так проходит, не понимая, куда попал,
  // а «УЗЕЛ Т-03 · НАЗНАЧЕНИЕ НЕ ОПРЕДЕЛЕНО» этого точно не поправит.
  // Тайна начинается там, где начинается чужая плата.
  // Стенд — не «узел изделия», и называть его так значит врать игроку в
  // первом же слове, которое он читает.
  function isBench(spec) {
    const s = sectorOf(spec.id);
    return !!(s && s.open);
  }

  function nameKnown(spec) {
    const s = sectorOf(spec.id);
    return (s && s.open) || isKnown(spec);
  }

  // Название узла на экране: до восстановления — только обозначение.
  function displayTitle(spec) {
    return nameKnown(spec) ? spec.title : spec.codename;
  }

  function revealOf(spec) { return spec.reveal || LEGACY_REVEAL[spec.id] || ''; }

  function entries() {
    const out = [];
    for (const s of SECTORS) {
      const rows = [];
      for (const id of s.levels) {
        const spec = LevelRegistry.byId(id);
        if (!spec) continue;
        rows.push({ spec, known: isKnown(spec), text: revealOf(spec) });
      }
      if (!rows.length) continue;
      const doneCount = rows.filter((r) => r.known).length;
      out.push({ sector: s, rows, doneCount, complete: doneCount === rows.length });
    }
    return out;
  }

  // Найденные неучтённые токи. Это не текст, который выдают за прохождение,
  // а список СНЯТЫХ ПРИБОРАМИ чисел: каждое из них игрок увидел сам, на своей
  // плате, в строке «Ток мимо схемы». Журнал их только собирает в одно место,
  // потому что держать шесть чисел в голове через полигры — не задача игрока.
  function tapFindings() {
    return SECRET_TAPS.map((t) => {
      const spec = LevelRegistry.byId(t.id);
      return {
        tap: t, spec,
        known: !!spec && GameConfig.isRepaired(t.id),
        amps: 12 / t.ohms,
      };
    });
  }

  function tapsComplete() { return tapFindings().every((f) => f.known); }

  function progress() {
    const all = LevelRegistry.list.length;
    const done = LevelRegistry.list.filter((s) => GameConfig.isRepaired(s.id)).length;
    return { all, done };
  }

  // Всплывающий журнал. Как и кодекс, это оверлей поверх симуляции — значит
  // обязан её останавливать: иначе нагрев и разряд идут, пока игрок читает.
  function open() {
    const wasPaused = SceneManager.paused;
    SceneManager.paused = true;
    const back = el('div', 'overlay', uiLayer());
    const card = el('div', 'win-card journal-card', back);
    const p = progress();
    el('div', 'win-kicker', card).textContent = 'Журнал изделия · восстановлено узлов ' + p.done + ' из ' + p.all;
    el('div', 'win-title', card).textContent = 'Что удалось прочитать';

    const body = el('div', 'journal-body', card);
    for (const group of entries()) {
      const sec = el('div', 'journal-sector', body);
      const head = el('div', 'journal-sector-head', sec);
      head.textContent = group.sector.id + ' · ' + group.sector.title
        + '  ·  ' + group.doneCount + '/' + group.rows.length;
      el('div', 'journal-sector-lead', sec).textContent = group.sector.lead;
      for (const r of group.rows) {
        const line = el('div', 'journal-line' + (r.known ? '' : ' is-locked'), sec);
        el('span', 'journal-code', line).textContent = r.spec.codename;
        el('span', 'journal-text', line).textContent = r.known
          ? (r.spec.title + ' — ' + r.text)
          : (group.sector.open
            ? (r.spec.title + ' — записка на этой сборке ещё не прочитана')
            : 'память узла недоступна: узел не работает');
      }
      if (group.complete) el('div', 'journal-sector-done', sec).textContent = group.sector.done;
    }

    // Отдельный раздел: то, что не значится ни в одном секторе, потому что
    // не значится вообще нигде.
    {
      const found = tapFindings();
      const sec = el('div', 'journal-sector', body);
      const head = el('div', 'journal-sector-head', sec);
      const done = found.filter((f) => f.known).length;
      head.textContent = 'НЕУЧТЁННЫЙ ТОК  ·  ' + done + '/' + found.length;
      el('div', 'journal-sector-lead', sec).textContent =
        'Шины, на которых источник отдаёт больше, чем берут все ветки вместе. Разница снята приборами и записана как есть.';
      for (const f of found) {
        const line = el('div', 'journal-line' + (f.known ? '' : ' is-locked'), sec);
        el('span', 'journal-code', line).textContent = f.spec ? f.spec.codename : '—';
        el('span', 'journal-text', line).textContent = f.known
          ? ('отвод ' + f.tap.tap + ': ' + fmtAmps(f.amps) + ' при 12 В — это ' + fmtOhms(f.tap.ohms))
          : 'плата ещё не восстановлена, замер не снят';
      }
      if (done === found.length) {
        el('div', 'journal-sector-done', sec).textContent =
          'Шесть отводов, шесть разных шин, одна общая точка. На карте появилось место, которого там не было.';
      }
    }

    const row = el('div', 'win-buttons', card);
    row.appendChild(makeButton('Закрыть', () => {
      back.remove();
      if (!document.querySelector('.codex, .overlay')) SceneManager.paused = wasPaused;
    }, 'btn-primary'));
    return back;
  }

  return { open, sectorOf, codenameOf, displayTitle, nameKnown, isBench, tapFindings, tapsComplete, revealOf, entries, progress, SECTORS };
})();
