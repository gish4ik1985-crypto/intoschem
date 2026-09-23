'use strict';
// Каркас уровня. Всё общее — здесь, уровень описывает только свою схему.
//
// Что делает каркас:
//   · держит цепь и решает её каждый кадр (а не по клику) — иначе
//     конденсатор, катушка и нагрев не могут существовать в принципе;
//   · считает нагрев каждой детали от реальной рассеиваемой мощности и
//     жжёт её, если перегрев держится;
//   · требует УДЕРЖАТЬ условие победы заданное время, а не коснуться его
//     на мгновение — иначе «сработало и сгорело» засчитывается как успех;
//   · разбирает мышь: клик по детали на плате, а не кнопка внизу экрана.

const CENTER = vec(858, 462);
const SIM_DT = 1 / 120; // шаг решателя; кадр может быть длиннее — догоняем шагами
const DEFAULT_BOARD = { x: -300, y: -110, w: 600, h: 220 };
const DEFAULT_SCALE = 1.5; // плата занимает середину экрана целиком, а не полоску в ней

// Геометрия дорожки фиксированного уровня. Вынесена из createLevel, чтобы её
// мог позвать не только рендер, но и проверка разводки (web/tests).
// `termOf('R1.b')` — мировая точка вывода детали.
function fixedWirePoints(w, termOf) {
  if (w.pts) return w.pts;
  const a = termOf(w.from);
  const b = termOf(w.to);
  if (w.y !== undefined) return [a, vec(a.x, w.y), vec(b.x, w.y), b];
  if (w.x !== undefined) return [a, vec(w.x, a.y), vec(w.x, b.y), b];
  if (Math.abs(a.y - b.y) < 2) return [a, b];
  const mx = (a.x + b.x) / 2;
  return [a, vec(mx, a.y), vec(mx, b.y), b];
}

// Направление огоньков на дорожке. `viaCur` — ток через её «via»/«viaSum» по
// СОБСТВЕННОМУ соглашению знаков детали (см. compI: nets[0] → nets[1] это
// плюс, источник и перевёрнутые детали учтены там же). `w.dir === -1`
// значит «дорожка нарисована ПРОТИВ тока» — например, шина VCC от блока
// питания наружу, или отвод от общей шины к перемычке (rig.js, l06/l07/l09/
// l10/l16). Вынесена сюда же, а не только в render(), чтобы проверка
// направления (_flowdir.js) звала ровно эту функцию, а не пересчитывала
// то же самое второй раз — разошедшиеся копии одной формулы уже один раз
// стоили молчаливого бага на весь обратный провод игры (см. CLAUDE.md,
// «Направление бега заряда»).
function wireReverse(viaCur, dir) {
  const normalDir = dir === undefined || dir > 0;
  return (viaCur >= 0) !== normalDir;
}

const LevelRegistry = {
  list: [],
  register(spec) {
    // Обозначение узла и сектор — то, что видно игроку ВМЕСТО названия, пока
    // узел не работает (см. scenes/journal.js). Заполняется здесь, чтобы
    // уровню не приходилось повторять то, что уже сказано составом сектора.
    const sec = Journal.sectorOf(spec.id);
    spec.sector = sec ? sec.id : '?';
    spec.codename = spec.codename || Journal.codenameOf(spec);
    this.list.push(spec);
    return spec;
  },
  byId(id) { return this.list.find((s) => s.id === id); },
  next(id) {
    const i = this.list.findIndex((s) => s.id === id);
    return i >= 0 && i + 1 < this.list.length ? this.list[i + 1] : null;
  },
  // Куда игрок реально пойдёт дальше. Просто «следующий по номеру» врёт
  // после возврата на уже пройденный уровень: игрока отправляло туда, где
  // всё давно сделано. Сначала — сосед по кабелю на карте (его как раз
  // открыл свет только что починенного прибора), потом первый непройденный.
  // Детская дорога (concept.md, раздел 01 «Для кого»): двадцать уровней в
  // порядке прохождения. «Дальше» ведёт по ней, а на карте следующий её узел
  // открывается, как только пройден предыдущий (kidsPrev в map.js), — свет
  // соседа тут не решает: уровни дороги разбросаны по разным секторам.
  kidsPath: [
    't_loop', 'flashlight', 't_resist', 'panel', 'garland', 'workbench', 'heater',
    'fuse_box', 't_power', 't_diode', 'led', 'motor', 'divider', 'v_trim',
    'g_and', 'g_or', 'flash', 'beacon', 'pump', 'sensor',
  ],
  // Инженерный режим: остальные уровни открываются на карте только после
  // того, как пройдена вся детская дорога (isLit в map.js).
  kidsDone() {
    return this.kidsPath.every((id) => GameConfig.isRepaired(id));
  },
  isKids(id) { return this.kidsPath.indexOf(id) >= 0; },
  kidsPrev(id) {
    const i = this.kidsPath.indexOf(id);
    return i > 0 ? this.kidsPath[i - 1] : null;
  },
  nextToPlay(id) {
    const kp = this.kidsPath;
    if (kp.indexOf(id) >= 0) {
      const byId = (k) => this.list.find((s) => s.id === k);
      const i = kp.indexOf(id);
      const rest = kp.slice(i + 1).concat(kp.slice(0, i));
      const k = rest.find((x) => byId(x) && !GameConfig.isRepaired(x));
      if (k) return byId(k);
    }
    const hasParent = (s, pid) => {
      const f = s.map && s.map.from;
      return Array.isArray(f) ? f.indexOf(pid) >= 0 : f === pid;
    };
    const child = this.list.find((s) => hasParent(s, id) && !GameConfig.isRepaired(s.id));
    if (child) return child;
    const i = this.list.findIndex((s) => s.id === id);
    for (let k = i + 1; k < this.list.length; k++) {
      if (!GameConfig.isRepaired(this.list[k].id)) return this.list[k];
    }
    return this.list.find((s) => !GameConfig.isRepaired(s.id)) || null;
  },
};

