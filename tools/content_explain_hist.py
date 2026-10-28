"""History explanations: every wrong option that is itself a known fact (its name or its description)
gets a line saying what it actually is. Writes src/content/55-explain-hist.json."""
import collections, json, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, 'src', 'data.json'), encoding='utf-8'))
facts = [dict(f, topic=t['id']) for t in d['topics'] for f in t['facts']]
norm = lambda s: re.sub(r'\s+', ' ', str(s).strip().rstrip('.')).lower()
by_text, by_label = collections.defaultdict(list), collections.defaultdict(list)
for f in facts:
    by_text[norm(f['text'])].append(f)
    by_label[norm(f['label'])].append(f)


def short(s, n=140):
    s = re.sub(r'\s+', ' ', str(s).strip())
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'


def lower_first(s):
    return s[:1].lower() + s[1:] if s[:2] != s[:2].upper() else s


def pick(cands, topic):
    return next((f for f in cands if f['topic'] == topic), cands[0])


out = {}
for q in d['questions']:
    if q['type'] != 'single' or len(q.get('explanation', '')) >= 220:
        continue
    lines = []
    for i, o in enumerate(q['options']):
        if i == q['correct']:
            continue
        if by_label.get(norm(o)):
            f = pick(by_label[norm(o)], q['topic'])
            lines.append(f'• {o} — {lower_first(short(f["text"]))}'.rstrip('.') + '.')
        elif by_text.get(norm(o)):
            f = pick(by_text[norm(o)], q['topic'])
            label = f['label'].rstrip('.').strip()
            what = {'D': f'подія, що датується: {lower_first(label)}', 'P': f'ідеться про {label}'}.get(f.get('kind'), f'це {label}')
            lines.append(f'• «{short(o, 90).rstrip(".")}» — {what}.')
    if lines:
        out[q['id']] = q['explanation'].rstrip() + '\nЧому не інші:\n' + '\n'.join(lines)
path = os.path.join(ROOT, 'src', 'content', '55-explain-hist.json')
json.dump({'explanations': out}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(path, len(out))
for k in list(out)[:3] + list(out)[-2:]:
    print('---', k); print(out[k])
