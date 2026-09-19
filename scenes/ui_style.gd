extends RefCounted
## Единая стилистика кнопок и строк настроек — портировано и упрощено с
## прошлого проекта (см. `maze off/ui_style.gd`, по просьбе пользователя),
## под палитру Into Schem: шкала потенциала раздела 09 — индиго у земли,
## бирюза/тёплый янтарь дальше по шкале, а не случайные цвета Godot по
## умолчанию.

const SETTINGS_ROW_W := 520.0

const ACCENT := Color(0.10, 0.50, 0.66, 0.75)      # ~#1a7fa8, раздел 09
const ACCENT_HOVER := Color(0.18, 0.83, 0.78, 1.0)  # ~#2fd4c8, раздел 09
const ACCENT_WARN := Color(1.0, 0.82, 0.40, 1.0)    # ~#ffd166, раздел 09
const PANEL_BG := Color(0.06, 0.06, 0.08, 0.94)


static func style_button(b: Button) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.08, 0.08, 0.11, 0.9)
	normal.set_border_width_all(2)
	normal.border_color = ACCENT
	normal.set_corner_radius_all(6)
	normal.content_margin_left = 16
	normal.content_margin_right = 16
	normal.content_margin_top = 8
	normal.content_margin_bottom = 8
	var hover := normal.duplicate()
	hover.bg_color = Color(0.08, 0.18, 0.20, 0.95)
	hover.border_color = ACCENT_HOVER
	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.12, 0.26, 0.26, 1.0)
	pressed.border_color = ACCENT_WARN

	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("focus", hover)
	b.add_theme_color_override("font_color", Color(0.85, 0.9, 0.95))
	b.add_theme_color_override("font_hover_color", Color(1, 1, 1))


static func make_button(text: String, on_pressed: Callable, w: float = 240, h: float = 44, font_size: int = 18) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, h)
	b.add_theme_font_size_override("font_size", font_size)
	if on_pressed.is_valid():
		b.pressed.connect(on_pressed)
	style_button(b)
	return b


static func panel_stylebox() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = PANEL_BG
	sb.set_corner_radius_all(8)
	sb.set_border_width_all(2)
	sb.border_color = ACCENT
	sb.content_margin_left = 20
	sb.content_margin_right = 20
	sb.content_margin_top = 16
	sb.content_margin_bottom = 16
	return sb


static func section_header(container: VBoxContainer, text: String) -> void:
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(0, 6)
	container.add_child(pad)
	var l := Label.new()
	l.text = text
	l.custom_minimum_size = Vector2(SETTINGS_ROW_W, 0)
	l.add_theme_font_size_override("font_size", 17)
	l.add_theme_color_override("font_color", ACCENT_HOVER)
	container.add_child(l)


## Строка-переключатель: подпись слева (растёт), CheckButton справа — та
## же раскладка, что у остальных строк настроек, единая левая кромка.
static func checkbox_row(container: VBoxContainer, text: String, value: bool, setter: Callable) -> void:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(SETTINGS_ROW_W, 0)
	row.add_theme_constant_override("separation", 10)
	container.add_child(row)

	var lbl := Label.new()
	lbl.text = text
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lbl.add_theme_font_size_override("font_size", 15)
	row.add_child(lbl)

	var cb := CheckButton.new()
	cb.button_pressed = value
	cb.toggled.connect(setter)
	row.add_child(cb)


## Ползунок громкости: подпись + HSlider 0..1 + процент справа.
static func volume_slider_row(container: VBoxContainer, text: String, value: float, setter: Callable) -> void:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(SETTINGS_ROW_W, 0)
	row.add_theme_constant_override("separation", 10)
	container.add_child(row)

	var lbl := Label.new()
	lbl.text = text
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lbl.add_theme_font_size_override("font_size", 15)
	row.add_child(lbl)

	var slider := HSlider.new()
	slider.min_value = 0.0
	slider.max_value = 1.0
	slider.step = 0.05
	slider.value = value
	slider.custom_minimum_size = Vector2(180, 24)
	row.add_child(slider)

	var pct := Label.new()
	pct.text = "%d%%" % int(round(value * 100.0))
	pct.custom_minimum_size = Vector2(46, 0)
	pct.add_theme_font_size_override("font_size", 13)
	row.add_child(pct)

	slider.value_changed.connect(func(v: float) -> void:
		pct.text = "%d%%" % int(round(v * 100.0))
		setter.call(v))
