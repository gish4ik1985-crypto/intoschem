extends Node
## Глобальные настройки звука/экрана — автозагрузка (раздел 00: «нормальное
## меню с настройками»). Паттерн портирован и упрощён с прошлого проекта
## (см. `maze off/config.gd` — по просьбе пользователя, не придумывать
## заново): процедурные аудио-шины Music/SFX, apply_volumes()/
## apply_display(), сохранение через ConfigFile. Профили, язык, тест-режим
## и прочее из старого проекта сюда не перенесены — там это было нужно,
## здесь пока нет.

const SAVE_PATH := "user://settings.cfg"
const RESOLUTIONS := [Vector2i(1280, 720), Vector2i(1600, 900), Vector2i(1920, 1080), Vector2i(2560, 1440)]

var music_volume: float = 0.8
var sfx_volume: float = 1.0
var fullscreen: bool = false
var vsync: bool = true
var resolution_idx: int = 1  # 1600×900 — совпадает с фиксированным размером окна в project.godot

# Прогресс — отдельная секция сейва от "settings" (звук/экран), но тот же
# файл: заводить второй ConfigFile ради нескольких флагов пока не стоит.
#
# Сколько света реально выдаёт каждый прибор, 0..1 — не «пройден/не
# пройден», а именно НАСКОЛЬКО хорошо он настроен. Раздел 02: «свет идёт
# только от тока», поэтому недокрученный прибор светит слабо и открывает
# меньший кусок карты. Ток настроен вполсилы — и соседнюю схему может быть
# физически не видно, пока не дашь больше света.
var device_output: Dictionary = {}

const REPAIRED_THRESHOLD := 0.05  # ниже — считаем, что прибор не работает


func get_device_output(device_id: String) -> float:
	return clampf(float(device_output.get(device_id, 0.0)), 0.0, 1.0)


func is_repaired(device_id: String) -> bool:
	return get_device_output(device_id) > REPAIRED_THRESHOLD


## Прибор сам сообщает, сколько света выдаёт прямо сейчас. Запоминаем
## ЛУЧШЕЕ достигнутое: игрок мог настроить как надо, а потом покрутить
## дальше — уходя с уровня, он уносит свой лучший результат, а не
## последний случайный.
func set_device_output(device_id: String, value: float) -> void:
	var clamped: float = clampf(value, 0.0, 1.0)
	if clamped <= get_device_output(device_id):
		return
	device_output[device_id] = clamped
	save_settings()

# Текущий заряд ядра (раздел 05), 0..1. Сознательно НЕ сохраняется между
# запусками — это состояние текущего забега, а не настройка; при каждом
# старте игры ядро снова полное. Копится/тратится в самих уровнях
# (сейчас — только в level_01.gd, единственное место, где есть потребитель).
var core_charge: float = 1.0


func _ready() -> void:
	_ensure_audio_buses()
	load_settings()
	apply_volumes()
	apply_display()


func _ensure_audio_buses() -> void:
	for bus_name in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus_name) == -1:
			var idx := AudioServer.bus_count
			AudioServer.add_bus(idx)
			AudioServer.set_bus_name(idx, bus_name)
			AudioServer.set_bus_send(idx, "Master")


func apply_volumes() -> void:
	var mi := AudioServer.get_bus_index("Music")
	var si := AudioServer.get_bus_index("SFX")
	if mi != -1:
		AudioServer.set_bus_volume_db(mi, linear_to_db(maxf(music_volume, 0.0001)))
		AudioServer.set_bus_mute(mi, music_volume <= 0.001)
	if si != -1:
		AudioServer.set_bus_volume_db(si, linear_to_db(maxf(sfx_volume, 0.0001)))
		AudioServer.set_bus_mute(si, sfx_volume <= 0.001)


## Полноэкранный режим и разрешение — через DisplayServer, а не через
## изменение project.godot: `window/size/resizable=false` там запрещает
## игроку тянуть окно мышью (была отдельная просьба — раздел 00), но не
## мешает движку менять размер программно из этого меню.
func apply_display() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if vsync else DisplayServer.VSYNC_DISABLED)
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		var r: Vector2i = RESOLUTIONS[clampi(resolution_idx, 0, RESOLUTIONS.size() - 1)]
		DisplayServer.window_set_size(r)


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("settings", "music_volume", music_volume)
	cfg.set_value("settings", "sfx_volume", sfx_volume)
	cfg.set_value("settings", "fullscreen", fullscreen)
	cfg.set_value("settings", "vsync", vsync)
	cfg.set_value("settings", "resolution_idx", resolution_idx)
	cfg.set_value("progress", "device_output", device_output)
	cfg.save(SAVE_PATH)


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	music_volume = clampf(float(cfg.get_value("settings", "music_volume", music_volume)), 0.0, 1.0)
	sfx_volume = clampf(float(cfg.get_value("settings", "sfx_volume", sfx_volume)), 0.0, 1.0)
	fullscreen = bool(cfg.get_value("settings", "fullscreen", fullscreen))
	vsync = bool(cfg.get_value("settings", "vsync", vsync))
	resolution_idx = clampi(int(cfg.get_value("settings", "resolution_idx", resolution_idx)), 0, RESOLUTIONS.size() - 1)
	var saved = cfg.get_value("progress", "device_output", {})
	device_output = saved if saved is Dictionary else {}
