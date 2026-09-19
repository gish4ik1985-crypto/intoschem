extends Node2D
## Уровень 1 «Сигнальный светодиод» (раздел 07). Ночное зрение не
## работает, нужен свет — самый первый прибор, который чинит проснувшийся
## механизм.
##
## Батарейка 1,5 В — одна, нижняя ступень библиотеки номиналов (раздел 11):
## это собственный источник этого прибора (раздел 07, «у каждого
## устройства свой источник»). Игрок решает, что вставить в гнездо между
## батарейкой и светодиодом: ничего (цепь разомкнута, темно), голый провод
## (почти наверняка сожжёт светодиод) или один из резисторов набора.
##
## Раньше этот файл был одновременно и картой платы, и самим прибором.
## Карта выделена в `map.gd`; здесь остался только прибор — такая же
## самостоятельная сцена, как уровни 2 и 3.

const InventoryWarehouseScene := preload("res://scenes/inventory_warehouse.gd")
const CircuitVisuals := preload("res://scenes/circuit_visuals.gd")
const UIStyle := preload("res://scenes/ui_style.gd")

const MAP_SCENE := "res://scenes/map.tscn"
const DEVICE_ID := "led"

const BATTERY_V := 1.5
const BURN_A := 0.035    # выше — светодиод сгорает (раздел 07: «не сгорела»)
const TARGET_A := 0.019  # ток лучшего резистора набора (47 Ом) — максимум достижимого, не идеал

# Библиотека номиналов резисторов, раздел 11 — ровно она, без придуманных чисел.
const KIT_OHMS := [10.0, 47.0, 100.0, 220.0, 470.0, 1000.0, 2200.0, 4700.0, 10000.0]

const BATTERY_POS := Vector2(-220, 0)
const SLOT_POS := Vector2(-60, 0)
const LED_POS := Vector2(120, 0)

const BATTERY_RADIUS := 19.0       # половина ширины «пальчиковой» батарейки
const BATTERY_STRAIGHT := 46.0     # длина прямого участка цилиндра, без колпачков
const BATTERY_NUB_SIZE := Vector2(16, 9)  # плюсовой «пупырёк» сверху
const BATTERY_PLUS_LOCAL := Vector2(0, -(BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS + BATTERY_NUB_SIZE.y))
const BATTERY_MINUS_LOCAL := Vector2(0, BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS)

const WIRE_PLUS_IDLE := Color(0.5, 0.13, 0.10)
const WIRE_PLUS_LIVE := Color(1.0, 0.35, 0.15)
const WIRE_MINUS_IDLE := Color(0.12, 0.13, 0.17)
const WIRE_MINUS_LIVE := Color(0.30, 0.38, 0.5)

# Верхний край гнезда — провода цепляются сюда, а не в середину, где
# лежит подпись номинала (её не должно перечёркивать проводом).
const SLOT_HALF_WIDTH := 30.0
const SLOT_HALF_HEIGHT := 18.0
const SLOT_ATTACH_Y := -(SLOT_HALF_HEIGHT + 8.0)

enum SlotState { OPEN, WIRE, RESISTOR }

var _led_body: Polygon2D
var _led_glow: Polygon2D
var _light_radius: Polygon2D
var _status_label: Label
var _reading_label: Label
var _slot_label: Label
var _wire_plus: Line2D
var _wire_return: Line2D

var _slot_state: SlotState = SlotState.OPEN
var _slot_ohms: float = 0.0


func _ready() -> void:
	_build_camera()
	_build_world()
	_build_circuit_diagram()
	_build_ui()
	_evaluate()


func _build_camera() -> void:
	var camera := Camera2D.new()
	camera.position = (BATTERY_POS + LED_POS) * 0.5
	camera.enabled = true
	add_child(camera)


func _build_world() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.05, 0.07)
	bg.size = Vector2(1600, 900)
	bg.position = Vector2(-800, -450)
	bg.z_index = -10
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	_light_radius = Polygon2D.new()
	_light_radius.position = LED_POS
	_light_radius.polygon = CircuitVisuals.circle_points(1.0, 48)
	_light_radius.color = Color(1.0, 0.75, 0.35, 0.10)
	_light_radius.z_index = -5
	add_child(_light_radius)


