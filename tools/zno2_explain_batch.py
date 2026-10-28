"""python -I tools/zno2_explain_batch.py SUBJECT TOPICS START COUNT  -> print official tasks without an analysis (readable, key marked)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
subject = sys.argv[1]
cats = sys.argv[2].split(',')
start, count = int(sys.argv[3]), int(sys.argv[4])
b = json.load(open(os.path.join(ROOT, 'src', 'zno2-bank.json'), encoding='utf-8'))['questions']
ex = json.load(open(os.path.join(ROOT, 'src', 'zno2-explanations.json'), encoding='utf-8'))
extra = {}
L = 'АБВГД'
seen = set()
SEEN_PARAS = set()


def clean(s):
    s = str(s)
    s = re.sub(r'⟦§h§(.*?)⟧', r'«\1»', s, flags=re.S)
    s = re.sub(r'⟦§b§(.*?)⟧', r'\1', s, flags=re.S)
    s = re.sub(r'⟦§i§(.*?)⟧', r'\1', s, flags=re.S)
    s = re.sub(r'⟦§u§(.*?)⟧', r'_\1_', s, flags=re.S)
    s = re.sub(r'⟦§m§zno2-\d+-(\w+)⟧', lambda m: {'romb': '◇', 'treug': '△', 'krug': '○', 'kvadrat': '□', 'trapec': '▽', 'treyg': '△', 'kryg': '○', 'trapeciya': '▽'}.get(m.group(1), '[' + m.group(1) + ']'), s)
    return s


todo = [q for q in b if q['subject'] == subject and q['id'] not in ex and q['id'] not in extra and q['topicId'] in cats]
order = {c: i for i, c in enumerate(cats)}
todo.sort(key=lambda q: (order[q['topicId']], -q['year'], q['source'], q['number']))
print('remaining in', cats, ':', len(todo))
SKIPPED = []
for q in todo[start:start + count]:
    a = q['answer']
    opts_all = q.get('options') or []
    if q['type'] == 'single' and opts_all and all(not clean(o) for o in opts_all) or ('нижче тексти' in q['prompt'] and len(q['prompt']) < 400):
        SKIPPED.append(q['id'])
        continue
    print('=' * 3, q['id'], q['topicId'], q['source'], '№%s' % q['number'], q['type'])
    imgs = False
    out = []
    for para in clean(q['prompt']).split(chr(10)):
        if len(para) > 160 and para in SEEN_PARAS:
            if not out or out[-1] != '[текст як вище]':
                out.append('[текст як вище]')
            continue
        if len(para) > 160:
            SEEN_PARAS.add(para)
        out.append(para)
    print(chr(10).join(out))
    if imgs:
        print('  [УВАГА: варіанти відповідей — зображення, їх не видно; пропусти]')
    opts = q.get('options') or []
    if q['type'] == 'match':
        left = q.get('left') or []
        print('ROWS:', ' | '.join('%d) %s' % (i + 1, clean(x)) for i, x in enumerate(left)))
        for i, o in enumerate(opts):
            print('  %s %s' % (L[i], clean(o)))
        print('KEY:', ' '.join('%d-%s' % (i + 1, L[x] if isinstance(x, int) else x) for i, x in enumerate(a)))
    else:
        for i, o in enumerate(opts):
            print('  %s%s %s' % (L[i], '*' if i == a else ' ', clean(o) or '[зображення]'))
        print('KEY:', L[a])
print('SKIPPED (варіанти-зображення або немає тексту):', ' '.join(SKIPPED))
