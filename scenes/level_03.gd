extends Node2D
## Уровень 3 «Регулировка яркости» (раздел 07): резистор, закон Ома,
## яркость от тока. Изъян: сопротивление подобрано неверно — в гнезде
## стоит слишком большой резистор, лампа еле тлеет.
##
## Цель не «сделать поярче до упора», а попасть в ЗАДАННЫЙ диапазон:
## дежурная подсветка должна светить вполсилы. Отсюда закон Ома
## становится нужен по-настоящему — надо посчитать, а не крутить наугад.
##
## Источник — «крона» 9 В, своя у этого прибора (раздел 07: «у каждого
## устройства свой источник», игрок ничего не носит с собой).

const CircuitVisuals := preload("res://scenes/circuit_visuals.gd")
const InventoryWarehouseScene := preload("res://scenes/inventory_warehouse.gd")
const UIStyle := preload("res://scenes/ui_style.gd")

const MAP_SCENE := "res://scenes/map.tscn"
const DEVICE_ID := "panel"

const BATTERY_V := 9.0     # «крона» — из библиотеки номиналов (раздел 11)
const LAMP_OHMS := 10.0    # лампа 3В/0,3А ≈ 10 Ом (раздел 11)
const RATED_A := 0.3       # паспортный ток лампы
const BURN_A := RATED_A * 1.5   # полуторный запас (раздел 11)

# Дежурная подсветка — вполсилы от паспортного тока, с допуском ±25%.
# При 9 В и лампе 10 Ом в этот диапазон попадает ровно один номинал
# набора — 47 Ом (158 мА). Проверено расчётом, не на глаз.
const TARGET_A := RATED_A * 0.5
const TARGET_TOLERANCE := 0.25

# Библиотека номиналов, раздел 11 — ровно она.
const KIT_OHMS := [10.0, 47.0, 100.0, 220.0, 470.0, 1000.0, 2200.0, 4700.0, 10000.0]
const START_OHMS := 100.0  # изъян уровня: подобрано неверно, лампа еле тлеет

const BATTERY_POS := Vector2(-280, 0)
const SLOT_POS := Vector2(-60, 0)
const LAMP_POS := Vector2(180, 0)

const WIRE_PLUS_IDLE := Color(0.5, 0.13, 0.10)
const WIRE_PLUS_LIVE := Color(1.0, 0.35, 0.15)
const WIRE_MINUS_IDLE := Color(0.12, 0.13, 0.17)
const WIRE_MINUS_LIVE := Color(0.30, 0.38, 0.5)

# «Крона» — прямоугольный корпус с двумя клеммами сверху, силуэт совсем
# не такой, как у пальчиковых элементов уровня 2: разное устройство —
# разный источник, это видно сразу.
const KRONA_SIZE := Vector2(52, 74)
const KRONA_PLUS_LOCAL := Vector2(-14, -KRONA_SIZE.y * 0.5 - 8.0)
const KRONA_MINUS_LOCAL := Vector2(14, -KRONA_SIZE.y * 0.5 - 8.0)

const SLOT_HALF_WIDTH := 34.0
const SLOT_HALF_HEIGHT := 18.0
const SLOT_ATTACH_Y := -(SLOT_HALF_HEIGHT + 8.0)

var _lamp_body: Polygon2D
var _lamp_glow: Polygon2D
var _light_radius: Polygon2D
var _status_label: Label
var _reading_label: Label
var _slot_label: Label
var _wire_plus: Line2D
var _wire_return: Line2D
var _target_bar: ProgressBar
var _target_hint: Label

var _slot_ohms: float = START_OHMS


func _ready() -> void:
	_build_camera()
	_build_world()
	_build_circuit_diagram()
	_build_ui()
	_evaluate()


func _build_camera() -> void:
	var camera := Camera2D.new()
	camera.position = (BATTERY_POS + LAMP_POS) * 0.5
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
	_light_radius.position = LAMP_POS
	_light_radius.polygon = CircuitVisuals.circle_points(1.0, 48)
	_light_radius.color = Color(1.0, 0.85, 0.55, 0.12)
	_light_radius.z_index = -5
	add_child(_light_radius)


