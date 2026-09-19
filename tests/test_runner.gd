extends SceneTree
## Headless-раннер тестов ядра. Запуск:
##   godot --headless --script res://tests/test_runner.gd
##
## Раздел 10: «Ядро считается готовым, только когда сходится с формулами
## из учебника». Этап 1 — резистивные цепи и задвижки. Этап 2 (текущий
## блок) добавляет конденсатор и катушку через переходный процесс.

var _pass_count := 0
var _fail_count := 0


func _initialize() -> void:
	print("Into Schem — тесты ядра симулятора\n")

	_test_voltage_divider()
	_test_switch_open_blocks_current()
	_test_switch_closed_passes_current()
	_test_parallel_resistors()
	_test_series_resistors()
	_test_floating_node_does_not_crash()
	_test_source_value_change_reuses_factorization()
	_test_rc_charge_curve()
	_test_rl_current_rise()
	_test_reactive_step_reuses_factorization()
	_test_diode_forward_self_consistent()
	_test_diode_reverse_blocks()
	_test_transistor_amplifies()

	print("\n%d прошло, %d упало" % [_pass_count, _fail_count])
	quit(1 if _fail_count > 0 else 0)


func _check(label: String, actual: float, expected: float, tolerance: float = 1e-6) -> void:
	var diff := absf(actual - expected)
	if diff <= tolerance:
		_pass_count += 1
		print("  OK    %s (%.6f)" % [label, actual])
	else:
		_fail_count += 1
		print("  FAIL  %s: получено %.6f, ожидалось %.6f (разница %.8f)" % [label, actual, expected, diff])


func _check_true(label: String, condition: bool) -> void:
	if condition:
		_pass_count += 1
		print("  OK    %s" % label)
	else:
		_fail_count += 1
		print("  FAIL  %s" % label)


## Уровень 2 прототипа (раздел 07): делитель напряжения. Библиотека
## номиналов из раздела 11 — R = 1 kΩ и 4.7 kΩ, V = 9 В.
func _test_voltage_divider() -> void:
	print("Делитель напряжения")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "MID", 1000.0, "R1")
	c.add_resistor("MID", "GND", 4700.0, "R2")

	var sol := c.solve()
	var expected: float = 9.0 * 4700.0 / (1000.0 + 4700.0)
	_check("V(MID) = V*R2/(R1+R2)", sol.node_voltage["MID"], expected)

	var expected_current: float = 9.0 / (1000.0 + 4700.0)
	_check("ток через R1 == ток через R2", sol.component_current["R1"], sol.component_current["R2"], 1e-9)
	_check("ток делителя = V/(R1+R2)", sol.component_current["R1"], expected_current)


## Разомкнутая задвижка (раздел 04: «закрыты — сухо и темно»).
func _test_switch_open_blocks_current() -> void:
	print("Разомкнутая задвижка")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "LAMP", 220.0, "R1")
	c.add_switch("LAMP", "GND", false, "SW1")

	var sol := c.solve()
	_check("ток почти нулевой при разомкнутой цепи", sol.component_current["SW1"], 0.0, 1e-6)


func _test_switch_closed_passes_current() -> void:
	print("Замкнутая задвижка")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "LAMP", 220.0, "R1")
	c.add_switch("LAMP", "GND", true, "SW1")

	var sol := c.solve()
	var expected: float = 9.0 / 220.0  # R_on пренебрежимо мал
	_check("ток через замкнутую цепь ~ V/R", sol.component_current["SW1"], expected, 1e-4)


## Параллельное соединение (раздел 04): «где шире — туда больше».
func _test_parallel_resistors() -> void:
	print("Параллельные резисторы")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "GND", 1000.0, "R1")
	c.add_resistor("VCC", "GND", 1000.0, "R2")

	var sol := c.solve()
	var expected_total: float = 9.0 / 500.0  # два 1kΩ параллельно = 500Ω
	var total: float = sol.component_current["R1"] + sol.component_current["R2"]
	_check("суммарный ток = V / R_parallel", total, expected_total, 1e-6)


