class_name Linalg
extends RefCounted
## Плотная линейная алгебра для решателя цепей.
##
## LU-разложение с частичным выбором ведущего элемента. Разложение и
## решение — отдельные шаги: раздел 10 требует кэшировать факторизацию
## между шагами времени, когда матрица не меняется (см. Circuit.solve()).

## Результат LU-разложения: скомбинированная матрица LU (L без единичной
## диагонали, U с диагональю) плюс перестановка строк от пивотинга.
class LuResult:
	var lu: Array  # Array[PackedFloat64Array], размер n x n
	var pivot: PackedInt32Array  # pivot[i] = исходный индекс строки в позиции i
	var singular: bool = false


## Раскладывает квадратную матрицу n x n (Array[PackedFloat64Array]) в LU
## с частичным пивотингом. Не изменяет входную матрицу.
static func lu_decompose(a: Array) -> LuResult:
	var n := a.size()
	var lu: Array = []
	for row in a:
		lu.append((row as PackedFloat64Array).duplicate())

	var pivot := PackedInt32Array()
	pivot.resize(n)
	for i in n:
		pivot[i] = i

	var result := LuResult.new()

	for k in n:
		# Частичный выбор ведущего элемента по столбцу k.
		var max_val := absf(lu[k][k])
		var max_row := k
		for i in range(k + 1, n):
			var v := absf(lu[i][k])
			if v > max_val:
				max_val = v
				max_row = i

		if max_val < 1e-14:
			# Матрица вырождена даже с pivoting — в реальной работе сюда не
			# должны попадать благодаря gmin (раздел 10, «Защиты»), но
			# solve() обязан не падать, а откатиться.
			result.singular = true
			result.lu = lu
			result.pivot = pivot
			return result

		if max_row != k:
			var tmp: PackedFloat64Array = lu[k]
			lu[k] = lu[max_row]
			lu[max_row] = tmp
			var tp := pivot[k]
			pivot[k] = pivot[max_row]
			pivot[max_row] = tp

		var pivot_val: float = lu[k][k]
		for i in range(k + 1, n):
			var factor: float = lu[i][k] / pivot_val
			lu[i][k] = factor
			if factor != 0.0:
				for j in range(k + 1, n):
					lu[i][j] -= factor * lu[k][j]

	result.lu = lu
	result.pivot = pivot
	return result


## Решает A x = b, используя готовое LU-разложение. Дешёвая часть —
## O(n^2) прямая и обратная подстановка вместо O(n^3) полного разложения.
## Возвращает пустой массив, если разложение помечено как вырожденное.
static func lu_solve(f: LuResult, b: PackedFloat64Array) -> PackedFloat64Array:
	if f.singular:
		return PackedFloat64Array()

	var n := f.lu.size()
	var y := PackedFloat64Array()
	y.resize(n)

	# Прямая подстановка: L y = P b
	for i in n:
		var sum: float = b[f.pivot[i]]
		var row: PackedFloat64Array = f.lu[i]
		for j in i:
			sum -= row[j] * y[j]
		y[i] = sum

	# Обратная подстановка: U x = y
	var x := PackedFloat64Array()
	x.resize(n)
	for i in range(n - 1, -1, -1):
		var sum: float = y[i]
		var row: PackedFloat64Array = f.lu[i]
		for j in range(i + 1, n):
			sum -= row[j] * x[j]
		x[i] = sum / row[i]

	return x


## Удобный метод «решить один раз» — для тестов и мест, где кэширование
## факторизации не нужно.
static func solve(a: Array, b: PackedFloat64Array) -> PackedFloat64Array:
	var f := lu_decompose(a)
	return lu_solve(f, b)


static func zero_matrix(n: int) -> Array:
	var m: Array = []
	for i in n:
		var row := PackedFloat64Array()
		row.resize(n)
		m.append(row)
	return m


static func zero_vector(n: int) -> PackedFloat64Array:
	var v := PackedFloat64Array()
	v.resize(n)
	return v