func _build_circuit_diagram() -> void:
	_build_krona(BATTERY_POS)

	# Гнездо под резистор — то, что игрок здесь и меняет.
	var slot_box := Polygon2D.new()
	slot_box.position = SLOT_POS
	slot_box.polygon = PackedVector2Array([
		Vector2(-SLOT_HALF_WIDTH, -SLOT_HALF_HEIGHT), Vector2(SLOT_HALF_WIDTH, -SLOT_HALF_HEIGHT),
		Vector2(SLOT_HALF_WIDTH, SLOT_HALF_HEIGHT), Vector2(-SLOT_HALF_WIDTH, SLOT_HALF_HEIGHT)
	])
	slot_box.color = Color(0.15, 0.15, 0.17)
	add_child(slot_box)

	_slot_label = Label.new()
	_slot_label.position = SLOT_POS + Vector2(-SLOT_HALF_WIDTH, -10)
	_slot_label.size = Vector2(SLOT_HALF_WIDTH * 2, 20)
	_slot_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_slot_label.add_theme_font_size_override("font_size", 12)
	add_child(_slot_label)

	_lamp_glow = Polygon2D.new()
	_lamp_glow.position = LAMP_POS
	_lamp_glow.polygon = CircuitVisuals.circle_points(30.0, 24)
	_lamp_glow.color = Color(1.0, 0.85, 0.55, 0.0)
	add_child(_lamp_glow)

	_lamp_body = Polygon2D.new()
	_lamp_body.position = LAMP_POS
	_lamp_body.polygon = CircuitVisuals.circle_points(12.0, 16)
	_lamp_body.color = Color(0.2, 0.18, 0.1)
	add_child(_lamp_body)

	var lamp_note := Label.new()
	lamp_note.text = "лампа 10 Ом"
	lamp_note.position = LAMP_POS + Vector2(-50, 26)
	lamp_note.size = Vector2(100, 20)
	lamp_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lamp_note.add_theme_font_size_override("font_size", 11)
	lamp_note.add_theme_color_override("font_color", Color(0.6, 0.62, 0.68))
	add_child(lamp_note)

	_wire_plus = CircuitVisuals.make_wire_path(
		[BATTERY_POS + KRONA_PLUS_LOCAL, SLOT_POS + Vector2(0, SLOT_ATTACH_Y), LAMP_POS + Vector2(-12, -8)],
		[-18.0, -14.0], WIRE_PLUS_IDLE)
	add_child(_wire_plus)
	_wire_return = CircuitVisuals.make_wire(
		LAMP_POS + Vector2(0, 12), BATTERY_POS + KRONA_MINUS_LOCAL, 52.0, WIRE_MINUS_IDLE)
	add_child(_wire_return)


## Батарейка «крона» 9 В — прямоугольный корпус, две клеммы сверху.
func _build_krona(pos: Vector2) -> void:
	var krona := Node2D.new()
	krona.position = pos
	add_child(krona)

	var body := ColorRect.new()
	body.color = Color(0.20, 0.21, 0.24)
	body.size = KRONA_SIZE
	body.position = -KRONA_SIZE * 0.5
	body.mouse_filter = Control.MOUSE_FILTER_IGNORE
	krona.add_child(body)

	for terminal_pos in [KRONA_PLUS_LOCAL, KRONA_MINUS_LOCAL]:
		var post := ColorRect.new()
		post.color = Color(0.72, 0.73, 0.78)
		post.size = Vector2(10, 10)
		post.position = terminal_pos - Vector2(5, 1)
		post.mouse_filter = Control.MOUSE_FILTER_IGNORE
		krona.add_child(post)

	var label := Label.new()
	label.text = "9В"
	label.position = Vector2(-KRONA_SIZE.x * 0.5, -10)
	label.size = Vector2(KRONA_SIZE.x, 20)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 13)
	krona.add_child(label)

	var plus_label := Label.new()
	plus_label.text = "+"
	plus_label.position = KRONA_PLUS_LOCAL + Vector2(-16, -22)
	plus_label.size = Vector2(16, 16)
	plus_label.add_theme_font_size_override("font_size", 15)
	plus_label.add_theme_color_override("font_color", WIRE_PLUS_LIVE)
	krona.add_child(plus_label)

	var minus_label := Label.new()
	minus_label.text = "−"
	minus_label.position = KRONA_MINUS_LOCAL + Vector2(2, -22)
	minus_label.size = Vector2(16, 16)
	minus_label.add_theme_font_size_override("font_size", 15)
	minus_label.add_theme_color_override("font_color", WIRE_MINUS_LIVE)
	krona.add_child(minus_label)


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
	title.text = "Уровень 3 · Регулировка яркости"
	title.add_theme_font_size_override("font_size", 20)
	panel.add_child(title)

	var brief := Label.new()
	brief.text = "Дежурная подсветка должна светить вполсилы — не ярче и не тусклее.\nСейчас в гнезде стоит не тот резистор."
	panel.add_child(brief)

	_target_hint = Label.new()
	_target_hint.text = "Нужный ток через лампу: %d–%d мА" % [
		int(TARGET_A * (1.0 - TARGET_TOLERANCE) * 1000.0),
		int(TARGET_A * (1.0 + TARGET_TOLERANCE) * 1000.0),
	]
	_target_hint.add_theme_color_override("font_color", UIStyle.ACCENT_WARN)
	panel.add_child(_target_hint)

	_target_bar = ProgressBar.new()
	_target_bar.min_value = 0.0
	_target_bar.max_value = RATED_A
	_target_bar.show_percentage = false
	_target_bar.custom_minimum_size = Vector2(0, 10)
	panel.add_child(_target_bar)

	_status_label = Label.new()
	panel.add_child(_status_label)

	_reading_label = Label.new()
	_reading_label.modulate = Color(0.7, 0.7, 0.7)
	panel.add_child(_reading_label)

	var warehouse := InventoryWarehouseScene.new()
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