## Последовательное соединение: «через всех течёт одинаково».
func _test_series_resistors() -> void:
	print("Последовательные резисторы")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "A", 100.0, "R1")
	c.add_resistor("A", "B", 220.0, "R2")
	c.add_resistor("B", "GND", 470.0, "R3")

	var sol := c.solve()
	_check_true("ток одинаков через все три", is_equal_approx(sol.component_current["R1"], sol.component_current["R2"]) and is_equal_approx(sol.component_current["R2"], sol.component_current["R3"]))


## gmin должен спасти от плавающего узла (раздел 10, «Защиты»).
func _test_floating_node_does_not_crash() -> void:
	print("Плавающий узел (gmin)")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "GND", 1000.0, "R1")
	c.node("FLOATING")  # узел существует, но ни к чему не подключён

	var sol := c.solve()
	_check_true("решается без падения", sol.ok)
	_check("плавающий узел садится к 0 через gmin", sol.node_voltage.get("FLOATING", NAN), 0.0, 1e-3)


## Раздел 10, «Производительность»: смена номинала источника не должна
## требовать пере-факторизации — проверяем, что кэш реально переиспользуется.
func _test_source_value_change_reuses_factorization() -> void:
	print("Кэш факторизации при смене номинала источника")
	var c := Circuit.new()
	var v1 := c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "GND", 1000.0, "R1")

	var sol1 := c.solve()
	var cached_before = c._cached_factorization

	c.set_source_value(v1, 12.0)
	var sol2 := c.solve()
	var cached_after = c._cached_factorization

	_check("V(VCC) следует за новым номиналом", sol2.node_voltage["VCC"], 12.0)
	_check_true("факторизация не пересчитана (тот же объект)", cached_before == cached_after)
	_check_true("напряжение действительно изменилось", not is_equal_approx(sol1.node_voltage["VCC"], sol2.node_voltage["VCC"]))


## Раздел 10, «Проверка»: v(t) = V*(1 - e^(-t/RC)). R=1kΩ, C=1µF -> τ=1мс.
## dt=1мкс, 1000 шагов = 1мс = ровно одна постоянная времени.
func _test_rc_charge_curve() -> void:
	print("Заряд RC-цепи")
	var r: float = 1000.0
	var cap: float = 1e-6
	var v_source: float = 9.0
	var tau: float = r * cap
	var dt: float = 1e-6
	var steps: int = int(round(tau / dt))  # ровно один τ

	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", v_source, "V1")
	c.add_resistor("VCC", "MID", r, "R1")
	c.add_capacitor("MID", "GND", cap, "C1")

	var sol: Circuit.Solution
	for i in steps:
		sol = c.step(dt)
		if not sol.ok:
			_check_true("шаг %d сходится" % i, false)
			return

	var expected: float = v_source * (1.0 - exp(-1.0))  # t = τ
	# Допуск шире, чем для остальных тестов: неявный Эйлер первого порядка,
	# ошибка ~O(dt/τ) накапливается за 1000 шагов — раздел 10 сознательно
	# выбрал устойчивость важнее точности.
	_check("v(τ) = V*(1 - e^-1) после %d шагов" % steps, sol.node_voltage["MID"], expected, 2e-3)


## Раздел 10, «Проверка»: i(t) = (V/R)*(1 - e^(-t/(L/R))). R=100Ω, L=100мГн
## -> τ=1мс. Та же схема шагов, что и для RC.
func _test_rl_current_rise() -> void:
	print("Нарастание тока в RL-цепи")
	var r: float = 100.0
	var ind: float = 0.1
	var v_source: float = 9.0
	var tau: float = ind / r
	var dt: float = 1e-6
	var steps: int = int(round(tau / dt))

	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", v_source, "V1")
	c.add_resistor("VCC", "MID", r, "R1")
	c.add_inductor("MID", "GND", ind, "L1")

	var sol: Circuit.Solution
	for i in steps:
		sol = c.step(dt)
		if not sol.ok:
			_check_true("шаг %d сходится" % i, false)
			return

	var expected: float = (v_source / r) * (1.0 - exp(-1.0))
	_check("i(τ) = (V/R)*(1 - e^-1) после %d шагов" % steps, sol.component_current["L1"], expected, 1e-4)


