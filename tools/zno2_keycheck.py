"""Compare the keys of the official ukr, math and eng tasks (src/zno2-bank.json) with UCEQA answer sheets
in sources/keys/zno2 (downloaded from osvita.ua and testportal.gov.ua, list in sources/keys/zno2-list.txt).

Text sheets are parsed: a task label («7», «7.», «25.1») is followed by one answer per booklet column. Where a sheet
has several booklet columns, the column that agrees best with the bank is used (an online test follows one booklet).
Scans without a usable text layer are read from sources/keys/zno2/manual.json. Prints agreement per test and every
mismatch, and writes sources/keys/zno2/mismatches.json. Run with plain `python` (needs pymupdf)."""
import json, os, re, sys
import pymupdf

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = os.path.join(ROOT, 'sources', 'keys', 'zno2')
CYR, LAT = 'АБВГДЕЖЗ', 'ABCDEFGH'

# test id -> sheet; «@N» after the file name: the key table starts on page N (1-based) of a demo booklet
SHEETS = {
    # українська мова
    189: 'ukr-2016-osn.pdf', 240: 'ukr-2017-osn.pdf', 254: 'ukr-2017-dod.pdf', 299: 'ukr-2018-osn.pdf', 309: 'ukr-2018-dod.pdf',
    347: 'ukr-2019-osn.pdf', 363: 'ukr-2019-dod.pdf', 401: 'ukr-2020-osn.pdf', 429: 'ukr-2020-dod.pdf',
    471: 'ukr-2021-osn.pdf', 491: 'ukr-2021-dod.pdf',
    515: 'ukr-demo2022.pdf@22', 519: 'ukr-nmt2022.pdf', 522: 'ukr-demo2023.pdf@10', 544: 'ukr-nmt2023-s1.pdf', 545: 'ukr-nmt2023-s2.pdf',
    568: 'ukr-demo2024.pdf@10', 583: 'ukr-nmt2024-v1.pdf', 584: 'ukr-nmt2024-v2.pdf',
    # математика
    122: 'math-2011.pdf', 3: 'math-2012-s1.pdf', 121: 'math-2012-s2.pdf', 1: 'math-2013-s1.pdf', 2: 'math-2013-s2.pdf',
    138: 'math-2014-osn.pdf', 144: 'math-2014-dod.pdf', 154: 'math-2015-osn.pdf', 191: 'math-2016-osn.pdf',
    247: 'math-2017-osn.pdf', 256: 'math-2017-dod.pdf', 298: 'math-2018-osn.pdf', 310: 'math-2018-dod.pdf',
    346: 'math-2019-osn.pdf', 357: 'math-2019-dod.pdf', 400: 'math-2020-osn.pdf', 425: 'math-2020-dod.pdf',
    469: 'math-2021-osn.pdf', 489: 'math-2021-dod.pdf',
    516: 'math-demo2022.pdf@23', 521: 'math-nmt2022.pdf', 523: 'math-demo2023.pdf@11', 546: 'math-nmt2023-s1.pdf', 547: 'math-nmt2023-s2.pdf',
    570: 'math-demo2024.pdf@9', 585: 'math-nmt2024-v1.pdf', 606: 'math-nmt2024-v2.pdf', 671: 'math-nmt2025-v1.pdf', 672: 'math-nmt2025-v2.pdf',
    712: 'math-demo2026.pdf@7', 846: 'math-nmt2026-v1.pdf', 847: 'math-nmt2026-v2.pdf',
    # англійська мова
    199: 'eng-2016-osn.pdf', 246: 'eng-2017-osn.pdf', 255: 'eng-2017-dod.pdf', 303: 'eng-2018-osn.pdf', 311: 'eng-2018-dod.pdf',
    351: 'eng-2019-osn.pdf', 370: 'eng-2019-dod.pdf', 411: 'eng-2020-osn.pdf', 430: 'eng-2020-dod.pdf',
    468: 'eng-2021-osn.pdf', 481: 'eng-2021-dod.pdf',
    527: 'eng-demo2023.pdf@8', 557: 'eng-nmt2023-s1.pdf', 556: 'eng-nmt2023-s2.pdf', 575: 'eng-demo2024.pdf@8',
    596: 'eng-nmt2024-v1.pdf', 597: 'eng-nmt2024-v2.pdf', 673: 'eng-nmt2025-v1.pdf', 674: 'eng-nmt2025-v2.pdf',
    714: 'eng-demo2026.pdf@8', 850: 'eng-nmt2026-v1.pdf', 851: 'eng-nmt2026-v2.pdf',
}
# online test number -> booklet number where the osvita.ua page swapped two tasks
RENUMBER = {429: {(23, 0): (24, 0)}}
LETTER = r'[А-ДA-H]'
ANSWER = re.compile(r'^(?:%s|[TF]|[А-Д]{3,4}|(?:\d\s*[–—-]+\s*%s\s*,?\s*){3,4}|[-–−]?\d+(?:[.,]\d+)?)\*?$' % (LETTER, LETTER))
LABEL = re.compile(r'^(\d{1,2})(?:\.(\d))?\.?$')


