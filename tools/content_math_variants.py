"""Make the v2–v5 variants of 12 math task families ask for different numbers.

In math-expressions-f1, -equations-f1, -inequalities-f1/-f3, -functions-f5, -circles-f6, -probability-f3/-f6,
-sequences-f2/-f6 and -vectors-f1/-f6 all five variants had the same key, so a learner could memorise the
answer instead of the method. v1 stays as it was (only grammar is fixed); v2–v5 get new data, options in a
fixed pseudo-random order, and an explanation in the same style. Output: src/content/65-math-variants.json (patch)."""
import json, os, random, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'content', '65-math-variants.json')
SUP = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')
POS = {1: 3, 2: 1, 3: 3, 4: 0, 5: None}  # where the key goes among the five options (v5 is a numeric task)
patch = {}


def sup(n):
    return str(n).translate(SUP)


def par(n):
    return '(%s)' % n if n < 0 else str(n)


def minus(n):
    return str(n).replace('-', '−')


def tail(key, others):
    return ('Чому не %s: ці числа лише трохи відрізняються від правильного результату, тобто з’являються через '
            'помилку в обчисленні, а не через інший спосіб розв’язання. Перевір себе підстановкою: підходить тільки %s.'
            % ('; '.join(others), key))


def put(fam, v, prompt, key, body, trap, near=None, fmt=str, prompt_only=False):
    """One variant: key, distractors (default key±1, ±2), explanation = body + Відповідь + Пастка + «Чому не»."""
    qid = 'math-%s-v%d' % (fam, v)
    if prompt_only:
        patch[qid] = {'prompt': prompt}
        return
    if v == 5:
        patch[qid] = {'prompt': prompt, 'answer': fmt(key),
                      'explanation': '%s\nВідповідь: %s.\n%s' % (body, fmt(key).replace('-', '−'), trap)}
        return
    near = near or [key - 2, key - 1, key + 1, key + 2]
    others = [fmt(x) for x in near]
    random.Random('%s-%d' % (fam, v)).shuffle(others)
    opts = others[:]
    opts.insert(POS[v], fmt(key))
    patch[qid] = {'prompt': prompt, 'options': opts, 'answer': POS[v],
                  'explanation': '%s\nВідповідь: %s.\n%s\n%s' % (body, fmt(key).replace('-', '−'), trap,
                                                                tail(fmt(key).replace('-', '−'), [o.replace('-', '−') for o in others]))}


def comma(x):
    return str(x).replace('.', ',')


# --- expressions-f1: a^m · a^n / a^k
for v, (a, m, n, k) in {2: (3, 2, 3, 1), 3: (5, 4, 2, 4), 4: (10, 5, 2, 4), 5: (3, 5, 2, 4)}.items():
    e = m + n - k
    key = a ** e
    near = {2: [79, 80, 82, 83], 3: [23, 24, 26, 27], 4: [900, 990, 1010, 1100], 5: [25, 26, 28, 29]}[v]
    put('expressions-f1', v, 'Обчисліть %d^%d · %d^%d / %d^%d.' % (a, m, a, n, a, k), key,
        'Основа однакова, тому при множенні показники додаємо, а при діленні віднімаємо.\n%d%s · %d%s / %d%s = %d^(%d + %d − %d) = %d%s = %d.'
        % (a, sup(m), a, sup(n), a, sup(k), a, m, n, k, a, sup(e), key),
        'Пастка — перемножувати показники замість додавати або додавати основи.', near)

# --- equations-f1: ax − b = c
for v, (a, b, c) in {2: (3, 6, 15), 3: (4, 8, 4), 4: (5, 10, 30), 5: (6, 12, 24)}.items():
    x = (c + b) // a
    put('equations-f1', v, 'Розв’яжіть %dx−%d=%d.' % (a, b, c), x,
        'Перенеси сталий доданок у праву частину зі зміною знака, а потім поділи обидві частини на коефіцієнт при x. %dx=%d, тому x=%d.'
        % (a, c + b, x), 'Пастка — перенести число без зміни знака: тоді вийшло б %dx=%d.' % (a, c - b))

