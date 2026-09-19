extends Node2D
## Карта устройства — плата целиком, по которой игрок ходит между
## приборами. Раньше эта карта жила прямо в `level_01.gd`, из-за чего
## уровень 1 был одновременно и картой, и прибором; теперь уровень 1 —
## такая же отдельная сцена-прибор, как уровни 2 и 3, а карта своя.
##
## Освещение карты выведено из правила раздела 02 («свет идёт только от
## тока»), а не назначено: карта тёмная, и каждый ПОЧИНЕННЫЙ прибор
## начинает светить на неё сам. Чем больше приборов работает — тем
## больше платы видно. Ничего дополнительно придумывать не пришлось.

const CircuitVisuals := preload("res://scenes/circuit_visuals.gd")
const UIStyle := preload("res://scenes/ui_style.gd")

const MAIN_MENU_SCENE := "res://scenes/main_menu.tscn"

# Приборы на карте. `radius` — насколько далеко прибор светит, когда
# починен: у фонарика мощный свет, у сигнального светодиода скромный,
# у панельной подсветки совсем小 — это дежурный индикатор.
## `start` — прибор, у которого механизм просыпается: он под рукой и виден
## в темноте, иначе первый шаг сделать нечем. Все остальные приборы нужно
## сперва ОСВЕТИТЬ: пока до прибора не дотянулся свет уже починенного
## соседа, его на тёмной плате попросту не видно. Отсюда и способ играть —
## куда подсветил, туда и пошёл чинить дальше.
const DEVICES := [
	{
		"id": "led", "title": "Сигнальный\nсветодиод", "pos": Vector2(120, 0),
		"scene": "res://scenes/level_01.tscn", "radius": 420.0,
		"color": Color(1.0, 0.45, 0.2), "start": true,
	},
	{
		"id": "flashlight", "title": "Освещение\nзоны", "pos": Vector2(180, -140),
		"scene": "res://scenes/level_02.tscn", "radius": 900.0,
		"color": Color(1.0, 0.85, 0.5), "start": false,
	},
	{
		"id": "panel", "title": "Подсветка\nпанели", "pos": Vector2(-320, 120),
		"scene": "res://scenes/level_03.tscn", "radius": 300.0,
		"color": Color(0.6, 0.9, 1.0), "start": false,
	},
]

const PLATFORM_OFFSETS := [
	Vector2(-260, -90), Vector2(300, 60),
	Vector2(60, 200), Vector2(-80, -220),
	Vector2(780, 420), Vector2(-820, -380), Vector2(1100, -80), Vector2(-950, 500),
]

const BOARD_AMBIENT_ALPHA := 0.08

# Заряд ядра (раздел 05). Числа — заглушки, баланс отдельным проходом:
# настоящее напряжение появится, когда будет на что тратить заряд всерьёз
# (режим «Поток», раздел 05) — сейчас важна работающая механика.
const CORE_DRAIN_PER_SEC := 0.02    # за каждый светящий прибор
const CORE_REGEN_PER_SEC := 0.03    # за каждый починенный прибор

const CABLE_COLOR := Color(0.16, 0.15, 0.13, 0.85)

const WORLD_BG_SIZE := Vector2(4400, 2800)
const WORLD_BG_POS := Vector2(-2200, -1400)
const CAMERA_PAN_LIMIT := Vector2(2200, 1400)
const CAMERA_ZOOM := 1.2  # >1 — камера видит больше карты, не приближает

var _board_container: Node2D
var _camera: Camera2D
var _core_meter: ProgressBar
var _core_label: Label
var _glows: Dictionary = {}    # id прибора -> Polygon2D
var _holders: Dictionary = {}  # id прибора -> Node2D с кнопкой

var _dragging_camera := false
var _drag_last_mouse := Vector2.ZERO


func _ready() -> void:
	_build_camera()
	_build_world()
	_build_cables()
	_build_devices()
	_build_ui()
	_update_core_charge(0.0)


func _process(delta: float) -> void:
	_update_core_charge(delta)


## Перетаскивание камеры ЛКМ. _unhandled_input, а не _input — иначе клик
## по кнопке прибора одновременно потащил бы карту у неё под пальцем.
## Мировые ColorRect-декорации помечены mouse_filter = IGNORE, иначе они,
## будучи Control-нодами, перехватывали бы клик раньше этого метода.
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging_camera = event.pressed
		_drag_last_mouse = event.position
	elif event is InputEventMouseMotion and _dragging_camera:
		var delta: Vector2 = event.position - _drag_last_mouse
		_drag_last_mouse = event.position
		_camera.position -= delta * _camera.zoom


