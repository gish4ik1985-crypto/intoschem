class_name Circuit
extends RefCounted
## Схема как данные (раздел 07 карты работы, NEW.05): именованные узлы,
## список компонентов, решение через MnaSystem. Не знает о Godot-сцене,
## о рендере, о зуме между режимами — чистая модель.
##
## Кэширование факторизации (раздел 10, «Производительность»): смена
## номинала V/I-источника не трогает G — дёшево. Смена сопротивления,
## переключение задвижки или добавление/удаление компонента — дорого,
## требует пере-факторизации при следующем solve().

const GND := MnaSystem.GROUND

var _node_names: Dictionary = {}  # String -> int
var _node_count: int = 0
var _components: Array = []  # Array[Component]

var _dt: float = 0.0
var _topology_dirty: bool = true
var _cached_factorization: Linalg.LuResult = null


class Solution:
	var node_voltage: Dictionary = {}     # String -> float
	var component_current: Dictionary = {}  # String -> float
	var ok: bool = true                    # false, если система вырождена


func node(name: String) -> int:
	if name == "GND":
		return GND
	if _node_names.has(name):
		return _node_names[name]
	var idx := _node_count
	_node_names[name] = idx
	_node_count += 1
	return idx


func _mark_dirty() -> void:
	_topology_dirty = true


func add_resistor(a: String, b: String, resistance: float, name: String = "") -> Component.Resistor:
	var c := Component.Resistor.new(node(a), node(b), resistance, name)
	_components.append(c)
	_mark_dirty()
	return c


func add_voltage_source(a: String, b: String, voltage: float, name: String = "") -> Component.VoltageSource:
	var c := Component.VoltageSource.new(node(a), node(b), voltage, name)
	_components.append(c)
	_mark_dirty()
	return c


func add_current_source(a: String, b: String, current: float, name: String = "") -> Component.CurrentSource:
	var c := Component.CurrentSource.new(node(a), node(b), current, name)
	_components.append(c)
	_mark_dirty()
	return c


func add_switch(a: String, b: String, closed: bool, name: String = "") -> Component.Switch:
	var c := Component.Switch.new(node(a), node(b), closed, name)
	_components.append(c)
	_mark_dirty()
	return c


func add_capacitor(a: String, b: String, capacitance: float, name: String = "", initial_voltage: float = 0.0) -> Component.Capacitor:
	var c := Component.Capacitor.new(node(a), node(b), capacitance, name, initial_voltage)
	_components.append(c)
	_mark_dirty()
	return c


func add_inductor(a: String, b: String, inductance: float, name: String = "", initial_current: float = 0.0) -> Component.Inductor:
	var c := Component.Inductor.new(node(a), node(b), inductance, name, initial_current)
	_components.append(c)
	_mark_dirty()
	return c


func add_diode(a: String, b: String, name: String = "") -> Component.Diode:
	var c := Component.Diode.new(node(a), node(b), name)
	_components.append(c)
	_mark_dirty()
	return c


func add_transistor(base: String, collector: String, emitter: String, name: String = "") -> Component.Transistor:
	var c := Component.Transistor.new(node(base), node(collector), node(emitter), name)
	_components.append(c)
	_mark_dirty()
	return c


## Меняет номинал V/I-источника без пере-факторизации — magnitude не
## входит в G (раздел 10).
func set_source_value(component, value: float) -> void:
	if component is Component.VoltageSource:
		component.voltage = value
	elif component is Component.CurrentSource:
		component.current = value


## Переключает задвижку. Меняет G — дорого, помечает пере-факторизацию.
func set_switch(sw: Component.Switch, closed: bool) -> void:
	if sw.closed == closed:
		return
	sw.closed = closed
	_mark_dirty()


func set_resistance(r: Component.Resistor, resistance: float) -> void:
	var clamped := maxf(resistance, 1e-9)
	if is_equal_approx(r.resistance, clamped):
		return
	r.resistance = clamped
	_mark_dirty()


func _assign_source_rows() -> int:
	var idx := 0
	for c in _components:
		if c.needs_source_row():
			c.source_index = idx
			idx += 1
	return idx


func _build_system() -> MnaSystem:
	var source_count := _assign_source_rows()
	var system := MnaSystem.new(_node_count, source_count, _dt)
	for c in _components:
		c.stamp(system)
	return system


