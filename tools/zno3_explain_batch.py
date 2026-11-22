"""python -I tools/zno3_explain_batch.py SUBJECT START COUNT [TOPIC ...]  -> print official biology/geography tasks without an analysis.

Repeats of one task are printed once with their ids after «також»; merge gives them the same analysis.
Tasks with pictures (question or options) are skipped and only counted: their analysis needs the picture.
The key is not printed: solve the task first, then merge with tools/zno3_explain_merge.py, which checks the answer.
Output order: topic order of the subject, newest year first. Env SKIP=id,id hides ids left for later."""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subject, start, count = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
only = sys.argv[4:]
bank = json.load(open(os.path.join(ROOT, 'src', 'zno3-bank.json'), encoding='utf-8'))
qs = bank['questions']
ex = json.load(open(os.path.join(ROOT, 'src', 'zno2-explanations.json'), encoding='utf-8'))
order = {t['id']: i for s in bank['subjects'] if s['id'] == subject for i, t in enumerate(s['topics'])}
L = 'АБВГДЕЖЗ'


def has_picture(q):
    return bool(q.get('images') or q.get('optionImages') or q.get('rowImages'))


todo = [q for q in qs if q['subject'] == subject and q['id'] not in ex and (not only or q['topicId'] in only)]
todo.sort(key=lambda q: (order.get(q['topicId'], 999), -q['year'], q.get('source', ''), q['number']))
text_only = [q for q in todo if not has_picture(q)]
# The same task is printed once: repeats (other tests, other years) share its text and options.
groups, seen = {}, {}
for q in text_only:
    sig = (q['type'], q['prompt'], tuple(q.get('options') or []), tuple(q.get('left') or []))
    if sig in seen:
        groups[seen[sig]].append(q['id'])
    else:
        seen[sig] = q['id']
        groups[q['id']] = []
reps = [q for q in text_only if seen.get((q['type'], q['prompt'], tuple(q.get('options') or []), tuple(q.get('left') or []))) == q['id']]
print('left without analysis:', len(todo), '| with pictures (skipped):', len(todo) - len(text_only), '| text only:', len(text_only), '| distinct tasks:', len(reps))
SKIP = set(filter(None, os.environ.get('SKIP', '').split(',')))  # ids left for later, e.g. SKIP=zb-2491,zb-6732
reps = [q for q in reps if q['id'] not in SKIP]
for q in reps[start:start + count]:
    dup = groups.get(q['id']) or []
    print('=' * 3, q['id'], q['topicId'], q['year'], '№%s' % q['number'], q['type'], ('tolerance %s' % q['tolerance']) if q['type'] == 'numeric' and 'tolerance' in q else '', ('(також: %s)' % ', '.join(dup)) if dup else '')
    print(q['prompt'])
    if q['type'] == 'match':
        print('ROWS:', ' | '.join('%d) %s' % (i + 1, x) for i, x in enumerate(q.get('left') or [])))
        for i, o in enumerate(q.get('options') or []):
            print('  %s %s' % (L[i], o))
    elif q['type'] == 'numeric':
        print('  (відповідь числом)')
    else:
        for i, o in enumerate(q.get('options') or []):
            print('  %s %s' % (L[i], o))
        if q['type'] == 'multi':
            print('  (позначте всі правильні)')