func _build_camera() -> void:
	_camera = Camera2D.new()
	_camera.position = Vector2.ZERO
	_camera.zoom = Vector2(CAMERA_ZOOM, CAMERA_ZOOM)
	_camera.limit_left = int(-CAMERA_PAN_LIMIT.x)
	_camera.limit_right = int(CAMERA_PAN_LIMIT.x)
	_camera.limit_top = int(-CAMERA_PAN_LIMIT.y)
	_camera.limit_bottom = int(CAMERA_PAN_LIMIT.y)
	_camera.enabled = true
	add_child(_camera)


func _build_world() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.05, 0.07)
	bg.size = WORLD_BG_SIZE
	bg.position = WORLD_BG_POS
	bg.z_index = -10
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	_board_container = Node2D.new()
	add_child(_board_container)
	for offset in PLATFORM_OFFSETS:
		_board_container.add_child(_make_board(offset))


func _make_board(offset: Vector2) -> Node2D:
	var board := Node2D.new()
	board.position = offset

	var rect := ColorRect.new()
	rect.color = Color(0.12, 0.16, 0.14)
	rect.size = Vector2(96, 64)
	rect.position = Vector2(-48, -32)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	board.add_child(rect)

	var label := Label.new()
	label.text = "плата"
	label.position = Vector2(-48, -32)
	label.size = Vector2(96, 64)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	board.add_child(label)

	board.modulate.a = BOARD_AMBIENT_ALPHA
	return board


## Дорожки между платами и приборами — пока просто визуальные шнуры, не
## часть расчёта цепи (деление на жилы — отдельный вопрос на будущее).
## Каждая точка соединяется с ближайшей: не полный граф, просто чтобы
## карта читалась как единая сеть, а не набор островков.
func _build_cables() -> void:
	var points: Array[Vector2] = []
	for device in DEVICES:
		points.append(device.pos)
	points.append_array(PLATFORM_OFFSETS)

	var drawn := {}
	for i in points.size():
		var nearest_dist := INF
		var nearest_j := -1
		for j in points.size():
			if j == i:
				continue
			var d: float = points[i].distance_to(points[j])
			if d < nearest_dist:
				nearest_dist = d
				nearest_j = j
		if nearest_j == -1:
			continue
		var key := "%d-%d" % [mini(i, nearest_j), maxi(i, nearest_j)]
		if drawn.has(key):
			continue
		drawn[key] = true
		var bulge: float = points[i].distance_to(points[nearest_j]) * 0.08
		var cable := CircuitVisuals.make_wire(points[i], points[nearest_j], bulge, CABLE_COLOR)
		cable.width = 6.0
		cable.z_index = -8
		add_child(cable)


func _build_devices() -> void:
	for device in DEVICES:
		var glow := Polygon2D.new()
		glow.position = device.pos
		glow.polygon = CircuitVisuals.circle_points(1.0, 28)
		glow.color = Color(device.color, 0.0)
		glow.z_index = -6
		add_child(glow)
		_glows[device.id] = glow

		var holder := Node2D.new()
		holder.position = device.pos
		add_child(holder)
		_holders[device.id] = holder

		var style := StyleBoxFlat.new()
		style.bg_color = Color(0.10, 0.11, 0.14, 0.95)
		style.border_color = device.color
		style.set_border_width_all(2)
		style.set_corner_radius_all(4)

		var btn := Button.new()
		btn.text = device.title
		btn.custom_minimum_size = Vector2(116, 48)
		btn.position = Vector2(-58, -24)
		btn.add_theme_font_size_override("font_size", 13)
		btn.add_theme_stylebox_override("normal", style)
		var scene_path: String = device.scene
		btn.pressed.connect(func() -> void: get_tree().change_scene_to_file(scene_path))
		holder.add_child(btn)


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	_build_core_meter(layer)

	var back_btn := UIStyle.make_button("← В меню", _on_back_pressed, 150, 38, 15)
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
	panel.add_theme_constant_override("separation", 8)
	backdrop.add_child(panel)

	var title := Label.new()
	title.text = "Плата"
	title.add_theme_font_size_override("font_size", 20)
	panel.add_child(title)

	var hint := Label.new()
	hint.text = "Тяни левой кнопкой, чтобы осмотреть плату.\nПочиненный прибор начинает светить сам."
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", Color(0.65, 0.67, 0.72))
	panel.add_child(hint)


