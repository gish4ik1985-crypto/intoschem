extends Node2D
## Уровень 2 «Освещение зоны» (раздел 07): батарея, ключ, лампа. Цель — цепь
## замкнута, лампа горит. Изъян: обрыв провода — в цепи есть разрыв,
## который нужно починить, и ключ, который нужно самому замкнуть
## (раздел 05: «ты сам щёлкаешь рубильником, зная, что стоишь внутри»).
##
## Малое, замкнутое устройство (раздел 06, ступень 1) — в отличие от
## уровня 1 не часть большой карты, без камеры и панорамирования.

const CircuitVisuals := preload("res://scenes/circuit_visuals.gd")
const InventoryWarehouseScene := preload("res://scenes/inventory_warehouse.gd")
const UIStyle := preload("res://scenes/ui_style.gd")

const MAP_SCENE := "res://scenes/map.tscn"
const DEVICE_ID := "flashlight"

# Прогрессия источников (NEW.12): уровень 1 — ОДНА батарейка 1,5 В.
# Здесь их ДВЕ, соединённые последовательно — ровно так устроен этот
# прибор на батарейках, и именно отсюда берутся 3 В, а не из воздуха.
# Раньше тут стоял единственный источник «3 В» без объяснения, откуда
# он взялся после полуторавольтового уровня 1 — это была дыра в прогрессии.
#
# В цепь ставятся два отдельных источника по 1,5 В, а не один на 3 В:
# последовательное соединение считается решателем честно, и это же
# первый в игре урок «последовательно — напряжения складываются».
const CELL_V := 1.5
const CELL_COUNT := 2
const BATTERY_V := CELL_V * CELL_COUNT
const LAMP_OHMS := 10.0   # лампа 3В/0,3А ≈ 10 Ом (раздел 11, таблица номиналов)
const TARGET_A := BATTERY_V / LAMP_OHMS

enum GapState { OPEN, WIRE }

const BATTERY_POS := Vector2(-300, 0)
const CELL_SPACING := 58.0   # расстояние между центрами двух элементов
const GAP_POS := Vector2(-120, 0)
const SWITCH_POS := Vector2(40, 0)
const LAMP_POS := Vector2(200, 0)

const WIRE_PLUS_IDLE := Color(0.5, 0.13, 0.10)
const WIRE_PLUS_LIVE := Color(1.0, 0.35, 0.15)
const WIRE_MINUS_IDLE := Color(0.12, 0.13, 0.17)
const WIRE_MINUS_LIVE := Color(0.30, 0.38, 0.5)

const BATTERY_RADIUS := 19.0
const BATTERY_STRAIGHT := 46.0
const BATTERY_NUB_SIZE := Vector2(16, 9)
const BATTERY_PLUS_LOCAL := Vector2(0, -(BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS + BATTERY_NUB_SIZE.y))
const BATTERY_MINUS_LOCAL := Vector2(0, BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS)

const GAP_HALF_WIDTH := 30.0
const GAP_HALF_HEIGHT := 18.0
const GAP_ATTACH_Y := -(GAP_HALF_HEIGHT + 8.0)

var _lamp_body: Polygon2D
var _lamp_glow: Polygon2D
var _light_radius: Polygon2D
var _status_label: Label
var _reading_label: Label
var _gap_box: Polygon2D
var _gap_label: Label
var _switch_lever: Line2D
var _switch_label: Label
var _wire_plus: Line2D
var _wire_return: Line2D

var _gap_state: GapState = GapState.OPEN
var _switch_closed := false


func _ready() -> void:
	_build_camera()
	_build_world()
	_build_circuit_diagram()
	_build_ui()
	_evaluate()


## Без камеры Godot считает мировой точкой (0,0) верхний левый угол
## экрана, а не центр — вся схема (расположена вокруг x≈-40) рисовалась
## бы за пределами видимой области. Статичная камера, без панорамирования
## (раздел 06: «малые, замкнутые» устройства — в отличие от уровня 1
## здесь не карта, а один компактный прибор целиком на экране).
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


