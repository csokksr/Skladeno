"""Compare the keys of the official biology and geography tasks (sources/zno3/bank.json, tools/zno2_import.py zno3) with the
UCEQA answer sheets downloaded from osvita.ua into sources/keys/zno3 (list: sources/keys/zno3-list.txt; the file name starts with
the osvita.ua answers page id).

Unlike tools/zno2_keycheck.py there is no hand-made table «test -> sheet»: every sheet is read with the same parser and tried
against every test of the same subject and year (the page title names the year); a pair counts only when at least 15 tasks
were found in the sheet and at least 90 % of them agree. A test with no such sheet stays unchecked and is listed. Booklets
(tasks without a key table) simply never reach the threshold. Prints agreement per test and every mismatch; writes
sources/keys/zno3/mismatches.json (or --out <file>) and the list of agreeing ids sources/zno3/verified.json. Run with plain `python` (needs pymupdf)."""
import glob, importlib.util, json, os, re, sys
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = os.path.join(ROOT, 'sources', 'keys', 'zno3')
spec = importlib.util.spec_from_file_location('zno2_keycheck', os.path.join(ROOT, 'tools', 'zno2_keycheck.py'))
zk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zk)
CYR = zk.CYR
SUBJECT_PAGES = {'biologiya': 'bio', 'geo': 'geo'}  # answers index pages sources/zno3/ans-<name>.html


def bank_key(q):
    a = q['answer']
    if q['type'] == 'single':
        return str(a)
    if q['type'] == 'multi':
        return ','.join(str(x) for x in sorted(a))
    if q['type'] == 'match':
        return ','.join(str(x) for x in a)
    return repr(round(float(str(a).replace(',', '.')), 6))


def shown(q):
    a = q['answer']
    if q['type'] == 'single':
        return CYR[a]
    if q['type'] == 'multi':
        return ''.join(CYR[x] for x in sorted(a))
    if q['type'] == 'match':
        return ''.join(CYR[x] for x in a)
    return str(a)


def normalize(text):
    """Sheets write a matching answer as «1Г 2А 3В 4Б» or «1Б, 2Г, 3Д, 4А» (the shared parser wants «1–Г») and a multi-choice
    answer as «2, 3, 4» (the parser wants one token «234»)."""
    text = re.sub(r'(?<![\d.])([1-4])[ ]?([А-Д])(?=[ ,]|$)', lambda m: m.group(1) + '–' + m.group(2), text)
    text = re.sub(r'(?m)^(\d(?:,[ ]*\d){1,5})[ ]*$', lambda m: re.sub(r'\D', '', m.group(1)), text)
    return re.sub(r'(?m)(–[А-Д]),[ ]*(?=\d–)', lambda m: m.group(1) + ' ', text)


def agrees(q, col):
    """Does the sheet column agree with the bank task? Sheets write a multi-choice answer as letters («БВГ») or as digits of the
    options («245»), and a task with several numeric parts as one string of digits («311») under the task number."""
    k = (q['number'], q.get('part', 0))
    if k in col:
        canon, raw = col[k][0], col[k][1].replace(' (вручну)', '')
        if q['type'] == 'multi':
            digits = re.sub(r'\D', '', raw)
            if digits and digits == raw.strip():
                return ','.join(sorted(str(int(c) - 1) for c in digits)) == bank_key(q)
            return ','.join(sorted(canon.split(','))) == bank_key(q)
        return canon == bank_key(q)
    whole = col.get((q['number'], 0))
    cell = whole[1].replace(' (вручну)', '').strip() if whole else ''
    if q.get('part') and whole and re.fullmatch(r'\d{3}' if q['type'] == 'single' else r'\d{2,4}', cell) and q['part'] <= len(cell):  # a «1;1;3» task has exactly three parts
        digit = cell[q['part'] - 1]
        return digit == (str(q['answer'] + 1) if q['type'] == 'single' else str(q['answer']).strip())  # a part of a «1;1;3» task is single-choice
    return None  # not in the sheet