func _build_circuit_diagram() -> void:
	# Батарейка: цилиндр-«пальчик» с плюсовым пупырьком сверху и плоским
	# минусом снизу — узнаваемый силуэт AA вместо серого блока. Провода
	# выходят строго из клемм, а не «из воздуха».
	var battery := Node2D.new()
	battery.position = BATTERY_POS
	add_child(battery)

	var body := Polygon2D.new()
	body.polygon = CircuitVisuals.capsule_points(BATTERY_RADIUS, BATTERY_STRAIGHT, 12)
	body.color = Color(0.22, 0.23, 0.26)
	battery.add_child(body)

	var nub := ColorRect.new()
	nub.color = Color(0.75, 0.76, 0.8)
	nub.size = BATTERY_NUB_SIZE
	nub.position = Vector2(-BATTERY_NUB_SIZE.x * 0.5, -(BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS + BATTERY_NUB_SIZE.y))
	nub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	battery.add_child(nub)

	var minus_contact := ColorRect.new()
	minus_contact.color = Color(0.12, 0.12, 0.14)
	minus_contact.size = Vector2(BATTERY_RADIUS * 1.1, 5)
	minus_contact.position = Vector2(-BATTERY_RADIUS * 0.55, BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS - 6.0)
	minus_contact.mouse_filter = Control.MOUSE_FILTER_IGNORE
	battery.add_child(minus_contact)

	var blabel := Label.new()
	blabel.text = "1,5В"
	blabel.position = Vector2(-BATTERY_RADIUS, -11)
	blabel.size = Vector2(BATTERY_RADIUS * 2, 22)
	blabel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	blabel.add_theme_font_size_override("font_size", 12)
	battery.add_child(blabel)

	var plus_label := Label.new()
	plus_label.text = "+"
	plus_label.position = BATTERY_PLUS_LOCAL + Vector2(-14, -22)
	plus_label.size = Vector2(20, 20)
	plus_label.add_theme_font_size_override("font_size", 16)
	plus_label.add_theme_color_override("font_color", WIRE_PLUS_LIVE)
	battery.add_child(plus_label)

	var minus_label := Label.new()
	minus_label.text = "−"
	minus_label.position = BATTERY_MINUS_LOCAL + Vector2(-14, 4)
	minus_label.size = Vector2(20, 20)
	minus_label.add_theme_font_size_override("font_size", 16)
	minus_label.add_theme_color_override("font_color", WIRE_MINUS_LIVE)
	battery.add_child(minus_label)

	# Гнездо: пусто по умолчанию — игрок сам решает, чем его заполнить.
	var slot_box := Polygon2D.new()
	slot_box.position = SLOT_POS
	slot_box.polygon = PackedVector2Array([
		Vector2(-SLOT_HALF_WIDTH, -SLOT_HALF_HEIGHT), Vector2(SLOT_HALF_WIDTH, -SLOT_HALF_HEIGHT),
		Vector2(SLOT_HALF_WIDTH, SLOT_HALF_HEIGHT), Vector2(-SLOT_HALF_WIDTH, SLOT_HALF_HEIGHT)
	])
	slot_box.color = Color(0.15, 0.15, 0.17)
	add_child(slot_box)

	_slot_label = Label.new()
	_slot_label.text = "пусто"
	_slot_label.position = SLOT_POS + Vector2(-SLOT_HALF_WIDTH, -10)
	_slot_label.size = Vector2(SLOT_HALF_WIDTH * 2, 20)
	_slot_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_slot_label.add_theme_font_size_override("font_size", 12)
	add_child(_slot_label)

	_led_glow = Polygon2D.new()
	_led_glow.position = LED_POS
	_led_glow.polygon = CircuitVisuals.circle_points(28.0, 24)
	_led_glow.color = Color(1.0, 0.2, 0.15, 0.0)
	add_child(_led_glow)

	_led_body = Polygon2D.new()
	_led_body.position = LED_POS
	_led_body.polygon = CircuitVisuals.circle_points(10.0, 16)
	_led_body.color = Color(0.25, 0.05, 0.05)
	add_child(_led_body)

	# Анод (+) со стороны гнезда, катод (−) со стороны земли — у диода
	# есть полярность, и она должна быть видна (раздел 04).
	var led_plus := Label.new()
	led_plus.text = "+"
	led_plus.position = LED_POS + Vector2(-22, -22)
	led_plus.size = Vector2(16, 16)
	led_plus.add_theme_font_size_override("font_size", 13)
	led_plus.add_theme_color_override("font_color", WIRE_PLUS_LIVE)
	add_child(led_plus)

	var led_minus := Label.new()
	led_minus.text = "−"
	led_minus.position = LED_POS + Vector2(6, 12)
	led_minus.size = Vector2(16, 16)
	led_minus.add_theme_font_size_override("font_size", 13)
	led_minus.add_theme_color_override("font_color", WIRE_MINUS_LIVE)
	add_child(led_minus)

	# Провода — не прямые лучи, а дуги, как гибкие перемычки на макетке.
	# «+»-путь идёт поверх гнезда, не перечёркивая подпись номинала внутри.
	#
	# TODO(арт-проход, раздел 09): позже гнездо должно физически входить
	# с одного бока и выходить с другого, с мини-клеммами под резистор —
	# сейчас это просто прямоугольник-заглушка, механики важнее вида.
	_wire_plus = CircuitVisuals.make_wire_path(
		[BATTERY_POS + BATTERY_PLUS_LOCAL, SLOT_POS + Vector2(0, SLOT_ATTACH_Y), LED_POS + Vector2(-10, -6)],
		[-16.0, -12.0], WIRE_PLUS_IDLE)
	add_child(_wire_plus)
	_wire_return = CircuitVisuals.make_wire(
		LED_POS + Vector2(0, 10), BATTERY_POS + BATTERY_MINUS_LOCAL, 40.0, WIRE_MINUS_IDLE)
	add_child(_wire_return)


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var back_btn := UIStyle.make_button("← На карту", _on_back_pressed, 150, 38, 15)
	back_btn.anchor_left = 1.0
	back_btn.anchor_right = 1.0
	back_btn.offset_left = -166.0
	back_btn.offset_right = -16.0
	back_btn.offset_top = 16.0
	back_btn.offset_bottom = 54.0
	layer.add_child(back_btn)

	var backdrop := PanelContainer.new()
	backdrop.position = Vector2(16, 16)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.06, 0.08, 0.94)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	backdrop.add_theme_stylebox_override("panel", style)
	layer.add_child(backdrop)

	var panel := VBoxContainer.new()
	panel.add_theme_constant_override("separation", 10)
	backdrop.add_child(panel)

	var title := Label.new()
	title.text = "Уровень 1 · Сигнальный светодиод"
	title.add_theme_font_size_override("font_size", 20)
	panel.add_child(title)

	var brief := Label.new()
	brief.text = "Ночное зрение не работает. Гнездо между батарейкой и светодиодом пустое — реши сам, чем его заполнить."
	panel.add_child(brief)

	_status_label = Label.new()
	panel.add_child(_status_label)

	_reading_label = Label.new()
	_reading_label.modulate = Color(0.7, 0.7, 0.7)
	panel.add_child(_reading_label)

	var warehouse := InventoryWarehouseScene.new()
	warehouse.add_rack("open", "Гнездо", [{"value": 0.0, "label": "Разомкнуть"}])
	warehouse.add_rack("wire", "Перемычка", [{"value": 0.0, "label": "Просто провод"}])

	var resistor_bins := []
	for ohms in KIT_OHMS:
		resistor_bins.append({"value": ohms, "label": _format_ohms(ohms)})
	warehouse.add_rack("resistor", "Резисторы", resistor_bins)

	warehouse.bin_selected.connect(_on_bin_selected)
	layer.add_child(warehouse)


