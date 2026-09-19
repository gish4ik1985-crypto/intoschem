extends RefCounted
## Кодекс — две колонки: слева список статей-«вкладок», справа тело
## выбранной. Портировано и упрощено с прошлого проекта
## (`maze off/menu.gd::_build_codex`) — без счётчиков «прочитано»,
## версий и языка, которые здесь пока не нужны.
##
## Каждая статья — четыре подписанных поля (что это / что делает / зачем
## придумали / как использовать), а не сплошной абзац. `how_to_use` —
## список: применение зависит от ситуации и со временем обрастает новыми
## пунктами, не переписывая остальное.

const UIStyle := preload("res://scenes/ui_style.gd")
const CodexData := preload("res://scenes/codex_data.gd")

const NAV_W := 190.0
const ART_W := 380.0
const PANEL_H := 400.0

const FIELD_LABEL_COLOR := Color(0.55, 0.6, 0.68)
const BODY_COLOR := Color(0.85, 0.87, 0.9)


## container — куда встроить кодекс целиком (пара панелей рядом).
static func build(container: Control) -> void:
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 14)
	container.add_child(hbox)

	var nav_panel := PanelContainer.new()
	nav_panel.add_theme_stylebox_override("panel", UIStyle.panel_stylebox())
	hbox.add_child(nav_panel)

	var nav_scroll := ScrollContainer.new()
	nav_scroll.custom_minimum_size = Vector2(NAV_W, PANEL_H)
	nav_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	nav_panel.add_child(nav_scroll)

	var nav_box := VBoxContainer.new()
	nav_box.add_theme_constant_override("separation", 4)
	nav_scroll.add_child(nav_box)

	var art_panel := PanelContainer.new()
	art_panel.add_theme_stylebox_override("panel", UIStyle.panel_stylebox())
	hbox.add_child(art_panel)

	var art_scroll := ScrollContainer.new()
	art_scroll.custom_minimum_size = Vector2(ART_W, PANEL_H)
	art_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	art_panel.add_child(art_scroll)

	var art_box := VBoxContainer.new()
	art_box.add_theme_constant_override("separation", 8)
	art_scroll.add_child(art_box)

	var nav_buttons: Array = []

	for section in CodexData.SECTIONS:
		var head := Label.new()
		head.text = section.title
		head.add_theme_font_size_override("font_size", 12)
		head.add_theme_color_override("font_color", section.color)
		nav_box.add_child(head)

		for article in CodexData.ARTICLES:
			if article.sec != section.id:
				continue
			var btn := Button.new()
			btn.text = article.title
			btn.custom_minimum_size = Vector2(0, 34)
			btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
			btn.toggle_mode = true
			UIStyle.style_button(btn)
			nav_box.add_child(btn)
			nav_buttons.append(btn)
			var art: Dictionary = article
			var this_btn := btn
			btn.pressed.connect(func() -> void:
				for other in nav_buttons:
					other.button_pressed = (other == this_btn)
				_show_article(art_box, art))

	if not nav_buttons.is_empty():
		nav_buttons[0].button_pressed = true
	if not CodexData.ARTICLES.is_empty():
		_show_article(art_box, CodexData.ARTICLES[0])


static func _show_article(art_box: VBoxContainer, article: Dictionary) -> void:
	for c in art_box.get_children():
		c.queue_free()

	var title := Label.new()
	title.text = article.title
	title.custom_minimum_size = Vector2(ART_W - 20.0, 0)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", UIStyle.ACCENT_WARN)
	art_box.add_child(title)

	_add_field(art_box, "Что это", article.what_is)
	_add_field(art_box, "Что делает", article.what_does)
	_add_field(art_box, "Зачем придумали", article.why_invented)

	var use_text := "\n".join(article.how_to_use.map(func(line: String) -> String: return "• " + line))
	_add_field(art_box, "Как использовать", use_text)


static func _add_field(container: VBoxContainer, label_text: String, value: String) -> void:
	var label := Label.new()
	label.text = label_text
	label.custom_minimum_size = Vector2(ART_W - 20.0, 0)
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_color_override("font_color", FIELD_LABEL_COLOR)
	container.add_child(label)

	var body := Label.new()
	body.text = value
	body.custom_minimum_size = Vector2(ART_W - 20.0, 0)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_theme_font_size_override("font_size", 13)
	body.add_theme_color_override("font_color", BODY_COLOR)
	container.add_child(body)
