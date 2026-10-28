"""Step-by-step explanations for templated math families (…-fN-vM).
Each family recomputes the answer from the prompt and must match the stored key,
so an explanation can never describe a different answer. Writes src/content/50-explain-math-families.json."""
import json, math, os, re, sys
from fractions import Fraction as Fr

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, 'src', 'data.json'), encoding='utf-8'))
math_subject = next(s for s in data['subjects'] if s['id'] == 'math')


def ints(s):
    return [int(x.replace('−', '-')) for x in re.findall(r'[−-]?\d+', s)]


def fmt(x):
    if isinstance(x, Fr):
        x = x.numerator / x.denominator if x.denominator != 1 else x.numerator
    if isinstance(x, float):
        x = round(x, 6)
        if x == int(x):
            x = int(x)
    return str(x).replace('.', ',')


# family -> function(prompt numbers, prompt) -> (answer, steps, trap)
F = {}


def fam(name):
    def deco(fn):
        F[name] = fn
        return fn
    return deco


@fam('math-numbers-f1')
def _(n, p):
    a, b, c = n[0], n[1], n[2]
    r = a // b + c
    return r, [f'За порядком дій спочатку ділення: {a}/{b} = {a // b}.', f'Потім додавання: {a // b} + {c} = {r}.'], \
        f'Пастка — рахувати зліва направо без пріоритету: {a}/({b} + {c}) або ({a}/{b}) зі зміненим порядком дають інше число.'


@fam('math-numbers-f2')
def _(n, p):
    pc, base = n[0], n[1]
    r = base * pc // 100
    return r, [f'{pc} % — це {pc}/100 від числа.', f'{base} · {pc}/100 = {base * pc}/100 = {r}.'], \
        f'Перевірка: {r} становить {pc} % від {base}, бо {r}/{base} = {fmt(Fr(r, base))} = {pc}/100.'


@fam('math-numbers-f3')
def _(n, p):
    pc, price = n[0], n[1]
    k = Fr(100 - pc, 100)
    r = Fr(price) / k
    return r, [f'Після знижки {pc} % лишається {100 - pc} % початкової ціни x: {fmt(k)}·x = {price}.',
               f'x = {price} : {fmt(k)} = {fmt(r)} грн.', f'Перевірка: {fmt(r)} · {fmt(k)} = {price}.'], \
        f'Пастка — додати {pc} % до {price}: вийде {fmt(Fr(price) * Fr(100 + pc, 100))}, але знижку рахували від початкової ціни, а не від {price}.'


@fam('math-numbers-f4')
def _(n, p):
    a, b = n[0], n[1]
    r = math.gcd(a, b)

    def fac(x):
        out, d = [], 2
        while x > 1:
            while x % d == 0:
                out.append(d)
                x //= d
            d += 1
        from collections import Counter
        return '·'.join(f'{k}{"" if v == 1 else "^" + str(v)}' for k, v in sorted(Counter(out).items()))
    return r, [f'Розкладемо на прості множники: {a} = {fac(a)}, {b} = {fac(b)}.',
               f'НСД — добуток спільних множників у найменших степенях: {r}.',
               f'Перевірка: {a} : {r} = {a // r}, {b} : {r} = {b // r}, а числа {a // r} і {b // r} взаємно прості.'], \
        f'Пастка — сплутати НСД із НСК ({a * b // r}) або взяти спільний дільник, що не є найбільшим.'


@fam('math-numbers-f5')
def _(n, p):
    x, y, total = n[0], n[1], n[2]
    part = total // (x + y)
    r = part * y
    return r, [f'Відношення {x} : {y} означає {x} + {y} = {x + y} рівних частин.', f'Одна частина: {total} : {x + y} = {part} учнів.',
               f'Дівчат {y} частини: {y} · {part} = {r}.'], f'Пастка — узяти {x} частини замість {y}: це кількість хлопців, {x * part}.'


@fam('math-numbers-f6')
def _(n, p):
    price = n[0]
    r = Fr(price) * Fr(6, 5) * Fr(4, 5)
    return r, [f'Подорожчання на 20 %: множник 1,2; подешевшання на 20 %: множник 0,8.', f'Разом: {price} · 1,2 · 0,8 = {price} · 0,96 = {fmt(r)} грн.'], \
        f'Пастка — вважати, що зміни компенсуються, і відповісти {price}: друге зниження рахують від більшої, нової ціни.'


@fam('math-expressions-f1')
def _(n, p):
    a, b, c = n[1], 3, n[-1]
    e = a + b - c
    return 2 ** e, [f'Основа однакова, тому при множенні показники додаємо, а при діленні віднімаємо.', f'2^{a} · 2³ / 2^{c} = 2^({a} + 3 − {c}) = 2^{e} = {2 ** e}.'], \
        'Пастка — перемножувати показники замість додавати або додавати основи.'