func _format_ohms(ohms: float) -> String:
	if ohms >= 1000.0:
		return "%s кОм" % String.num(ohms / 1000.0, 1).rstrip("0").rstrip(".")
	return "%d Ом" % int(ohms)


func _on_back_pressed() -> void:
	get_tree().change_scene_to_file(MAP_SCENE)


func _on_bin_selected(kind: String, value: float) -> void:
	match kind:
		"open":
			_slot_state = SlotState.OPEN
			_slot_label.text = "пусто"
		"wire":
			_slot_state = SlotState.WIRE
			_slot_label.text = "провод"
		"resistor":
			_slot_state = SlotState.RESISTOR
			_slot_ohms = value
			_slot_label.text = _format_ohms(value)
	_evaluate()


## Пересобирает и решает цепь по текущему состоянию гнезда. Пустое гнездо
## не строит компонент вовсе — цепь разомкнута физически, а не притворно.
func _evaluate() -> void:
	if _slot_state == SlotState.OPEN:
		_status_label.text = "Цепь разомкнута — гнездо пустое. Вставь провод или резистор."
		_reading_label.text = ""
		_update_visuals(0.0, false)
		_update_wire_colors(false)
		return

	# Петля замыкается на GND: батарейка → гнездо → светодиод → земля.
	var circuit := Circuit.new()
	circuit.add_voltage_source("VCC", "GND", BATTERY_V, "V1")
	if _slot_state == SlotState.WIRE:
		circuit.add_switch("VCC", "LED_A", true, "W1")
	else:
		circuit.add_resistor("VCC", "LED_A", _slot_ohms, "R1")
	circuit.add_diode("LED_A", "GND", "LED1")

	var sol := circuit.solve()
	if not sol.ok:
		_status_label.text = "Схема не решилась — что-то совсем не так."
		return

	var current: float = sol.component_current.get("LED1", 0.0)
	var burnt: bool = current > BURN_A

	var slot_desc: String = "голый провод" if _slot_state == SlotState.WIRE else _format_ohms(_slot_ohms)
	_reading_label.text = "%s · ток через светодиод ≈ %.2f мА" % [slot_desc, current * 1000.0]

	if burnt:
		_status_label.text = "Светодиод сгорел — сопротивление слишком маленькое (или его вообще нет), ток зашкалил."
	elif current < 0.0005:
		_status_label.text = "Едва тлеет — сопротивление слишком большое, почти весь ток гасится в резисторе."
	elif current < TARGET_A * 0.5:
		_status_label.text = "Горит тускло. Есть варианты и получше в наборе."
	elif current < TARGET_A * 0.85:
		_status_label.text = "Уже неплохо. Но не самый удачный подбор."
	else:
		_status_label.text = "Хорошо горит — этот резистор явно лучше остальных."

	# На карту прибор светит ровно настолько, насколько реально светит
	# здесь: настроил вполсилы — и на плате откроется меньший круг.
	GameConfig.set_device_output(DEVICE_ID, 0.0 if burnt else clampf(current / TARGET_A, 0.0, 1.0))

	_update_visuals(current, burnt)
	_update_wire_colors(not burnt and current > 0.0005)


