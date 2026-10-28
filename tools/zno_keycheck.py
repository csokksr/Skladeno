"""Compare the keys in sources/zno/bank.json with official UCEQA answer sheets in sources/keys.

Text PDFs are parsed; scans without a text layer are read from sources/keys/manual.json.
Where a sheet has several booklet columns, the column that agrees best with the bank is used
(the online tests follow one booklet). Prints agreement per test and every mismatch.
Run with plain `python` (needs pymupdf)."""
import difflib, json, os, re, sys
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = os.path.join(ROOT, 'sources', 'keys')
L = 'АБВГДЕ'

# test id in bank -> answer sheet (file, first page used for demos with the key at the end)
SHEETS = {
    848: 'nmt2026-v1.pdf', 849: 'nmt2026-v2.pdf', 713: os.path.join('..', '..', 'dist', 'web', 'files', 'officialPapers.2.documents.keys.data.pdf'),
    669: 'nmt2025-v1.pdf', 670: 'nmt2025-v2.pdf', 628: 'demo2025.pdf',
    586: 'nmt2024-v1.pdf', 587: 'nmt2024-v2.pdf', 571: 'demo2024.pdf',
    548: 'nmt2023-s1.pdf', 549: 'nmt2023-s2.pdf', 524: 'demo2023.pdf',
    520: 'nmt2022.pdf',
    472: 'zno2021-osn.pdf', 493: 'zno2021-dod.pdf', 414: 'zno2020-osn.pdf', 432: 'zno2020-dod.pdf',
    353: 'zno2019-osn.pdf', 371: 'zno2019-dod.pdf', 305: 'zno2018-osn.pdf', 315: 'zno2018-dod.pdf',
    248: 'zno2017-osn.pdf', 257: 'zno2017-dod.pdf', 190: 'zno2016-osn.pdf', 160: 'zno2015-osn.pdf',
}
# older sheets that print the answer text instead of letters (task numbers as in the bank)
TEXT_SHEETS = {26: 'zno2010-s2.pdf', 23: 'zno2011.pdf'}
ANSWER = re.compile(r'^(?:[А-Д]\*?|[А-Д](?: ?[А-Д]){3}\*?|(?:\d\s*[–—-]+\s*[А-Д]\s*,?\s*){4}|\d{3}|\d\s*,\s*\d\s*,\s*\d)$')


def canon(tok):
    tok = tok.replace('*', '').replace(' ', '').strip() if re.fullmatch(r'[А-Д ]+\*?', tok.strip()) else tok.replace('*', '').strip()
    pairs = re.findall(r'(\d)\s*[–—-]+\s*([А-Д])', tok)
    if pairs:
        return ''.join(l for _, l in sorted(pairs))
    digits = re.findall(r'\d', tok)
    if digits:
        return ''.join(sorted(digits))
    return tok


def parse(path):
    """Return a list of columns; each column maps task number -> (canonical answer, raw token)."""
    doc = pymupdf.open(path)
    text = '\n'.join(p.get_text() for p in doc)
    if 'Відповідь' in text and doc.page_count > 4:  # demo booklet: the key table is on the last page
        text = doc[-1].get_text()
    head = re.search(r'(Зошити[^\n]*\n)+', text)
    cols = len(re.findall(r'Зошити', head.group(0))) if head else 1
    toks = [re.sub(r'^(\d+)\*$', r'\1', t.strip()) for t in text.split('\n') if t.strip()]  # «12*» refers to a footnote
    out = [dict() for _ in range(cols)]
    n, i = 1, 0
    while i < len(toks):
        if toks[i] == str(n):
            got, j = [], i + 1
            while j < len(toks) and len(got) < cols and toks[j] != str(n + 1):
                if ANSWER.match(toks[j]):
                    got.append(toks[j])
                j += 1
            if not got and 'зарахувати' in ' '.join(toks[i + 1:j]):  # annulled task: points given to everyone
                for c in range(cols):
                    out[c][n] = ('ANNULLED', 'анульовано')
                n += 1
                i = j
                continue
            if len(got) == cols:
                for c, g in enumerate(got):
                    out[c][n] = (canon(g), g)
                n += 1
                i = j
                continue
        i += 1
    return out


def bank_key(t):
    a = t['answer']
    if t['type'] == 'single':
        return L[a]
    if t['type'] == 'multi':
        return ''.join(sorted(str(x + 1) for x in a))
    return ''.join(L[x] for x in a)


def norm(s):
    s = re.sub(r"[’ʼ'`]", "'", s.lower()).replace('ё', 'е').replace('—', '–').replace('-', '–')
    return re.sub(r'\s+', ' ', re.sub(r'[«»"“”().,;:!?]', ' ', s)).strip()


def locate(opt, seg):
    """Best fuzzy position of an option inside a sheet segment: (score 0..1, position)."""
    o = norm(opt)
    if not o:
        return 0, -1
    k = seg.find(o)
    if k >= 0:
        return 1, k
    best = (0, -1)
    w = len(o)
    for k in range(0, max(1, len(seg) - w + 1), 3):
        sm = difflib.SequenceMatcher(None, seg[k:k + w + 8], o, autojunk=False)
        if sm.quick_ratio() > best[0]:
            r = sm.ratio()
            if r > best[0]:
                best = (r, k)
    return best


