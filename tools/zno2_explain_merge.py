"""python -I tools/zno2_explain_merge.py file.json [...]  -> checks analyses of official ukr tasks and merges them into src/zno2-explanations.json

Math/eng: a value may be {"t": text, "a": answer} -- "a" is the answer solved independently (single: letter, numeric: number, match: letters like "БВА"); it must equal the bank key and only "t" is stored.
Checks: id exists and has no analysis yet; single: the key letter closes a paragraph and no other letter closes a paragraph
that is not a «Чому не інші»/«Помилки в…» one; match: row N line starts «N.» and ends «— Х.» with the key letter."""
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'src', 'zno2-explanations.json')
bank = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'src', 'zno2-bank.json'), encoding='utf-8'))['questions']}
ex = json.load(open(P, encoding='utf-8'))
L = 'АБВГДЕЖЗ'
bad = []
new = {}
for f in sys.argv[1:]:
    for i, t in json.load(open(f, encoding='utf-8')).items():
        q = bank.get(i)
        mine = None
        if isinstance(t, dict):
            t, mine = t['t'], str(t['a']).strip()
        if not q or (q['subject'] != 'ukr' and mine is None):
            bad.append((i, 'unknown id or no independent answer')); continue
        if mine is not None:
            if q['type'] == 'single':
                key = L[q['answer']]
            elif q['type'] == 'numeric':
                key = str(q['answer'])
            else:
                key = ''.join(L[x] if isinstance(x, int) else str(x) for x in q['answer'])
            ok = (mine == key)
            if q['type'] == 'numeric' and not ok:
                try:
                    ok = abs(float(mine.replace(',', '.')) - float(key.replace(',', '.'))) <= max(1e-9, abs(float(key.replace(',', '.'))) * 1e-9)
                except ValueError:
                    ok = False
            if not ok:
                bad.append((i, 'my answer %s != key %s' % (mine, key))); continue
        if i in ex:
            bad.append((i, 'already has analysis')); continue
        t = t.strip()
        if len(t) < (15 if mine is not None else 40):
            bad.append((i, 'too short')); continue
        if q['subject'] == 'ukr' and q['type'] == 'single':
            key = L[q['answer']]
            paras = t.split(chr(10))
            trail = [re.findall(r'\(([А-Д])\)\.?\s*$', x) for x in paras]
            trail = [x[0] if x else None for x in trail]
            if key not in trail:
                bad.append((i, 'key letter %s is not closing any paragraph: %s' % (key, trail))); continue
            DIS = ('Чому не інші', 'Помилки в інших', 'У рядках', 'Інші', 'Решта', 'Усі інші', 'Помилки в')
            wrong = [(x, pa[:20]) for x, pa in zip(trail, paras) if x and x != key and not pa.startswith(DIS)]
            if wrong:
                bad.append((i, 'non-key letter closes a paragraph: %s' % wrong)); continue
        if q['subject'] == 'ukr' and q['type'] == 'match':
            paras = t.split(chr(10))
            for r, x in enumerate(q['answer']):
                want = L[x] if isinstance(x, int) else str(x)
                line = next((pa for pa in paras if pa.startswith('%d.' % (r + 1))), None)
                if line is None or not line.rstrip().endswith('— ' + want + '.'):
                    bad.append((i, 'row %d must end with "— %s."' % (r + 1, want))); break
            if bad and bad[-1][0] == i:
                continue
        new[i] = t
for i, why in bad:
    print('REJECT', i, why)
if bad:
    sys.exit(1)
ex.update(new)
with open(P, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write('{\n' + ',\n'.join('%s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in ex.items()) + '\n}\n')
print('merged', len(new), 'total', len(ex))
