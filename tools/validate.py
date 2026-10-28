"""Structural checks for every question in the built data (ids, keys, options, explanations)."""
import json, re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
t = open(sys.argv[1] if len(sys.argv) > 1 else 'dist/skladeno-nmt.html', encoding='utf-8').read()
o = '<script id="data" type="application/json">'
a = t.index(o) + len(o)
d = json.loads(t[a:t.index('</script><script>', a)])
qs = [('hist', q['topic'], {**q, 'answer': q['correct'], 'left': q.get('rows'), 'right': q.get('options')}) for q in d['questions']]
for s in d['subjects']:
    for tp in s['topics']:
        qs += [(s['id'], tp['id'], q) for q in tp['questions']]
for k in ('advanced', 'auditQuestions', 'visualBank', 'controlBank'):
    qs += [(q.get('subject'), q.get('topicId'), q) for q in d.get(k, [])]
problems = collections.defaultdict(list)
ids = collections.Counter(q['id'] for _, _, q in qs)
for sid, tid, q in qs:
    p = lambda m: problems[m].append(q['id'])
    if ids[q['id']] > 1: p('duplicate id')
    typ, ans, opts = q.get('type'), q.get('answer'), q.get('options') or []
    # Official ZNO/НМТ tasks cite their source instead of a written analysis.
    if not str(q.get('explanation', '')).strip() and not q.get('source'): p('no explanation')
    for k in q.get('images', []) + [x for x in q.get('optionImages') or [] if x] + [x for x in q.get('rowImages') or [] if x]:
        if k not in d['assets']: p('missing image asset')
    if q.get('optionImages') and len(q['optionImages']) != len(opts): p('optionImages length')
    if not str(q.get('prompt', '')).strip(): p('no prompt')
    if typ == 'single':
        if not isinstance(ans, int) or not 0 <= ans < len(opts): p('single: key out of range')
        if len(opts) < 3: p('single: fewer than 3 options')
        if len(set(zip(map(str, opts), q.get('optionImages') or [None] * len(opts)))) != len(opts): p('single: repeated option')
    elif typ == 'multi':
        if not isinstance(ans, list) or len(set(ans)) != len(ans) or any(not 0 <= x < len(opts) for x in ans): p('multi: bad key')
    elif typ == 'order':
        if sorted(ans or []) != list(range(len(ans or []))) or len(ans or []) < 3: p('order: key not a permutation')
    elif typ == 'match':
        right = q.get('right') or opts
        left = q.get('left') or []
        if not isinstance(ans, list) or len(ans) != len(left) or len(set(ans)) != len(ans) or any(not 0 <= x < len(right) for x in ans): p('match: bad key')
    elif typ == 'numeric':
        try: float(str(ans).replace(',', '.'))
        except ValueError: p('numeric: key not a number')
    else: p('unknown type ' + str(typ))
for s in d['subjects']:
    for i, st in enumerate(s.get('mockSets', [])):
        if len(st) != 32 or len(set(st)) != 32: problems['eng mock set size'].append(i + 1)
for i, st in enumerate(d['ukrainianFiveOptionSets']):
    if len(st) != 15 or len(set(st)) != 15: problems['ukr five set size'].append(i + 1)
print('questions checked:', len(qs))
for k, v in problems.items(): print(f'{k}: {len(v)}  e.g. {v[:8]}')
print('OK' if not problems else 'PROBLEMS FOUND')