def from_text(path, tasks):
    """Older sheets print each task with its correct answer written out. Derive the answer letters
    from where the option texts appear; tasks that cannot be resolved this way are returned apart."""
    text = '\n'.join(p.get_text() for p in pymupdf.open(path))
    starts = {}
    for n in tasks:
        m = re.search(r'(?:^|\n)\s*%d\.\s' % n, text)
        if m:
            starts[n] = m.start()
    col, unresolved = {}, []
    order = sorted(starts, key=starts.get)
    for i, n in enumerate(order):
        t = tasks[n]
        seg = norm(text[starts[n]:starts[order[i + 1]] if i + 1 < len(order) else len(text)])
        seg = seg[len(norm(t['prompt'])) // 2:]  # skip most of the question itself
        if any(t['optionImages']) or not all(t['options']):
            unresolved.append(n)
            continue
        found = [(locate(o, seg), j) for j, o in enumerate(t['options'])]
        present = sorted([(pos, j) for (sc, pos), j in found if sc >= 0.86], key=lambda x: x[0])
        need = 1 if t['type'] == 'single' else 3 if t['type'] == 'multi' else len(t['answer'])
        if t['type'] == 'single':
            sc = sorted(((s, j) for (s, _), j in found), reverse=True)
            ans = L[sc[0][1]] if sc[0][0] >= 0.86 and sc[0][0] - sc[1][0] >= 0.1 else None
        elif t['type'] == 'match' and len(present) == need:
            # the sheet may list the rows in another order: pair rows and answers by their rank in the sheet
            rows = sorted((locate(r, seg)[1], i) for i, r in enumerate(t['left']))
            pairs = {i: j for (_, i), (_, j) in zip(rows, present)}
            ans = ''.join(L[pairs[i]] for i in range(len(t['left'])))
        elif len(present) == need:
            js = [j for _, j in present]
            ans = ''.join(sorted(str(j + 1) for j in js)) if t['type'] == 'multi' else ''.join(L[j] for j in js)
        else:
            ans = None
        if ans:
            col[n] = (ans, ans + ' (з тексту відповіді)')
        else:
            unresolved.append(n)
    return col, unresolved


def main():
    bank = json.load(open(os.path.join(ROOT, 'sources', 'zno', 'bank.json'), encoding='utf-8'))
    manual = json.load(open(os.path.join(KEYS, 'manual.json'), encoding='utf-8'))
    total = bad = 0
    report = []
    for test, sheet in TEXT_SHEETS.items():
        tasks = {t['number']: t for t in bank if t['test'] == test}
        col, unresolved = from_text(os.path.join(KEYS, sheet), tasks)
        col.update({int(n): (canon(v), v + ' (вручну)') for n, v in manual.get(sheet, {}).items()})
        unresolved = [n for n in unresolved if n not in col]
        diff = [(n, bank_key(tasks[n]), col[n][1]) for n in sorted(col) if col[n][0] != bank_key(tasks[n])]
        total += len(col)
        bad += len(diff)
        print('%-40s %-16s checked %d/%d  mismatches %d%s' % (next(iter(tasks.values()))['source'], sheet, len(col), len(tasks), len(diff), ('  TO CHECK BY EYE: %s' % sorted(unresolved)) if unresolved else ''))
        for n, mine, off in diff:
            print('   #%d zno-%d [%s] bank %s | official %s' % (n, tasks[n]['zid'], tasks[n]['type'], mine, off))
            report.append({'test': test, 'number': n, 'zid': tasks[n]['zid'], 'bank': mine, 'official': off})
    for test, sheet in SHEETS.items():
        tasks = {t['number']: t for t in bank if t['test'] == test}
        if sheet in manual:
            cols = [{i + 1: (canon(v), v) for i, v in enumerate(manual[sheet])}]
        else:
            cols = parse(os.path.join(KEYS, sheet))
        best = max(cols, key=lambda c: sum(1 for n, t in tasks.items() if n in c and c[n][0] == bank_key(t)))
        ci = cols.index(best)
        miss = [n for n in tasks if n not in best]
        diff = [(n, bank_key(t), best[n][1]) for n, t in sorted(tasks.items()) if n in best and best[n][0] != bank_key(t)]
        star = [(n, best[n][1]) for n in sorted(best) if '*' in best[n][1] and n in tasks]
        total += len(tasks) - len(miss)
        bad += len(diff)
        name = next(iter(tasks.values()))['source'] if tasks else test
        print('%-40s %-16s col %d/%d  checked %d/%d  mismatches %d%s' % (name, sheet[-30:], ci + 1, len(cols), len(tasks) - len(miss), len(tasks), len(diff), ('  NOT IN SHEET: %s' % miss) if miss else ''))
        for n, mine, off in diff:
            t = tasks[n]
            print('   #%d zno-%d [%s] bank %s | official %s' % (n, t['zid'], t['type'], mine, off))
            report.append({'test': test, 'number': n, 'zid': t['zid'], 'bank': mine, 'official': off})
        for n, off in star:
            print('   note: #%d official answer marked with * : %s' % (n, off))
    print('checked', total, 'tasks; mismatches', bad)
    json.dump(report, open(os.path.join(KEYS, 'mismatches.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
