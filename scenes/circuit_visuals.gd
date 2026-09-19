extends RefCounted
## Общие геометрические хелперы для отрисовки схем (провода-дуги как на
## макетке, капсула батарейки, окружности для свечения) — вынесены с
## уровня 1 сюда, чтобы уровень 2 и дальнейшие не копипастили тот же код
## (раздел 00: «один раз сделать правильно, чтобы не переделывать на
## каждом следующем уровне» — тот же принцип, что и у инвентаря-склада).
##
## Все функции static — вызываются как CircuitVisuals.make_wire(...) без
## инстанцирования. make_wire()/make_wire_path() не делают add_child —
## это остаётся на вызывающей стороне, у static-функции нет своего `self`.

const WIRE_SEGMENTS := 20


## Точки одной дуги (квадратичная кривая Безье) между from и to. `bulge`
## положительный выгибает дугу вниз, отрицательный — вверх.
static func bezier_arc(from: Vector2, to: Vector2, bulge: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var mid: Vector2 = (from + to) * 0.5
	var dir: Vector2 = (to - from).normalized()
	var perp: Vector2 = Vector2(-dir.y, dir.x)
	var control: Vector2 = mid + perp * bulge

	for i in range(WIRE_SEGMENTS + 1):
		var t: float = float(i) / float(WIRE_SEGMENTS)
		var one_minus_t: float = 1.0 - t
		var point: Vector2 = one_minus_t * one_minus_t * from \
			+ 2.0 * one_minus_t * t * control \
			+ t * t * to
		pts.append(point)
	return pts


static func style_wire(line: Line2D, idle_color: Color) -> void:
	line.width = 4.0
	line.default_color = idle_color
	line.joint_mode = Line2D.LINE_JOINT_ROUND
	line.begin_cap_mode = Line2D.LINE_CAP_ROUND
	line.end_cap_mode = Line2D.LINE_CAP_ROUND


## Провод как одна гибкая дуга между двумя точками — ближе к тому, как
## реально лежит перемычка на макетке, чем прямой луч.
static func make_wire(from: Vector2, to: Vector2, bulge: float, idle_color: Color) -> Line2D:
	var line := Line2D.new()
	for p in bezier_arc(from, to, bulge):
		line.add_point(p)
	style_wire(line, idle_color)
	return line


## Провод из НЕСКОЛЬКИХ дуг, но одним цельным Line2D — важно, когда путь
## должен пройти через промежуточную точку, не разрываясь визуально на
## стыке (`waypoints.size()` == `bulges.size() + 1`).
static func make_wire_path(waypoints: Array, bulges: Array, idle_color: Color) -> Line2D:
	var line := Line2D.new()
	for i in bulges.size():
		var segment := bezier_arc(waypoints[i], waypoints[i + 1], bulges[i])
		var start_index: int = 1 if i > 0 else 0  # не дублировать стыковую точку
		for j in range(start_index, segment.size()):
			line.add_point(segment[j])
	style_wire(line, idle_color)
	return line


## Вертикальная «таблетка»-цилиндр — силуэт пальчиковой батарейки.
static func capsule_points(radius: float, straight_height: float, cap_segments: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var top_y: float = -straight_height * 0.5
	var bottom_y: float = straight_height * 0.5
	for i in range(cap_segments + 1):
		var a: float = PI + PI * float(i) / float(cap_segments)
		pts.append(Vector2(cos(a), sin(a)) * radius + Vector2(0, top_y))
	for i in range(cap_segments + 1):
		var a2: float = PI * float(i) / float(cap_segments)
		pts.append(Vector2(cos(a2), sin(a2)) * radius + Vector2(0, bottom_y))
	return pts


static func circle_points(radius: float, segments: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in segments:
		var angle := TAU * float(i) / float(segments)
		pts.append(Vector2(cos(angle), sin(angle)) * radius)
	return pts