func _on_bin_selected(_kind: String, value: float) -> void:
	_slot_ohms = value
	_evaluate()


func _evaluate() -> void:
	_slot_label.text = _format_ohms(_slot_ohms)

	# Петля замыкается на GND: 9В → резистор → лампа → земля.
	var circuit := Circuit.new()
	circuit.add_voltage_source("VCC", "GND", BATTERY_V, "V1")
	circuit.add_resistor("VCC", "LAMP_A", _slot_ohms, "R1")
	circuit.add_resistor("LAMP_A", "GND", LAMP_OHMS, "LAMP1")

	var sol := circuit.solve()
	if not sol.ok:
		_status_label.text = "Схема не решилась — что-то совсем не так."
		return

	var current: float = sol.component_current.get("LAMP1", 0.0)
	var low: float = TARGET_A * (1.0 - TARGET_TOLERANCE)
	var high: float = TARGET_A * (1.0 + TARGET_TOLERANCE)

	_reading_label.text = "%s · ток через лампу ≈ %d мА" % [_format_ohms(_slot_ohms), int(round(current * 1000.0))]
	_target_bar.value = minf(current, RATED_A)

	var burnt: bool = current > BURN_A
	if burnt:
		_status_label.text = "Лампа сгорела — сопротивление слишком маленькое, ток зашкалил."
	elif current > RATED_A:
		_status_label.text = "Перекал — лампа светит на пределе и долго не проживёт. Нужно больше сопротивления."
	elif current > high:
		_status_label.text = "Ярче, чем нужно. Дежурная подсветка не должна слепить."
	elif current < low:
		_status_label.text = "Слишком тускло — сопротивление великовато, почти весь ток гасится в резисторе."
	else:
		_status_label.text = "Точно в диапазоне — дежурная подсветка настроена."

	# На карту прибор светит по факту тока, а не по факту «зачтено»:
	# сгоревшая лампа не светит вовсе, тусклая — открывает меньший круг.
	GameConfig.set_device_output(DEVICE_ID, 0.0 if burnt else clampf(current / RATED_A, 0.0, 1.0))

	_update_visuals(current, burnt)
	_update_wire_colors(not burnt and current > 0.0005)


func _update_wire_colors(live: bool) -> void:
	_wire_plus.default_color = WIRE_PLUS_LIVE if live else WIRE_PLUS_IDLE
	_wire_return.default_color = WIRE_MINUS_LIVE if live else WIRE_MINUS_IDLE


func _update_visuals(current: float, burnt: bool) -> void:
	if burnt:
		_lamp_body.color = Color(0.05, 0.05, 0.05)
		_lamp_glow.color = Color(1.0, 0.85, 0.55, 0.0)
		_light_radius.scale = Vector2(1, 1) * 0.001
		return

	# Яркость привязана к паспортному току, а не к цели: при перекале
	# лампа реально светит ярче нужного — это видно, а не только написано.
	var brightness: float = clampf(current / RATED_A, 0.0, 1.0)
	_lamp_body.color = Color(1.0, 0.9, 0.6, 1.0).lerp(Color(0.2, 0.18, 0.1), 1.0 - brightness)
	_lamp_glow.color = Color(1.0, 0.85, 0.55, 0.6 * brightness)

	var radius: float = lerpf(16.0, 360.0, brightness)
	_light_radius.scale = Vector2(1, 1) * radius
	_light_radius.color = Color(1.0, 0.85, 0.55, 0.08 + 0.12 * brightness)