# --- inequalities-f1: count integers in a<x<b
for v, (lo, hi) in {2: (1, 8), 3: (2, 11), 4: (-2, 6), 5: (5, 15)}.items():
    ints = list(range(lo + 1, hi))
    lst = ', '.join(minus(i) for i in ints) if len(ints) <= 9 else '%s, …, %s' % (minus(ints[0]), minus(ints[-1]))
    put('inequalities-f1', v, 'Скільки цілих x задовольняють %s<x<%d?' % (minus(lo), hi), len(ints),
        'Строгі нерівності не включають кінці %s і %d.\nЦілі числа: %s — усього %d.' % (minus(lo), hi, lst, len(ints)),
        'Пастка — порахувати b − a = %d, тобто включити один із кінців.' % (hi - lo))

# --- inequalities-f3: |x − c| ≤ r
for v, (c, r) in {2: (3, 4), 3: (-1, 2), 4: (5, 5), 5: (-2, 6)}.items():
    lo, hi = c - r, c + r
    inner = 'x − %d' % c if c > 0 else 'x + %d' % (-c)
    put('inequalities-f3', v, 'Скільки цілих розв’язків має |%s|≤%d?' % (inner.replace(' ', ''), r), 2 * r + 1,
        '|%s| ≤ %d ⇔ −%d ≤ %s ≤ %d ⇔ %s ≤ x ≤ %d.\nЦілих чисел від %s до %d включно: %d − (%s) + 1 = %d.'
        % (inner, r, r, inner, r, minus(lo), hi, minus(lo), hi, hi, minus(lo), 2 * r + 1),
        'Пастка — забути «+1» і відповісти %d або порахувати лише додатні числа.' % (2 * r))

# --- probability-f6: range of a set
for v, (nums, trap) in {
        2: ([3, 7, -2, 10], 'Пастка — взяти перше число замість найменшого: 10 − 3 = 7.'),
        3: ([-5, 0, 6, -1], 'Пастка — взяти нуль замість найменшого числа: 6 − 0 = 6.'),
        4: ([12, 25, 7, 3], 'Пастка — взяти перше число замість найменшого: 25 − 12 = 13.'),
        5: ([-7, -2, -10, -4], 'Пастка — відняти перше число замість найменшого: −2 − (−7) = 5.')}.items():
    mx, mn = max(nums), min(nums)
    put('probability-f6', v, 'Знайдіть розмах набору %s.' % '; '.join(minus(n) for n in nums), mx - mn,
        'Розмах = найбільше − найменше.\n%s − %s = %d.' % (minus(mx), minus(par(mn)) if mn < 0 else str(mn), mx - mn), trap)

# --- sequences-f2: d from a1 and a5
for v, (a1, a5) in {2: (5, 29), 3: (10, 2), 4: (1, 21), 5: (-4, 8)}.items():
    d = (a5 - a1) // 4
    near = {2: [4, 5, 7, 8], 3: [-4, -3, -1, 2], 4: [3, 4, 6, 7], 5: [1, 2, 4, 5]}[v]
    put('sequences-f2', v, 'У прогресії a₁=%s, a₅=%s. Знайдіть різницю d.' % (minus(a1), minus(a5)), d,
        'Між першим і п’ятим членами чотири однакові прирости, тому різницю цих членів ділимо на чотири.\na₅−a₁=4d=%s, тому d=%s.'
        % (minus(a5 - a1), minus(d)),
        'Пастка — поділити на 5 замість 4 або поміняти члени місцями (знак d стане протилежним).', near, fmt=str)

# --- sequences-f6: index of a term
for v, (a1, d, t) in {2: (3, 4, 31), 3: (1, 3, 28), 4: (-6, 2, 10), 5: (40, -3, 7)}.items():
    q = (t - a1) // d
    put('sequences-f6', v, 'Арифметична прогресія: a₁=%s, d=%s. Який номер має член %s?' % (minus(a1), minus(d), minus(t)), q + 1,
        'aₙ = a₁ + (n − 1)d: %s = %s + (n − 1)·%s.\nn − 1 = (%s − %s) : %s = %d, n = %d.\nПеревірка: %s + %d·%s = %s.'
        % (minus(t), minus(a1), minus(par(d)), minus(t), minus(par(a1)), minus(par(d)), q, q + 1, minus(a1), q, minus(par(d)), minus(t)),
        'Пастка — забути «+1» і відповісти %d.' % q)

