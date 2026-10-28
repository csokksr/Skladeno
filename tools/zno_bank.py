"""Convert sources/zno/bank.json into the app's history bank src/history-bank.json.

Each task keeps its official source; images point to assets zno-<key> whose data URIs live in src/blobs.
The build replaces the generated history questions with this bank (see load_data in tools/build.py)."""
import json, os, re, sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, 'sources', 'zno', 'bank.json')
OUT = os.path.join(ROOT, 'src', 'history-bank.json')
BLOBS = os.path.join(ROOT, 'src', 'blobs')


def key(url):  # same naming as tools/zno_images.py
    parts = url.rstrip('/').split('/')
    return 'zno-' + re.sub(r'[^a-z0-9]+', '-', (parts[-2] + '-' + os.path.splitext(parts[-1])[0]).lower()).strip('-')


def clean(prompt):
    # Group references from the printed booklet make no sense for a single task.
    p = re.sub(r'\s*(та|й|і)\s+(виконайте|дайте відповіді? на)\s+завдання\s+\d+\s*[–-]\s*\d+(\s+до нього)?', ' та виконайте завдання', prompt)
    p = re.sub(r'(виконайте завдання)\s*\.', r'\1.', p)
    p = re.sub(r'\s*\(завдання\s+\d+\s*[–-]\s*\d+\)', '', p)
    p = re.sub(r'^У завданнях \d+ і \d+ розташуйте події в хронологічній послідовності\.?\s*', '', p)
    return p.strip()


def norm(s):
    return re.sub(r"[ʼ’`']", "'", s.lower()).replace('ё', 'е')


def fact_patterns(fact):
    """Word-stem regex for a theory card: surname for persons, the name itself for terms, monuments and places."""
    label = re.sub(r'[«»"()]', ' ', norm(fact['label']))
    words = re.findall(r"[а-яіїєґa-z'-]+", label)
    if fact['kind'] == 'P':
        words = [w for w in words if len(w) >= 4][-1:]
    elif fact['kind'] == 'C':
        words = [w for w in words if len(w) >= 4][:3]
    words = [w for w in words if len(w) >= 3]
    if not words or fact['kind'] not in 'PTCG':
        return None
    stems = [w[:max(4, len(w) - 2)] for w in words]
    gap = "[а-яіїєґ'-]*\\s+(?:[а-яіїєґ'-]+\\s+)?"  # rest of the word, optionally one word in between
    return re.compile('(?<![а-яіїєґ])' + gap.join(re.escape(x) for x in stems))


def main():
    data = json.load(open(os.path.join(ROOT, 'src', 'data.json'), encoding='utf-8'))
    facts = {t['id']: [(f['id'], fact_patterns(f)) for f in t['facts'] if f['kind'] != 'L'] for t in data['topics']}
    bank = json.load(open(BANK, encoding='utf-8'))
    # Own written analyses of official tasks (osvita.ua explanations are not used), keyed by app id.
    notes = json.load(open(os.path.join(ROOT, 'src', 'history-explanations.json'), encoding='utf-8'))
    out, assets, missing = [], {}, []

    def img(url):
        k = key(url)
        if not os.path.exists(os.path.join(BLOBS, k + '.txt')):
            missing.append(url)
        assets[k] = '@@blob:' + k
        return k

    for t in sorted(bank, key=lambda t: (t['topic'], -t['year'], t['test'], t['number'])):
        q = {'id': 'zno-%d' % t['zid'], 'topic': t['topic'], 'type': t['type'], 'category': 'Z',
             'prompt': clean(t['prompt']), 'options': t['options'],
             'correct': t['answer'], 'explanation': notes.pop('zno-%d' % t['zid'], ''), 'facts': [],
             'source': '%s, завдання %d' % (t['source'], t['number']), 'year': t['year'],
             'test': t['test'], 'testName': t['source'], 'number': t['number']}
        if t['images']:
            q['images'] = [img(u) for u in t['images']]
        if any(t['optionImages']):
            q['optionImages'] = [img(l[0]) if l else None for l in t['optionImages']]
        if t['type'] == 'match':
            q['rows'] = t['left']
            if any(t['leftImages']):
                q['rowImages'] = [img(l[0]) if l else None for l in t['leftImages']]
        text = norm(' '.join([t['prompt']] + t['options'] + t.get('left', [])))
        q['facts'] = [fid for fid, rx in facts.get(t['topic'], []) if rx and rx.search(text)]
        if t.get('keyFixed'):
            q['keyNote'] = t['keyFixed']
        out.append(q)
    assert not notes, 'explanations for unknown tasks: %s' % list(notes)[:5]
    json.dump({'questions': out, 'assets': assets}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(out), 'tasks,', len(assets), 'images,', len(missing), 'missing blobs')
    print(sorted(Counter(q['topic'] for q in out).items()))
    print('tasks with an analysis:', sum(1 for q in out if q['explanation']))
    print('tasks linked to theory cards:', sum(1 for q in out if q['facts']), '| links:', sum(len(q['facts']) for q in out))


if __name__ == '__main__':
    main()