@fam('math-expressions-f3')
def _(n, p):
    a, b = n[0], abs(n[1])
    return a * a - b * b, [f'(a − b)(a + b) = a² − b².', f'{a}² − {b}² = {a * a} − {b * b} = {a * a - b * b}.', f'Перевірка: {a - b} · {a + b} = {(a - b) * (a + b)}.'], \
        f'Пастка — порахувати (a − b)² або a² + b² = {a * a + b * b}.'


@fam('math-expressions-f4')
def _(n, p):
    x = n[-1]
    return x + 3, ['Розкладемо чисельник: x² − 9 = (x − 3)(x + 3).', f'При x ≠ 3 дріб скорочується: (x² − 9)/(x − 3) = x + 3.', f'x = {x}: {x} + 3 = {x + 3}.',
                   f'Перевірка: ({x * x} − 9)/({x} − 3) = {x * x - 9}/{x - 3} = {x + 3}.'], 'Пастка — скоротити «9 на 3» й отримати x² − 3 або x + 9.'


@fam('math-expressions-f6')
def _(n, p):
    a = n[0]
    return 2 * a, [f'(x + a)² = x² + 2ax + a².', f'Тут a = {a}: (x + {a})² = x² + {2 * a}x + {a * a}.', f'Коефіцієнт при x: 2 · {a} = {2 * a}.'], \
        f'Пастка — забути подвоєний добуток і відповісти {a} або записати вільний член {a * a}.'


@fam('math-equations-f2')
def _(n, p):
    m = re.search(r'x²−(\d+)x\+(\d+)', p)
    s, pr = int(m.group(1)), int(m.group(2))
    d = s * s - 4 * pr
    x1, x2 = (s - int(math.isqrt(d))) // 2, (s + int(math.isqrt(d))) // 2
    return x2, [f'D = {s}² − 4·{pr} = {d}, √D = {math.isqrt(d)}.', f'x = ({s} ± {math.isqrt(d)})/2: x₁ = {x1}, x₂ = {x2}.',
                f'Перевірка за Вієтою: {x1} + {x2} = {s}, {x1} · {x2} = {pr}.', f'Більший корінь {x2}.'], \
        f'Пастка — відповісти меншим коренем {x1} або взяти корені з протилежними знаками.'


@fam('math-equations-f3')
def _(n, p):
    s, d = n[0], n[1]
    x = (s + d) // 2
    return x, [f'Додамо рівняння: (x + y) + (x − y) = {s} + {d}, тобто 2x = {s + d}.', f'x = {x}, тоді y = {s} − {x} = {s - x}.', f'Перевірка: {x} − {s - x} = {d}.'], \
        f'Пастка — записати y = {s - x} замість x.'


@fam('math-equations-f4')
def _(n, p):
    a = n[0]
    x = a // 2 + 1
    return x, [f'ОДЗ: x ≠ 1.', f'{a}/(x − 1) = 2 → x − 1 = {a} : 2 = {a // 2}.', f'x = {x}; перевірка: {a}/{x - 1} = 2.'], \
        f'Пастка — забути додати 1 і відповісти {a // 2}.'


@fam('math-equations-f5')
def _(n, p):
    a, b = n[0], n[1]
    x = b * b - a
    return x, [f'Права частина {b} ≥ 0, тому можна підносити до квадрата.', f'x + {a} = {b}² = {b * b}, x = {x}.', f'Перевірка: √({x} + {a}) = √{b * b} = {b}.'], \
        f'Пастка — не піднести {b} до квадрата: x + {a} = {b} дає x = {b - a}, що не задовольняє рівняння.'


@fam('math-equations-f6')
def _(n, p):
    s = n[0]
    t = s // 3
    return t, [f'Нехай менше число t, тоді більше 2t.', f't + 2t = {s}, 3t = {s}, t = {t}.', f'Перевірка: {t} + {2 * t} = {s}, і {2 * t} удвічі більше за {t}.'], \
        f'Пастка — відповісти більшим числом {2 * t} або поділити {s} навпіл.'


@fam('math-inequalities-f1')
def _(n, p):
    a, b = n[0], n[1]
    r = b - a - 1
    return r, [f'Строгі нерівності не включають кінці {a} і {b}.', f'Цілі числа: {", ".join(map(str, range(a + 1, b)))} — усього {r}.'], \
        f'Пастка — порахувати b − a = {b - a}, тобто включити один із кінців.'


@fam('math-inequalities-f2')
def _(n, p):
    c = -n[-1] if n[-1] < 0 else n[-1]
    x = c // 2
    return x + 1, [f'−2x < −{c}. Ділимо на −2 і змінюємо знак: x > {x}.', f'Найменше ціле, більше за {x}: {x + 1}.', f'Перевірка: −2·{x + 1} = {-2 * (x + 1)} < −{c}; а для {x} маємо −{c} < −{c} — хибно.'], \
        f'Пастка — не змінити знак (вийде x < {x}) або включити межу {x}.'


@fam('math-inequalities-f3')
def _(n, p):
    a, b = abs(n[0]), n[1]
    return 2 * b + 1, [f'|x − {a}| ≤ {b} ⇔ −{b} ≤ x − {a} ≤ {b} ⇔ {a - b} ≤ x ≤ {a + b}.', f'Цілих чисел від {a - b} до {a + b} включно: {a + b} − ({a - b}) + 1 = {2 * b + 1}.'], \
        f'Пастка — забути «+1» і відповісти {2 * b} або порахувати лише додатні числа.'


