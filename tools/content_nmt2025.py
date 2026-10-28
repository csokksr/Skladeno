"""Real NMT-2025 tests (variant 2 of each subject) for the official answer-sheet trainer.
Variant 1 booklets on osvita.ua are the item-statistics edition: some tasks print the key next to them, so they are not used.
Keys were transcribed from the official key PDFs and spot-checked by solving tasks.
Usage: python -I tools/content_nmt2025.py <folder with the downloaded PDFs>
Writes src/blobs/nmt2025.*.txt and src/content/60-nmt2025.json."""
import base64, hashlib, json, os, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
UA, EN = 'АБВГД', 'ABCDEFGH'

PAPERS = {
    'ukr': ('1_Ukr_mova_2.pdf', 'Ukr_mova_vidp_2.pdf', 'https://osvita.ua/test/answers/95541/',
            'Б Б В В Г А А Б В Г Д Д Г Б Д Д Г Д Б А В Г В А Г ГВАД ГВАБ ВГАД ВАБГ ГАВД'),
    'math': ('1_Mat_2.pdf', None, 'https://osvita.ua/test/answers/95542/',
             'Г А В Г В Б Б Д Д Б Д Б Б Б В ГАБ ВГБ ВАГ 2,8 42 900 −2,4'),
    'hist': ('1_Ist_2.pdf', 'Ist_vidp_2.pdf', 'https://osvita.ua/test/answers/95543/',
             'А Б Г В А А Б Г Б А Б Б В Г А В Б В А А ВАГБ БГАВ БГДА ВБДГ АГВБ БАГВ ВГАБ 135 236 256'),
    'eng': ('Anhl_2.pdf', 'Anhl_vidp_2.pdf', 'https://osvita.ua/test/answers/95547/',
            'F H E C B A D B A C H F B A D E F H A E D B A B A C D A C B D A'),
}


def kind(sid, n):
    """Task format of NMT-2025, checked against the booklets."""
    if sid == 'ukr':
        return ('single', 4) if n <= 10 else ('single', 5) if n <= 25 else ('match', 4)
    if sid == 'math':
        return ('single', 5) if n <= 15 else ('match', 3) if n <= 18 else ('numeric', 0)
    if sid == 'hist':
        return ('single', 4) if n <= 20 else ('match', 4) if n <= 24 else ('order', 4) if n <= 27 else ('multi', 7)
    return ('single', 8) if n <= 5 or 11 <= n <= 22 else ('single', 4)


def question(sid, n, key):
    t, size = kind(sid, n)
    q = {'number': n, 'sourceKey': key, 'subject': sid, 'type': t}
    if t == 'single':
        letters = EN if sid == 'eng' else UA
        q['options'] = list(letters[:size])
        q['answer'] = letters.index(key)
        assert q['answer'] < size, (sid, n, key)
    elif t == 'match':
        q['options'] = list(UA[:4])
        q['left'] = [str(i + 1) for i in range(size)]
        q['right'] = list(UA)
        q['answer'] = [UA.index(c) for c in key]
        assert len(q['answer']) == size and len(set(q['answer'])) == size, (sid, n, key)
    elif t == 'order':
        q['options'] = list(UA[:4])
        q['answer'] = [UA.index(c) for c in key]
        assert sorted(q['answer']) == [0, 1, 2, 3], (sid, n, key)
    elif t == 'multi':
        q['options'] = [str(i) for i in range(1, 8)]
        q['answer'] = sorted(int(c) - 1 for c in key)
        assert len(set(q['answer'])) == 3, (sid, n, key)
    else:
        q['options'] = list(UA[:4])
        q['answer'] = key.replace('−', '-').replace(',', '.')
        float(q['answer'])
    return q


def blob(name, path):
    raw = open(path, 'rb').read()
    open(os.path.join(ROOT, 'src', 'blobs', name + '.txt'), 'w', encoding='ascii').write('data:application/pdf;base64,' + base64.b64encode(raw).decode())
    return {'filename': os.path.basename(path), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'data': '@@blob:' + name}


papers = []
for sid, (book, keys, url, key_line) in PAPERS.items():
    ks = key_line.split()
    count = {'ukr': 30, 'math': 22, 'hist': 30, 'eng': 32}[sid]
    assert len(ks) == count, (sid, len(ks))
    docs = {'questions': blob(f'nmt2025.{sid}.questions', os.path.join(SRC, book))}
    if keys:
        docs['keys'] = blob(f'nmt2025.{sid}.keys', os.path.join(SRC, keys))
    papers.append({'id': f'nmt2025-{sid}', 'subject': sid, 'year': 2025, 'variant': 2, 'title': 'НМТ-2025, варіант 2',
                   'kind': 'real', 'sourceUrl': url, 'documents': docs,
                   'questions': [question(sid, i + 1, k) for i, k in enumerate(ks)]})
    print(sid, len(papers[-1]['questions']), 'tasks', sum(1 for q in papers[-1]['questions'] if q['type'] != 'single'), 'non-single')
json.dump({'extend': {'officialPapers': papers}}, open(os.path.join(ROOT, 'src', 'content', '60-nmt2025.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