def page_years():
    """answers page id -> (subject, year) from the titles on the index pages."""
    out = {}
    for name, subj in SUBJECT_PAGES.items():
        t = open(os.path.join(ROOT, 'sources', 'zno3', 'ans-%s.html' % name), encoding='utf-8', errors='replace').read()
        for a, x in re.findall(r'href="(?:https?://osvita.ua)?/test/answers/(\d+)/"[^>]*>(.*?)</a>', t, re.S):
            m = re.search(r'(20\d\d)', re.sub(r'<[^>]+>', '', x))
            if m:
                out.setdefault(a, (subj, int(m.group(1))))
    return out


def main():
    bank = json.load(open(os.path.join(ROOT, 'sources', 'zno3', 'bank.json'), encoding='utf-8'))
    tests = defaultdict(dict)  # (subject, test) -> {(number, part): task}
    meta = {}
    for q in bank:
        tests[(q['subject'], q['test'])][(q['number'], q.get('part', 0))] = q
        meta[(q['subject'], q['test'])] = (q['year'], q['source'])
    pages = page_years()
    sheets = {}  # file -> columns (parsed once)
    for path in sorted(glob.glob(os.path.join(KEYS, '*.pdf'))):
        name = os.path.basename(path)
        try:
            sheets[name] = zk.parse(normalize(zk.sheet_text(path, 1)))
        except Exception as e:  # noqa: BLE001  a broken PDF is reported, not fatal
            print('UNREADABLE', name, repr(e)[:60])
    manual = json.load(open(os.path.join(KEYS, 'manual.json'), encoding='utf-8')) if os.path.exists(os.path.join(KEYS, 'manual.json')) else {}
    for name, answers in manual.items():  # scans without a text layer, read by eye from the page image
        sheets[name] = [{(int(k), 0): (zk.canon(v), v + ' (вручну)') for k, v in answers.items()}]
    report, unchecked, total, bad, verified = [], [], 0, 0, []
    for (subj, test), tasks in sorted(tests.items(), key=lambda kv: (kv[0][0], -meta[kv[0]][0], kv[0][1])):
        year, source = meta[(subj, test)]
        best = None
        for name, cols in sheets.items():
            page = pages.get(name.split('-')[0])
            if not page or page != (subj, year):
                continue
            for ci, col in enumerate(cols):
                got = [(k, q) for k, q in tasks.items() if agrees(q, col) is not None]
                if len(got) < 15:
                    continue
                ok = sum(1 for k, q in got if agrees(q, col))
                if ok / len(got) >= 0.9 and (best is None or ok > best[0]):
                    best = (ok, name, ci, len(cols), col)
        if not best:
            print('%-4s %-45s NO SHEET (%d tasks not checked)' % (subj, source, len(tasks)))
            unchecked += [q['zid'] for q in tasks.values()]
            continue
        ok, name, ci, ncols, col = best
        miss = sorted(k for k, q in tasks.items() if agrees(q, col) is None)
        diff = [(k, q) for k, q in sorted(tasks.items()) if agrees(q, col) is False]
        total += len(tasks) - len(miss)
        bad += len(diff)
        print('%-4s %-45s %-42s col %d/%d  checked %d/%d  mismatches %d' % (subj, source, name[:42], ci + 1, ncols, len(tasks) - len(miss), len(tasks), len(diff)))
        for (n, p), q in diff:
            official = col.get((n, p), col.get((n, 0), ('', '?')))[1]
            print('   #%d%s %s [%s] bank %s | official %s' % (n, '.%d' % p if p else '', q['zid'], q['type'], shown(q), official))
            report.append({'subject': subj, 'test': test, 'number': n, 'part': p, 'zid': q['zid'], 'bank': shown(q), 'official': official})
        unchecked += [tasks[k]['zid'] for k in miss]
        verified += [q['zid'] for k, q in tasks.items() if k not in miss and agrees(q, col)]
    print('checked', total, 'tasks of', len(bank), '; mismatches', bad, '; not checked', len(unchecked))
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv[:-1] else os.path.join(KEYS, 'mismatches.json')
    json.dump(report, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # The ids whose key agrees with an official sheet: tools/zno3_bank.py marks the other tasks «ключ не звірено з аркушем».
    # Written only by a run that read the sheets (they are not in git), so a machine without them keeps the committed list.
    if sheets and '--out' not in sys.argv:
        json.dump(sorted(verified), open(os.path.join(ROOT, 'sources', 'zno3', 'verified.json'), 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()