## Один элемент 1,5 В — узнаваемый силуэт пальчиковой батарейки с
## плюсовым пупырьком сверху и плоским минусом снизу.
func _build_battery_cell(pos: Vector2) -> void:
	var cell := Node2D.new()
	cell.position = pos
	add_child(cell)

	var body := Polygon2D.new()
	body.polygon = CircuitVisuals.capsule_points(BATTERY_RADIUS, BATTERY_STRAIGHT, 12)
	body.color = Color(0.22, 0.23, 0.26)
	cell.add_child(body)

	var nub := ColorRect.new()
	nub.color = Color(0.75, 0.76, 0.8)
	nub.size = BATTERY_NUB_SIZE
	nub.position = Vector2(-BATTERY_NUB_SIZE.x * 0.5, -(BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS + BATTERY_NUB_SIZE.y))
	nub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cell.add_child(nub)

	var minus_contact := ColorRect.new()
	minus_contact.color = Color(0.12, 0.12, 0.14)
	minus_contact.size = Vector2(BATTERY_RADIUS * 1.1, 5)
	minus_contact.position = Vector2(-BATTERY_RADIUS * 0.55, BATTERY_STRAIGHT * 0.5 + BATTERY_RADIUS - 6.0)
	minus_contact.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cell.add_child(minus_contact)

	var blabel := Label.new()
	blabel.text = "1,5В"
	blabel.position = Vector2(-BATTERY_RADIUS, -11)
	blabel.size = Vector2(BATTERY_RADIUS * 2, 22)
	blabel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	blabel.add_theme_font_size_override("font_size", 12)
	cell.add_child(blabel)

	var plus_label := Label.new()
	plus_label.text = "+"
	plus_label.position = BATTERY_PLUS_LOCAL + Vector2(-14, -22)
	plus_label.size = Vector2(20, 20)
	plus_label.add_theme_font_size_override("font_size", 16)
	plus_label.add_theme_color_override("font_color", WIRE_PLUS_LIVE)
	cell.add_child(plus_label)

	var minus_label := Label.new()
	minus_label.text = "−"
	minus_label.position = BATTERY_MINUS_LOCAL + Vector2(-14, 4)
	minus_label.size = Vector2(20, 20)
	minus_label.add_theme_font_size_override("font_size", 16)
	minus_label.add_theme_color_override("font_color", WIRE_MINUS_LIVE)
	cell.add_child(minus_label)