function createLevel(spec) {
  const board = Object.assign({}, DEFAULT_BOARD, spec.board || {});
  const scale = spec.scale || DEFAULT_SCALE;
  let P = {};            // детали по id
  let circuit = null;
  let refs = {};
  let topoKey = '';
  let sol = { nodeVoltage: {}, componentCurrent: {}, ok: false };
  let m = {};            // последние измерения
  let hud = null;
  let simAccum = 0;
  let holdTime = 0;
  let elapsed = 0;
  let won = false;
  let bestAtMount = 0;   // с чем игрок пришёл на уровень
  let hover = null;      // деталь под курсором
  let dragKnob = null;
  let mouse = vec(-1000, -1000);
  let lampLight = 0;     // сколько света сейчас на плате — плата это видит
  let flashMsg = null;

  // --- Звуки ------------------------------------------------------------
  let motorNodes = {}; // id → { stop }
  let relayStates = {}; // id → bool (было замкнуто)
  function playSound(fn) { try { return fn(); } catch(_) {} return null; }

  // --- Свободная сборка (spec.freeform) --------------------------------------
  // В обычном уровне детали и провода задаёт автор уровня. Здесь их задаёт
  // игрок: ставит деталь из палитры, тянет провод между двумя выводами —
  // и цепь под этим строится заново из графа связей, а не из готового
  // build(). Все остальные механики (нагрев, самописец, победа, починка)
  // общие и трогать их не пришлось.
  let connections = [];  // провода: [{ id, a:{p,t}, b:{p,t} }]
  let freeformDirty = true;
  let placeCounter = 0;
  let tool = 'idle';      // 'idle' | 'place' | 'wire' | 'erase'
  let placeKind = null;
  let pendingWire = null; // первый выбранный вывод при разводке провода
  let dragPart = null;    // деталь, которую сейчас тащат мышью (в режиме «Готово»)
  let dragTap = null;     // точку отвода тащат вдоль провода, к которому она припаяна
  let boardDrag = null;   // плату тащат за пустое место — панорама
  let pinch = null;       // жест двумя пальцами: зум и сдвиг платы (engine/touch.js)
  let fingerInput = false; // последнее нажатие было пальцем, а не мышью

  // --- Зум и панорама платы -----------------------------------------------
  // Колесо мыши масштабирует плату вокруг центра сцены, если оно не занято
  // ручкой (у ручки колесо крутит номинал — это было раньше и остаётся).
  // Зажатая на пустом месте платы (не на детали) кнопка мыши таскает саму
  // плату — иначе от приближения толку мало: то, что интересно разглядеть
  // вблизи, может оказаться у самого края экрана, и без панорамы туда не
  // добраться. Ни зум, ни панорама не сохраняются между заходами.
  let viewZoom = 1;
  let boardPan = vec(0, 0); // сдвиг платы (в игровых координатах)
  const ZOOM_MIN = 0.5, ZOOM_MAX = 2.5;
  function effScale() { return scale * viewZoom; }
  let updateToolButtons = () => {};

  // --- Детали ---------------------------------------------------------------

  function instantiate() {
    P = {};
    for (const raw of spec.parts) {
      const part = Object.assign({}, raw);
      part.heat = 0;
      // Деталь может быть найдена уже сгоревшей — это и есть изъян прибора.
      part.burnt = !!raw.burnt;
      part.anim = part.closed ? 1 : 0;
      part.spin = 0;
      P[part.id] = part;
    }
    if (spec.freeform) {
      connections = [];
      placeCounter = 0;
      const saved = GameConfig.getLevelState(spec.id);
      if (saved && saved.parts) {
        for (const raw of saved.parts) {
          const part = Object.assign(spec.sandbox.make(raw.kind), raw);
          finalizePart(part);
          P[part.id] = part;
        }
        connections = (saved.wires || []).map((w) => Object.assign({}, w));
        placeCounter = saved.nextId || 0;
        // В уже сохранённых платах мёртвые огрызки могли накопиться до
        // того, как их начали убирать при стирании, — подчищаем на входе,
        // иначе игрок так и будет видеть их до конца жизни сохранения.
        // Убрали — сразу записываем: без persist() чистка живёт только до
        // выхода с уровня, и на следующем заходе огрызок возвращается.
        const before = connections.length;
        // Дубликаты могли накопиться в сохранении до того, как их начали
        // запрещать при рисовании, — на плате они видны узкой «шпилькой».
        connections = connections.filter((cn, i) =>
          !connections.some((o, j) => j < i && sameConnection(o, cn)));
        dropDeadStubs();
        if (connections.length !== before) persist();
      }
      freeformDirty = true;
      return;
    }
    restore();
  }

  // Общая часть создания детали в свободной сборке: пересчитать её сеть по
  // виду выводов и сбросить всё, что не должно переживать перезаход/загрузку.
  function finalizePart(part) {
    const terms = Parts[part.kind].terminals(part);
    if (part.kind === 'block') {
      // Блок — не один компонент решателя, а группа внутренних деталей
      // (см. web/js/engine/blocks.js, Blocks.instantiate). У обычной
      // детали ровно два вывода 'a'/'b' и один part.nets на них; у блока
      // выводов может быть сколько угодно, с любыми именами, — поэтому
      // сеть считается по каждому терминалу отдельно, в part.blockNets, а
      // не втискивается в двухэлементный part.nets.
      part.comp = null;
      part.blockNets = {};
      for (const k of Object.keys(terms)) part.blockNets[k] = netNameFor(part, k);
    } else if (Object.keys(terms).length >= 2) {
      part.comp = part.id;
      part.nets = [netNameFor(part, 'a'), netNameFor(part, 'b')];
    }
    part.heat = 0;
    part.burnt = false;
    part.anim = part.closed ? 1 : 0;
    part.spin = 0;
    return part;
  }

  // Имя сети для конкретного вывода детали. Провода не «сливают» узлы
  // (union-find) — каждый провод сам становится компонентом решателя
  // (резистор ~0 Ом, см. rebuildFreeform), поэтому у каждого вывода своя
  // сеть, и её имя можно вычислить один раз при создании детали.
  // Единственное исключение — «земля»: у неё один вывод, и он и есть GND.
  function netNameFor(part, term) {
    const terms = Parts[part.kind].terminals(part);
    if (Object.keys(terms).length === 1) return 'GND';
    return part.id + '_' + term;
  }

  // Конец провода в свободной сборке бывает двух видов:
  //   { p: partId, t: term }       — обычный вывод детали;
  //   { tapOf: wireId, frac }      — отвод от ДРУГОГО провода: точка на
  //     его пути (0 = у начала, 1 = у конца), а не отдельный узел.
  // Электрически провод — это резистор ~0 Ом (см. rebuildFreeform), а
  // значит любая точка вдоль него имеет тот же потенциал, что и его
  // собственное начало. Поэтому отвод просто ПЕРЕИСПОЛЬЗУЕТ сеть начала
  // того провода, который он трогает, — не заводит отдельный узел и не
  // требует лишнего резистора-моста. Рекурсия по цепочке (отвод от
  // отвода) не зациклится: новый провод всегда ссылается на уже
  // существующий, более ранний id.
  //   { at: {x,y}, net }           — свободный конец: место, где дорожку
  //     перерезали ластиком. Своего узла в схеме он не соединяет ни с чем
  //     (это огрызок), но имя ему нужно своё — иначе два разных среза
  //     слиплись бы в один узел.
  function endpointNet(end) {
    if (end.at !== undefined) return end.net;
    if (end.tapOf !== undefined) {
      const src = connections.find((c) => c.id === end.tapOf);
      return src ? endpointNet(src.a) : 'GND';
    }
    return netNameFor(P[end.p], end.t);
  }

  // Мировая точка конца провода — для отрисовки и для хит-теста. Для
  // отвода — точка вдоль ПУТИ того провода, который он трогает, на
  // текущий момент (если тот провод сам подключён к движущимся деталям,
  // отвод едет вместе с ним, а не застывает в старом месте).
  function endpointPos(end) {
    if (end.at !== undefined) return vec(end.at.x, end.at.y);
    if (end.tapOf !== undefined) {
      const src = connections.find((c) => c.id === end.tapOf);
      if (!src) return vec(0, 0);
      return pointAlong(rawWirePts(src), end.frac);
    }
    return partTerminal(end.p, end.t);
  }

  // Единственный источник правды о геометрии провода свободной сборки:
  // и отрисовка, и хит-тест, и позиция отвода считаются отсюда. Раньше
  // здесь была развилка — провод «вывод-вывод» разводился wirePoints, а
  // всё, где участвует отвод, рисовалось ГОЛОЙ ДИАГОНАЛЬЮ от точки до
  // точки. Из-за этого шина с отводами выглядела пучком косых линий, а
  // при перетаскивании детали такая диагональ ещё и разворачивалась
  // вокруг точки отвода. Теперь маршрут один для всех — ортогональный.
  function rawWirePts(cn) { return routePoints(cn, 0); }

  // Насколько дорожка отходит от вывода по своей оси, прежде чем
  // поворачивать. Без этого «хвостика» провод от бокового вывода сразу
  // уходил бы вверх/вниз прямо от ножки — на плате так не разводят.
  const WIRE_STUB = 16;

  // Куда дорожка выходит из своего конца. У вывода детали — вдоль самой
  // ножки (левый вывод — влево, верхний — вверх), уже с учётом поворота
  // корпуса. У отвода — ПОПЕРЁК той дорожки, к которой он припаян, в
  // сторону второго конца: именно так выглядит настоящее T-примыкание.
  function endpointDir(end, other, depth) {
    if (end.p !== undefined && P[end.p]) {
      const part = P[end.p];
      const t = (part.terminals || Parts[part.kind].terminals(part))[end.t];
      if (t && (t.x || t.y)) {
        const v = rotateOffset(t, part.rot);
        if (Math.abs(v.x) >= Math.abs(v.y)) return vec(Math.sign(v.x) || 1, 0);
        return vec(0, Math.sign(v.y) || 1);
      }
    }
    if (end.tapOf !== undefined) {
      const src = connections.find((c) => c.id === end.tapOf);
      if (src) {
        const sp = routePoints(src, depth + 1);
        const here = pointAlong(sp, end.frac);
        const ahead = pointAlong(sp, clamp(end.frac + 0.02, 0, 1));
        const back = pointAlong(sp, clamp(end.frac - 0.02, 0, 1));
        if (Math.abs(ahead.x - back.x) >= Math.abs(ahead.y - back.y)) {
          return vec(0, Math.sign(other.y - here.y) || 1);
        }
        return vec(Math.sign(other.x - here.x) || 1, 0);
      }
    }
    const a = endpointPos(end);
    if (Math.abs(other.x - a.x) >= Math.abs(other.y - a.y)) return vec(Math.sign(other.x - a.x) || 1, 0);
    return vec(0, Math.sign(other.y - a.y) || 1);
  }

  // Прямоугольники корпусов, сквозь которые дорожке ходить не следует.
  // Детали на своих же концах провода пропускаем: вывод по определению
  // лежит на границе корпуса, и любой маршрут «задевал» бы его всегда.
  function routeObstacles(skipA, skipB) {
    const out = [];
    for (const id of Object.keys(P)) {
      if (id === skipA || id === skipB) continue;
      const part = P[id];
      if (part.kind === 'ground') continue;
      const box = partHit(part);
      const pad = 6;
      out.push({
        x0: part.pos.x - box.w / 2 - pad, x1: part.pos.x + box.w / 2 + pad,
        y0: part.pos.y - box.h / 2 - pad, y1: part.pos.y + box.h / 2 + pad,
      });
    }
    return out;
  }

  // Все звенья маршрута осевые, поэтому пересечение с корпусом — это
  // обычное перекрытие двух прямоугольников, без всякой геометрии.
  function segHitsRect(p, q, r) {
    return Math.max(p.x, q.x) >= r.x0 && Math.min(p.x, q.x) <= r.x1
      && Math.max(p.y, q.y) >= r.y0 && Math.min(p.y, q.y) <= r.y1;
  }

  // Звенья уже проложенных проводов — чтобы новый маршрут не ложился на
  // них сверху. Пересечение поперёк (крест) законно и на бумажной схеме
  // тоже бывает; недопустимо именно СОВПАДЕНИЕ вдоль — две дорожки на
  // одной линии сливаются в одну, и по картинке уже не сказать, сколько
  // там проводов и куда каждый идёт.
  // Пока считаем маршруты соседей — сами соседей не учитываем. Иначе
  // получается взаимная рекурсия без дна: провод A смотрит на B, B на A.
  // Флаг обрывает её на первом же уровне: соседи получают «базовый»
  // маршрут (выводы + корпуса деталей), и уже относительно него
  // раскладывается тот провод, который считаем сейчас.
  let routingNeighbours = false;
  let baseRouteCache = null, baseRouteKey = '';

  // Ключ кэша считается ИЗ САМОЙ геометрии — позиций деталей, поворотов и
  // концов проводов. Поэтому кэш физически не может протухнуть: изменилось
  // что-нибудь, влияющее на маршрут, — изменился и ключ. Ключ по счётчику
  // «версии», который надо не забыть увеличить в каждом месте, где что-то
  // двигается, был бы дешевле, но ровно одно забытое место дало бы провод,
  // приклеенный к старой позиции детали, — а это ищется потом часами.
  function geometryKey() {
    let s = '';
    for (const id of Object.keys(P)) {
      const p = P[id];
      s += id + ',' + p.pos.x + ',' + p.pos.y + ',' + (p.rot || 0) + ';';
    }
    for (const cn of connections) {
      const e = (x) => (x.p !== undefined ? x.p + '.' + x.t : (x.tapOf !== undefined ? x.tapOf + '@' + x.frac : x.at.x + '_' + x.at.y));
      s += cn.id + ':' + e(cn.a) + '>' + e(cn.b) + ';';
    }
    return s;
  }

  // Базовые маршруты всех проводов — без учёта соседей. Считаются один раз
  // на каждую новую геометрию, а не заново для каждого провода: без этого
  // разводка была бы кубической по числу проводов.
  function baseRoutes() {
    const key = geometryKey();
    if (baseRouteCache && baseRouteKey === key) return baseRouteCache;
    routingNeighbours = true;
    try {
      const m = {};
      for (const cn of connections) m[cn.id] = routePoints(cn, 0);
      baseRouteCache = m;
      baseRouteKey = key;
      return m;
    } finally { routingNeighbours = false; }
  }

  function routeNeighbours(skipId) {
    const m = baseRoutes();
    const out = [];
    for (const id of Object.keys(m)) {
      if (id === skipId) continue;
      const pts = m[id];
      for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
    }
    return out;
  }

  // Длина участка, на котором два ОСЕВЫХ звена лежат на одной линии.
  function overlapLen(p, q, r, s) {
    const pH = Math.abs(p.y - q.y) < 0.5, rH = Math.abs(r.y - s.y) < 0.5;
    const pV = Math.abs(p.x - q.x) < 0.5, rV = Math.abs(r.x - s.x) < 0.5;
    if (pH && rH && Math.abs(p.y - r.y) < 3) {
      return Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x));
    }
    if (pV && rV && Math.abs(p.x - r.x) < 3) {
      return Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) - Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y));
    }
    return 0;
  }

  // Раньше колено выбиралось одним жёстким правилом (если так — значит
  // эдак), и правило приходилось латать под каждый новый случай. Вместо
  // этого перебираем ВСЕ четыре осевых варианта и берём лучший по счёту.
  // Так новый случай не требует новой ветки в коде — он просто получает
  // тот вариант, который по этим же признакам оказался лучше.
  function routeCandidates(a2, b2) {
    const mx = (a2.x + b2.x) / 2, my = (a2.y + b2.y) / 2;
    return [
      [vec(mx, a2.y), vec(mx, b2.y)], // колено посередине, поперёк X
      [vec(a2.x, my), vec(b2.x, my)], // колено посередине, поперёк Y
      [vec(b2.x, a2.y)],              // угол: сначала по X, потом по Y
      [vec(a2.x, b2.y)],              // угол: сначала по Y, потом по X
    ];
  }

  function routePoints(cn, depth) {
    const a = endpointPos(cn.a), b = endpointPos(cn.b);
    // Отвод от отвода от отвода… — цепочка конечна (см. endpointNet), но
    // ограничитель дешевле, чем доверять этому на слово.
    if (depth > 6) return [a, b];
    const da = endpointDir(cn.a, b, depth);
    const db = endpointDir(cn.b, a, depth);
    const a2 = vec(a.x + da.x * WIRE_STUB, a.y + da.y * WIRE_STUB);
    const b2 = vec(b.x + db.x * WIRE_STUB, b.y + db.y * WIRE_STUB);
    const obstacles = routeObstacles(cn.a.p, cn.b.p);
    const neighbours = routingNeighbours ? [] : routeNeighbours(cn.id);

    let best = null, bestScore = Infinity;
    routeCandidates(a2, b2).forEach((mid, idx) => {
      // Соседи хвостиков считаем ДО схлопывания: dedupePts убирает нулевые
      // звенья и сдвигает индексы, а нам нужно именно то, куда дорожка
      // трогается от вывода и с какой стороны приходит во второй.
      const afterA = mid.length ? mid[0] : b2;
      const beforeB = mid.length ? mid[mid.length - 1] : a2;
      let score = 0;
      // 1) Разворот назад в собственный вывод — самый заметный глазу
      // дефект: у ножки торчит короткий отросток-возврат.
      if ((afterA.x - a2.x) * da.x + (afterA.y - a2.y) * da.y < -0.001) score += 4000;
      if ((b2.x - beforeB.x) * db.x + (b2.y - beforeB.y) * db.y > 0.001) score += 4000;
      const pts = dedupePts([a, a2].concat(mid, [b2, b]));
      // 2) Дорожка сквозь корпус чужой детали.
      for (let i = 1; i < pts.length; i++) {
        for (const r of obstacles) if (segHitsRect(pts[i - 1], pts[i], r)) score += 500;
      }
      // 3) Дорожка поверх другой дорожки. Штрафуем ДЛИНОЙ совпадения, а не
      // фактом: короткий общий кусок у самого пятака неизбежен и не мешает,
      // а вот полсотни пикселей одна на другой сливаются в одну линию, и по
      // картинке уже не сказать, сколько там проводов.
      for (let i = 1; i < pts.length; i++) {
        for (const s of neighbours) {
          const ov = overlapLen(pts[i - 1], pts[i], s[0], s[1]);
          if (ov > 8) score += 20 + ov * 2;
        }
      }
      // 3b) Маршрут, наложившийся САМ НА СЕБЯ, — это «шпилька»: дорожка
      // уходит далеко и возвращается почти по себе же, двумя линиями в
      // нескольких пикселях друг от друга. Отдельная проверка нужна
      // потому, что соседей мы считаем по другим проводам, а этот дефект
      // целиком внутри одного.
      for (let i = 1; i < pts.length; i++) {
        for (let j = i + 2; j < pts.length; j++) {
          const ov = overlapLen(pts[i - 1], pts[i], pts[j - 1], pts[j]);
          if (ov > 4) score += 3000 + ov * 4;
        }
      }
      // 4) При прочих равных — короче. Слагаемое по индексу разрешает
      // полное равенство всегда в одну и ту же сторону: иначе вариант
      // мог бы «дребезжать» между двумя одинаковыми, пока тащат деталь.
      score += pathLength(pts) * 0.01 + idx * 0.001;
      if (score < bestScore) { bestScore = score; best = pts; }
    });
    return best;
  }

  // Совпавшие точки схлопываем: при выровненных выводах колено вырождается
  // в прямую само собой. Это важнее, чем кажется — раньше «почти на одной
  // высоте» разводилось прямой линией, а «на 3 пикселя мимо» уже зигзагом,
  // и провод дёргался туда-сюда, пока игрок тащил деталь. Здесь порога нет
  // вообще: маршрут один и тот же, просто с нулевыми звеньями.
  function dedupePts(pts) {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
      out.push(p);
    }
    return out.length >= 2 ? out : [pts[0], pts[pts.length - 1]];
  }

  function pointAlong(pts, frac) {
    if (pts.length < 2) return pts[0] || vec(0, 0);
    const total = pathLength(pts) || 1;
    const target = clamp(frac, 0, 1) * total;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const segLen = distV(pts[i - 1], pts[i]);
      if (acc + segLen >= target || i === pts.length - 1) {
        const t = segLen > 0 ? clamp((target - acc) / segLen, 0, 1) : 0;
        return vec(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t);
      }
      acc += segLen;
    }
    return pts[pts.length - 1];
  }

  function fracAlong(pts, p) {
    const total = pathLength(pts) || 1;
    let acc = 0, best = 0, bestDist = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      const segLen = Math.sqrt(len2);
      const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
      const d = distV(p, vec(a.x + dx * t, a.y + dy * t));
      if (d < bestDist) { bestDist = d; best = acc + segLen * t; }
      acc += segLen;
    }
    return clamp(best / total, 0, 1);
  }

  // Два провода соединяют одну и ту же пару точек — в любом порядке концов.
  function sameConnection(x, y) {
    return (sameEndpoint(x.a, y.a) && sameEndpoint(x.b, y.b))
      || (sameEndpoint(x.a, y.b) && sameEndpoint(x.b, y.a));
  }

  function sameEndpoint(a, b) {
    if (!a || !b) return false;
    if (a.p !== undefined && b.p !== undefined) return a.p === b.p && a.t === b.t;
    if (a.tapOf !== undefined && b.tapOf !== undefined) return a.tapOf === b.tapOf && Math.abs(a.frac - b.frac) < 0.01;
    return false;
  }

  // Конец провода для хранения в connections — без временного .pos,
  // который terminalOrTapAt добавляет только для отрисовки/хит-теста.
  function stripPos(end) {
    if (end.at !== undefined) return { at: vec(end.at.x, end.at.y), net: end.net };
    return end.tapOf !== undefined ? { tapOf: end.tapOf, frac: end.frac } : { p: end.p, t: end.t };
  }

  // Сохранение общее для всех уровней: каркас знает, какие поля детали
  // может менять игрок, и пишет только их.
  const SAVED_FIELDS = ['value', 'closed', 'flipped', 'knob', 'content', 'repaired', 'choice', 'mode', 'wiring', 'blown'];

  function persist() {
    if (spec.freeform) {
      const parts = Object.keys(P).map((id) => {
        const p = P[id];
        const out = { id: p.id, kind: p.kind, pos: { x: p.pos.x, y: p.pos.y } };
        // 'silk' — сюда placeAt() дописывает порядковый номер детали
        // («R» → «R3»). Без него после выхода и возврата на уровень
        // make(kind) при загрузке отдавал голое базовое имя без номера, и
        // все резисторы на плате подписывались одинаково просто «R».
        // 'blockId' — какой именно блок это (BlockRegistry.id); без него
        // сохранённый блок при возврате на уровень восстановился бы как
        // деталь kind:'block' без своего blockId — Parts.block.hit/
        // terminals/draw и finalizePart не смогли бы понять, какой это блок.
        for (const f of ['value', 'closed', 'vf', 'rot', 'silk', 'blockId']) if (p[f] !== undefined) out[f] = p[f];
        return out;
      });
      GameConfig.setLevelState(spec.id, { parts, wires: connections, nextId: placeCounter });
      return;
    }
    const data = {};
    for (const id of Object.keys(P)) {
      const out = {};
      for (const f of SAVED_FIELDS) if (P[id][f] !== undefined) out[f] = P[id][f];
      data[id] = out;
    }
    GameConfig.setLevelState(spec.id, data);
  }

  function restore() {
    const data = GameConfig.getLevelState(spec.id);
    if (!data) return;
    for (const id of Object.keys(data)) {
      if (!P[id]) continue;
      for (const f of SAVED_FIELDS) if (data[id][f] !== undefined) P[id][f] = data[id][f];
    }
  }

  // Локальный вывод детали повёрнут вместе с её корпусом (см. render():
  // `if (part.rot) ctx.rotate(part.rot)`) — вывод и провод, который к
  // нему идёт, обязаны считаться из одной и той же повёрнутой точки,
  // иначе дорожка отрисуется туда, где вывод был ДО поворота.
  function rotateOffset(v, rot) {
    if (!rot) return v;
    const c = Math.cos(rot), s = Math.sin(rot);
    return vec(v.x * c - v.y * s, v.x * s + v.y * c);
  }

  function partTerminal(partId, termName) {
    const part = P[partId];
    const t = (part.terminals || Parts[part.kind].terminals(part))[termName];
    return addV(part.pos, rotateOffset(t || vec(0, 0), part.rot));
  }

  // Габарит детали с учётом поворота: на 90°/270° видимые ширина и высота
  // меняются местами (деталь легла «на бок»), на 0°/180° — нет.
  function partHit(part) {
    const box = Parts[part.kind].hit(part);
    const q = Math.round((part.rot || 0) / (Math.PI / 2)) % 2;
    return q ? { w: box.h, h: box.w } : box;
  }

  // --- Цепь -----------------------------------------------------------------

  function rebuild() {
    circuit = new Circuit();
    refs = spec.build(circuit, P) || {};
    topoKey = spec.topologyKey ? spec.topologyKey(P) : '';
    circuit.setTimestep(SIM_DT);
  }

  // Свободная сборка: цепь собирается заново из графа «деталь-провод»
  // при каждом структурном изменении (детали немного — полная пересборка
  // на такое редкое событие не дороже, чем у обычного уровня при смене
  // топологии переключателем). Номинал резистора и положение ключа между
  // пересборками меняются через circuit.setResistance/setSwitch — как и
  // везде в проекте, см. CLAUDE.md.
  function rebuildFreeform() {
    circuit = new Circuit();
    refs = {};
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind === 'block') {
        // Честная разборка блока на реальные детали (см. BLOCKS.md,
        // «Физика блока»): Blocks.instantiate сама заводит их в circuit —
        // это не один компонент, а группа, поэтому refs[part.comp] сюда не
        // ложится (part.comp у блока — null, см. finalizePart).
        refs['block:' + id] = Blocks.instantiate(circuit, part);
        continue;
      }
      if (!part.comp) continue; // «земля» — это просто имя сети, не компонент
      refs[part.comp] = spec.sandbox.add(circuit, part.nets[0], part.nets[1], part);
    }
    for (const cn of connections) {
      const a = endpointNet(cn.a);
      const b = endpointNet(cn.b);
      refs['w_' + cn.id] = circuit.addResistor(a, b, 1e-3, 'w_' + cn.id);
    }
    circuit.setTimestep(SIM_DT);
  }

  function freeformApply() {
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (!refs[part.comp]) continue;
      if (part.kind === 'toggle') circuit.setSwitch(refs[part.comp], part.closed);
      else if (part.kind === 'resistor' || part.kind === 'lamp' || part.kind === 'motor') {
        circuit.setResistance(refs[part.comp], part.value);
      }
    }
  }

  function stepSim(dt) {
    if (spec.freeform) {
      if (freeformDirty) { rebuildFreeform(); freeformDirty = false; }
      freeformApply();
    } else {
      if (spec.topologyKey && spec.topologyKey(P) !== topoKey) rebuild();
      spec.apply(refs, P, circuit);
    }
    // Сгоревший резистивный элемент физически размыкается сам — не надо
    // писать это в каждом уровне отдельно.
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.burnt && part.comp && refs[part.comp] && refs[part.comp].resistance !== undefined) {
        circuit.setResistance(refs[part.comp], 1e9);
      }
    }
    sol = circuit.step(dt);
    // Пик тока живёт доли кадра: если смотреть раз в кадр, разряд
    // конденсатора почти всегда будет пойман уже на спаде.
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (!part.comp) continue;
      const i = Math.abs(compI(part.comp));
      if (i > (part.iMax || 0)) part.iMax = i;
    }
  }

  // Дым и искры сгорания. Сгорание — лучший урок в игре («дал слишком много
  // тока — сгорело»), и оно должно быть заметным и немного весёлым, а не
  // только красной надписью. Частицы живут в координатах платы, время —
  // собственное (performance.now), чтобы дым шёл и на паузе, и во время
  // экрана победы — плата при этом не пересчитывается.
  let smoke = [];
  function puff(part, n, big) {
    const now = performance.now() / 1000;
    for (let k = 0; k < n; k++) {
      const spark = big && k % 3 === 0;
      smoke.push({
        x: part.pos.x + (Math.random() - 0.5) * 16, y: part.pos.y - 4,
        vx: (Math.random() - 0.5) * (spark ? 260 : 36),
        vy: -(spark ? 120 + Math.random() * 160 : 26 + Math.random() * 30),
        born: now, life: spark ? 0.5 + Math.random() * 0.3 : (big ? 1.8 : 1.3) + Math.random(),
        r: big ? 8 + Math.random() * 8 : 4 + Math.random() * 3, spark,
      });
    }
    if (smoke.length > 220) smoke = smoke.slice(-220);
  }
  function drawSmoke(ctx) {
    if (!smoke.length) return;
    const now = performance.now() / 1000;
    smoke = smoke.filter((s) => now - s.born < s.life);
    ctx.save();
    for (const s of smoke) {
      const t = now - s.born, k = t / s.life;
      const x = s.x + s.vx * t, y = s.y + s.vy * t + (s.spark ? 260 * t * t : 0);
      if (s.spark) {
        ctx.fillStyle = colorToCss(Pal.WARN, 1 - k);
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(150,150,155,' + (0.42 * (1 - k)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x + Math.sin(t * 3 + s.r) * 6, y, s.r * (1 + k * 1.6), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function nodeV(name) {
    if (name === 'GND' || name === undefined) return 0;
    const v = sol.nodeVoltage[name];
    return v === undefined ? 0 : v;
  }
  // Ток детали по её имени в решателе. Знак приводится к сетям детали:
  // перевёрнутый диод физически добавлен в цепь задом наперёд, и решатель
  // считает его ток в обратную сторону (`iSign`). Без этой поправки дорожка
  // рядом с ним анимируется против настоящего тока, а приборы, читающие ток
  // напрямую, показывают минус там, где его нет.
  function compI(name) {
    const v = sol.componentCurrent[name];
    if (v === undefined) return 0;
    for (const id of Object.keys(P)) {
      if (P[id].comp === name && P[id].iSign === -1) return -v;
    }
    return v;
  }

  // Напряжение, ток и мощность на каждой детали — для приборов, подсказки
  // под курсором и модели нагрева.
  function measureParts(dt) {
    lampLight = 0;
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.nets) {
        part.u = nodeV(part.nets[0]) - nodeV(part.nets[1]);
        part.i = part.comp ? compI(part.comp) : 0;
        part.p = Math.abs(part.u * part.i);
      } else {
        part.u = 0; part.i = 0; part.p = 0;
      }

      if (part.rated && part.rated.pMax && !part.burnt) {
        const target = part.p / part.rated.pMax;
        part.heat = approach(part.heat, target, 1 / (part.rated.tau || 0.7), dt);
        if (part.heat > 1.0) {
          part.burnt = true;
          part.heat = 1.0;
          puff(part, 22, true);
          playSound(Audio.burn);
          flash('Деталь сгорела: ' + (part.name || part.silk || 'элемент'), 'bad');
        }
      } else if (part.burnt) {
        part.heat = approach(part.heat, 0, 1.2, dt);
        // Сгоревшая деталь ещё дымится тонкой струйкой.
        if (Math.random() < dt * 2.5) puff(part, 1, false);
      }

      if (part.rated && part.rated.pNom) {
        part.bright = part.burnt ? 0 : clamp(Math.pow(clamp(part.p / part.rated.pNom, 0, 1), 0.85), 0, 1);
        lampLight = Math.max(lampLight, part.bright);
      }

      // Предохранитель сгорел по току — звук «пшш»
      if (part.kind === 'fuse' && part.blown && !part._blownPlayed) {
        part._blownPlayed = true;
        puff(part, 12, true);
        playSound(Audio.fuseBlow);
      }
      if (part.kind === 'fuse' && !part.blown) {
        part._blownPlayed = false;
      }

      if (part.kind === 'motor') {
        const rpm = clamp(part.i / (part.rated && part.rated.iNom ? part.rated.iNom : 0.2), -1.5, 1.5);
        part.rpm = rpm;
        part.spin += rpm * dt * 14;
        // Мотор жужжит, когда крутится
        if (Math.abs(rpm) > 0.05) {
          if (!motorNodes[id]) {
            motorNodes[id] = playSound(() => Audio.motorHum(55 + Math.abs(rpm) * 40));
          }
        } else if (motorNodes[id]) {
          motorNodes[id].stop();
          motorNodes[id] = null;
        }
      }
      if (part.kind === 'capacitor' && part.vMax) part.charge = clamp(part.u / part.vMax, 0, 1);
      if (part.kind === 'toggle' || part.kind === 'button') {
        part.anim = approach(part.anim, part.closed ? 1 : 0, 22, dt);
      }
    }
  }

  function flash(textValue, tone) {
    flashMsg = { text: textValue, tone, until: elapsed + 2.6 };
  }

  // --- Самописец ------------------------------------------------------------
  // Мгновенное число на приборе не показывает, что происходит ВО ВРЕМЕНИ:
  // как наливается конденсатор, с каким периодом щёлкает реле, как ползёт
  // нагрев. Лента с историей показывает — и заодно видно, держится ли
  // величина в нужном коридоре или только что через него проскочила.

  const SCOPE_RECT = { x: board.x, y: board.y + board.h + 22, w: board.w, h: 84 };
  const SCOPE_HZ = 30;
  const SCOPE_SPAN = 10; // секунд в окне
  let scopeData = [];
  let scopeAccum = 0;

  function scopeSample(dt) {
    if (!spec.scope) return;
    scopeAccum += dt;
    const step = 1 / SCOPE_HZ;
    while (scopeAccum >= step) {
      scopeAccum -= step;
      scopeData.push(spec.scope.get(m, P));
      if (scopeData.length > SCOPE_HZ * SCOPE_SPAN) scopeData.shift();
    }
  }

  function drawScope(ctx) {
    if (!spec.scope) return;
    const s = spec.scope;
    const { x, y, w, h } = SCOPE_RECT;
    const fmt = s.fmt || fmtAmps;

    fillRound(ctx, x, y, w, h, 8, rgba(0.035, 0.045, 0.055, 0.92));
    strokeRound(ctx, x, y, w, h, 8, colorToCss(Pal.BOARD_EDGE, 0.9), 1.4);

    // График, сетка и коридор цели живут в чуть уменьшенной по высоте
    // области: подписи сверху («label» и текущее число) и снизу («10 с
    // назад» / «сейчас») рисуются поверх поля, и коридор у самого края
    // раньше заливал их бегущей заливкой — читать становилось нечем.
    const PAD_TOP = 20, PAD_BOTTOM = 16;
    const py = y + PAD_TOP, ph = Math.max(10, h - PAD_TOP - PAD_BOTTOM);

    ctx.save();
    roundRectPath(ctx, x, y, w, h, 8); ctx.clip();

    // Сетка: по горизонтали — секунды, по вертикали — доли шкалы.
    ctx.strokeStyle = rgba(1, 1, 1, 0.05); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < SCOPE_SPAN; i++) { const gx = x + (w * i) / SCOPE_SPAN; ctx.moveTo(gx, py); ctx.lineTo(gx, py + ph); }
    for (let i = 1; i < 4; i++) { const gy = py + (ph * i) / 4; ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
    ctx.stroke();

    const toY = (v) => py + ph - clamp((v - s.min) / (s.max - s.min || 1), 0, 1) * ph;

    // Коридор, в который надо попасть, — видно, а не только написано.
    if (s.band) {
      const y0 = toY(s.band[1]), y1 = toY(s.band[0]);
      ctx.fillStyle = colorToCss(Pal.ACCENT, 0.1);
      ctx.fillRect(x, y0, w, y1 - y0);
      ctx.strokeStyle = colorToCss(Pal.ACCENT, 0.28);
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w, y0); ctx.moveTo(x, y1); ctx.lineTo(x + w, y1); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (scopeData.length > 1) {
      const n = SCOPE_HZ * SCOPE_SPAN;
      const pts = scopeData.map((v, i) => vec(x + w - (scopeData.length - 1 - i) * (w / n), toY(v)));
      ctx.save();
      ctx.strokeStyle = colorToCss(Pal.ACCENT, 0.95);
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.shadowColor = colorToCss(Pal.ACCENT, 0.7);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
      const last = pts[pts.length - 1];
      fillCircle(ctx, last, 2.6, colorToCss(Pal.WARN));
    }
    ctx.restore();

    // Подписи самописца рисуются на холсте и уменьшались вместе со сценой:
    // на планшете 9 px превращались в 6. Растут на тот же коэффициент, что и
    // панели интерфейса (main.js, applyUiBoost).
    const uk = window.UI_K || 1;
    text(ctx, s.label, vec(x + 10, y + 12), { size: 11 * uk, align: 'left', color: colorToCss(Pal.TEXT_DIM) });
    text(ctx, fmt(spec.scope.get(m, P) || 0), vec(x + w - 10, y + 12), {
      size: 12 * uk, align: 'right', color: colorToCss(Pal.WARN), font: '"Consolas", monospace',
    });
    text(ctx, '10 с назад', vec(x + 10, y + h - 9), { size: 9 * uk, align: 'left', color: colorToCss(Pal.TEXT_DIM, 0.6) });
    text(ctx, 'сейчас', vec(x + w - 10, y + h - 9), { size: 9 * uk, align: 'right', color: colorToCss(Pal.TEXT_DIM, 0.6) });
  }

  // --- Мышь -----------------------------------------------------------------

  function toLevelCoords(clientX, clientY) {
    // Считаем от холста (#world), а не от всей сцены: на экране выше 16:9
    // сцена выше холста, и холст опущен внутри неё (main.js, applyStageHeight).
    const rect = document.getElementById('world').getBoundingClientRect();
    const sx = rect.width / 1600;
    const eff = effScale();
    return vec(((clientX - rect.left) / sx - CENTER.x) / eff + boardPan.x, ((clientY - rect.top) / sx - CENTER.y) / eff + boardPan.y);
  }
  function toScreen(p) { return addV(scaleV(subV(p, boardPan), effScale()), CENTER); }

  function partAt(p) {
    let best = null, bestDist = Infinity;
    for (const id of Object.keys(P)) {
      const part = P[id];
      const box = partHit(part);
      const dx = Math.abs(p.x - part.pos.x), dy = Math.abs(p.y - part.pos.y);
      if (dx <= box.w / 2 + 4 && dy <= box.h / 2 + 4) {
        const d = dx + dy;
        if (d < bestDist) { bestDist = d; best = part; }
      }
    }
    return best;
  }

  function onMouseMove(e) {
    if (boardDrag) {
      const stage = document.getElementById('stage');
      const rect = stage.getBoundingClientRect();
      const sx = rect.width / 1600;
      const eff = effScale();
      boardPan.x -= (e.clientX - boardDrag.lastX) / sx / eff;
      boardPan.y -= (e.clientY - boardDrag.lastY) / sx / eff;
      boardDrag.lastX = e.clientX; boardDrag.lastY = e.clientY;
      mouse = toLevelCoords(e.clientX, e.clientY);
      document.getElementById('world').style.cursor = 'grabbing';
      return;
    }
    mouse = toLevelCoords(e.clientX, e.clientY);
    if (dragTap) {
      const end = dragTap.cn[dragTap.key];
      const src = connections.find((c) => c.id === end.tapOf);
      // Долю считаем по ТОМУ ЖЕ пути, который сейчас нарисован
      // (rawWirePts), иначе точка поедет не туда, куда её ведёт курсор.
      if (src) end.frac = fracAlong(rawWirePts(src), mouse);
      return;
    }
    if (dragPart) {
      dragPart.part.pos.x = mouse.x;
      dragPart.part.pos.y = mouse.y;
      return;
    }
    if (dragKnob) {
      const part = dragKnob.part;
      const delta = (dragKnob.lastY - e.clientY) * 0.006;
      dragKnob.lastY = e.clientY;
      setKnob(part, clamp((part.knob || 0) + delta, 0, 1));
      return;
    }
    hover = partAt(mouse);
    const canvas = document.getElementById('world');
    // Пустое место платы теперь тоже «хватается» — панорама, — поэтому
    // курсор-рука уместна и там, а не только над деталью.
    if (spec.freeform && tool !== 'idle') {
      // crosshair уже выставлен updateToolButtons() при выборе инструмента
    } else if (hover && hover.interact) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'grab';
    }
  }

  function setKnob(part, k) {
    part.knob = k;
    if (part.interact.map) part.value = part.interact.map(k);
    persist();
  }

  // --- Свободная сборка: расстановка и разводка -----------------------------

  // Палец попадает хуже курсора: зоны попадания по выводам и проводам для
  // него шире. Иначе на планшете вывод размером в несколько пикселей просто
  // не поймать.
  function reach(n) { return fingerInput ? n * 1.8 : n; }

  function terminalAt(p) {
    let best = null, bestDist = reach(14);
    for (const id of Object.keys(P)) {
      const part = P[id];
      const terms = Parts[part.kind].terminals(part);
      for (const key of Object.keys(terms)) {
        const gp = addV(part.pos, rotateOffset(terms[key], part.rot));
        const d = distV(p, gp);
        if (d < bestDist) { bestDist = d; best = { p: id, t: key, pos: gp }; }
      }
    }
    return best;
  }

  function connectionPoints(cn) {
    return rawWirePts(cn);
  }

  // Точка отвода — второе, что на плате можно двигать, помимо самих
  // деталей. Она не имеет собственных координат: живёт долей пути вдоль
  // чужого провода, — поэтому «подвинуть» её значит поменять эту долю,
  // то есть проехать по шине, а не улететь от неё в сторону. Так и на
  // настоящей плате: место пайки отвода можно выбрать где угодно вдоль
  // дорожки, но не рядом с ней.
  function tapAt(p) {
    let best = null, bestDist = reach(10);
    for (const cn of connections) {
      for (const key of ['a', 'b']) {
        if (cn[key].tapOf === undefined) continue;
        const d = distV(endpointPos(cn[key]), p);
        if (d < bestDist) { bestDist = d; best = { cn, key }; }
      }
    }
    return best;
  }

  function wireAt(p) {
    for (const cn of connections) if (distToPath(connectionPoints(cn), p) < reach(10)) return cn;
    return null;
  }

  // Конец нового провода: обычный вывод детали, а если рядом нет вывода —
  // точка на пути УЖЕ существующего провода (отвод от шины, как в
  // фиксированных уровнях). Так собирают общую шину и на настоящей плате:
  // не обязательно попадать в вывод, достаточно коснуться дорожки.
  function terminalOrTapAt(p) {
    const t = terminalAt(p);
    if (t) return t;
    const w = wireAt(p);
    if (!w) return null;
    const pts = connectionPoints(w);
    const frac = fracAlong(pts, p);
    return { tapOf: w.id, frac, pos: pointAlong(pts, frac) };
  }

  // Что именно сотрёт ластик в этой точке. Провод почти всегда подходит
  // вплотную к детали — он и подключается прямо на её вывод, — поэтому
  // проверяем провод ПЕРВЫМ: иначе клик ровно там, где видна неправильная
  // пайка (то есть у самого вывода), стирал бы деталь целиком, хотя
  // игрок целился именно в этот один провод.
  function eraseTargetAt(p) {
    const wire = wireAt(p);
    if (wire) return { kind: 'wire', wire };
    const part = partAt(p);
    if (part) return { kind: 'part', part };
    return null;
  }

  // Точки, где к этой дорожке что-то припаяно: отводы других проводов и
  // концы чужих проводов, попавшие ровно на её путь. Это ровно те места,
  // где render рисует паяный пятак, — ластик обязан резать там же, где
  // игрок видит узел, а не по какой-то своей отдельной логике.
  // Возвращает доли пути 0..1 по возрастанию, БЕЗ самих концов дорожки.
  function wireNodeFracs(cn) {
    const pts = connectionPoints(cn);
    const fracs = [];
    for (const other of connections) {
      if (other.id === cn.id) continue;
      for (const end of [other.a, other.b]) {
        let f = null;
        if (end.tapOf === cn.id) f = clamp(end.frac, 0, 1);
        else {
          const ep = endpointPos(end);
          if (distToPath(pts, ep) < 2) f = fracAlong(pts, ep);
        }
        if (f === null || f < 0.02 || f > 0.98) continue;
        if (fracs.some((g) => Math.abs(g - f) < 0.02)) continue;
        fracs.push(f);
      }
    }
    return fracs.sort((x, y) => x - y);
  }

  // Что именно вырежет ластик в этой точке. Если между концами дорожки
  // есть узлы — только КУСОК между двумя соседними, а не вся дорожка: она
  // выглядит как несколько участков, разделённых пятаками, и вести себя
  // обязана так же. Целиком уходит только дорожка без узлов внутри.
  function cutPlan(cn, p) {
    const pts = connectionPoints(cn);
    const nodes = wireNodeFracs(cn);
    if (!nodes.length) return { wire: cn, pts, whole: true, seg: pts };
    const f = fracAlong(pts, p);
    const bounds = [0].concat(nodes, [1]);
    let i = 0;
    while (i < bounds.length - 2 && bounds[i + 1] < f) i++;
    const lo = bounds[i], hi = bounds[i + 1];
    return { wire: cn, pts, whole: false, lo, hi, seg: subPath(pts, lo, hi) };
  }

  // Кусок ломаной между двумя долями пути — и для подсветки, и чтобы
  // знать, где именно у огрызков окажутся срезы.
  function subPath(pts, f0, f1) {
    const total = pathLength(pts) || 1;
    const t0 = f0 * total, t1 = f1 * total;
    const out = [pointAlong(pts, f0)];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += distV(pts[i - 1], pts[i]);
      if (acc > t0 && acc < t1) out.push(pts[i]);
    }
    out.push(pointAlong(pts, f1));
    return out;
  }

  // Вырезать участок дорожки между двумя соседними узлами. Дорожка
  // распадается на два огрызка, и всё, что было припаяно к каждой
  // половине, ПЕРЕЕЗЖАЕТ на свой огрызок, а не стирается вместе с ней —
  // именно из-за каскадного удаления раньше пропадала целая ветка.
  // Доли отводов пересчитываются: огрызок короче исходной дорожки, и
  // старая доля указывала бы совсем в другое место.
  function cutWire(plan) {
    const cn = plan.wire, lo = plan.lo, hi = plan.hi, pts = plan.pts;
    let left = null, right = null;
    if (lo > 0.001) {
      const id = 'w' + (++placeCounter);
      left = { id, a: cn.a, b: { at: pointAlong(pts, lo), net: 'cut_' + id + '_b' } };
    }
    if (hi < 0.999) {
      const id = 'w' + (++placeCounter);
      right = { id, a: { at: pointAlong(pts, hi), net: 'cut_' + id + '_a' }, b: cn.b };
    }

    const dead = [];
    for (const other of connections) {
      for (const end of [other.a, other.b]) {
        if (end.tapOf !== cn.id) continue;
        const f = clamp(end.frac, 0, 1);
        if (f <= lo + 0.001 && left) {
          end.tapOf = left.id;
          end.frac = clamp(f / lo, 0, 1);
        } else if (f >= hi - 0.001 && right) {
          end.tapOf = right.id;
          end.frac = clamp((f - hi) / (1 - hi), 0, 1);
        } else {
          // Отвод сидел ровно на вырезанном куске (или на конце, от
          // которого ничего не осталось) — держаться ему больше не за что.
          dead.push(other.id);
        }
      }
    }

    connections = connections.filter((c) => c.id !== cn.id);
    if (left) connections.push(left);
    if (right) connections.push(right);
    if (dead.length) removeWiresCascade(dead);
  }

  // Огрызок, у которого место среза больше ни с чем не граничит, — мёртвый
  // провод: он ведёт из вывода в пустоту, тока по нему быть не может
  // никогда, и на плате он выглядит как «провод непонятно как торчит».
  // Появляется не в момент реза (тогда на срезе ещё стоял узел), а позже —
  // когда игрок стирает то, ради чего срез и остался. Поэтому проверяем
  // после КАЖДОГО стирания, а не только после cutWire, и в цикле: убрали
  // один огрызок — соседний мог осиротеть следом.
  function dropDeadStubs() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const cn of connections) {
        const free = [cn.a, cn.b].filter((e) => e.at !== undefined);
        if (!free.length) continue;
        // К огрызку кто-то припаян отводом — значит он работает куском шины.
        if (connections.some((o) => o.id !== cn.id && [o.a, o.b].some((e) => e.tapOf === cn.id))) continue;
        const dead = free.some((f) => !connections.some((o) => o.id !== cn.id
          && [o.a, o.b].some((e) => distV(endpointPos(e), f.at) < 3)));
        if (!dead) continue;
        removeWiresCascade([cn.id]);
        changed = true;
        break;
      }
    }
  }

  function eraseAt(p) {
    const target = eraseTargetAt(p);
    if (!target) return;
    if (target.kind === 'wire') {
      const plan = cutPlan(target.wire, p);
      if (plan.whole) removeWiresCascade([target.wire.id]);
      else cutWire(plan);
    } else {
      delete P[target.part.id];
      const direct = connections.filter((cn) => cn.a.p === target.part.id || cn.b.p === target.part.id).map((cn) => cn.id);
      removeWiresCascade(direct);
    }
    dropDeadStubs();
    freeformDirty = true;
    persist();
  }

  // Стереть провода по id и вместе с ними — все отводы, которые к ним
  // цеплялись (и отводы от отводов, и так далее): иначе после удаления
  // провода-«шины» отвод от неё остался бы висеть, ссылаясь на id,
  // которого больше нет — endpointNet тогда молча подставляет 'GND',
  // и отвод электрически перестаёт значить то, что нарисован.
  function removeWiresCascade(ids) {
    const toRemove = new Set(ids);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cn of connections) {
        if (toRemove.has(cn.id)) continue;
        const depends = (end) => end.tapOf !== undefined && toRemove.has(end.tapOf);
        if (depends(cn.a) || depends(cn.b)) { toRemove.add(cn.id); changed = true; }
      }
    }
    connections = connections.filter((cn) => !toRemove.has(cn.id));
  }

  function placeAt(kind, p) {
    const id = 'p' + (++placeCounter);
    const snapped = vec(Math.round(p.x / 20) * 20, Math.round(p.y / 20) * 20);
    const part = Object.assign({ id, kind, pos: snapped }, spec.sandbox.make(kind));
    if (part.silk) part.silk += id.replace(/^p/, '');
    finalizePart(part);
    P[id] = part;
    freeformDirty = true;
    persist();
  }

  function handleFreeformTool(p) {
    if (tool === 'place' && placeKind) {
      placeAt(placeKind, p);
      tool = 'idle'; placeKind = null;
      updateToolButtons();
    } else if (tool === 'wire') {
      const t = terminalOrTapAt(p);
      if (!t) { pendingWire = null; return; }
      if (!pendingWire) { pendingWire = t; return; }
      if (sameEndpoint(pendingWire, t)) { pendingWire = null; return; }
      // Тот же провод второй раз проводить незачем: электрически это
      // ничего не меняет (два резистора по 1 мОм параллельно), а на плате
      // две дорожки между одной парой точек ложатся почти одна на другую и
      // расходятся узкой «шпилькой» — выглядит как дефект отрисовки, хотя
      // это честно два провода. Проще не давать создать второй.
      if (connections.some((c) => sameConnection(c, { a: pendingWire, b: t }))) {
        pendingWire = null;
        flash('Тут уже есть провод', 'bad');
        return;
      }
      connections.push({ id: 'w' + (++placeCounter), a: stripPos(pendingWire), b: stripPos(t) });
      pendingWire = null;
      freeformDirty = true;
      persist();
    } else if (tool === 'erase') {
      eraseAt(p);
    } else if (tool === 'rotate') {
      rotatePartAt(p);
    }
  }

  // Поворот на 90°. Правая кнопка мыши (onContextMenu) и инструмент
  // «Повернуть» для экрана без правой кнопки идут через одну функцию —
  // иначе два способа повернуть деталь рано или поздно разошлись бы.
  function rotatePartAt(p) {
    const part = partAt(p);
    if (!part) return;
    part.rot = ((part.rot || 0) + Math.PI / 2) % (Math.PI * 2);
    persist();
  }

  // Клик по интерфейсу (список номиналов, кнопки, панели) не должен
  // считаться кликом по плате: иначе mousedown по пункту списка сначала
  // закрывал бы сам список, и выбор не срабатывал никогда.
  function isWorldTarget(e) {
    const id = e.target && e.target.id;
    return id === 'world' || id === 'stage';
  }

  // Сброс всего, что «тащат». Нужен, когда обычное нажатие вдруг оказалось
  // началом жеста двумя пальцами: первый палец уже успел схватить деталь,
  // ручку или плату, и они не должны уехать вслед за щипком.
  function cancelDrags() {
    dragKnob = null;
    boardDrag = null;
    dragTap = null;
    if (dragPart) {
      dragPart.part.pos.x = dragPart.origX;
      dragPart.part.pos.y = dragPart.origY;
      dragPart = null;
    }
    for (const id of Object.keys(P)) if (P[id].interact && P[id].interact.type === 'press') P[id].closed = false;
  }

  function pinchBoard(ratio, mid, shift) {
    const rect = document.getElementById('stage').getBoundingClientRect();
    const sx = rect.width / 1600;
    boardPan.x -= shift.x / sx / effScale();
    boardPan.y -= shift.y / sx / effScale();
    const before = toLevelCoords(mid.x, mid.y);
    viewZoom = clamp(viewZoom * ratio, ZOOM_MIN, ZOOM_MAX);
    const after = toLevelCoords(mid.x, mid.y);
    boardPan.x += before.x - after.x;
    boardPan.y += before.y - after.y;
  }

  // Мышь, палец и перо приходят одним и тем же событием pointer*, поэтому
  // тащить, нажимать и отпускать умеет любой из них. Отдельно только жест
  // двумя пальцами — его у мыши нет (там колесо).
  function onPointerDown(e) {
    if (e.pointerType !== 'mouse') fingerInput = true; else fingerInput = false;
    if (pinch.down(e)) return;
    onMouseDown(e);
  }
  function onPointerMove(e) {
    if (pinch.move(e)) return;
    onMouseMove(e);
  }
  function onPointerUp(e) {
    if (pinch.up(e)) return;
    onMouseUp(e);
  }
  function onPointerCancel(e) {
    pinch.up(e);
    cancelDrags();
  }

  function onMouseDown(e) {
    if (e.button !== 0 || !isWorldTarget(e)) return;
    Picker.close();
    const p = toLevelCoords(e.clientX, e.clientY);
    const part = partAt(p);
    // У пальца нет «наведения», подсказка с напряжением и током иначе не
    // открылась бы вовсе, а ради неё многие уровни и заведены. Берём деталь
    // под пальцем при нажатии; она остаётся выбранной, пока не нажмут
    // куда-то ещё.
    mouse = p;
    hover = part;
    // Свободная сборка, инструмент не выбран: деталь можно перетащить.
    // Различаем перетаскивание от обычного клика по сдвигу при отпускании
    // (onMouseUp) — маленький сдвиг возвращает деталь на место и ведёт
    // себя как клик (открыть номинал, щёлкнуть ключ).
    // Точку отвода проверяем ДО детали: она маленькая и часто лежит у
    // самого корпуса, так что при обратном порядке до неё было бы не
    // добраться — вместо неё всегда хваталась бы деталь.
    if (spec.freeform && tool === 'idle') {
      const tap = tapAt(p);
      if (tap) { dragTap = tap; return; }
    }
    if (spec.freeform && tool === 'idle' && part) {
      dragPart = { part, origX: part.pos.x, origY: part.pos.y };
      return;
    }
    // Пустое место платы (не деталь) и инструмент палитры сейчас не
    // занят своим смыслом клика по пустому месту (тянуть провод/ставить/
    // стирать) — значит тащат саму плату, панорама.
    if (!part && (!spec.freeform || tool === 'idle')) {
      boardDrag = { lastX: e.clientX, lastY: e.clientY };
      return;
    }
    if (!part || !part.interact) return;
    e.stopPropagation();
    const it = part.interact;
    if (it.type === 'knob') {
      dragKnob = { part, lastY: e.clientY };
    } else if (it.type === 'press') {
      part.closed = true;
      playSound(Audio.buttonPress);
      if (it.onPress) it.onPress(part, P);
    }
  }

  function onMouseUp(e) {
    if (dragKnob) { dragKnob = null; return; }
    if (boardDrag) { boardDrag = null; return; }
    // Кнопки «нажать и держать» отпускаются всегда, где бы ни оказался
    // курсор, — иначе уехавшая с детали мышь оставит их нажатыми.
    for (const id of Object.keys(P)) if (P[id].interact && P[id].interact.type === 'press') P[id].closed = false;
    // Отвод переехал по шине. Пересобирать цепь не нужно: он по-прежнему
    // сидит на том же проводе, а значит и в той же сети — поменялось
    // только место пайки.
    if (dragTap) { dragTap = null; persist(); return; }
    if (dragPart) {
      const { part, origX, origY } = dragPart;
      dragPart = null;
      const moved = Math.abs(part.pos.x - origX) + Math.abs(part.pos.y - origY);
      if (moved > 6) {
        part.pos.x = Math.round(part.pos.x / 20) * 20;
        part.pos.y = Math.round(part.pos.y / 20) * 20;
        persist();
        return;
      }
      // Почти не сдвинулось — это был клик, а не перетаскивание. Вернуть
      // точную исходную позицию и провалиться в обычный клик по детали
      // ниже (открыть номинал, щёлкнуть ключ).
      part.pos.x = origX;
      part.pos.y = origY;
    }
    // Пока активен инструмент палитры (ставить/тянуть провод/стирать) —
    // клик по плате идёт в него, а не в обычный интерактив детали.
    if (spec.freeform && tool !== 'idle') {
      if (!isWorldTarget(e)) return;
      handleFreeformTool(toLevelCoords(e.clientX, e.clientY));
      return;
    }
    if (!isWorldTarget(e)) return;
    const p = toLevelCoords(e.clientX, e.clientY);
    const part = partAt(p);
    if (!part || !part.interact) return;
    const it = part.interact;
    if (it.type === 'toggle') {
      part.closed = !part.closed;
      playSound(Audio.click);
      persist();
    } else if (it.type === 'flag') {
      part[it.field] = !part[it.field];
      playSound(Audio.click);
      persist();
    } else if (it.type === 'cycle') {
      const opts = it.values;
      const at = Math.max(0, opts.indexOf(part[it.field]));
      part[it.field] = opts[(at + 1) % opts.length];
      playSound(Audio.click);
      persist();
    } else if (it.type === 'flip') {
      part.flipped = !part.flipped;
      playSound(Audio.click);
      persist();
    } else if (it.type === 'pick') {
      const opts = typeof it.options === 'function' ? it.options(part, P) : it.options;
      // Текущий выбор для подсветки в списке: у самостоятельной детали
      // (ручка, предохранитель) это part.value, у гнезда — value внутри
      // content. part.value у гнезда не существует, и подсветка молча
      // не работала ни на одном пункте.
      const current = part.content && part.content.value !== undefined ? part.content.value : part.value;
      Picker.open(toScreen(addV(part.pos, vec(0, -partHit(part).h / 2))), it.title, opts, (opt) => {
        playSound(Audio.click);
        if (opt.content !== undefined) part.content = opt.content;
        if (opt.value !== undefined) part.value = opt.value;
        if (opt.choice !== undefined) part.choice = opt.choice;
        if (opt.repaired !== undefined) part.repaired = opt.repaired;
        if (opt.blown !== undefined) part.blown = opt.blown;
        if (opt.flipped !== undefined) part.flipped = opt.flipped;
        part.burnt = false;
        part.heat = 0;
        persist();
      }, current);
    }
  }

  // Тот же список исключений, что и у клика: колесо мыши над деталью,
  // закрытой кодексом, всплывающим списком или паузой, не должно её крутить.
  function onWheel(e) {
    if (!isWorldTarget(e)) return;
    const p = toLevelCoords(e.clientX, e.clientY);
    const part = partAt(p);
    if (part && part.interact && part.interact.type === 'knob') {
      e.preventDefault();
      setKnob(part, clamp((part.knob || 0) - Math.sign(e.deltaY) * 0.04, 0, 1));
      return;
    }
    // Не над ручкой — колесо зумит плату вместо неё, к тому же вокруг
    // точки под курсором, а не вокруг центра: приближая деталь, не хочется,
    // чтобы она убегала к краю экрана.
    e.preventDefault();
    const before = toLevelCoords(e.clientX, e.clientY);
    viewZoom = clamp(viewZoom * Math.exp(-e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
    const after = toLevelCoords(e.clientX, e.clientY);
    boardPan.x += before.x - after.x;
    boardPan.y += before.y - after.y;
  }

  // --- Сцена ---------------------------------------------------------------

  function mount() {
    instantiate();
    if (spec.freeform) { rebuildFreeform(); freeformDirty = false; } else rebuild();
    simAccum = 0; holdTime = 0; elapsed = 0; won = false; hover = null; flashMsg = null; smoke = [];
    bestAtMount = GameConfig.getDeviceOutput(spec.id);
    scopeData = []; scopeAccum = 0;
    tool = 'idle'; placeKind = null; pendingWire = null; dragPart = null; dragTap = null;
    viewZoom = 1; boardPan = vec(0, 0); boardDrag = null;

    hud = buildLevelHud(spec, {
      onBack: () => SceneManager.goto(MapScene),
      onCodex: () => CodexPanel.openOverlay(spec.codex || []),
      onRepair: () => {
        for (const id of Object.keys(P)) { if (!P[id].noReplace) { P[id].burnt = false; P[id].heat = 0; } }
        flash('Сгоревшее заменено', 'good');
      },
    });

    if (spec.freeform) buildPaletteHud();

    pinch = createPinch({ start: cancelDrags, change: pinchBoard });
    const stage = document.getElementById('stage');
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('wheel', onWheel, { passive: false });
    if (spec.freeform) stage.addEventListener('contextmenu', onContextMenu);
  }

  // Правая кнопка — повернуть деталь на 90°. Отдельная от левой кнопки
  // (ставить/тащить/тянуть провод), поэтому не мешает ни одному из
  // режимов палитры — работает и в «Готово», и внутри активного
  // инструмента, всегда над той деталью, что под курсором.
  function onContextMenu(e) {
    if (!spec.freeform || !isWorldTarget(e)) return;
    e.preventDefault();
    rotatePartAt(toLevelCoords(e.clientX, e.clientY));
  }

  // Палитра деталей и инструменты (провод/ластик) — только для уровней
  // свободной сборки. Отдельная маленькая панель, а не часть общего HUD:
  // остальные 16 уровней её никогда не строят.
  function buildPaletteHud() {
    const layer = uiLayer();
    const panel = el('div', 'card sandbox-palette', layer);
    el('div', 'card-title-small', panel).textContent = 'Детали';
    // На маленьком экране длинная инструкция съедала пол-панели и палитра не
    // помещалась по высоте: сворачиваем её под «Как пользоваться». На большом
    // остаётся открытой — правило проекта: инструкция по управлению не должна
    // прятаться за кнопкой (см. «Свободная сборка» в CLAUDE.md).
    let help;
    if ((window.UI_K || 1) > 1.15) {
      const det = el('details', 'palette-details', panel);
      el('summary', 'palette-summary', det).textContent = 'Как пользоваться';
      help = el('div', 'palette-help', det);
    } else {
      help = el('div', 'palette-help', panel);
    }
    help.textContent = 'Кнопка — взять деталь, клик по плате — поставить. Уже стоящую деталь можно взять и потащить мышью — она переместится, а правым кликом или кнопкой «Повернуть» — повернуть на 90°. Точку пайки, где к проводу подходит отвод, тоже можно потащить — она поедет вдоль своего провода. «Провод»: клик по выводу, потом по другому — а если второй конец не вывод, а просто точка на уже проложенном проводе, получится отвод от него, как шина. «Ластик»: наведи — подсветится красным то, что сотрётся, клик — сотрёт; у самого вывода сотрётся именно провод, а не вся деталь, а если на проводе есть точки пайки — только участок между соседними, остальное останется на месте. Колесо мыши мимо ручки или два пальца — зум платы.';
    const grid = el('div', 'palette-grid', panel);
    const kindButtons = {};
    // Палитра бывает функцией — список открытых блоков (BlockRegistry,
    // GameConfig.hasBlock) известен только на момент входа на уровень, а
    // не на момент разбора файла спеки (тот же приём, что и у spec.wires
    // для уровней с переменной топологией).
    // Телефон: выбрал деталь или инструмент — панель убирается, иначе она
    // закрывает плату, по которой сейчас надо нажать. На большом экране
    // класса drawer-palette нет, и это ничего не делает.
    panel.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.btn')) document.documentElement.classList.remove('drawer-palette');
    });
    // Телефон: панель деталей прячется, кнопка «Детали» — в общем доке.
    const dock = layer.querySelector && layer.querySelector('.phone-dock');
    if (dock) dock.appendChild(makeButton('Детали', () => toggleDrawer('drawer-palette'), 'btn-ghost'));
    const palette = typeof spec.sandbox.palette === 'function' ? spec.sandbox.palette() : spec.sandbox.palette;
    for (const item of palette) {
      const b = makeButton(item.label, () => {
        tool = 'place'; placeKind = item.kind; pendingWire = null;
        updateToolButtons();
      }, 'btn-small');
      grid.appendChild(b);
      kindButtons[item.kind] = b;
    }
    const toolsRow = el('div', 'palette-tools', panel);
    const wireBtn = makeButton('Провод', () => {
      tool = 'wire'; placeKind = null; pendingWire = null;
      updateToolButtons();
    }, 'btn-small');
    const eraseBtn = makeButton('Ластик', () => {
      tool = 'erase'; placeKind = null; pendingWire = null;
      updateToolButtons();
    }, 'btn-small btn-danger');
    const rotateBtn = makeButton('Повернуть', () => {
      tool = 'rotate'; placeKind = null; pendingWire = null;
      updateToolButtons();
    }, 'btn-small');
    const idleBtn = makeButton('Готово', () => {
      tool = 'idle'; placeKind = null; pendingWire = null;
      updateToolButtons();
    }, 'btn-small btn-ghost');
    toolsRow.appendChild(wireBtn);
    toolsRow.appendChild(rotateBtn);
    toolsRow.appendChild(eraseBtn);
    toolsRow.appendChild(idleBtn);

    updateToolButtons = () => {
      for (const k of Object.keys(kindButtons)) kindButtons[k].classList.toggle('is-current', tool === 'place' && placeKind === k);
      wireBtn.classList.toggle('is-current', tool === 'wire');
      rotateBtn.classList.toggle('is-current', tool === 'rotate');
      eraseBtn.classList.toggle('is-current', tool === 'erase');
      const canvas = document.getElementById('world');
      canvas.style.cursor = tool === 'idle' ? 'default' : 'crosshair';
    };
    updateToolButtons();
  }

  function unmount() {
    const stage = document.getElementById('stage');
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    if (pinch) pinch.reset();
    stage.removeEventListener('wheel', onWheel);
    stage.removeEventListener('contextmenu', onContextMenu);
    Picker.close();
    Tip.drop();
    updateToolButtons = () => {};
    // Останавливаем все звуки моторов — иначе жужжание остаётся на карте
    for (const id of Object.keys(motorNodes)) {
      if (motorNodes[id] && motorNodes[id].stop) motorNodes[id].stop();
    }
    motorNodes = {};
    relayStates = {};
  }

  function update(dt) {
    elapsed += dt;
    simAccum = Math.min(simAccum + dt, 0.25);
    while (simAccum >= SIM_DT) {
      stepSim(SIM_DT);
      simAccum -= SIM_DT;
    }
    measureParts(dt);
    m = spec.read(sol, refs, P) || {};
    if (spec.tick) spec.tick(dt, P, m, refs, circuit, { flash });
    scopeSample(dt);

    // Реле: щелчок при переключении
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind === 'relay' && part.closedNow !== undefined) {
        if (part.closedNow !== relayStates[id]) {
          relayStates[id] = part.closedNow;
          playSound(Audio.relayClick);
        }
      }
    }

    // Кнопка замены не должна чинить то, для чего запасной детали нет:
    // перегоревшая лампа гирлянды — часть задачи, а не расходник.
    m.anyBurnt = Object.keys(P).some((id) => P[id].burnt && !P[id].noReplace);

    const g = spec.goal(m, P);
    if (g.ok) holdTime = Math.min(holdTime + dt, spec.hold);
    else holdTime = Math.max(0, holdTime - dt * 2.2);

    const score = clamp(spec.score(m, P), 0, 1);
    if (g.ok) GameConfig.setDeviceOutput(spec.id, score);

    if (!won && g.ok && holdTime >= spec.hold) {
      won = true;
      GameConfig.setDeviceOutput(spec.id, score);
      // Разблокировка блоков (см. BLOCKS.md): связь «уровень → блок» живёт
      // ОДИН раз, на самом блоке (BlockRegistry: unlockedBy), а не
      // дублируется полем на спеке уровня — два места хранили бы один факт
      // и рано или поздно разошлись бы молча. unlockBlock идемпотентна,
      // flash — только при первой настоящей разблокировке, не при каждом
      // повторном прохождении уже открытого уровня.
      for (const b of BlockRegistry.list) {
        if (b.unlockedBy === spec.id && GameConfig.unlockBlock(b.id)) {
          flash('Новый блок в Верстаке: «' + b.title + '»', 'good');
        }
      }
      // Узел, открытый через map.needs, висит на карте без кабеля к этому
      // уровню — игрок сам его не найдёт, поэтому о нём говорит экран победы
      // (flash на плате живёт 2,6 с и прячется под этим экраном).
      const unlocks = [];
      if (bestAtMount <= GameConfig.REPAIRED_THRESHOLD) {
        // Карта при следующем входе покажет, как этот прибор оживает (map.js).
        // Не сохраняется: после перезагрузки анимация уже не нужна.
        GameConfig.justRepaired = spec.id;
        if (LevelRegistry.isKids(spec.id) && LevelRegistry.kidsDone()) {
          unlocks.push('Детская дорога пройдена! Открыт инженерный режим: на карте появились ещё '
            + (LevelRegistry.list.length - LevelRegistry.kidsPath.length) + ' узлов посложнее.');
        }
        for (const d of LevelRegistry.list) {
          const n = d.map && d.map.needs;
          if (n && n.indexOf(spec.id) >= 0 && n.every((id) => GameConfig.isRepaired(id))) {
            unlocks.push('Открылся новый узел: «' + d.title + '». Ищи его на карте.');
          }
        }
      }
      // Возврат на уже настроенный прибор не должен снова показывать
      // экран победы — только если игрок реально сделал лучше, чем было.
      const worthShowing = bestAtMount <= GameConfig.REPAIRED_THRESHOLD || score > bestAtMount + 0.01;
      const nxt = LevelRegistry.nextToPlay(spec.id);
      if (worthShowing) showWinOverlay(spec, {
        score,
        scoreNote: spec.scoreNote ? spec.scoreNote(m, P, score) : '',
        next: nxt,
        unlocks,
      }, {
        onNext: () => SceneManager.goto(nxt ? nxt.scene : MapScene),
        onMap: () => SceneManager.goto(MapScene),
      });
    }

    const st = spec.status(m, P);
    hud.setStatus(st[0], st[1]);
    hud.setMeter(spec.meter(m, P));
    const held = g.ok && holdTime >= spec.hold;
    // spec.gauge: цель как шкала «мало — в самый раз — много». Величину и
    // зелёную зону берёт у самописца (spec.scope) — там они уже есть и
    // совпадают с условием победы. Подпись «мало/много» словами заменяет
    // число из goal.note; число остаётся на приборах. Ноль (пусто, сгорело,
    // разомкнуто) объясняет сам уровень, поэтому там остаётся его note.
    let gaugeNote = null;
    if (spec.gauge && spec.scope) {
      const sc = spec.scope, gg = spec.gauge;
      const v = sc.get(m, P), span = sc.max - sc.min;
      const pos = isBadNum(v) ? 0 : (v - sc.min) / span;
      hud.setGauge({
        pos, a: (sc.band[0] - sc.min) / span, b: (sc.band[1] - sc.min) / span,
        lowWord: gg.lowWord || 'мало', highWord: gg.highWord || 'много',
      });
      const alive = !m.anyBurnt && !isBadNum(v) && Math.abs(v) > span * 0.01;
      if (alive && v < sc.band[0]) gaugeNote = gg.low;
      else if (alive && v > sc.band[1]) gaugeNote = gg.high;
    }
    hud.setGoal(
      g.text || spec.goalText,
      spec.hold > 0 ? holdTime / spec.hold : (g.ok ? 1 : 0),
      g.ok
        ? (holdTime >= spec.hold ? 'Держится стабильно.' : 'Держим… ' + (spec.hold - holdTime).toFixed(1) + ' с')
        : (gaugeNote || g.note || 'Условие пока не выполнено.'),
      held,
    );
    hud.repairBtn.style.display = m.anyBurnt ? '' : 'none';

    updateTip();
  }

  function updateTip() {
    if (Picker.isOpen() || !hover) { Tip.hide(); return; }
    const rows = [];
    // Земля не участвует в общей ветке ниже (у неё нет `nets`, это точка
    // подключения, а не деталь с двумя выводами), и без этой строки на неё
    // вообще нельзя навести мышь и что-то увидеть — просто безымянный
    // значок. Игрок спросил напрямую: «зачем земля, если цепь и так от
    // плюса к минусу» — ответ и есть эта строка: земля и есть тот самый
    // минус, просто она называется так, потому что это общий провод сразу
    // для всех деталей платы, а не только для одной ветки.
    if (hover.kind === 'ground') {
      rows.push(['', 'Общий обратный провод. Электрически то же самое, что минус источника.']);
    }
    if (hover.nets) {
      rows.push(['Напряжение', fmtVolts(hover.u)]);
      if (hover.comp) rows.push(['Ток', fmtAmps(hover.i)]);
      if (hover.comp) rows.push(['Мощность', fmtWatts(hover.p)]);
    }
    if (hover.rated && hover.rated.pMax) {
      rows.push(['Нагрев', Math.round(clamp(hover.heat, 0, 1) * 100) + '%']);
    }
    // Пока активен инструмент палитры, обычная подсказка детали
    // («Нажми, чтобы сменить номинал» и т. п.) врёт — клик сейчас делает
    // не то, что она обещает (сотрёт деталь, а не откроет список).
    if (spec.freeform && tool === 'erase') {
      rows.push(['', 'Ластик: клик сотрёт']);
    } else if (spec.freeform && tool === 'place') {
      rows.push(['', 'Клик поставит сюда новую деталь']);
    } else if (spec.freeform && tool === 'wire') {
      // Подсказка по выводу уже на экране — подсвеченный кружок.
    } else if (spec.freeform && tool === 'rotate') {
      rows.push(['', 'Клик повернёт на 90°']);
    } else if (hover.interact) {
      rows.push(['', hover.interact.hint || 'Нажми, чтобы изменить']);
    }
    if (!rows.length) return;
    Tip.show(toScreen(hover.pos), hover.name || hover.silk || (hover.kind === 'ground' ? 'Земля' : ''), rows);
  }

  function render(ctx) {
    Board.drawBackdrop(ctx, 1600, 900);

    ctx.save();
    ctx.translate(CENTER.x, CENTER.y);
    ctx.scale(effScale(), effScale());
    ctx.translate(-boardPan.x, -boardPan.y);

    Board.drawPlate(ctx, board, { lit: clamp(0.12 + lampLight * 0.8, 0, 1), silk: spec.silk, decorSeed: spec.index });

    // Дорожки под деталями. Список может быть функцией: в уровнях, где
    // игрок меняет саму топологию, провода обязаны меняться вместе с ней.
    // В свободной сборке провода не заданы автором уровня вообще — их
    // список строится из того, что игрок реально протянул.
    const wireList = spec.freeform ? freeformWireList() : (typeof spec.wires === 'function' ? spec.wires(P) : spec.wires);
    // Рисуем не сами объекты `wireList`, а СЦЕПКИ (wireChains): два объекта,
    // встретившиеся конец-в-конец без настоящей развилки между ними (см.
    // wireJunctions), физически одна и та же дорожка меди, только Rig не
    // умеет описать рельс и ряд одним объектом. Рисовать их раздельными
    // обводками — получить шов на ровном месте: у каждой обводки свой
    // пунктир начинается заново от своей точки и на стыке не совпадает.
    // Игрок поймал это именно там, где до этого убрали лишний пятак —
    // без пятака шов стало видно, и это надо было не спрятать обратно
    // пятаком, а убрать по-настоящему, склеив дорожку в одну.
    for (const chain of wireChains(wireList)) {
      const w = chain.w;
      const viaCur = w.viaSum
        ? w.viaSum.reduce((a, v) => a + v.sign * compI(v.comp), 0)
        : (w.via ? compI(w.via) : 0);
      const rated = w.rated || 0.05;
      const reverse = wireReverse(viaCur, w.dir);
      drawTrace(ctx, chain.pts, {
        width: w.width || 6,
        flow: clamp(Math.abs(viaCur) / rated, 0, 1),
        potential: clamp(Math.abs(nodeV(w.net)) / spec.vmax, 0, 1) * 0.74,
        energized: Math.abs(nodeV(w.net)) > 0.05,
        reverse,
      });
    }

    // Узлы, где сходятся ≥2 отдельных провода не на выводе детали (шина
    // земли, общая шина питания и т. п.), — паяем такой же пятак, что и
    // на выводах. Без него в точке T-образного примыкания не видно,
    // соединены дорожки на самом деле или просто пересеклись на глаз.
    for (const p of wireJunctions(wireList)) solderPad(ctx, p, 5);

    // Пятаки под выводами — деталь стоит на плате, а не висит над ней.
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind === 'ground' || part.noPads) continue;
      const terms = part.terminals || Parts[part.kind].terminals(part);
      for (const k of Object.keys(terms)) solderPad(ctx, addV(part.pos, rotateOffset(terms[k], part.rot)), 5);
    }

    for (const id of Object.keys(P)) {
      const part = P[id];
      const box = partHit(part);
      if (part.silk) Board.silkOutline(ctx, part.pos, box.w, box.h, part.silk, lampLight);
    }

    // Сами детали.
    for (const id of Object.keys(P)) {
      const part = P[id];
      ctx.save();
      ctx.translate(part.pos.x, part.pos.y);
      if (part.rot) ctx.rotate(part.rot);
      const view = Object.assign({
        heat: part.heat || 0,
        bright: part.bright || 0,
        burnt: part.burnt,
        flow: clamp(Math.abs(part.i || 0) / (part.rated && part.rated.iNom ? part.rated.iNom : 0.05), 0, 1),
        energized: Math.abs(nodeV(part.nets ? part.nets[0] : 'GND')) > 0.05,
        potential: clamp(Math.abs(nodeV(part.nets ? part.nets[0] : 'GND')) / spec.vmax, 0, 1) * 0.74,
        anim: part.anim,
        spin: part.spin,
        rpm: part.rpm,
        charge: part.charge,
        pull: part.pull,
      }, spec.partView ? (spec.partView(part, m, P) || {}) : {});
      Parts[part.kind].draw(ctx, part, view);
      ctx.restore();

      // Подпись номинала под деталью — читается без наведения мыши.
      if (part.showValue) {
        const box = partHit(part);
        text(ctx, part.valueText ? part.valueText(part) : fmtOhms(part.value), addV(part.pos, vec(0, box.h / 2 + 12)), {
          size: 12, color: colorToCss(Pal.TEXT, 0.8), weight: '600', shadow: true,
        });
      }
    }

    drawSmoke(ctx);

    // Подсветка того, что под курсором, — сразу видно, что кликабельно.
    if (hover && hover.interact && !Picker.isOpen()) {
      const box = partHit(hover);
      ctx.save();
      ctx.strokeStyle = colorToCss(Pal.ACCENT, 0.75);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -clockNow() * 22;
      roundRectPath(ctx, hover.pos.x - box.w / 2 - 5, hover.pos.y - box.h / 2 - 5, box.w + 10, box.h + 10, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Деталь, которую сейчас тащат, — сплошная (не пунктирная) рамка:
    // видно, что она уже «в руке», а не просто под курсором.
    if (dragPart) {
      const box = partHit(dragPart.part);
      strokeRound(ctx, dragPart.part.pos.x - box.w / 2 - 5, dragPart.part.pos.y - box.h / 2 - 5, box.w + 10, box.h + 10, 7, colorToCss(Pal.WARN, 0.85), 2);
    }

    // Точка отвода под курсором — кольцо вокруг пятака: иначе по виду
    // никак не отличить точку, которую можно потащить, от нарисованной
    // пайки, которую двигать нечем.
    if (spec.freeform && tool === 'idle') {
      const t = dragTap || tapAt(mouse);
      if (t) strokeCircle(ctx, endpointPos(t.cn[t.key]), 9, colorToCss(dragTap ? Pal.WARN : Pal.ACCENT, 0.9), 2);
    }

    // В режиме «Провод» подсвечиваем саму точку — вывод детали или, если
    // рядом нет вывода, ближайшую точку на чужом проводе (отвод от шины).
    if (spec.freeform && tool === 'wire') {
      const nearMouse = terminalOrTapAt(mouse);
      if (pendingWire) {
        strokeCircle(ctx, endpointPos(pendingWire), 9, colorToCss(Pal.WARN, 0.9), 2);
      }
      if (nearMouse && !sameEndpoint(nearMouse, pendingWire)) {
        strokeCircle(ctx, nearMouse.pos, 8, colorToCss(Pal.ACCENT, 0.9), 2);
      }
    }

    // В режиме «Ластик» показываем ровно то, что сотрёт клик, — до
    // самого клика. Без этого не видно, попадёт ли ластик в провод или
    // (если рядом с выводом) в целую деталь.
    if (spec.freeform && tool === 'erase') {
      const target = eraseTargetAt(mouse);
      if (target && target.kind === 'wire') {
        ctx.save();
        ctx.strokeStyle = colorToCss(Pal.DANGER, 0.9);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = colorToCss(Pal.DANGER, 0.8);
        ctx.shadowBlur = 10;
        // Подсвечиваем ровно тот кусок, который вырежет клик, — иначе
        // ластик обещал бы стереть всю дорожку, а резал один участок.
        tracePath(ctx, cutPlan(target.wire, mouse).seg, 12);
        ctx.stroke();
        ctx.restore();
      } else if (target && target.kind === 'part') {
        const box = partHit(target.part);
        strokeRound(ctx, target.part.pos.x - box.w / 2 - 5, target.part.pos.y - box.h / 2 - 5, box.w + 10, box.h + 10, 7, colorToCss(Pal.DANGER, 0.9), 2.4);
      }
    }

    if (spec.decor) spec.decor(ctx, m, P);

    ctx.restore();

    // Самописец рисуется СВОИМ, ФИКСИРОВАННЫМ преобразованием — тем же
    // CENTER/scale, что и плата в состоянии «зум не трогали», а не живым
    // effScale()/boardPan. Раньше он был внутри общего блока трансформации
    // платы: пока масштаб был фиксированным, разницы не было, а после
    // появления зума и панорамы (см. «Зум платы и поворот детали» в
    // CLAUDE.md) прибор при zoom=2.5 просто уезжал за экран вместе с
    // платой. Прибор — часть интерфейса поверх схемы, а не часть самой
    // платы, и обязан стоять на месте независимо от того, что игрок делает
    // с видом.
    ctx.save();
    ctx.translate(CENTER.x, CENTER.y);
    ctx.scale(scale, scale);
    drawScope(ctx);
    ctx.restore();

    Board.vignette(ctx, 1600, 900, 0.55);

    if (flashMsg && elapsed < flashMsg.until) {
      const a = clamp((flashMsg.until - elapsed) / 0.6, 0, 1);
      const col = flashMsg.tone === 'bad' ? Pal.DANGER : Pal.ACCENT;
      ctx.save();
      ctx.globalAlpha = a;
      fillRound(ctx, 600, 96, 400, 40, 8, rgba(0.05, 0.05, 0.07, 0.9));
      strokeRound(ctx, 600, 96, 400, 40, 8, colorToCss(col, 0.8), 1.5);
      text(ctx, flashMsg.text, vec(800, 116), { size: 14, color: colorToCss(col), weight: '600' });
      ctx.restore();
    }
  }

  // Дорожка задаётся либо готовым списком точек, либо просто «от вывода к
  // выводу» — маршрут по прямым со сдвигом каркас построит сам. Сама функция
  // живёт снаружи (fixedWirePoints), чтобы ровно ту же геометрию считали и
  // проверки из web/tests: если развести отрисовку и проверку по разным
  // копиям одной формулы, проверка начнёт врать ровно там, где нужнее всего.
  function wirePoints(w) { return fixedWirePoints(w, refTerminal); }

  // Точки, где сходятся ≥2 РАЗНЫХ провода не на выводе детали — например,
  // общая шина земли, к которой сбоку подключаются несколько отдельных
  // отводов. Ищем это геометрически: конец одного провода лежит на пути
  // (своём или чужом) ещё хотя бы одного провода — и не важно, вершина
  // это чужой ломаной или точка на её прямом участке (T-примыкание).
  //
  // Пятак нужен РОВНО там, где есть настоящая неоднозначность:
  //   · конец провода лежит на СЕРЕДИНЕ пути другого — T-примыкание к
  //     непрерывной шине, без точки не видно, есть тут соединение или
  //     провод просто идёт рядом;
  //   · в одной точке концами сходятся ТРИ провода и больше — тоже
  //     неоднозначно, сколько их там на самом деле.
  // Простое продолжение одного провода в другой — конец ровно в конец,
  // и больше никто там не сходится, — неоднозначности не создаёт: это
  // то же самое, что обычный излом внутри одной ломаной, и пятак там
  // лишний шум. Игрок поймал ровно это на первом же уровне: точка на
  // ровном месте, где рельс питания просто поворачивает к первому ряду.
  function wireJunctions(wireList) {
    const polys = wireList.map((w) => wirePoints(w)).filter((pts) => pts.length >= 2);
    // Земля — не провод, а деталь со своим выводом, но её врезка в шину —
    // такая же настоящая развилка, как и любая другая (см. Rig: знак земли
    // сидит прямо на обратном проводе, чаще всего у него в середине пути,
    // а не на конце). Добавляем её вывод как вырожденный провод нулевой
    // длины — участвует в той же проверке, не дублируя логику.
    for (const id of Object.keys(P)) {
      const part = P[id];
      if (part.kind !== 'ground') continue;
      const ts = part.terminals || Parts.ground.terminals();
      const gp = addV(part.pos, ts.a);
      polys.push([gp, gp]);
    }
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1.5;
    const isEndpointOf = (poly, p) => near(poly[0], p) || near(poly[poly.length - 1], p);
    const found = [];
    const seen = new Set();
    polys.forEach((poly, wi) => {
      for (const p of [poly[0], poly[poly.length - 1]]) {
        let interior = 0, endpointOthers = 0;
        polys.forEach((other, oi) => {
          if (oi === wi) return;
          if (distToPath(other, p) >= 1.5) return;
          if (isEndpointOf(other, p)) endpointOthers += 1; else interior += 1;
        });
        if (interior < 1 && endpointOthers < 2) continue;
        const key = Math.round(p.x) + '_' + Math.round(p.y);
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(p);
      }
    });
    return found;
  }

  // Сцепляет объекты `wireList` в непрерывные дорожки для отрисовки: два
  // объекта одной сети, встретившиеся конец-в-конец в точке, которая НЕ
  // является настоящей развилкой (см. wireJunctions), склеиваются в одну
  // ломаную. Электрическое описание (via/dir/rated/net) при этом берётся
  // ЦЕЛИКОМ у одного объекта-«первопроходца» и не мешается по кускам с
  // другими: ток вдоль такой сцепки одинаков везде (иначе между ними стояла
  // бы настоящая развилка), поэтому направление и сила потока, посчитанные
  // по любому одному участку, верны для всей сцепки целиком, если только не
  // разворачивать точки самого этого участка при склейке — только точки
  // ДОБАВЛЯЕМЫХ соседей.
  function wireChains(wireList) {
    const items = wireList
      .map((w) => ({ w, pts: wirePoints(w) }))
      .filter((it) => it.pts && it.pts.length >= 2);
    const junctionKeys = new Set(wireJunctions(wireList).map((p) => key(p)));
    function key(p) { return Math.round(p.x) + '_' + Math.round(p.y); }
    function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) < 1.5; }

    const used = new Array(items.length).fill(false);
    const chains = [];
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const base = items[i];
      let pts = base.pts.slice(); // точки первопроходца — направление не трогаем
      let grew = true;
      while (grew) {
        grew = false;
        for (const atStart of [true, false]) {
          const tip = atStart ? pts[0] : pts[pts.length - 1];
          if (junctionKeys.has(key(tip))) continue; // настоящая развилка — дальше не сливаем
          for (let j = 0; j < items.length; j++) {
            if (used[j] || items[j].w.net !== base.w.net) continue;
            const jp = items[j].pts;
            const a = jp[0], b = jp[jp.length - 1];
            let add = null;
            if (near(a, tip)) add = jp.slice(1);
            else if (near(b, tip)) add = jp.slice(0, -1).reverse();
            if (!add) continue;
            pts = atStart ? add.reverse().concat(pts) : pts.concat(add);
            used[j] = true;
            grew = true;
            break;
          }
          if (grew) break;
        }
      }
      chains.push({ w: base.w, pts });
    }
    return chains;
  }

  function refTerminal(ref) {
    const [pid, term] = ref.split('.');
    return partTerminal(pid, term || 'a');
  }

  // Провода свободной сборки — из графа связей, а не из spec.wires.
  // Провод, который игрок только начал тянуть (первый вывод выбран,
  // второй ещё нет), рисуется как пунктир до курсора — видно, что он
  // «в работе», а не просто исчез.
  function freeformWireList() {
    // Геометрию берём из routePoints для ВСЕХ проводов без исключения —
    // и для «вывод-вывод», и для отводов. Иначе хит-тест (rawWirePts) и
    // отрисовка расходятся, и отвод садится не туда, где нарисован.
    const list = connections.map((cn) => ({
      net: endpointNet(cn.a), via: 'w_' + cn.id, rated: 0.35, pts: rawWirePts(cn),
    }));
    if (pendingWire) {
      list.push({ pts: [endpointPos(pendingWire), mouse], net: 'GND', rated: 0.35, pending: true });
    }
    return list;
  }

  const scene = { mount, unmount, update, render, spec };
  spec.scene = scene;
  return scene;
}