## Плюсовой и минусовой провод не красятся в один «цвет тока» — у них
## разная база, ток только делает каждый ярче, не стирая полярность.
func _update_wire_colors(live: bool) -> void:
	_wire_plus.default_color = WIRE_PLUS_LIVE if live else WIRE_PLUS_IDLE
	_wire_return.default_color = WIRE_MINUS_LIVE if live else WIRE_MINUS_IDLE


func _update_visuals(current: float, burnt: bool) -> void:
	if burnt:
		_led_body.color = Color(0.05, 0.05, 0.05)
		_led_glow.color = Color(1.0, 0.2, 0.15, 0.0)
		_light_radius.scale = Vector2(1, 1) * 0.001
		return

	var brightness: float = clampf(current / TARGET_A, 0.0, 1.0)
	_led_body.color = Color(1.0, 0.55 + 0.3 * brightness, 0.2, 1.0).lerp(Color(0.25, 0.05, 0.05), 1.0 - brightness)
	_led_glow.color = Color(1.0, 0.35, 0.15, 0.55 * brightness)

	var radius: float = lerpf(20.0, 420.0, brightness)
	_light_radius.scale = Vector2(1, 1) * radius
	_light_radius.color = Color(1.0, 0.75, 0.35, 0.10 + 0.10 * brightness)