@fam('math-inequalities-f4')
def _(n, p):
    a, b = abs(n[0]), abs(n[1])
    return b - 1, [f'Корені {a} і {b}; парабола (x − {a})(x − {b}) має гілки вгору.', f'Добуток від’ємний між коренями: {a} < x < {b}.', f'Найбільше ціле: {b - 1} (саме {b} не входить, бо там добуток дорівнює 0).'], \
        f'Пастка — включити корінь {b} або взяти проміжок поза коренями.'


@fam('math-inequalities-f5')
def _(n, p):
    a = abs(n[0])
    return a, [f'Рівняння kx = 5 не має розв’язків лише тоді, коли k = 0, а права частина не 0.', f'k = a − {a} = 0 → a = {a}; тоді 0·x = 5 — неможливо.',
               f'При будь-якому іншому a є єдиний корінь x = 5/(a − {a}).'], f'Пастка — відповісти a = 0: тоді рівняння −{a}x = 5 має корінь.'


@fam('math-inequalities-f6')
def _(n, p):
    a = n[0]
    return a, [f'Розв’язок системи — перетин: {a} ≤ x < {n[1]}, тобто [{a}; {n[1]}).', f'Квадратна дужка: число {a} входить. Найменше ціле — {a}.'], \
        f'Пастка — вважати межу {a} невключеною і відповісти {a + 1}.'


@fam('math-functions-f1')
def _(n, p):
    b, x = -n[1] if n[1] < 0 else n[1], n[2]
    return 3 * x - b, [f'Підставляємо x = {x}: f({x}) = 3·{x} − {b}.', f'= {3 * x} − {b} = {3 * x - b}.'], f'Пастка — підставити неправильне значення x або відняти до множення.'


@fam('math-functions-f2')
def _(n, p):
    a, c = n[0], n[-1]
    a, c = abs(a), c
    return c, [f'(x − {a})² ≥ 0 і дорівнює 0 при x = {a}.', f'Отже, найменше значення y = 0 + ({c}) = {c} (вершина параболи ({a}; {c})).'], \
        f'Пастка — відповісти абсцисою вершини {a} замість найменшого значення y.'


@fam('math-functions-f3')
def _(n, p):
    b = abs(n[-1])
    return b // 2, [f'Нуль функції — x, при якому y = 0.', f'2x − {b} = 0 → x = {b // 2}.', f'Перевірка: 2·{b // 2} − {b} = 0.'], \
        f'Пастка — відповісти точкою перетину з віссю Oy, тобто −{b}.'


@fam('math-functions-f5')
def _(n, p):
    dx, dy = n[0], n[1]
    return dy, [f'Вершина y = x² — точка (0; 0).', f'Зсув на {dx} вправо змінює абсцису, на {dy} вгору — ординату: вершина ({dx}; {dy}).', f'Ордината {dy}.'], \
        f'Пастка — відповісти абсцисою {dx} або вважати, що зсув вправо змінює ординату.'


@fam('math-functions-f6')
def _(n, p):
    a = abs(n[-1])
    return a, [f'На нуль ділити не можна: x − {a} ≠ 0.', f'Отже, x ≠ {a}; усі інші числа входять в область визначення.'], f'Пастка — відповісти −{a} (неправильно розв’язати x − {a} = 0).'


@fam('math-trigonometry-f1')
def _(n, p):
    k = n[0]
    return k // 2, ['sin 30° = 1/2.', f'{k} · 1/2 = {k // 2}.'], f'Пастка — сплутати з cos 30° = √3/2 або sin 60°.'


@fam('math-trigonometry-f2')
def _(n, p):
    k = n[0]
    return k // 4, ['cos 60° = 1/2, тому cos² 60° = 1/4.', f'{k} · 1/4 = {k // 4}.'], f'Пастка — забути піднести до квадрата й відповісти {k // 2}.'


@fam('math-trigonometry-f3')
def _(n, p):
    k = n[0]
    return k, ['За основною тотожністю sin² α + cos² α = 1 для будь-якого кута.', f'{k} · 1 = {k}.'], 'Пастка — шукати значення sin 17° і cos 17°: вони не потрібні.'


@fam('math-trigonometry-f4')
def _(n, p):
    k = n[0]
    return 30 * k, ['π радіан = 180°, тому π/6 = 30°.', f'{k}π/6 = {k} · 30° = {30 * k}°.'], 'Пастка — помножити на π/180 замість 180/π.'


@fam('math-trigonometry-f5')
def _(n, p):
    m = n[-1]
    return m + 1, ['sin x = 0 при x = πk, k ∈ Z.', f'На [0; {m}π] підходять k = 0, 1, …, {m}: це {m + 1} коренів.'], \
        f'Пастка — не врахувати кінці проміжку (0 і {m}π) і відповісти {m - 1} або {m}.'


