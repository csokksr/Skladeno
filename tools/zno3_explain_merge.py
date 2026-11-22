"""python -I tools/zno3_explain_merge.py file.json [...]  -> checks analyses of official biology/geography tasks and merges them into src/zno2-explanations.json

File: {id: {"t": text, "a": answer, "also": [ids]}}. "a" is the answer solved independently: a letter for single ("Б"),
letters in row order for match ("БВАГ"), letters for multi ("АГ"), a number for numeric ("35").
"also" lists the other ids of the same task (printed as «також» by tools/zno3_explain_batch.py); they get the same text.
The answer must equal the bank key. A disagreeing key is not merged: it goes to sources/zno3/explain_disputed.json
(the official key may be wrong, or the task was misread).
Checks: id exists, subject bio or geo, no analysis yet; single: the key letter appears as "(Б)"; match: every row
line starts «N.» and ends «— Х.»; multi: text ends with «Відповідь: АГ.»; text at least 15 characters.
Pictures are not checked here: solve only text tasks."""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'src', 'zno2-explanations.json')
DIS = os.path.join(ROOT, 'sources', 'zno3', 'explain_disputed.json')
bank = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'src', 'zno3-bank.json'), encoding='utf-8'))['questions']}
ex = json.load(open(P, encoding='utf-8'))
disputed = json.load(open(DIS, encoding='utf-8')) if os.path.exists(DIS) else {}
L = 'АБВГДЕЖЗ'


def key_of(q):
    if q['type'] == 'single':
        return L[q['answer']]
    if q['type'] == 'match':
        return ''.join(L[x] for x in q['answer'])
    if q['type'] == 'multi':
        return ''.join(sorted(L[x] for x in q['answer']))
    return str(q['answer'])


def same(q, mine):
    if q['type'] == 'numeric':
        try:
            return abs(float(mine.replace(',', '.')) - float(str(q['answer']).replace(',', '.'))) <= float(q.get('tolerance') or 0) + 1e-9
        except ValueError:
            return False
    if q['type'] == 'multi':
        return ''.join(sorted(mine)) == key_of(q)
    return mine == key_of(q)


def text_problem(q, t):
    if len(t) < 15:
        return 'too short'
    if q['type'] == 'single' and '(%s)' % key_of(q) not in t:
        return 'key letter must appear as (%s)' % key_of(q)
    if q['type'] == 'match':
        paras = t.split(chr(10))
        for r, letter in enumerate(key_of(q)):
            line = next((pa for pa in paras if pa.startswith('%d.' % (r + 1))), None)
            if line is None or not line.rstrip().endswith('— %s.' % letter):
                return 'row %d must start "%d." and end "— %s."' % (r + 1, r + 1, letter)
    if q['type'] == 'multi' and not t.endswith('Відповідь: %s.' % key_of(q)):
        return 'text must end with «Відповідь: %s.»' % key_of(q)
    return None


bad, new = [], {}
for f in sys.argv[1:]:
    for i, v in json.load(open(f, encoding='utf-8')).items():
        if not isinstance(v, dict) or 'a' not in v:
            bad.append((i, 'needs {"t": text, "a": answer}')); continue
        t, mine = v['t'].strip(), str(v['a']).strip()
        for pid in [i] + list(v.get('also', [])):
            q = bank.get(pid)
            if not q or q['subject'] not in ('bio', 'geo'):
                bad.append((pid, 'unknown id or not bio/geo')); continue
            if pid in ex:
                bad.append((pid, 'already has analysis')); continue
            if not same(q, mine):
                disputed[pid] = {'mine': mine, 'key': key_of(q), 'keyUnverified': bool(q.get('keyUnverified')), 'year': q['year'], 'source': q.get('source')}
                bad.append((pid, 'my answer %s != key %s (in explain_disputed.json)' % (mine, key_of(q)))); continue
            problem = text_problem(q, t)
            if problem:
                bad.append((pid, problem)); continue
            new[pid] = t
            disputed.pop(pid, None)
for i, why in bad:
    print('REJECT', i, why)
with open(DIS, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(json.dumps(disputed, ensure_ascii=False, indent=1) + '\n')
if new:
    ex.update(new)
    with open(P, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('{\n' + ',\n'.join('%s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in ex.items()) + '\n}\n')
print('merged', len(new), 'total', len(ex), 'disputed', len(disputed))
if bad:
    sys.exit(1)