## Меняет шаг времени, используемый Capacitor/Inductor для компаньонной
## проводимости (g = C/h, g = h/L — раздел 10). Пере-факторизация нужна
## только когда dt реально меняется: сама по себе стабильная частота
## кадров держит G постоянной сколько угодно шагов подряд, дорогое
## LU-разложение выполняется один раз на всю переходную симуляцию.
func set_timestep(h: float) -> void:
	# Точное сравнение, не is_equal_approx: dt легитимно бывает
	# микро- и наносекундным (раздел 11), где относительный эпсилон
	# is_equal_approx ошибочно считает 0 и 1e-6 «одним и тем же».
	if _dt == h:
		return
	_dt = h
	_mark_dirty()


## Один линейный проход: собрать систему, факторизовать (с кэшем —
## раздел 10, «Производительность»), решить. Возвращает пустой массив
## при вырожденной матрице. Не трогает состояние компонентов.
func _raw_solve() -> PackedFloat64Array:
	var system := _build_system()
	if _topology_dirty or _cached_factorization == null:
		_cached_factorization = system.decompose()
		_topology_dirty = false
	return system.solve_with(_cached_factorization)


func _has_nonlinear() -> bool:
	for c in _components:
		if c.is_nonlinear():
			return true
	return false


func _voltage_lookup(x: PackedFloat64Array) -> Callable:
	return func(n: int) -> float:
		return 0.0 if n == GND else x[n]


## Итерации Ньютона–Рафсона (раздел 10) для схем с диодом или
## транзистором. G меняется на каждой итерации — фактор из кэша не
## годится, форсим пере-факторизацию, пока не сойдётся или не кончится
## лимит попыток. При несходимости отдаём последнюю итерацию, а не
## падаем — раздел 10: «при несходимости не падать».
func _newton_solve() -> PackedFloat64Array:
	const MAX_ITERATIONS := 100
	const TOLERANCE := 1e-6

	var x := PackedFloat64Array()
	for _iter in MAX_ITERATIONS:
		_topology_dirty = true
		x = _raw_solve()
		if x.is_empty():
			return x

		var voltage_lookup := _voltage_lookup(x)
		var max_delta := 0.0
		for c in _components:
			if not c.is_nonlinear():
				continue
			var junctions: Array = c.newton_junctions()
			for idx in junctions.size():
				var pair: Array = junctions[idx]
				var v: float = voltage_lookup.call(pair[0]) - voltage_lookup.call(pair[1])
				max_delta = maxf(max_delta, c.newton_delta(idx, v))

		if max_delta < TOLERANCE:
			break

	return x


func _extract_solution(x: PackedFloat64Array, source_count: int) -> Solution:
	var sol := Solution.new()
	for name in _node_names:
		var idx: int = _node_names[name]
		sol.node_voltage[name] = x[idx]

	var source_currents := PackedFloat64Array()
	source_currents.resize(source_count)
	for i in source_count:
		source_currents[i] = x[_node_count + i]

	var voltage_lookup := _voltage_lookup(x)
	for c in _components:
		if not c.name.is_empty():
			sol.component_current[c.name] = c.current_through(voltage_lookup, source_currents)

	return sol


## Решает цепь при текущем dt и коммитит состояние реактивных и
## нелинейных компонентов (v_prev/i_prev, догадки Ньютона) ровно один
## раз — после того, как итерации (если они были) сошлись. Использовать
## для чисто резистивных цепей (dt не участвует) и как основу step().
##
## При вырожденной матрице — ok = false вместо падения.
func solve() -> Solution:
	var has_nonlinear := _has_nonlinear()
	var x := _newton_solve() if has_nonlinear else _raw_solve()

	if x.is_empty():
		var sol := Solution.new()
		sol.ok = false
		_topology_dirty = true
		return sol

	# Источников с собственной строкой могло не совпасть с тем, что видел
	# _build_system() в последний раз, если топология не менялась — но
	# после каждого solve()/_newton_solve() число источников фиксировано
	# на момент последнего _build_system(), а source_index уже присвоены
	# всем компонентам, так что просто пересчитываем количество.
	var source_count := 0
	for c in _components:
		if c.needs_source_row():
			source_count += 1

	var sol := _extract_solution(x, source_count)

	var voltage_lookup := _voltage_lookup(x)
	for c in _components:
		c.advance(voltage_lookup)

	return sol


## Продвигает переходный процесс на один шаг времени `dt` и возвращает
## решение. Тонкая обёртка над set_timestep() + solve() — вынесена
## отдельно, чтобы код симуляции во времени читался как «шаг», а не
## как побочный эффект обычного solve().
func step(dt: float) -> Solution:
	set_timestep(dt)
	return solve()