@fam('math-trigonometry-f6')
def _(n, p):
    ang, add = n[0], n[1]
    return 1 + add, [f'Період тангенса 180°: tg {ang}° = tg({ang}° − {ang - 45}°) = tg 45° = 1.', f'1 + {add} = {1 + add}.'], \
        'Пастка — вважати, що tg великого кута від’ємний або дорівнює 0; зведення до 45° дає 1.'


@fam('math-logs-f1')
def _(n, p):
    v = n[-1]
    e = int(round(math.log2(v)))
    return e, [f'log₂{v} — показник, до якого треба піднести 2, щоб отримати {v}.', f'2^{e} = {v}, тому log₂{v} = {e}.'], f'Пастка — поділити {v} на 2 і відповісти {v // 2}.'


@fam('math-logs-f2')
def _(n, p):
    v = n[-1]
    e = int(round(math.log(v, 3)))
    return e, [f'Подамо праву частину як степінь 3: {v} = 3^{e}.', f'3ˣ = 3^{e} → x = {e}.'], f'Пастка — поділити {v} на 3 й відповісти {v // 3}.'


@fam('math-logs-f3')
def _(n, p):
    a = abs(n[-2])
    return 9 + a, [f'ОДЗ: x − {a} > 0, тобто x > {a}.', f'За означенням логарифма x − {a} = 3² = 9.', f'x = {9 + a}; ОДЗ виконано.'], \
        f'Пастка — записати x − {a} = 2·3 = 6 і відповісти {6 + a}.'


@fam('math-logs-f4')
def _(n, p):
    v = float(re.search(r'=(\d+(?:\.\d+)?)', p).group(1))
    e = int(round(-math.log2(v)))
    return e, [f'{fmt(v)} = 1/{2 ** e} = (1/2)^{e}.', f'(1/2)ˣ = (1/2)^{e} → x = {e}.'], f'Пастка — отримати від’ємний показник −{e}: основа тут 1/2, а не 2.'


@fam('math-logs-f5')
def _(n, p):
    v = n[0]
    e = int(round(math.log(v, 5)))
    return e + 2, [f'log₅{v} = {e}, бо 5^{e} = {v}.', 'log₅25 = 2, бо 5² = 25.', f'Сума: {e} + 2 = {e + 2}.'], \
        f'Пастка — перемножити логарифми ({2 * e}) замість додати.'


@fam('math-logs-f6')
def _(n, p):
    v = n[-1]
    e = int(round(math.log2(v)))
    return e + 1, [f'{v} = 2^{e}, тому 2ˣ > 2^{e}.', f'Основа 2 > 1, знак зберігається: x > {e}.', f'Найменше ціле — {e + 1}.'], f'Пастка — включити межу й відповісти {e}.'


@fam('math-sequences-f3')
def _(n, p):
    a1, d = n[1], n[2]
    a10 = a1 + 9 * d
    s = (a1 + a10) * 10 // 2
    return s, [f'a₁₀ = a₁ + 9d = {a1} + 9·{d} = {a10}.', f'S₁₀ = (a₁ + a₁₀)·10/2 = ({a1} + {a10})·5 = {s}.'], f'Пастка — узяти a₁₀ = a₁ + 10d = {a1 + 10 * d}.'


@fam('math-sequences-f6')
def _(n, p):
    a1, d, v = n[0], n[1], n[2]
    k = (v - a1) // d + 1
    return k, [f'aₙ = a₁ + (n − 1)d: {v} = {a1} + (n − 1)·({d}).', f'n − 1 = ({v} − {a1}) : ({d}) = {k - 1}, n = {k}.', f'Перевірка: {a1} + {k - 1}·({d}) = {v}.'], \
        f'Пастка — забути «+1» і відповісти {k - 1}.'


@fam('math-calculus-f2')
def _(n, p):
    x = n[-1]
    return 3 * x * x, ['Кутовий коефіцієнт дотичної дорівнює значенню похідної в точці.', f"y′ = 3x², y′({x}) = 3·{x}² = {3 * x * x}."], \
        f'Пастка — підставити x у саму функцію: {x}³ = {x ** 3}.'


@fam('math-calculus-f3')
def _(n, p):
    b = abs(n[0])
    return b // 2, [f"f′(x) = 2x − {b}; f′(x) = 0 при x = {b // 2}.", f'Ліворуч f′ < 0, праворуч f′ > 0, тож x = {b // 2} — точка мінімуму.'], \
        f'Пастка — відповісти найменшим значенням функції f({b // 2}) = {(b // 2) ** 2 - b * (b // 2) + 5} замість абсциси.'


@fam('math-calculus-f4')
def _(n, p):
    b = n[1]
    return b * b, ['Первісна для 2x — x².', f'∫₀^{b} 2x dx = {b}² − 0² = {b * b}.'], f'Пастка — підставити в саму функцію: 2·{b} = {2 * b}.'


