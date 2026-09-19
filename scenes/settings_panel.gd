extends RefCounted
## Содержимое панели настроек (звук + экран) — одна реализация на главное
## меню (раздел 00: «один раз сделать правильно», тот же принцип, что у
## инвентаря-склада и `circuit_visuals.gd`). Строит секции в переданный
## контейнер, ничего не создаёт сам по себе.
##
## Без class_name и через preload — новый скрипт в этой сессии не всегда
## сразу попадает в глобальный кэш классов Godot без пересканирования
## проекта (см. раздел 00: та же засада была с InventoryWarehouse).

const UIStyle := preload("res://scenes/ui_style.gd")

static func build(container: VBoxContainer) -> void:
	UIStyle.section_header(container, "Звук")
	UIStyle.volume_slider_row(container, "Музыка", GameConfig.music_volume, func(v: float) -> void:
		GameConfig.music_volume = v
		GameConfig.apply_volumes()
		GameConfig.save_settings())
	UIStyle.volume_slider_row(container, "Звуки", GameConfig.sfx_volume, func(v: float) -> void:
		GameConfig.sfx_volume = v
		GameConfig.apply_volumes()
		GameConfig.save_settings())

	UIStyle.section_header(container, "Экран")
	UIStyle.checkbox_row(container, "Полноэкранный режим", GameConfig.fullscreen, func(on: bool) -> void:
		GameConfig.fullscreen = on
		GameConfig.apply_display()
		GameConfig.save_settings())

	var res_row := HBoxContainer.new()
	res_row.custom_minimum_size = Vector2(UIStyle.SETTINGS_ROW_W, 0)
	res_row.add_theme_constant_override("separation", 10)
	container.add_child(res_row)
	var res_lbl := Label.new()
	res_lbl.text = "Разрешение окна"
	res_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	res_lbl.add_theme_font_size_override("font_size", 15)
	res_row.add_child(res_lbl)
	var res_opt := OptionButton.new()
	for r in GameConfig.RESOLUTIONS:
		res_opt.add_item("%d × %d" % [r.x, r.y])
	res_opt.selected = GameConfig.resolution_idx
	res_opt.item_selected.connect(func(i: int) -> void:
		GameConfig.resolution_idx = i
		GameConfig.apply_display()
		GameConfig.save_settings())
	res_row.add_child(res_opt)

	UIStyle.checkbox_row(container, "Вертикальная синхронизация (VSync)", GameConfig.vsync, func(on: bool) -> void:
		GameConfig.vsync = on
		GameConfig.apply_display()
		GameConfig.save_settings())
