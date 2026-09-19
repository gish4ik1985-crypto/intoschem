extends PanelContainer
## Инвентарь-склад (раздел 00, NEW.13): полки деталей, сгруппированные по
## типу компонента, вместо одного ряда кнопок вперемешку. Уровень 1 раньше
## строил такой ряд сам (scenes/level_01.gd); здесь то же самое стало
## многоразовым виджетом, который не нужно будет пересобирать на каждом
## следующем уровне.
##
## Докается снизу экрана и складывается по умолчанию — виден только ряд
## категорий. Категория с одним вариантом (например, «Разомкнуть») —
## это прямая кнопка-действие. Категория с несколькими номиналами
## («Резисторы») по нажатию раскрывает строку с ними НАД собой, а не
## вбок — так виджет никогда не съедает половину экрана и не закрывает
## саму схему (было — раньше все номиналы висели развёрнутыми всегда).

signal bin_selected(kind: String, value: float)

var _content: HBoxContainer
var _header_row: HBoxContainer
var _racks: Dictionary = {}  # kind -> {"bins": Array}
var _expanded_kind: String = ""


func _init() -> void:
	# Точка привязки — центр нижнего края экрана. anchor_left == anchor_right
	# и grow_horizontal BOTH держат виджет отцентрованным по ширине его
	# содержимого; grow_vertical BEGIN растит его вверх при раскрытии
	# номиналов, а не вниз за край экрана.
	anchor_left = 0.5
	anchor_right = 0.5
	anchor_top = 1.0
	anchor_bottom = 1.0
	offset_left = 0.0
	offset_right = 0.0
	offset_top = 0.0
	offset_bottom = -14.0
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BEGIN

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.06, 0.08, 0.94)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 12.0
	style.content_margin_bottom = 12.0
	add_theme_stylebox_override("panel", style)

	var outer := VBoxContainer.new()
	outer.add_theme_constant_override("separation", 8)
	outer.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(outer)

	# Строка номиналов — над рядом категорий, пустая и невидимая, пока
	# ничего не раскрыто.
	_content = HBoxContainer.new()
	_content.add_theme_constant_override("separation", 6)
	_content.alignment = BoxContainer.ALIGNMENT_CENTER
	outer.add_child(_content)

	_header_row = HBoxContainer.new()
	_header_row.add_theme_constant_override("separation", 10)
	_header_row.alignment = BoxContainer.ALIGNMENT_CENTER
	outer.add_child(_header_row)


## bins — Array[Dictionary], каждый элемент {value: float, label: String}.
## Один вариант в полке — кнопка-действие в самом ряду категорий, без
## раскрытия (нечего выбирать). Несколько вариантов — кнопка-категория,
## раскрывающая строку номиналов над собой.
func add_rack(kind: String, title: String, bins: Array) -> void:
	_racks[kind] = {"bins": bins}

	var header := Button.new()
	header.text = title
	header.custom_minimum_size = Vector2(120, 34)
	if bins.size() == 1:
		var only_value: float = bins[0].get("value", 0.0)
		header.pressed.connect(_on_bin_pressed.bind(kind, only_value))
	else:
		header.pressed.connect(_on_header_pressed.bind(kind))
	_header_row.add_child(header)


func _on_header_pressed(kind: String) -> void:
	if _expanded_kind == kind:
		_collapse()
	else:
		_expand(kind)


func _expand(kind: String) -> void:
	_collapse()
	_expanded_kind = kind
	for bin_data in _racks[kind].bins:
		var value: float = bin_data.get("value", 0.0)
		var label: String = bin_data.get("label", "")
		var btn := Button.new()
		btn.text = label
		btn.custom_minimum_size = Vector2(80, 30)
		btn.pressed.connect(_on_bin_pressed.bind(kind, value))
		_content.add_child(btn)


func _collapse() -> void:
	# free() вместо queue_free(): старые кнопки обязаны исчезнуть ДО того,
	# как _expand() добавит новые, иначе один кадр в контейнере живут оба
	# ряда и раскладка прыгает.
	for child in _content.get_children():
		_content.remove_child(child)
		child.free()
	_expanded_kind = ""


func _on_bin_pressed(kind: String, value: float) -> void:
	bin_selected.emit(kind, value)
	_collapse()