# --- vectors-f1: distance between two points (Pythagorean differences)
for v, (A, B) in {2: ((1, 2), (7, 10)), 3: ((-2, 1), (3, 13)), 4: ((2, -1), (10, 14)), 5: ((1, 1), (8, 25))}.items():
    dx, dy = B[0] - A[0], B[1] - A[1]
    key = int(round((dx * dx + dy * dy) ** 0.5))
    assert key * key == dx * dx + dy * dy
    put('vectors-f1', v, 'Знайдіть відстань між A(%s;%s) і B(%s;%s).' % (minus(A[0]), minus(A[1]), B[0], B[1]), key,
        'AB = √((x₂ − x₁)² + (y₂ − y₁)²) = √((%s − %s)² + (%s − %s)²) = √(%d² + %d²) = √%d = %d.'
        % (B[0], minus(par(A[0])), B[1], minus(par(A[1])), dx, dy, dx * dx + dy * dy, key),
        'Пастка — додати різниці координат (%d) без кореня з квадратів.' % (dx + dy))

# --- vectors-f6: radius of a sphere
for v, (cx, cy, cz, r) in {2: (1, 4, -2, 7), 3: (-3, 0, 1, 4), 4: (2, -5, -1, 9), 5: (-1, 2, 6, 6)}.items():
    def term(var, c):
        return '%s²' % var if c == 0 else '(%s%s%d)²' % (var, '−' if c > 0 else '+', abs(c))
    put('vectors-f6', v, 'Сфера має рівняння %s+%s+%s=%d. Знайдіть її радіус.' % (term('x', cx), term('y', cy), term('z', cz), r * r), r,
        'Рівняння сфери: (x − a)² + (y − b)² + (z − c)² = R².\nR² = %d, R = %d.' % (r * r, r),
        'Пастка — відповісти R² = %d або взяти координату центра.' % (r * r))

# --- functions-f5: ordinate of the vertex after a shift
def units(n):
    return '%d %s' % (n, 'одиницю' if n == 1 else 'одиниці' if 2 <= n <= 4 else 'одиниць')


put('functions-f5', 1, 'Графік y=x² змістили на 2 одиниці вправо і 4 одиниці вгору. Знайдіть ординату його вершини.', 4, '', '', prompt_only=True)
for v, (dx, side, dy, up) in {2: (3, 'вліво', 5, 'вгору'), 3: (4, 'вправо', 6, 'вгору'), 4: (5, 'вліво', 3, 'вниз'), 5: (6, 'вправо', 8, 'вгору')}.items():
    yv = dy if up == 'вгору' else -dy
    xv = dx if side == 'вправо' else -dx
    put('functions-f5', v, 'Графік y=x² змістили на %s %s і %s %s. Знайдіть ординату його вершини.' % (units(dx), side, units(dy), up), yv,
        'Вершина y = x² — точка (0; 0). Зсув на %d %s змінює абсцису, на %d %s — ординату: вершина (%s; %s). Ордината %s.'
        % (dx, side, dy, up, minus(xv), minus(yv), minus(yv)),
        'Пастка — відповісти абсцисою %s або вважати, що горизонтальний зсув змінює ординату.' % minus(xv),
        [yv - 2, yv - 1, yv + 1, yv + 2])

# --- circles-f6: inscribed and central angles (v1 keeps the diameter task)
circ = {
    2: ('Центральний кут дорівнює 80°. Знайдіть вписаний кут, що спирається на ту саму дугу (градуси).', 40,
        'Вписаний кут удвічі менший за центральний, що спирається на ту саму дугу.\n80° : 2 = 40°.', 'Пастка — подвоїти замість ділити навпіл (160°).'),
    3: ('Вписаний кут дорівнює 35°. Знайдіть центральний кут, що спирається на ту саму дугу (градуси).', 70,
        'Центральний кут удвічі більший за вписаний, що спирається на ту саму дугу.\n35°·2 = 70°.', 'Пастка — поділити навпіл (17,5°).'),
    4: ('Вписаний кут спирається на дугу 110°. Знайдіть величину цього кута (градуси).', 55,
        'Вписаний кут дорівнює половині дуги, на яку спирається.\n110° : 2 = 55°.', 'Пастка — взяти всю дугу (110°).'),
    5: ('Вписаний кут дорівнює 52°. Знайдіть градусну міру дуги, на яку він спирається.', 104,
        'Дуга вдвічі більша за вписаний кут, що на неї спирається.\n52°·2 = 104°.', 'Пастка — відповісти самим кутом (52°).'),
}
put('circles-f6', 1, 'Хорда є діаметром. Який вписаний кут спирається на неї (градуси), якщо радіус 2 см?', 90, '', '', prompt_only=True)
patch.pop('math-circles-f6-v1')  # unchanged
for v, (p, key, body, trap) in circ.items():
    put('circles-f6', v, p, key, body, trap, [key - 2, key - 1, key + 1, key + 2] if key < 90 else [key - 4, key - 2, key + 2, key + 4])

