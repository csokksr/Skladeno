"""python -I tools/zno2_explain_merge.py file.json [...]  -> checks analyses of official ukr tasks and merges them into src/zno2-explanations.json

Checks: id exists and has no analysis yet; single: the key letter closes a paragraph and no other letter closes a paragraph
that is not a «Чому не інші»/«Помилки в…» one; match: row N line starts «N.» and ends «— Х.» with the key letter."""
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'src', 'zno2-explanations.json')
bank = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'src', 'zno2-bank.json'), encoding='utf-8'))['questions']}
ex = json.load(open(P, encoding='utf-8'))
L = 'АБВГД'
bad = []
new = {}
for f in sys.argv[1:]:
    for i, t in json.load(open(f, encoding='utf-8')).items():
        q = bank.get(i)
        if not q or q['subject'] != 'ukr':
            bad.append((i, 'unknown id')); continue
        if i in ex:
            bad.append((i, 'already has analysis')); continue
        t = t.strip()
        if len(t) < 40:
            bad.append((i, 'too short')); continue
        if q['type'] == 'single':
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
        if q['type'] == 'match':
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
