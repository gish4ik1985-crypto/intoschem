class_name MnaSystem
extends RefCounted
## Собираемая методом штампов система уравнений модифицированного узлового
## анализа (раздел 10). Компоненты не знают друг о друге — каждый добавляет
## свой вклад в G и rhs независимо от порядка.
##
## Индексация узлов: земля — сентинел GROUND (-1), остальные узлы — 0..n-1.
## Источники напряжения добавляют по одной дополнительной строке/столбцу
## после всех узловых: индекс n + номер_источника.

const GROUND := -1
const GMIN := 1e-12  # проводимость с каждого узла на землю (раздел 10, «Защиты»)

var node_count: int
var source_count: int
var size: int
var g: Array          # Array[PackedFloat64Array], size x size
var rhs: PackedFloat64Array
var dt: float          # шаг времени текущего решения; 0 = вне переходного процесса


func _init(p_node_count: int, p_source_count: int, p_dt: float = 0.0) -> void:
	node_count = p_node_count
	source_count = p_source_count
	size = node_count + source_count
	dt = p_dt
	g = Linalg.zero_matrix(size)
	rhs = Linalg.zero_vector(size)
	# gmin на каждый узел — спасает от плавающих узлов, которые
	# соберёт игрок. Не влияет на исправно заземлённые цепи.
	for i in node_count:
		g[i][i] += GMIN


func stamp_conductance(a: int, b: int, conductance: float) -> void:
	if a != GROUND:
		g[a][a] += conductance
	if b != GROUND:
		g[b][b] += conductance
	if a != GROUND and b != GROUND:
		g[a][b] -= conductance
		g[b][a] -= conductance


## Добавляет вклад источника тока, текущего от a к b номиналом `current`.
func stamp_current_source(a: int, b: int, current: float) -> void:
	if a != GROUND:
		rhs[a] -= current
	if b != GROUND:
		rhs[b] += current


## Источник тока, управляемый напряжением (ВЧУИ/VCCS) — нужен транзистору
## (раздел 10): ток gm*(V[ctrl_a]-V[ctrl_b]) течёт от out_a к out_b, но
## зависит от СОВСЕМ ДРУГОЙ пары узлов, чем та, между которой течёт сам
## ток. Это и есть источник усиления — слабое напряжение на одной паре
## узлов управляет сильным током между другой парой.
## При out == ctrl вырождается в обычный stamp_conductance.
func stamp_transconductance(out_a: int, out_b: int, ctrl_a: int, ctrl_b: int, gm: float) -> void:
	if out_a != GROUND:
		if ctrl_a != GROUND: g[out_a][ctrl_a] += gm
		if ctrl_b != GROUND: g[out_a][ctrl_b] -= gm
	if out_b != GROUND:
		if ctrl_a != GROUND: g[out_b][ctrl_a] -= gm
		if ctrl_b != GROUND: g[out_b][ctrl_b] += gm


## Источник напряжения `voltage` между a (+) и b (-), под собственным
## дополнительным неизвестным `source_index` (ток через источник).
func stamp_voltage_source(a: int, b: int, voltage: float, source_index: int) -> void:
	var row := node_count + source_index
	if a != GROUND:
		g[row][a] += 1.0
		g[a][row] += 1.0
	if b != GROUND:
		g[row][b] -= 1.0
		g[b][row] -= 1.0
	rhs[row] = voltage


func decompose() -> Linalg.LuResult:
	return Linalg.lu_decompose(g)


func solve_with(factorization: Linalg.LuResult) -> PackedFloat64Array:
	return Linalg.lu_solve(factorization, rhs)