func _build_circuit_diagram() -> void:
	# Две батарейки по 1,5 В, стоящие «столбиком» плюс-к-минусу — видно,
	# что 3 В получились сложением двух одинаковых элементов, а не взялись
	# из ниоткуда (NEW.12: прогрессия источников).
	for i in CELL_COUNT:
		var offset := Vector2(float(i) * CELL_SPACING, 0.0)
		_build_battery_cell(BATTERY_POS + offset)

	# Перемычка между элементами: минус первого к плюсу второго — именно
	# это и есть «последовательно».
	for i in CELL_COUNT - 1:
		var from_pos: Vector2 = BATTERY_POS + Vector2(float(i) * CELL_SPACING, 0.0) + BATTERY_MINUS_LOCAL
		var to_pos: Vector2 = BATTERY_POS + Vector2(float(i + 1) * CELL_SPACING, 0.0) + BATTERY_PLUS_LOCAL
		var link := CircuitVisuals.make_wire(from_pos, to_pos, 26.0, WIRE_MINUS_IDLE)
		add_child(link)

	var series_note := Label.new()
	series_note.text = "1,5 В + 1,5 В = 3 В (последовательно)"
	series_note.position = BATTERY_POS + Vector2(-70, 88)
	series_note.size = Vector2(200, 20)
	series_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	series_note.add_theme_font_size_override("font_size", 11)
	series_note.add_theme_color_override("font_color", Color(0.6, 0.62, 0.68))
	add_child(series_note)

	# Обрыв провода (раздел 07, изъян уровня 2) — как гнездо на уровне 1,
	# только без выбора номинала: либо провод цел, либо в нём разрыв.
	_gap_box = Polygon2D.new()
	_gap_box.position = GAP_POS
	_gap_box.polygon = PackedVector2Array([
		Vector2(-GAP_HALF_WIDTH, -GAP_HALF_HEIGHT), Vector2(GAP_HALF_WIDTH, -GAP_HALF_HEIGHT),
		Vector2(GAP_HALF_WIDTH, GAP_HALF_HEIGHT), Vector2(-GAP_HALF_WIDTH, GAP_HALF_HEIGHT)
	])
	_gap_box.color = Color(0.15, 0.15, 0.17)
	add_child(_gap_box)
	_gap_label = Label.new()
	_gap_label.text = "обрыв"
	_gap_label.position = GAP_POS + Vector2(-GAP_HALF_WIDTH, -10)
	_gap_label.size = Vector2(GAP_HALF_WIDTH * 2, 20)
	_gap_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_gap_label.add_theme_font_size_override("font_size", 12)
	add_child(_gap_label)

	# Ключ — простой рычаг: наклонён «вверх» разомкнутым, «вниз» замкнутым.
	var switch_base := Polygon2D.new()
	switch_base.position = SWITCH_POS
	switch_base.polygon = CircuitVisuals.circle_points(6.0, 12)
	switch_base.color = Color(0.5, 0.5, 0.55)
	add_child(switch_base)
	_switch_lever = Line2D.new()
	_switch_lever.add_point(Vector2.ZERO)
	_switch_lever.add_point(Vector2(28, -18))
	_switch_lever.width = 4.0
	_switch_lever.default_color = Color(0.7, 0.7, 0.75)
	_switch_lever.position = SWITCH_POS
	add_child(_switch_lever)
	_switch_label = Label.new()
	_switch_label.text = "ключ: разомкнут"
	_switch_label.position = SWITCH_POS + Vector2(-40, -46)
	_switch_label.size = Vector2(120, 20)
	_switch_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_switch_label.add_theme_font_size_override("font_size", 12)
	add_child(_switch_label)

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

	# В схему уходят только КРАЙНИЕ клеммы столбика: плюс первого элемента
	# и минус последнего — внутренние соединены перемычками между собой.
	var stack_plus: Vector2 = BATTERY_POS + BATTERY_PLUS_LOCAL
	var stack_minus: Vector2 = BATTERY_POS + Vector2(float(CELL_COUNT - 1) * CELL_SPACING, 0.0) + BATTERY_MINUS_LOCAL

	_wire_plus = CircuitVisuals.make_wire_path(
		[stack_plus, GAP_POS + Vector2(0, GAP_ATTACH_Y), SWITCH_POS + Vector2(-14, -10), LAMP_POS + Vector2(-14, -8)],
		[-16.0, -14.0, -12.0], WIRE_PLUS_IDLE)
	add_child(_wire_plus)
	_wire_return = CircuitVisuals.make_wire(
		LAMP_POS + Vector2(0, 12), stack_minus, 40.0, WIRE_MINUS_IDLE)
	add_child(_wire_return)


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	# Выход с уровня обратно на карту — без него из уровня некуда деться,
	# кроме как закрыть игру.
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
	title.text = "Уровень 2 · Освещение зоны"
	title.add_theme_font_size_override("font_size", 20)
	panel.add_child(title)

	var brief := Label.new()
	brief.text = "В проводе обрыв, а ключ разомкнут. Почини провод и замкни ключ, чтобы загорелась лампа."
	panel.add_child(brief)

	_status_label = Label.new()
	panel.add_child(_status_label)

	_reading_label = Label.new()
	_reading_label.modulate = Color(0.7, 0.7, 0.7)
	panel.add_child(_reading_label)

	var warehouse := InventoryWarehouseScene.new()
	warehouse.add_rack("gap_open", "Провод", [{"value": 0.0, "label": "Обрыв"}])
	warehouse.add_rack("gap_wire", "Перемычка", [{"value": 0.0, "label": "Починить"}])
	warehouse.add_rack("switch", "Ключ", [
		{"value": 0.0, "label": "Разомкнуть"},
		{"value": 1.0, "label": "Замкнуть"},
	])
	warehouse.bin_selected.connect(_on_bin_selected)
	layer.add_child(warehouse)