@fam('math-calculus-f5')
def _(n, p):
    c, a, b = n[0], n[1], n[2]
    return c * (b - a), [f'Під графіком y = {c} на [{a}; {b}] — прямокутник.', f'Ширина {b} − {a} = {b - a}, висота {c}: S = {b - a}·{c} = {c * (b - a)}.'], \
        f'Пастка — множити на {b} замість довжини відрізка {b - a}.'


@fam('math-calculus-f6')
def _(n, p):
    k, t = n[0], n[1]
    return 2 * t + k, [f"v(t) = s′(t) = 2t + {k}.", f'v({t}) = 2·{t} + {k} = {2 * t + k} м/с.'], f'Пастка — обчислити шлях s({t}) = {t * t + k * t} замість швидкості.'


@fam('math-probability-f2')
def _(n, p):
    m = n[0]
    r = m * (m - 1) // 2
    return r, ['Ролі однакові, тому порядок не важливий — це комбінації.', f'C({m}, 2) = {m}·{m - 1}/2 = {r}.'], \
        f'Пастка — рахувати розміщення {m}·{m - 1} = {m * (m - 1)}, тобто враховувати порядок.'


@fam('math-probability-f3')
def _(n, p):
    a, b = n[0], n[1]
    return Fr(a, a + b), [f'Усього кульок {a} + {b} = {a + b}, сприятливих (червоних) {a}.', f'P = {a}/{a + b} = 0,5.'], \
        'Пастка — поділити кількість червоних на кількість синіх (вийде 1).'


@fam('math-probability-f4')
def _(n, p):
    s = sum(n)
    return Fr(s, len(n)), [f'Сума: {" + ".join(map(str, n))} = {s}.', f'Середнє: {s} : {len(n)} = {fmt(Fr(s, len(n)))}.'], f'Пастка — узяти середнє число за порядком ({sorted(n)[1]}) — це медіана.'


@fam('math-probability-f5')
def _(n, p):
    srt = sorted(n)
    return srt[2], [f'Упорядкуємо: {"; ".join(map(str, srt))}.', f'Медіана — середній (третій) член: {srt[2]}.'], f'Пастка — узяти третє число без упорядкування ({n[2]}) або середнє арифметичне.'


@fam('math-probability-f6')
def _(n, p):
    return max(n) - min(n), [f'Розмах = найбільше − найменше.', f'{max(n)} − ({min(n)}) = {max(n) - min(n)}.'], \
        f'Пастка — відняти без урахування знака мінімуму: {max(n)} − {abs(min(n))} = {max(n) - abs(min(n))}.'


@fam('math-triangles-f2')
def _(n, p):
    a, b = n[0], n[1]
    c = math.isqrt(a * a + b * b)
    return c, [f'За теоремою Піфагора c² = {a}² + {b}² = {a * a} + {b * b} = {a * a + b * b}.', f'c = √{a * a + b * b} = {c} см.'], \
        f'Пастка — додати катети ({a + b}) або забути добути корінь.'


@fam('math-triangles-f4')
def _(n, p):
    a, b = n[1], n[2]
    return Fr(a * b, 4), [f'S = ½·a·b·sin γ.', f'S = ½·{a}·{b}·sin 30° = ½·{a * b}·½ = {fmt(Fr(a * b, 4))} см².'], \
        f'Пастка — забути множник ½ або sin 30°: тоді вийде {fmt(Fr(a * b, 2))}.'


@fam('math-triangles-f5')
def _(n, p):
    s = n[0]
    return 9 * s, ['Площі подібних фігур відносяться як квадрат коефіцієнта подібності.', f'k = 3, k² = 9: {s}·9 = {9 * s} см².'], f'Пастка — помножити площу на k = 3 і відповісти {3 * s}.'


