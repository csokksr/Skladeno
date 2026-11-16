"""Перевірка тексту інтерфейсу в коді (src/app.js, src/modules, src/web, src/shell.html). Це не орфографічний словник, а пошук механічних помилок,
для яких словник не потрібен:
  - слова зі змішаними літерами кирилиці й латиниці (гомогліфи; дефіс розділяє слова: «HTML-файл» не помилка);
  - літери, яких немає в українській (ы, э, ъ, ё): ознака російського слова або набору не в тій розкладці;
  - ASCII-апостроф усередині українського слова (має бути ʼ або ’, як у решті сайту), зокрема записаний як \\' в одинарних лапках;
  - пробіл перед комою, крапкою, двокрапкою, крапкою з комою, знаком питання чи оклику;
  - два пробіли підряд усередині фрази;
  - те саме слово двічі підряд (від трьох літер).
Коментарі коду (// … і /* … */) не перевіряються. Для багаторядкового шаблону номер рядка точний.
Завершується кодом 0 лише без знахідок. Виняток для навмисних випадків: позначка `check_text:ok` у рядку коду, де знахідка.
Запуск: python -I tools/check_text.py"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CYR = 'А-Яа-яІіЇїЄєҐґ'
STRING = re.compile(r"""'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`""", re.S)
COMMENT = re.compile(r'/\*.*?\*/|(?:(?<=\s)|^)//[^\n]*', re.S | re.M)
HAS_CYR = re.compile('[' + CYR + ']')
WORD = re.compile(r"[A-Za-z" + CYR + r"ʼ’']+")
RULES = [
    ('літери, яких немає в українській', re.compile('[ыэъёЫЭЪЁ]')),
    ('ASCII-апостроф у слові', re.compile('[' + CYR + r"]\\?'[" + CYR + ']')),
    ('пробіл перед розділовим знаком', re.compile('[' + CYR + r'] [,.;:!?](?!\w)')),
    ('два пробіли підряд', re.compile('[' + CYR + r'][ ]{2,}[' + CYR + ']')),
    ('слово двічі підряд', re.compile(r'(?<![' + CYR + r'])([' + CYR + r']{3,}) \1(?![' + CYR + r'])', re.I)),
]


def blank_comments(source):
    """Замінює коментарі пробілами (розриви рядків лишаються), щоб зсуви й номери рядків не змінились."""
    return COMMENT.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), source)


def scan_text(text):
    """[(правило, фрагмент, зсув)] для одного рядка тексту."""
    found = []
    for name, rx in RULES:
        for m in rx.finditer(text):
            found.append((name, text[max(0, m.start() - 12):m.end() + 12], m.start()))
    for m in WORD.finditer(text):
        w = m.group(0)
        if re.search('[A-Za-z]', w) and HAS_CYR.search(w):
            found.append(('змішані літери в слові', w, m.start()))
    return found


def scan_source(source):
    """Знахідки у всіх рядкових літералах коду з кирилицею: [(номер рядка, правило, фрагмент)]."""
    results = []
    lines = source.split('\n')
    for m in STRING.finditer(blank_comments(source)):
        body = next(g for g in m.groups() if g is not None)
        if not HAS_CYR.search(body):
            continue
        # \n, \r, \t у коді означають розрив чи табуляцію, а не літери; довжина тексту не змінюється, тож зсуви лишаються точними
        text = re.sub(r'\\[nrt]', '\x0b\x0b', body)
        start_line = source.count('\n', 0, m.start()) + 1
        for name, frag, pos in scan_text(text):
            line = start_line + body.count('\n', 0, pos)
            if 'check_text:ok' in lines[min(line, len(lines)) - 1]:
                continue
            results.append((line, name, frag.replace('\x0b', ' ')))
    return results


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    files = sorted(glob.glob(os.path.join(ROOT, 'src', 'modules', '*.js')) + glob.glob(os.path.join(ROOT, 'src', 'web', '*.js'))
                   + [os.path.join(ROOT, 'src', 'app.js'), os.path.join(ROOT, 'src', 'shell.html')])
    total = 0
    for f in files:
        with open(f, encoding='utf-8') as fh:
            source = fh.read()
        for line, name, frag in scan_source(source):
            print(f'{os.path.relpath(f, ROOT)}:{line}: {name}: «{frag.strip()}»')
            total += 1
    print('файлів перевірено:', len(files), '· знахідок:', total)
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main())
