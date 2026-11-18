"""Parse the official ZNO/НМТ tests of ukrainian, mathematics and english saved by tools/zno2_fetch.py (sources/zno2/html)
into sources/zno2/bank.json. Only tasks of full official tests are kept; the site's own explanations are not used.

Kept task types: single choice (tip 1), match (4, and 13 with picture rows), one numeric answer (8) and the parts of
numeric multi-answer tasks (11, split into separate numeric tasks). Open tasks with a written answer (12) and tasks that
need audio are skipped. Formulas stay as LaTeX between ⟦ and ⟧ (rendered in the app).
Run with `python -I tools/zno2_import.py`; the argument `zno3` reads sources/zno3 (biology, geography) instead."""
import glob, html, json, os, re, sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA = sys.argv[1:] == ['zno3']
SRC = os.path.join(ROOT, 'sources', 'zno3' if EXTRA else 'zno2', 'html')
OUT = os.path.join(ROOT, 'sources', 'zno3' if EXTRA else 'zno2', 'bank.json')
SUBJ = {'biology': 'bio', 'geography': 'geo'} if EXTRA else {'ukrainian': 'ukr', 'mathematics': 'math', 'english': 'eng'}
LETTERS = 'abcdefgh'
MARKS = False  # Ukrainian pages: keep underline, bold and italic (tasks ask about underlined letters and highlighted words)
SUP = str.maketrans('0123456789+-=()n', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ')
SUB = str.maketrans('0123456789+-=()', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎')


def text(fragment):
    """Readable plain text from a small HTML fragment; formulas become ⟦latex⟧."""
    s = re.sub(r'<(style|xml|script)\b.*?</\1>', '', fragment, flags=re.S | re.I)
    s = re.sub(r'<img\b[^>]*>', '', s, flags=re.I)
    s = re.sub(r'\$\$(.*?)\$\$', lambda m: '<latex>\\(' + m.group(1) + '\\)</latex>', s, flags=re.S)
    maths = []

    def keep(m):
        maths.append(html.unescape(m.group(1)).replace('\xa0', ' ').strip())
        return '\u0001%d\u0002' % (len(maths) - 1)
    s = re.sub(r'<latex>\s*\\[(\[](.*?)\\[)\]]\s*</latex>', keep, s, flags=re.S | re.I)
    s = re.sub(r'(?:<latex>\s*)?\\begin\{gather\*?\}(.*?)\\end\{gather\*?\}(?:\s*</latex>)?', keep, s, flags=re.S | re.I)  # display block without \( \)
    s = re.sub(r'\\\((.*?)\\\)', keep, s, flags=re.S)  # a few pages write \( \) without the <latex> tag
    if MARKS:
        s = re.sub(r'<u>(.*?)</u>', lambda m: '\x03u\x04' + m.group(1) + '\x05', s, flags=re.S | re.I)
        s = re.sub(r'<(b|strong)>(.*?)</\1>', lambda m: '\x03b\x04' + m.group(2) + '\x05', s, flags=re.S | re.I)
        s = re.sub(r'<(i|em)>(.*?)</\1>', lambda m: '\x03i\x04' + m.group(2) + '\x05', s, flags=re.S | re.I)
    s = re.sub(r'<sup>\s*([0-9n+\-=()]+)\s*</sup>', lambda m: m.group(1).translate(SUP), s, flags=re.I)
    s = re.sub(r'<sub>\s*([0-9+\-=()]+)\s*</sub>', lambda m: m.group(1).translate(SUB), s, flags=re.I)
    s = re.sub(r'<sup>(.*?)</sup>', r'^\1', s, flags=re.I | re.S)
    s = re.sub(r'<sub>(.*?)</sub>', r'_\1', s, flags=re.I | re.S)
    ols = []

    def ol(m):
        items = re.findall(r'<li\b[^>]*>(.*?)</li>', m.group(1), re.S | re.I)
        return '\n' + '\n'.join('%d) %s' % (i + 1, it) for i, it in enumerate(items)) + '\n'
    s = re.sub(r'<ol\b[^>]*>(.*?)</ol>', ol, s, flags=re.S | re.I)
    s = re.sub(r'<li\b[^>]*>', '\n• ', s, flags=re.I)
    s = re.sub(r'</t[dh]>\s*<t[dh]\b[^>]*>', ' | ', s, flags=re.I)
    s = re.sub(r'<br\s*/?>|</p>|</div>|</li>|</tr>|<p\b[^>]*>|<div\b[^>]*>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ').replace('​', '').replace('‑', '-')
    s = re.sub(r'\u0001(\d+)\u0002', lambda m: '⟦%s⟧' % maths[int(m.group(1))], s)
    if MARKS:
        def both(a, b):  # <b><i>x</i></b> is one bold-italic mark «h»; underline wins over emphasis
            ks = {a, b}
            return 'u' if 'u' in ks else a if len(ks) == 1 else 'h'

        def mark(m):  # innermost first; marks never nest and never cross a line, formulas stay as they are
            kind, lines = m.group(1), []
            for line in m.group(2).split('\n'):
                seg = []
                for p in re.split(r'(⟦[^⟧]*⟧)', line):
                    inner = re.fullmatch(r'⟦§(\w)§(.*)⟧', p, re.S)
                    if inner:
                        seg.append('⟦§%s§%s⟧' % (both(kind, inner.group(1)), inner.group(2)))
                    elif p.startswith('⟦') or not p.strip():
                        seg.append(p)
                    else:
                        core = p.strip()
                        seg.append(p[:len(p) - len(p.lstrip())] + '⟦§%s§%s⟧' % (kind, core) + p[len(p.rstrip()):])
                lines.append(''.join(seg))
            return '\n'.join(lines)
        prev = None
        while prev != s:
            prev, s = s, re.sub(r'\u0003(\w)\u0004([^\u0003\u0004\u0005]*)\u0005', mark, s)
        s = s.replace('\u0003', '').replace('\u0004', '').replace('\u0005', '')
    lines = [re.sub(r'[ \t]+', ' ', l).strip() for l in s.split('\n')]
    out = []
    for l in lines:
        if l or (out and out[-1]):
            out.append(l)
    return '\n'.join(out).strip()


def imgs(fragment):
    res = []
    for src in re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', fragment, re.I):
        if src.startswith('/'):
            src = 'https://zno.osvita.ua' + src
        res.append(src)
    return res


def answers(block):
    items = re.findall(r'<div class="answer"><span class="marker">([^<]*)</span>(.*?)</div>(?=\s*(?:<div class="answer">|<!--|</div>|$))', block, re.S)
    return [(m.strip(), text(t), imgs(t)) for m, t in items]


def label(title):
    m = re.match(r'(ЗНО|НМТ) онлайн (\d{4}) року з (.+?) – (.+?) – сайт', title)
    kind, year, _, session = m.groups()
    session = session.replace('демоваріант', 'демонстраційний варіант')
    return kind, int(year), session


def parts(prompt_html):
    """Split a multi-part numeric task into its «1.», «2.» parts: (stem, [part html])."""
    pieces = re.split(r'(?=<p>\s*<b>\s*\d\.\s*</b>)', prompt_html)
    return pieces[0], pieces[1:]


def main():
    topics_of = defaultdict(set)
    for p in glob.glob(os.path.join(SRC, 'tag-mathematics-*.html')):
        slug = os.path.basename(p)[len('tag-mathematics-'):-5]
        for i in re.findall(r'name="q\[id\]"[^>]*value="(\d+)"', open(p, encoding='utf-8').read()):
            topics_of[i].add(slug)
    files = []
    for p in glob.glob(os.path.join(SRC, '[bg]*_*.html' if EXTRA else '[mue]*_*.html')):
        name = os.path.basename(p)[:-5]
        sub, tid = name.split('_')
        h = open(p, encoding='utf-8').read()
        kind, year, session = label(html.unescape(re.search(r'<title>(.*?)</title>', h, re.S).group(1)))
        files.append((0 if kind == 'НМТ' else 1, -year, sub, int(tid), p, kind, year, session, h))
    files.sort(key=lambda x: x[:4])
    bank, skipped, seen = [], Counter(), set()
    for _, _, sub, test, p, kind, year, session, h in files:
        subject = SUBJ[sub]
        global MARKS
        MARKS = subject == 'ukr'
        source = '%s-%d, %s' % (kind, year, session)
        for f in re.findall(r'<form class="q-test".*?</form>', h, re.S):
            g = lambda n: re.search(r'name="q\[%s\]"[^>]*value="(\d+)"' % n, f).group(1)
            zid, tip, num = g('id'), g('tip'), int(g('out_order'))
            if zid in seen:
                skipped['dup'] += 1
                continue
            qm = re.search(r'<div class="question">(.*?)</div>\s*<div class="clear">', f, re.S)
            res = re.search(r'name="result" value="([^"]*)"', f)
            res = res.group(1) if res else ''
            qhtml = qm.group(1) if qm else ''
            if re.search(r'<audio|audio/|\.mp3', f, re.I):
                skipped['audio'] += 1
                continue
            base = {'zid': int(zid), 'subject': subject, 'test': test, 'source': source, 'kind': kind, 'year': year,
                    'session': session, 'number': num, 'slugs': sorted(topics_of.get(zid, ()))}
            blocks = re.findall(r'<div class="answers[^"]*"[^>]*>(.*?)</div>\s*(?=<div class="answers|<div class="clear)', f, re.S)
            try:
                if not res:
                    skipped['nokey'] += 1
                    continue
                if tip in ('1', '7') and blocks:
                    a = answers(blocks[0])
                    if tip == '1':
                        ans = LETTERS.index(res) if len(res) == 1 and res in LETTERS else int(res) - 1
                        item = dict(base, type='single', answer=ans)
                    else:
                        item = dict(base, type='multi', answer=sorted(int(x) - 1 for x in res.split(';')))
                    item.update(prompt=text(qhtml), images=imgs(qhtml), options=[x[1] for x in a], optionImages=[x[2] for x in a])
                elif tip in ('4', '13') and len(blocks) >= 2:
                    left, right = answers(blocks[0]), answers(blocks[1])
                    pairs = dict((x[0], x[1:]) for x in res.split(';'))
                    item = dict(base, type='match', prompt=text(qhtml), images=imgs(qhtml), left=[x[1] for x in left],
                                leftImages=[x[2] for x in left], options=[x[1] for x in right], optionImages=[x[2] for x in right],
                                answer=[LETTERS.index(pairs[str(k)]) for k in range(1, len(left) + 1)])
                elif tip == '8':
                    if '|' in res or not res.strip():
                        skipped['alt-answer'] += 1
                        continue
                    item = dict(base, type='numeric', prompt=text(qhtml), images=imgs(qhtml), answer=res.strip())
                elif tip == '11':
                    stem, ps = parts(qhtml)
                    vals = res.split(';')
                    if len(ps) != len(vals):
                        skipped['multi-numeric'] += 1
                        continue
                    for i, (ph, v) in enumerate(zip(ps, vals)):
                        seen.add(zid + '-%d' % (i + 1))
                        bank.append(dict(base, zid=int(zid) * 10 + i + 1, number=num, part=i + 1, type='numeric',
                                         prompt=(text(stem) + '\n' + text(ph)).strip(), images=imgs(qhtml), answer=v.strip()))
                    seen.add(zid)
                    continue
                else:
                    skipped['tip' + tip] += 1
                    continue
            except Exception as e:  # noqa: BLE001
                skipped['err:' + repr(e)[:40]] += 1
                continue
            if item['type'] in ('single', 'multi') and len(set(zip(item['options'], [tuple(x) for x in item['optionImages']]))) != len(item['options']):
                skipped['dup-option'] += 1  # a typo in the published task: two identical options
                continue
            seen.add(zid)
            bank.append(item)
    json.dump(bank, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(bank), 'tasks')
    print(Counter((b['subject'], b['type']) for b in bank))
    print(dict(skipped))


if __name__ == '__main__':
    main()