func _on_back_pressed() -> void:
	get_tree().change_scene_to_file(MAP_SCENE)


func _on_bin_selected(kind: String, value: float) -> void:
	match kind:
		"gap_open":
			_gap_state = GapState.OPEN
			_gap_label.text = "обрыв"
		"gap_wire":
			_gap_state = GapState.WIRE
			_gap_label.text = "провод"
		"switch":
			_switch_closed = value > 0.5
			_switch_label.text = "ключ: %s" % ("замкнут" if _switch_closed else "разомкнут")
	_evaluate()


func _evaluate() -> void:
	_switch_lever.rotation = deg_to_rad(-35.0) if _switch_closed else deg_to_rad(0.0)

	if _gap_state == GapState.OPEN:
		_status_label.text = "Цепь разомкнута — в проводе обрыв. Почини его."
		_reading_label.text = ""
		_update_visuals(0.0)
		_update_wire_colors(false)
		return

	# Петля обязана замыкаться на GND, иначе цепи физически нет: раньше
	# источник стоял между VCC и GAP_B, а сам VCC не был подключён больше
	# никуда — узел висел в воздухе, и ток не шёл ни при каком положении
	# ключа («замкнул ключ, ничего не происходит»).
	# Два отдельных источника по 1,5 В в цепочку, а не один на 3 В: так
	# решатель складывает напряжения сам, честно — 3 В на выходе столбика
	# не задано константой, а получается из физики последовательного
	# соединения (NEW.12: прогрессия источников начинается с 1,5 В).
	var circuit := Circuit.new()
	for i in CELL_COUNT:
		var top: String = "VCC" if i == 0 else "CELL_%d" % i
		var bottom: String = "GND" if i == CELL_COUNT - 1 else "CELL_%d" % (i + 1)
		circuit.add_voltage_source(top, bottom, CELL_V, "V%d" % (i + 1))
	circuit.add_switch("VCC", "SW_A", true, "W1")  # починенный провод — не идеал, просто целый
	circuit.add_switch("SW_A", "LAMP_A", _switch_closed, "SW1")
	circuit.add_resistor("LAMP_A", "GND", LAMP_OHMS, "LAMP1")

	var sol := circuit.solve()
	if not sol.ok:
		_status_label.text = "Схема не решилась — что-то совсем не так."
		return

	var current: float = sol.component_current.get("LAMP1", 0.0)
	_reading_label.text = "ток через лампу ≈ %.0f мА" % (current * 1000.0)

	if not _switch_closed:
		_status_label.text = "Провод цел, но ключ разомкнут — щёлкни рубильником."
	elif current < TARGET_A * 0.5:
		_status_label.text = "Едва тлеет."
	else:
		_status_label.text = "Лампа горит — цепь замкнута полностью."

	# Раздел 02: «свет идёт только от тока» — на карту прибор светит ровно
	# настолько, насколько реально горит здесь, а не за факт посещения.
	GameConfig.set_device_output(DEVICE_ID, clampf(current / TARGET_A, 0.0, 1.0))

	_update_visuals(current)
	_update_wire_colors(current > 0.0005)


func _update_wire_colors(live: bool) -> void:
	var plus_color: Color = WIRE_PLUS_LIVE if live else WIRE_PLUS_IDLE
	var minus_color: Color = WIRE_MINUS_LIVE if live else WIRE_MINUS_IDLE
	_wire_plus.default_color = plus_color
	_wire_return.default_color = minus_color


func _update_visuals(current: float) -> void:
	var brightness: float = clampf(current / TARGET_A, 0.0, 1.0)
	_lamp_body.color = Color(1.0, 0.9, 0.6, 1.0).lerp(Color(0.2, 0.18, 0.1), 1.0 - brightness)
	_lamp_glow.color = Color(1.0, 0.85, 0.55, 0.6 * brightness)

	var radius: float = lerpf(20.0, 380.0, brightness)
	_light_radius.scale = Vector2(1, 1) * radius
	_light_radius.color = Color(1.0, 0.85, 0.55, 0.10 + 0.10 * brightness)
