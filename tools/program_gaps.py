"""Compare history theory cards with the programme lists in sources/program/hist.md.

Prints, per topic, programme items with no matching card and cards that match no programme item.
Usage: python -I tools/program_gaps.py [topic]"""
import json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KINDS = {'D': 'D', 'T': 'T', 'P': 'P', 'C': 'C', 'G': 'G'}


def norm(s):
    return re.sub(r"[ʼ’`']", "'", s.lower()).replace('ё', 'е')


def programme():
    out, topic = {}, None
    for line in open(os.path.join(ROOT, 'sources', 'program', 'hist.md'), encoding='utf-8'):
        m = re.match(r'## (\d+)\.', line)
        if m:
            topic = int(m.group(1))
            out[topic] = {k: [] for k in KINDS}
            continue
        m = re.match(r'([DTPCG]): (.*)', line)
        if m and topic:
            out[topic][m.group(1)] += [x.strip(' .*') for x in m.group(2).split(';') if x.strip(' .*')]
    return out


def stems(text, n=None):
    words = [w for w in re.findall(r"[а-яіїєґa-z0-9'-]+", norm(text)) if len(w) >= 4 or w.isdigit()]
    words = [w if w.isdigit() else w[:max(4, len(w) - 2)] for w in words]
    return words[:n] if n else words


def key_words(kind, item):
    if kind == 'D':
        return re.findall(r'\b\d{3,4}\b', item)[:1] + stems(item.split('—', 1)[-1], 2)
    if kind == 'P':
        name = re.sub(r'\(.*?\)', '', item).replace('-', ' ').split()
        return stems(name[-1])[:1] if name else []
    if kind == 'C':
        return stems(re.sub(r'\(.*?\)', '', item), 3)
    return stems(item, 2)


# Programme wording -> card label, where the card names the same thing differently (checked by hand).
ALIASES = {
    'Бахчисарайський історико-культурний заповідник': 'Ханський палац у Бахчисараї',
    'Українська греко-католицька церква': 'Греко-католицька церква',
    'Острозький замок: Кругла (Нова) вежа': 'Кругла вежа в Острозі',
    'замок у с. Підгірці': 'Підгорецький замок',
    'змосковщення/зросійщення': 'Зросійщення',
    'ратуша в Бучачі': 'Бучацька ратуша',
    'будівля оперного театру в Одесі': 'Одеський оперний театр',
    'Вільгельм Франц фон Габсбург-Лотрінген': 'Вільгельм Габсбург (Василь Вишиваний)',
    'нова економічна політика (неп)': 'НЕП',
    'концтабори': 'Концентраційний табір (концтабір)',
    'український національно-демократичний рух': 'Національно-демократичний рух',
}


def covered(kind, item, cards):
    for prefix, label in ALIASES.items():
        if item.startswith(prefix):
            return next((c['id'] for c in cards if c['label'] == label), None)
    kw = key_words(kind, item)
    if not kw:
        return True
    for c in cards:
        hay = norm(c['label'] + ' ' + c.get('text', ''))
        if kind == 'D':  # a date card with the same year
            if c['kind'] == 'D' and kw[0] in norm(c['label'] + ' ' + c.get('text', '')):
                return c['id']
        elif kind == 'C':  # a monument card sharing a distinctive word
            if c['kind'] == 'C' and any(len(k) >= 5 and k in hay for k in stems(item)):
                return c['id']
        elif kind == 'T' and c['kind'] == 'T' and kw and kw[0] in norm(c['label']):
            return c['id']
        elif all(k in hay for k in kw):
            return c['id']
    return None


def main():
    # The built page, so content modules (renames, added and dropped cards) are taken into account.
    page = open(os.path.join(ROOT, 'dist', 'skladeno-nmt.html'), encoding='utf-8').read()
    o = '<script id="data" type="application/json">'
    a = page.index(o) + len(o)
    data = json.loads(page[a:page.index('</script><script>', a)])
    only = int(sys.argv[1]) if len(sys.argv) > 1 else None
    prog = programme()
    total_missing = 0
    for t in data['topics']:
        if only and t['id'] != only:
            continue
        cards = [f for f in t['facts'] if f['kind'] != 'L']
        used, missing = set(), []
        for kind, items in prog.get(t['id'], {}).items():
            if kind == 'G':  # map skills, not cards
                continue
            pool = [c for c in cards if c['kind'] == kind] or cards
            for it in items:
                hit = covered(kind, it, pool) or covered(kind, it, cards)
                if hit:
                    used.add(hit)
                else:
                    missing.append('%s %s' % (kind, it))
        extra = [c for c in cards if c['id'] not in used]
        total_missing += len(missing)
        print('== %d %s | cards %d | missing %d | not in programme %d' % (t['id'], t['title'], len(cards), len(missing), len(extra)))
        for m in missing:
            print('  - ' + m[:150])
        if only:
            for c in extra:
                print('  + %s %s | %s' % (c['kind'], c['label'], c.get('text', '')[:80]))
    print('missing total', total_missing)


if __name__ == '__main__':
    main()
