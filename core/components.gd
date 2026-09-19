class_name Component
extends RefCounted
## Базовый интерфейс компонента цепи (раздел 10). Каждый компонент умеет
## одно: добавить свой вклад в MnaSystem. Порядок компонентов не важен —
## система штампуется, а не выводится аналитически.
##
## Подклассы переопределяют stamp(). Компоненты, требующие своей строки в
## MNA (источники напряжения), переопределяют needs_source_row() и
## получают присвоенный source_index перед stamp().

var node_a: int
var node_b: int
var name: String = ""

var source_index: int = -1  # присваивается Circuit, если needs_source_row()


func _init(p_node_a: int, p_node_b: int, p_name: String = "") -> void:
	node_a = p_node_a
	node_b = p_node_b
	name = p_name


func needs_source_row() -> bool:
	return false


## Переопределяется в подклассах. Ничего не делает по умолчанию.
func stamp(_system: MnaSystem) -> void:
	pass


## Ток через компонент после решения — для чтения результата и для
## условий победы (раздел 07: «ток через нагрузку в диапазоне»).
## node_voltage(node) -> float берётся из Circuit.
func current_through(_node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
	return 0.0


## Вызывается Circuit.step() сразу после current_through(), с уже
## решённым состоянием этого шага. Реактивные компоненты (Capacitor,
## Inductor) запоминают в нём своё состояние для следующего шага
## времени — раздел 10: «неявный Эйлер... хранит значение прошлого шага».
## Для остальных компонентов — пустая операция.
func advance(_node_voltage: Callable) -> void:
	pass


## true для диода и транзистора — Circuit решает такую схему не одним
## линейным проходом, а итерациями Ньютона–Рафсона (раздел 10).
func is_nonlinear() -> bool:
	return false


## Пары узлов, чьё напряжение компонент должен «угадывать» и уточнять
## по Ньютону. У диода один переход, у транзистора — два (VBE, VBC).
## Индекс в этом массиве и есть индекс, которым Circuit вызывает
## newton_delta() ниже.
func newton_junctions() -> Array:
	return []


## Один шаг Ньютона для перехода `index` (из newton_junctions()):
## компонент получает свежерешённое напряжение на этом переходе,
## обновляет свою догадку (с ограничением шага — раздел 10, «клампинг»)
## и возвращает |Δ| для проверки сходимости. Для линейных компонентов
## не вызывается.
func newton_delta(_index: int, _new_v: float) -> float:
	return 0.0


class Resistor extends Component:
	var resistance: float

	func _init(p_node_a: int, p_node_b: int, p_resistance: float, p_name: String = "") -> void:
		super._init(p_node_a, p_node_b, p_name)
		resistance = maxf(p_resistance, 1e-9)  # ноль ловит матрицу в вырождение

	func stamp(system: MnaSystem) -> void:
		system.stamp_conductance(node_a, node_b, 1.0 / resistance)

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		var va: float = node_voltage.call(node_a)
		var vb: float = node_voltage.call(node_b)
		return (va - vb) / resistance


class VoltageSource extends Component:
	var voltage: float

	func _init(p_node_a: int, p_node_b: int, p_voltage: float, p_name: String = "") -> void:
		super._init(p_node_a, p_node_b, p_name)
		voltage = p_voltage

	func needs_source_row() -> bool:
		return true

	func stamp(system: MnaSystem) -> void:
		system.stamp_voltage_source(node_a, node_b, voltage, source_index)

	func current_through(_node_voltage: Callable, source_currents: PackedFloat64Array) -> float:
		return source_currents[source_index]


class CurrentSource extends Component:
	var current: float

	func _init(p_node_a: int, p_node_b: int, p_current: float, p_name: String = "") -> void:
		super._init(p_node_a, p_node_b, p_name)
		current = p_current

	func stamp(system: MnaSystem) -> void:
		system.stamp_current_source(node_a, node_b, current)

	func current_through(_node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		return current


## Задвижка (раздел 04): замкнута — почти провод, разомкнута — почти
## бесконечное сопротивление. Никогда не 0 и не ∞ — матрица не вырождается
## (раздел 10, «Защиты»).
class Switch extends Component:
	const R_ON := 1e-3
	const R_OFF := 1e9

	var closed: bool

	func _init(p_node_a: int, p_node_b: int, p_closed: bool, p_name: String = "") -> void:
		super._init(p_node_a, p_node_b, p_name)
		closed = p_closed

	func resistance() -> float:
		return R_ON if closed else R_OFF

	func stamp(system: MnaSystem) -> void:
		system.stamp_conductance(node_a, node_b, 1.0 / resistance())

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		var va: float = node_voltage.call(node_a)
		var vb: float = node_voltage.call(node_b)
		return (va - vb) / resistance()


## Конденсатор (раздел 04: «упругая мембрана, вздувается и наливается
## светом»). Компаньонная модель неявного Эйлера (раздел 10): на каждом
## шаге времени ведёт себя как проводимость g = C/h параллельно с
## источником тока, «помнящим» напряжение прошлого шага. Без dt (вне
## переходного процесса) ничего не штампует — эквивалент разрыва цепи,
## что физически верно для DC-режима незаряжаемого конденсатора.
class Capacitor extends Component:
	var capacitance: float
	var v_prev: float = 0.0  # напряжение (va - vb) на конец прошлого шага

	var _g: float = 0.0  # проводимость, использованная в последнем stamp()

	func _init(p_node_a: int, p_node_b: int, p_capacitance: float, p_name: String = "", p_initial_voltage: float = 0.0) -> void:
		super._init(p_node_a, p_node_b, p_name)
		capacitance = maxf(p_capacitance, 1e-15)
		v_prev = p_initial_voltage

	func stamp(system: MnaSystem) -> void:
		if system.dt <= 0.0:
			_g = 0.0
			return
		_g = capacitance / system.dt
		system.stamp_conductance(node_a, node_b, _g)
		# Компаньонный источник входит с обратным порядком узлов —
		# знак вытекает из того, что заряд конденсатора *вычитается*
		# из мгновенного тока: i = g*v - g*v_prev.
		system.stamp_current_source(node_b, node_a, _g * v_prev)

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		if _g == 0.0:
			return 0.0
		var va: float = node_voltage.call(node_a)
		var vb: float = node_voltage.call(node_b)
		return _g * (va - vb) - _g * v_prev

	func advance(node_voltage: Callable) -> void:
		if _g == 0.0:
			return  # шаг был без dt — состояние не продвигаем
		v_prev = node_voltage.call(node_a) - node_voltage.call(node_b)


## Катушка (раздел 04: «тяжёлый маховик, долго раскручивается, потом не
## хочет останавливаться»). Дуальна конденсатору: компаньонная
## проводимость g = h/L, а «память» — это не напряжение, а ток прошлого
## шага, входящий с плюсом: i = g*v + i_prev. Без dt не штампует ничего —
## разрыв, а не короткое замыкание; честный DC-режим для катушки сюда
## не входит (см. ограничение в разделе 10) — в игре dt есть всегда.
class Inductor extends Component:
	var inductance: float
	var i_prev: float = 0.0  # ток (a -> b) на конец прошлого шага

	var _g: float = 0.0

	func _init(p_node_a: int, p_node_b: int, p_inductance: float, p_name: String = "", p_initial_current: float = 0.0) -> void:
		super._init(p_node_a, p_node_b, p_name)
		inductance = maxf(p_inductance, 1e-15)
		i_prev = p_initial_current

	func stamp(system: MnaSystem) -> void:
		if system.dt <= 0.0:
			_g = 0.0
			return
		_g = system.dt / inductance
		system.stamp_conductance(node_a, node_b, _g)
		system.stamp_current_source(node_a, node_b, i_prev)

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		if _g == 0.0:
			return i_prev
		var va: float = node_voltage.call(node_a)
		var vb: float = node_voltage.call(node_b)
		return _g * (va - vb) + i_prev

	func advance(node_voltage: Callable) -> void:
		if _g == 0.0:
			return
		var va: float = node_voltage.call(node_a)
		var vb: float = node_voltage.call(node_b)
		i_prev = _g * (va - vb) + i_prev


## Диод (раздел 04: «лепестковая дверь, туда — сама, обратно —
## намертво»). Нелинейный: ток растёт по экспоненте (Шокли), не по
## прямой. Решается методом Ньютона (раздел 10) — на каждой итерации
## диод линеаризуется вокруг текущей догадки о своём напряжении,
## как обычный резистор с компаньонным источником, а после решения
## подправляет догадку и сообщает Circuit, насколько она сдвинулась.
class Diode extends Component:
	const IS := 1e-12    # ток насыщения, А — типичный кремниевый диод
	const VT := 0.02585  # тепловое напряжение при комнатной температуре, В
	const EXP_CLAMP := 40.0  # клампинг аргумента экспоненты (раздел 10, «Защиты»)
	const NEWTON_STEP_LIMIT := 10.0 * VT  # ограничение шага догадки за итерацию

	var _guess_v: float = 0.0  # текущая догадка о напряжении va - vb
	var _g: float = 0.0        # компаньонная проводимость последнего stamp()

	func is_nonlinear() -> bool:
		return true

	## Ток и проводимость идеального диода в точке v (без клампинга шага
	## догадки — тот применяется отдельно, в newton_delta).
	static func _junction(v: float) -> Array:
		var exponent: float = clampf(v / VT, -EXP_CLAMP, EXP_CLAMP)
		var e: float = exp(exponent)
		var i: float = IS * (e - 1.0)
		var g: float = (IS / VT) * e
		return [i, g]

	func stamp(system: MnaSystem) -> void:
		var j := _junction(_guess_v)
		var i_g: float = j[0]
		_g = j[1]
		system.stamp_conductance(node_a, node_b, _g)
		# i ≈ g*v + (i_g - g*v_guess) — та же линеаризация Тейлора, что и
		# у конденсатора/катушки, только точка разложения не «прошлый
		# шаг времени», а «текущая догадка Ньютона».
		system.stamp_current_source(node_a, node_b, i_g - _g * _guess_v)

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		# Настоящая (не линеаризованная) характеристика в решённой точке —
		# для игры важна честная физика, не промежуточная аппроксимация.
		var v: float = node_voltage.call(node_a) - node_voltage.call(node_b)
		var j := _junction(v)
		return j[0]

	func newton_junctions() -> Array:
		return [[node_a, node_b]]

	func newton_delta(_index: int, new_v: float) -> float:
		var limited: float = clampf(new_v, _guess_v - NEWTON_STEP_LIMIT, _guess_v + NEWTON_STEP_LIMIT)
		var delta: float = absf(limited - _guess_v)
		_guess_v = limited
		return delta


## Транзистор (раздел 04: «клапан от бокового давления» — тонкая струя
## сбоку распахивает дверь для широкого потока). Упрощённая модель
## Эберса — Молла в транспортной форме (раздел 10: «Гуммель–Пун
## избыточен для игры») — два диода на переходах база-эмиттер и
## коллектор-база плюс управляемый источник тока коллектор→эмиттер,
## дающий усиление. Три вывода: node_a = база, node_b = эмиттер,
## node_c = коллектор (наследуемые node_a/node_b переиспользованы,
## чтобы не дублировать интерфейс Component).
class Transistor extends Component:
	const IS := 1e-12
	const VT := 0.02585
	const EXP_CLAMP := 40.0
	const NEWTON_STEP_LIMIT := 10.0 * VT
	const BF := 100.0  # коэффициент усиления по току, прямое включение
	const BR := 4.0     # то же самое в обратном (насыщение)

	var node_c: int  # коллектор

	var _guess_vbe: float = 0.0
	var _guess_vbc: float = 0.0
	var _g_f: float = 0.0
	var _g_r: float = 0.0

	func _init(p_base: int, p_collector: int, p_emitter: int, p_name: String = "") -> void:
		super._init(p_base, p_emitter, p_name)  # node_a = база, node_b = эмиттер
		node_c = p_collector

	func is_nonlinear() -> bool:
		return true

	static func _junction(v: float) -> Array:
		var exponent: float = clampf(v / VT, -EXP_CLAMP, EXP_CLAMP)
		var e: float = exp(exponent)
		var i: float = IS * (e - 1.0)
		var g: float = (IS / VT) * e
		return [i, g]

	func stamp(system: MnaSystem) -> void:
		var jf := _junction(_guess_vbe)  # переход база-эмиттер
		var jr := _junction(_guess_vbc)  # переход база-коллектор
		_g_f = jf[1]
		_g_r = jr[1]
		var c_f: float = jf[0] - _g_f * _guess_vbe
		var c_r: float = jr[0] - _g_r * _guess_vbc

		# D1: база → эмиттер, масштаб 1/BF — базовый ток от прямого перехода.
		system.stamp_conductance(node_a, node_b, _g_f / BF)
		system.stamp_current_source(node_a, node_b, c_f / BF)

		# D2: база → коллектор, масштаб 1/BR — базовый ток от насыщения.
		# Направление именно такое: у NPN переход база-коллектор — диод от
		# базы, как и база-эмиттер. Развёрнутый источник здесь не виден в
		# активном режиме (обратный ток почти нулевой), но в насыщении
		# роняет коллектор в минус на десятки вольт.
		system.stamp_conductance(node_a, node_c, _g_r / BR)
		system.stamp_current_source(node_a, node_c, c_r / BR)

		# Управляемый источник: усиленный ток коллектор → эмиттер,
		# зависящий от обоих переходов сразу — вот здесь и рождается
		# усиление, ради которого транзистор вообще нужен.
		system.stamp_transconductance(node_c, node_b, node_a, node_b, _g_f)
		system.stamp_transconductance(node_c, node_b, node_c, node_a, _g_r)
		system.stamp_current_source(node_c, node_b, c_f - c_r)

	func current_through(node_voltage: Callable, _source_currents: PackedFloat64Array) -> float:
		# Ток коллектора (в узел c) настоящей нелинейной моделью —
		# та же величина, что раздел 07 будет проверять на «мотор
		# крутится в нужную сторону» и подобные условия победы.
		var vb: float = node_voltage.call(node_a)
		var vc: float = node_voltage.call(node_c)
		var ve: float = node_voltage.call(node_b)
		var jf := _junction(vb - ve)
		var jr := _junction(vb - vc)
		# Ток в коллектор: перенос минус то, что уходит в базу через
		# открытый переход база-коллектор.
		return (jf[0] - jr[0]) - jr[0] / BR

	## Индекс 0 = переход база-эмиттер (VBE = Vb-Ve), индекс 1 = база-коллектор
	## (VBC = Vb-Vc) — порядок узлов в паре обязан совпадать с тем, как
	## _junction() интерпретирует _guess_vbe/_guess_vbc в stamp() и
	## current_through() (там оба раза именно Vb - V_другой).
	func newton_junctions() -> Array:
		return [[node_a, node_b], [node_a, node_c]]

	func newton_delta(index: int, new_v: float) -> float:
		if index == 0:
			var limited: float = clampf(new_v, _guess_vbe - NEWTON_STEP_LIMIT, _guess_vbe + NEWTON_STEP_LIMIT)
			var delta: float = absf(limited - _guess_vbe)
			_guess_vbe = limited
			return delta
		else:
			var limited2: float = clampf(new_v, _guess_vbc - NEWTON_STEP_LIMIT, _guess_vbc + NEWTON_STEP_LIMIT)
			var delta2: float = absf(limited2 - _guess_vbc)
			_guess_vbc = limited2
			return delta2