@fam('math-triangles-f6')
def _(n, p):
    l, b = n[0], n[1]
    h = math.isqrt(l * l - (b // 2) ** 2)
    return h, [f'Висота до основи рівнобедреного трикутника ділить основу навпіл: {b}/2 = {b // 2}.', f'h² = {l}² − {b // 2}² = {l * l} − {(b // 2) ** 2} = {h * h}, h = {h} см.'], \
        f'Пастка — узяти всю основу {b} замість половини.'


@fam('math-polygons-f2')
def _(n, p):
    a, h = n[0], n[1]
    return a * h, ['Площа паралелограма — основа на висоту, проведену до неї.', f'S = {a}·{h} = {a * h} см².'], f'Пастка — поділити на 2, як для трикутника: {a * h // 2}.'


@fam('math-polygons-f3')
def _(n, p):
    a, b = n[0], n[1]
    return a * b // 2, ['Площа ромба — половина добутку діагоналей.', f'S = {a}·{b}/2 = {a * b // 2} см².'], f'Пастка — не ділити на 2: {a * b}.'


@fam('math-polygons-f4')
def _(n, p):
    a, b, h = n[0], n[1], n[2]
    return (a + b) * h // 2, ['Площа трапеції — півсума основ на висоту.', f'S = ({a} + {b})/2·{h} = {(a + b) // 2}·{h} = {(a + b) * h // 2} см².'], \
        f'Пастка — не ділити суму основ на 2: ({a} + {b})·{h} = {(a + b) * h}.'


@fam('math-polygons-f6')
def _(n, p):
    a = n[0]
    return 180 - a, ['Сусідні кути паралелограма прилеглі до однієї сторони, їхня сума 180°.', f'180° − {a}° = {180 - a}°.'], f'Пастка — вважати сусідній кут рівним {a}° (рівні протилежні кути) або відняти від 360°.'


@fam('math-circles-f1')
def _(n, p):
    r = n[0]
    return 2 * r, ['Довжина кола C = 2πR.', f'C = 2π·{r} = {2 * r}π, отже k = {2 * r}.'], f'Пастка — обчислити площу πR² і відповісти {r * r}.'


@fam('math-circles-f3')
def _(n, p):
    a = n[0]
    return a // 2, ['Вписаний кут дорівнює половині центрального кута, що спирається на ту саму дугу.', f'{a}° : 2 = {a // 2}°.'], f'Пастка — подвоїти кут ({2 * a}°) замість ділити навпіл.'


@fam('math-circles-f4')
def _(n, p):
    r = n[0]
    return r * r // 4, [f'Сектор 90° — чверть круга.', f'S = πR²·90/360 = π·{r * r}/4 = {r * r // 4}π, k = {r * r // 4}.'], f'Пастка — узяти площу всього круга {r * r}π.'


@fam('math-circles-f5')
def _(n, p):
    d, r = n[0], n[1]
    t = math.isqrt(d * d - r * r)
    return t, ['Радіус у точку дотику перпендикулярний дотичній — маємо прямокутний трикутник з гіпотенузою d.', f't² = {d}² − {r}² = {d * d - r * r}, t = {t} см.'], \
        f'Пастка — додати квадрати замість віднімати або взяти d − R = {d - r}.'


@fam('math-circles-f6')
def _(n, p):
    return 90, ['Вписаний кут, що спирається на діаметр, спирається на півколо (дуга 180°).', 'Тому він дорівнює 180° : 2 = 90°; радіус на це не впливає.'], \
        f'Пастка — використати радіус у розрахунку: величина кута від нього не залежить.'


@fam('math-vectors-f1')
def _(n, p):
    x1, y1, x2, y2 = n
    dx, dy = x2 - x1, y2 - y1
    return math.isqrt(dx * dx + dy * dy), [f'AB = √((x₂ − x₁)² + (y₂ − y₁)²).', f'= √({dx}² + {dy}²) = √{dx * dx + dy * dy} = {math.isqrt(dx * dx + dy * dy)}.'], \
        f'Пастка — додати різниці координат ({dx + dy}) без кореня з квадратів.'


@fam('math-vectors-f3')
def _(n, p):
    a1, a2, b1, b2 = n
    return a1 * b1 + a2 * b2, ['Скалярний добуток: a·b = a₁b₁ + a₂b₂.', f'= {a1}·{b1} + {a2}·({b2}) = {a1 * b1} + ({a2 * b2}) = {a1 * b1 + a2 * b2}.'], \
        f'Пастка — забути знак мінус у −1 і отримати {a1 * b1 - a2 * b2}.'


@fam('math-vectors-f5')
def _(n, p):
    a1, a2, b1 = n[0], n[1], n[2]
    k = Fr(-a1 * b1, a2)
    return k, ['Перпендикулярні вектори мають нульовий скалярний добуток.', f'{a1}·{b1} + {a2}·k = 0 → {a2}k = {-a1 * b1} → k = {fmt(k)}.'], \
        f'Пастка — загубити мінус і відповісти {fmt(-k)}.'


@fam('math-vectors-f6')
def _(n, p):
    r2 = n[-1]
    return math.isqrt(r2), ['Рівняння сфери: (x − a)² + (y − b)² + (z − c)² = R².', f'R² = {r2}, R = {math.isqrt(r2)}.'], f'Пастка — відповісти R² = {r2} або взяти координату центра.'


@fam('math-solids-f1')
def _(n, p):
    a = n[0]
    return a ** 3, ['Об’єм куба V = a³.', f'{a}³ = {a ** 3} см³.'], f'Пастка — обчислити площу грані {a * a} або повної поверхні {6 * a * a}.'


@fam('math-solids-f2')
def _(n, p):
    a = n[0]
    return 6 * a * a, ['У куба 6 рівних квадратних граней.', f'S = 6a² = 6·{a * a} = {6 * a * a} см².'], f'Пастка — порахувати об’єм {a ** 3} або лише 4 бічні грані ({4 * a * a}).'


@fam('math-solids-f3')
def _(n, p):
    s, h = n[0], n[-1]
    return s * h, ['Об’єм прямої призми V = Sосн·h.', f'V = {s}·{h} = {s * h} см³.'], f'Пастка — поділити на 3, як для піраміди: {fmt(Fr(s * h, 3))}.'


@fam('math-solids-f5')
def _(n, p):
    a, b, c = n[0], n[1], n[2]
    d = math.isqrt(a * a + b * b + c * c)
    return d, ['Діагональ прямокутного паралелепіпеда: d² = a² + b² + c².', f'd² = {a * a} + {b * b} + {c * c} = {d * d}, d = {d} см.'], \
        f'Пастка — узяти діагональ грані, наприклад √({a}² + {b}²), або суму ребер.'


@fam('math-rotation-f1')
def _(n, p):
    r, h = n[0], n[1]
    return r * r * h, ['V = πR²H.', f'V = π·{r}²·{h} = {r * r * h}π, k = {r * r * h}.'], f'Пастка — узяти діаметр замість радіуса або забути піднести R до квадрата ({r * h}).'


@fam('math-rotation-f3')
def _(n, p):
    r, h = n[0], n[1]
    return r * r * h // 3, ['Об’єм конуса — третина об’єму циліндра: V = πR²H/3.', f'V = π·{r * r}·{h}/3 = {r * r * h // 3}π, k = {r * r * h // 3}.'], \
        f'Пастка — забути поділити на 3: {r * r * h}.'


@fam('math-rotation-f5')
def _(n, p):
    r = n[0]
    return 4 * r * r, ['Площа сфери S = 4πR².', f'S = 4π·{r * r} = {4 * r * r}π, k = {4 * r * r}.'], f'Пастка — обчислити площу круга πR² ({r * r}) або об’єм кулі.'


@fam('math-rotation-f6')
def _(n, p):
    R, d = n[0], n[1]
    r = math.isqrt(R * R - d * d)
    return r, ['Радіус кулі, відстань до площини й радіус перерізу утворюють прямокутний трикутник.', f'r² = R² − d² = {R * R} − {d * d} = {r * r}, r = {r} см.'], \
        f'Пастка — відняти без квадратів: {R} − {d} = {R - d}.'



@fam('math-expressions-f2')
def _(n, p):
    a = abs(n[0])
    return a, [f'√(a²) = |a|, бо арифметичний корінь невід’ємний.', f'√((−{a})²) = |−{a}| = {a}.'], f'Пастка — відповісти −{a}.'


@fam('math-expressions-f5')
def _(n, p):
    a = abs(n[0])
    return a, [f'Підкореневий вираз невід’ємний: x − {a} ≥ 0.', f'x ≥ {a}, найменше ціле — {a}.'], f'Пастка — вимагати x − {a} > 0 і відповісти {a + 1}.'


@fam('math-equations-f1')
def _(n, p):
    k, b, c = n[0], abs(n[1]), n[2]
    return Fr(c + b, k), [f'{k}x = {c} + {b} = {c + b}.', f'x = {c + b} : {k} = {fmt(Fr(c + b, k))}.'], 'Пастка — перенести доданок без зміни знака.'


@fam('math-functions-f4')
def _(n, p):
    b = abs(n[0])
    return Fr(b, 2), [f'Абсциса вершини x₀ = −b/(2a).', f'x₀ = {b}/2 = {fmt(Fr(b, 2))}.'], 'Пастка — взяти b без зміни знака.'


@fam('math-sequences-f1')
def _(n, p):
    a1, d = n[0], n[1]
    return a1 + 5 * d, ['aₙ = a₁ + (n − 1)d.', f'a₆ = {a1} + 5·{d} = {a1 + 5 * d}.'], 'Пастка — додати d шість разів, а не п’ять.'


@fam('math-sequences-f2')
def _(n, p):
    a1, a5 = n[0], n[1]
    return Fr(a5 - a1, 4), [f'a₅ = a₁ + 4d, тож 4d = {a5} − {a1} = {a5 - a1}.', f'd = {fmt(Fr(a5 - a1, 4))}.'], 'Пастка — ділити на 5 замість 4.'


@fam('math-sequences-f4')
def _(n, p):
    b1, q = n[0], n[1]
    return b1 * q ** 4, [f'b₅ = b₁·q⁴.', f'b₅ = {b1}·{q}⁴ = {b1}·{q ** 4} = {b1 * q ** 4}.'], 'Пастка — піднести q до п’ятого степеня.'


@fam('math-sequences-f5')
def _(n, p):
    b1, q = n[1], n[2]
    s = b1 * (1 + q + q * q + q ** 3)
    return s, [f'S₄ = b₁(1 + q + q² + q³).', f'S₄ = {b1}·(1 + {q} + {q * q} + {q ** 3}) = {s}.'], 'Пастка — додати лише три члени.'


@fam('math-calculus-f1')
def _(n, p):
    x0, k = n[0], n[-1]
    return 2 * x0 + k, [f'f′(x) = 2x + {k}.', f'f′({x0}) = 2·{x0} + {k} = {2 * x0 + k}.'], 'Пастка — підставити x у саму функцію.'


@fam('math-probability-f1')
def _(n, p):
    a, b = n[0], n[1]
    return a * b, ['Правило добутку: кожну футболку можна поєднати з кожною парою штанів.', f'{a}·{b} = {a * b}.'], f'Пастка — додати: {a + b}.'


@fam('math-triangles-f1')
def _(n, p):
    a, b = n[0], n[1]
    return 180 - a - b, ['Сума кутів трикутника 180°.', f'180° − {a}° − {b}° = {180 - a - b}°.'], 'Пастка — відняти від 360°.'


@fam('math-triangles-f3')
def _(n, p):
    a, h = n[0], n[1]
    return Fr(a * h, 2), ['S = ½·a·h.', f'S = {a}·{h}/2 = {fmt(Fr(a * h, 2))}.'], 'Пастка — забути поділити на 2.'


@fam('math-polygons-f1')
def _(n, p):
    a, b = n[0], n[1]
    return 2 * (a + b), ['P = 2(a + b).', f'P = 2·({a} + {b}) = {2 * (a + b)}.'], f'Пастка — знайти площу {a * b}.'


@fam('math-polygons-f5')
def _(n, p):
    k = n[0]
    return 180 * (k - 2), ['Сума кутів опуклого n-кутника 180°(n − 2).', f'180°·({k} − 2) = {180 * (k - 2)}°.'], 'Пастка — множити на n замість n − 2.'


@fam('math-circles-f2')
def _(n, p):
    r = n[0]
    return r * r, ['S = πR².', f'S = π·{r}² = {r * r}π, k = {r * r}.'], f'Пастка — обчислити довжину кола 2πR ({2 * r}π).'


@fam('math-vectors-f2')
def _(n, p):
    x1, x2 = n[0], n[2]
    return Fr(x1 + x2, 2), ['Абсциса середини — середнє арифметичне абсцис кінців.', f'({x1} + {x2})/2 = {fmt(Fr(x1 + x2, 2))}.'], 'Пастка — взяти різницю координат.'


@fam('math-vectors-f4')
def _(n, p):
    x, y = n[0], n[1]
    l = math.isqrt(x * x + y * y)
    return l, ['|a| = √(x² + y²).', f'√({x}² + {y}²) = √{x * x + y * y} = {l}.'], f'Пастка — додати координати ({x + y}).'


@fam('math-solids-f4')
def _(n, p):
    s, h = n[0], n[1]
    return Fr(s * h, 3), ['Об’єм піраміди V = Sосн·h/3.', f'V = {s}·{h}/3 = {fmt(Fr(s * h, 3))}.'], f'Пастка — не поділити на 3 ({s * h}).'


@fam('math-solids-f6')
def _(n, p):
    a, l = n[0], n[1]
    return 2 * a * l, ['Бічна поверхня правильної піраміди — половина добутку периметра основи на апофему.', f'S = 4·{a}·{l}/2 = {2 * a * l}.'], 'Пастка — не поділити на 2.'


@fam('math-rotation-f2')
def _(n, p):
    r, h = n[0], n[1]
    return 2 * r * h, ['Sбіч = 2πRH.', f'Sбіч = 2π·{r}·{h} = {2 * r * h}π, k = {2 * r * h}.'], 'Пастка — використати πR²H (об’єм).'


@fam('math-rotation-f4')
def _(n, p):
    r, h = n[0], n[1]
    l = math.isqrt(r * r + h * h)
    return l, ['Твірна — гіпотенуза трикутника з катетами R і H.', f'l = √({r}² + {h}²) = √{r * r + h * h} = {l}.'], 'Пастка — додати R і H.'

def key(q):
    return Fr(str(q['options'][q['answer']]).replace(',', '.').replace('−', '-')) if q['type'] == 'single' else Fr(str(q['answer']).replace(',', '.').replace('−', '-'))


def main():
    out, missing = {}, set()
    for t in math_subject['topics']:
        for q in t['questions']:
            m = re.match(r'(.*-f\d+)-v\d+$', q['id'])
            if not m or len(q['explanation']) >= 100:
                continue
            if m.group(1) not in F:
                missing.add(m.group(1))
                continue
            ans, steps, trap = F[m.group(1)](ints(q['prompt']), q['prompt'])
            assert Fr(str(fmt(ans)).replace(',', '.')) == key(q), (q['id'], ans, key(q))
            text = '\n'.join(steps) + f'\nВідповідь: {fmt(ans)}.\n{trap}'
            if q['type'] == 'single':
                wrong = [str(o) for i, o in enumerate(q['options']) if i != q['answer']]
                assert all(abs(Fr(w.replace(',', '.').replace('−', '-')) - key(q)) <= 2 for w in wrong), q['id']
                text += f'\nЧому не {"; ".join(wrong)}: ці числа лише трохи відрізняються від правильного результату, тобто з’являються через помилку в обчисленні, а не через інший спосіб розв’язання. Перевір себе підстановкою: підходить тільки {fmt(ans)}.'
            sup = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
            text = re.sub(r'\^(\d+)', lambda m: m.group(1).translate(sup), text)
            text = re.sub(r'(?<![\w)])-(?=\d)', '−', text)
            text = re.sub(r'(?<=\d)\.(?=\d)', ',', text)
            out[q['id']] = text
    assert not missing, missing
    path = os.path.join(ROOT, 'src', 'content', '50-explain-math-families.json')
    json.dump({'explanations': out}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(path, len(out))



if __name__ == "__main__":
    main()