## Раздел 10, «Производительность» распространяется на переходный процесс:
## при постоянном dt и неизменной топологии LU не должно пересчитываться
## между шагами — меняется только rhs (компаньонный источник).
func _test_reactive_step_reuses_factorization() -> void:
	print("Кэш факторизации между шагами переходного процесса")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 9.0, "V1")
	c.add_resistor("VCC", "MID", 1000.0, "R1")
	c.add_capacitor("MID", "GND", 1e-6, "C1")

	c.step(1e-6)
	var cached_after_first = c._cached_factorization
	for i in 50:
		c.step(1e-6)
	var cached_after_many = c._cached_factorization

	_check_true("факторизация одна и та же спустя 50 шагов", cached_after_first == cached_after_many)


## Диод: проверяем не «магическое» число прямого падения (оно зависит от
## выбранного IS), а физическую самосогласованность — закон Кирхгофа по
## напряжению и уравнение Шокли должны сойтись на одной и той же точке.
func _test_diode_forward_self_consistent() -> void:
	print("Диод в прямом включении — самосогласованность")
	var v_source: float = 5.0
	var r: float = 1000.0

	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", v_source, "V1")
	c.add_resistor("VCC", "MID", r, "R1")
	c.add_diode("MID", "GND", "D1")

	var sol := c.solve()
	_check_true("решение сошлось", sol.ok)

	var v_diode: float = sol.node_voltage["MID"]
	var i_kvl: float = (v_source - v_diode) / r  # ток из закона Кирхгофа
	var i_diode: float = sol.component_current["D1"]  # ток из уравнения Шокли

	_check_true("диод открылся в разумном диапазоне (0.3–0.9 В)", v_diode > 0.3 and v_diode < 0.9)
	_check("ток по КВЛ совпадает с током по Шокли", i_kvl, i_diode, 1e-6)


## Развёрнутый диод почти не пропускает ток — почти всё напряжение
## падает на нём самом (раздел 04: «обратно — намертво»).
func _test_diode_reverse_blocks() -> void:
	print("Диод в обратном включении")
	var c := Circuit.new()
	c.add_voltage_source("VCC", "GND", 5.0, "V1")
	c.add_resistor("VCC", "MID", 1000.0, "R1")
	c.add_diode("GND", "MID", "D1")  # развёрнут: анод на земле

	var sol := c.solve()
	_check_true("решение сошлось", sol.ok)
	_check("почти всё напряжение падает на диоде", sol.node_voltage["MID"], 5.0, 0.05)
	_check_true("ток исчезающе мал", absf(sol.component_current["D1"]) < 1e-9)


## Транзистор: диагностика на общем эмиттере. Малый базовый ток должен
## открывать значительно больший ток коллектора, а не наоборот.
func _test_transistor_amplifies() -> void:
	print("Транзистор — усиление (диагностика)")
	var c := Circuit.new()
	c.add_voltage_source("VBB", "GND", 5.0, "VB")
	c.add_resistor("VBB", "BASE", 100000.0, "RB")   # 100 kΩ — малый базовый ток
	c.add_voltage_source("VCC", "GND", 9.0, "VC")
	c.add_resistor("VCC", "COL", 1000.0, "RC")       # 1 kΩ нагрузка коллектора
	c.add_transistor("BASE", "COL", "GND", "Q1")

	var sol := c.solve()
	_check_true("решение сошлось", sol.ok)

	var v_base: float = sol.node_voltage.get("BASE", NAN)
	var v_col: float = sol.node_voltage.get("COL", NAN)
	var i_c: float = sol.component_current.get("Q1", NAN)
	var i_b: float = (5.0 - v_base) / 100000.0  # ток через RB — независимо посчитанный базовый ток
	print("    диагностика: V(base)=%.6f V(col)=%.6f I(Q1)=%.9f I(RB)=%.9f Ic/Ib=%.2f" % [v_base, v_col, i_c, i_b, i_c / i_b])

	_check_true("база открылась в разумном диапазоне (0.3–0.9 В)", v_base > 0.3 and v_base < 0.9)
	_check_true("усиление Ic/Ib в пределах модели (BF=100, ±20%)", i_c / i_b > 80.0 and i_c / i_b < 120.0)
	_check_true("коллектор просел ниже питания — транзистор проводит", v_col < 9.0 - 0.01)
	_check_true("ток коллектора положительный (втекает)", i_c > 0.0)
