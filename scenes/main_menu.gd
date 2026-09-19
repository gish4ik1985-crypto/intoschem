extends Node2D
## Главное меню (раздел 00): играть / настройки звука и экрана / выход.
## Паттерн портирован с прошлого проекта (`maze off/menu.gd`), упрощён —
## без профилей, языка и тест-режима, которые здесь пока не нужны.

const UIStyle := preload("res://scenes/ui_style.gd")
const SettingsPanel := preload("res://scenes/settings_panel.gd")
const CodexPanel := preload("res://scenes/codex_panel.gd")
const MAP_SCENE := "res://scenes/map.tscn"

var _menu_box: VBoxContainer
var _settings_scroll: ScrollContainer
var _settings_box: VBoxContainer
var _codex_scroll: ScrollContainer
var _codex_box: VBoxContainer


func _ready() -> void:
	_build_ui()


func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.04, 0.04, 0.06)
	bg.size = Vector2(1600, 900)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	var layer := CanvasLayer.new()
	add_child(layer)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	layer.add_child(center)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 18)
	root.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(root)

	var title := Label.new()
	title.text = "INTO SCHEM"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", UIStyle.ACCENT_HOVER)
	root.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "ремонтная подсистема"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 15)
	subtitle.add_theme_color_override("font_color", Color(0.6, 0.6, 0.65))
	root.add_child(subtitle)

	_menu_box = VBoxContainer.new()
	_menu_box.add_theme_constant_override("separation", 12)
	_menu_box.alignment = BoxContainer.ALIGNMENT_CENTER
	root.add_child(_menu_box)
	_menu_box.add_child(UIStyle.make_button("Играть", _on_play_pressed))
	_menu_box.add_child(UIStyle.make_button("Настройки", _on_settings_pressed))
	_menu_box.add_child(UIStyle.make_button("Кодекс", _on_codex_pressed))
	_menu_box.add_child(UIStyle.make_button("Выход", _on_quit_pressed))

	_settings_scroll = ScrollContainer.new()
	_settings_scroll.visible = false
	_settings_scroll.custom_minimum_size = Vector2(560, 420)
	_settings_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(_settings_scroll)

	_settings_box = VBoxContainer.new()
	_settings_box.add_theme_constant_override("separation", 10)
	_settings_scroll.add_child(_settings_box)
	SettingsPanel.build(_settings_box)
	_add_back_button(_settings_box, _on_settings_back_pressed)

	_codex_scroll = ScrollContainer.new()
	_codex_scroll.visible = false
	_codex_scroll.custom_minimum_size = Vector2(700, 460)
	_codex_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_codex_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(_codex_scroll)

	_codex_box = VBoxContainer.new()
	_codex_box.add_theme_constant_override("separation", 4)
	_codex_scroll.add_child(_codex_box)
	CodexPanel.build(_codex_box)
	_add_back_button(_codex_box, _on_codex_back_pressed)


func _add_back_button(container: VBoxContainer, on_pressed: Callable) -> void:
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(0, 6)
	container.add_child(pad)
	container.add_child(UIStyle.make_button("Назад", on_pressed, 160, 40, 16))


func _on_play_pressed() -> void:
	get_tree().change_scene_to_file(MAP_SCENE)


func _on_settings_pressed() -> void:
	_menu_box.visible = false
	_settings_scroll.visible = true


func _on_settings_back_pressed() -> void:
	_settings_scroll.visible = false
	_menu_box.visible = true


func _on_codex_pressed() -> void:
	_menu_box.visible = false
	_codex_scroll.visible = true


func _on_codex_back_pressed() -> void:
	_codex_scroll.visible = false
	_menu_box.visible = true


func _on_quit_pressed() -> void:
	get_tree().quit()