func _build_core_meter(layer: CanvasLayer) -> void:
	var meter_panel := PanelContainer.new()
	meter_panel.anchor_left = 0.5
	meter_panel.anchor_right = 0.5
	meter_panel.offset_left = -110.0
	meter_panel.offset_right = 110.0
	meter_panel.offset_top = 12.0
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.06, 0.08, 0.9)
	style.set_border_width_all(1)
	style.border_color = Color(1.0, 0.85, 0.5, 0.5)
	style.set_corner_radius_all(4)
	style.content_margin_left = 10.0
	style.content_margin_right = 10.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	meter_panel.add_theme_stylebox_override("panel", style)
	layer.add_child(meter_panel)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 3)
	meter_panel.add_child(col)

	_core_label = Label.new()
	_core_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_core_label.add_theme_font_size_override("font_size", 12)
	col.add_child(_core_label)

	_core_meter = ProgressBar.new()
	_core_meter.min_value = 0.0
	_core_meter.max_value = 1.0
	_core_meter.show_percentage = false
	_core_meter.custom_minimum_size = Vector2(0, 8)
	col.add_child(_core_meter)


## Заряд ядра: починенные приборы питают систему, светящие — тратят её.
## Пока чистый баланс положительный (настоящий потребитель — режим
## «Поток» — ещё не построен), но сама механика уже работает и видна.
func _update_core_charge(delta: float) -> void:
	var repaired := 0
	var lit := 0
	for device in DEVICES:
		if GameConfig.is_repaired(device.id):
			repaired += 1
			if GameConfig.core_charge > 0.0:
				lit += 1

	var regen: float = CORE_REGEN_PER_SEC * float(repaired) * delta
	var drain: float = CORE_DRAIN_PER_SEC * float(lit) * delta
	GameConfig.core_charge = clampf(GameConfig.core_charge + regen - drain, 0.0, 1.0)

	_core_meter.value = GameConfig.core_charge
	_core_label.text = "Заряд ядра: %d%%" % int(round(GameConfig.core_charge * 100.0))

	_update_glows()


func _update_glows() -> void:
	for device in DEVICES:
		var glow: Polygon2D = _glows[device.id]
		# Радиус — не «починен/нет», а НАСКОЛЬКО прибор реально светит:
		# настроенный вполсилы открывает вдвое меньший круг платы, и
		# соседнюю схему может быть просто не видно, пока не дашь больше.
		var output: float = GameConfig.get_device_output(device.id)
		var lit: bool = output > 0.0 and GameConfig.core_charge > 0.0
		var radius: float = float(device.radius) * output * GameConfig.core_charge if lit else 0.0
		glow.scale = Vector2(1, 1) * maxf(radius, 0.001)
		glow.color = Color(device.color, 0.05 + 0.12 * output if lit else 0.0)
	_update_device_visibility()
	_reveal_boards()


## Прибор доступен, если он стартовый (механизм просыпается прямо у него),
## уже починен, либо до него дотянулся свет другого работающего прибора.
## Свет буквально открывает следующий участок платы — это то же правило
## «свет идёт только от тока», просто применённое к навигации.
func _update_device_visibility() -> void:
	for device in DEVICES:
		var holder: Node2D = _holders[device.id]
		var reachable: bool = bool(device.start) or GameConfig.is_repaired(device.id)
		if not reachable:
			reachable = _light_reaches(Vector2(device.pos), device.id)
		holder.visible = reachable


## Дотягивается ли до точки свет какого-нибудь работающего прибора,
## кроме него самого.
func _light_reaches(point: Vector2, exclude_id: String) -> bool:
	for device in DEVICES:
		if device.id == exclude_id:
			continue
		var radius: float = (_glows[device.id] as Polygon2D).scale.x
		if radius <= 1.0:
			continue
		if point.distance_to(Vector2(device.pos)) <= radius:
			return true
	return false


## Плата видна там, куда дотягивается свет хотя бы одного работающего
## прибора — берём максимум по всем источникам, а не последний.
func _reveal_boards() -> void:
	for board in _board_container.get_children():
		var best: float = BOARD_AMBIENT_ALPHA
		for device in DEVICES:
			var glow: Polygon2D = _glows[device.id]
			var radius: float = glow.scale.x
			if radius <= 1.0:
				continue
			var dist: float = (board.position - Vector2(device.pos)).length()
			best = maxf(best, clampf(1.0 - (dist - radius) / 120.0, 0.0, 1.0))
		board.modulate.a = best


func _on_back_pressed() -> void:
	get_tree().change_scene_to_file(MAIN_MENU_SCENE)