def canon(tok):
    """Canonical answer: option indexes joined by «,» (rows in order) or a number as a string."""
    tok = tok.replace('*', '').strip()
    pairs = re.findall(r'(\d)\s*[–—-]+\s*(%s)' % LETTER, tok)
    if pairs:
        return ','.join(str((CYR + LAT).index(l) % 8) for _, l in sorted(pairs))
    if re.fullmatch(r'[А-Д]{1,4}|[A-H]', tok):
        return ','.join(str((CYR + LAT).index(l) % 8) for l in tok)
    num = tok.replace('–', '-').replace('−', '-').replace(',', '.')
    try:
        return repr(round(float(num), 6))
    except ValueError:
        return tok


def bank_key(q):
    a = q['answer']
    if q['type'] == 'single':
        return str(a)
    if q['type'] == 'match':
        return ','.join(str(x) for x in a)
    return repr(round(float(str(a).replace(',', '.')), 6))


def shown(q):
    a = q['answer']
    if q['type'] == 'single':
        return (LAT if q['subject'] == 'eng' else CYR)[a]
    if q['type'] == 'match':
        return ''.join(CYR[x] for x in a)
    return str(a)


def sheet_text(path, start):
    doc = pymupdf.open(path)
    return '\n'.join(doc[i].get_text() for i in range(start - 1, doc.page_count))


def parse(text, latin=False):
    """Columns of {(task, part): (canonical answer, raw token)}. English sheets sometimes type a Cyrillic look-alike letter."""
    if latin:
        text = text.translate(str.maketrans('АВСЕНМОРТХ', 'ABCEHMOPTX'))
    head = re.search(r'(Зошити[^\n]*\n\s*)+', text)
    cols = len(re.findall(r'Зошити', head.group(0))) if head else 1
    toks = [re.sub(r'\s+', ' ', t).strip() for t in text.split('\n') if t.strip()]
    out = [dict() for _ in range(cols)]
    cur = (0, 0)
    i = 0
    while i < len(toks):
        m = LABEL.match(toks[i])
        if m:
            lab = (int(m.group(1)), int(m.group(2) or 0))
            nxt = [(cur[0] + 1, 0), (cur[0] + 1, 1)] + ([(cur[0], cur[1] + 1)] if cur[1] else [])
            if lab in nxt:
                got, j = [], i + 1
                while j < len(toks) and len(got) < cols:
                    if ANSWER.match(toks[j]):
                        got.append(toks[j])
                    elif LABEL.match(toks[j]) and not got:
                        break
                    j += 1
                if len(got) == cols:
                    for c, g in enumerate(got):
                        out[c][lab] = (canon(g), g)
                    cur, i = lab, j
                    continue
        i += 1
    return out


def main():
    bank = [q for q in json.load(open(os.path.join(ROOT, 'src', 'zno2-bank.json'), encoding='utf-8'))['questions']]
    raw = {}
    for q in json.load(open(os.path.join(ROOT, 'sources', 'zno2', 'bank.json'), encoding='utf-8')):
        raw[q['zid']] = q
    manual = json.load(open(os.path.join(KEYS, 'manual.json'), encoding='utf-8'))
    total = bad = 0
    report, unchecked = [], []
    for test, sheet in SHEETS.items():
        tasks = {}
        for q in bank:
            if q.get('test') == test:
                z = int(q['id'].split('-')[1])
                part = raw[z].get('part', 0) if z in raw else 0
                tasks[(q['number'], part)] = q
        if not tasks:
            continue
        name, _, start = sheet.partition('@')
        cols = parse(sheet_text(os.path.join(KEYS, name), int(start or 1)), name.startswith('eng'))
        for k, v in manual.get(name, {}).items():  # read by eye: fills scans and corrects misprints in every column
            lab = (int(k.split('.')[0]), int(k.split('.')[1]) if '.' in k else 0)
            for c in cols:
                c[lab] = (canon(v), v + ' (вручну)')
        for a, b in RENUMBER.get(test, {}).items():  # the online test numbers some tasks differently from the booklet
            tasks[b], tasks[a] = tasks.pop(a), tasks.pop(b)
        best = max(cols, key=lambda c: sum(1 for k, q in tasks.items() if k in c and c[k][0] == bank_key(q)))
        ci = cols.index(best)
        miss = sorted(k for k in tasks if k not in best)
        diff = [(k, q) for k, q in sorted(tasks.items()) if k in best and best[k][0] != bank_key(q)]
        total += len(tasks) - len(miss)
        bad += len(diff)
        src = next(iter(tasks.values()))['source']
        print('%-6s %-38s %-22s col %d/%d  checked %d/%d  mismatches %d%s' % (
            next(iter(tasks.values()))['subject'], src, name, ci + 1, len(cols), len(tasks) - len(miss), len(tasks), len(diff),
            ('  NOT IN SHEET: %s' % ['%d%s' % (n, '.%d' % p if p else '') for n, p in miss]) if miss else ''))
        for (n, p), q in diff:
            print('   #%d%s %s [%s] bank %s | official %s' % (n, '.%d' % p if p else '', q['id'], q['type'], shown(q), best[(n, p)][1]))
            report.append({'test': test, 'number': n, 'part': p, 'id': q['id'], 'bank': shown(q), 'official': best[(n, p)][1]})
        unchecked += [tasks[k]['id'] for k in miss]
    print('checked', total, 'tasks; mismatches', bad, '; not found in sheets', len(unchecked))
    json.dump(report, open(os.path.join(KEYS, 'mismatches.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