# --- probability-f3: red ball out of red and blue
for v, (r, b, key, near) in {1: (2, 3, 0.4, ['0.5', '0.3', '0.6', '0.2']), 2: (3, 2, 0.6, ['0.4', '0.5', '0.7', '0.3']),
                              3: (3, 7, 0.3, ['0.7', '0.4', '0.2', '0.5']), 4: (5, 15, 0.25, ['0.2', '0.3', '0.5', '0.75']),
                              5: (6, 9, 0.4, None)}.items():
    red = {2: '2 червоні', 3: '3 червоні', 5: '5 червоних', 6: '6 червоних'}[r]
    blue = {3: '3 сині', 2: '2 сині', 7: '7 синіх', 15: '15 синіх', 9: '9 синіх'}[b]
    prompt = 'У коробці %s і %s %s. Одну кульку навмання витягають. Знайдіть імовірність червоної.' % (red, blue, 'кульки' if b < 5 else 'кульок')
    body = 'Усього кульок %d + %d = %d, сприятливих (червоних) %d.\nP = %d/%d = %s.' % (r, b, r + b, r, r, r + b, comma(key))
    trap = 'Пастка — поділити кількість червоних на кількість синіх (вийде %d/%d).' % (r, b)
    if v == 1:
        patch['math-probability-f3-v1'] = {'prompt': prompt, 'options': ['0.5', '0.3', '0.6', '0.4', '0.2'], 'answer': 3,
                                           'explanation': '%s\nВідповідь: %s.\n%s\n%s' % (body, comma(key), trap, tail(comma(key), [comma(o) for o in ['0.5', '0.3', '0.6', '0.2']]))}
        continue
    if v == 5:
        patch['math-probability-f3-v5'] = {'prompt': prompt, 'answer': '0.4', 'explanation': '%s\nВідповідь: %s.\n%s' % (body, comma(key), trap)}
        continue
    opts = near[:]
    random.Random('f3-%d' % v).shuffle(opts)
    opts.insert(POS[v], str(key))
    patch['math-probability-f3-v%d' % v] = {'prompt': prompt, 'options': opts, 'answer': POS[v],
                                           'explanation': '%s\nВідповідь: %s.\n%s\n%s' % (body, comma(key), trap, tail(comma(key), [comma(o) for o in opts if o != str(key)]))}


# --- probability-f5: median of five numbers (the old sets were symmetric, so «third number» and «mean» equalled the key)
for v, nums in {1: [9, 1, 7, 3, 4], 2: [12, 3, 10, 5, 6], 3: [15, 2, 11, 4, 9], 4: [20, 8, 14, 6, 10], 5: [7, 21, 5, 13, 11]}.items():
    srt = sorted(nums)
    med = srt[2]
    mean = comma(round(sum(nums) / 5, 2))
    near = {1: [2, 3, 5, 6], 2: [4, 5, 7, 8], 3: [7, 8, 10, 11], 4: [8, 9, 11, 12], 5: [9, 10, 12, 13]}[v]
    put('probability-f5', v, 'Знайдіть медіану набору %s.' % '; '.join(map(str, nums)), med,
        'Упорядкуємо: %s.\nМедіана — середній (третій) член: %d.' % ('; '.join(map(str, srt)), med),
        'Пастка — узяти третє число без упорядкування (%d) або середнє арифметичне (%s).' % (nums[2], mean), near)

# --- probability-f1: wrong numeral agreement in v3–v5 («5 футболки» → «5 футболок»)
for v, n in {3: 5, 4: 6, 5: 7}.items():
    patch['math-probability-f1-v%d' % v] = {'prompt': 'Є %d футболок та 4 пари штанів. Скільки різних комплектів «футболка + штани»?' % n}

json.dump({'patch': patch}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(patch), 'patched tasks ->', os.path.relpath(OUT, ROOT))
