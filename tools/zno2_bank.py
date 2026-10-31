"""Turn sources/zno2/bank.json (tools/zno2_import.py) into the site's question format: src/zno2-bank.json plus compressed
images in src/blobs/zno2-*.txt. Each subject (math, eng, ukr) has its own topic rule; build.py swaps these official tasks in for
the generated practice bank. Run with plain `python` (needs Pillow): python tools/zno2_bank.py [math|eng|ukr ...]"""
import base64, io, json, os, re, sys, time, urllib.request
from collections import Counter

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, 'sources', 'zno2', 'bank.json')
RAW = os.path.join(ROOT, 'sources', 'zno2', 'img')
OUT = os.path.join(ROOT, 'src', 'zno2-bank.json')
BLOBS = os.path.join(ROOT, 'src', 'blobs')
MAX_SIDE = 960
PREFIX = {'math': 'zm', 'eng': 'ze', 'ukr': 'zu'}

# ---------------------------------------------------------------- math
MATH_TOPIC = {
    'dijsni_chysla': 'numbers', 'vidnoshennya_ta_proporciyi': 'numbers',
    'racionalni_irracionalni_stepenevi_virazi': 'expressions',
    'linijni_kvadratni_racionalni_rivnjannja_ta_systemy_rivnjan': 'equations', 'rozvjazuvannja_zadach_z_rivnjan_i_system_rivnjan': 'equations',
    'pokaznykovi_logharyfmichni_rivnjannja_ta_systemy_rivnjan': 'logs',
    'nerivnosti_ta_systemy_nerivnostej': 'inequalities', 'chislovi_poslidovnosti': 'sequences',
    'funkcionalna_zalezhnist_vlastivosti': 'functions', 'linijni_ta_kvadratychni_funkciyi': 'functions',
    'pokaznykovi_logharyfmichni_tryghonometrychni_funkciyi': 'functions',
    'pokhidna_funkciyi': 'calculus', 'pervisna_ta_viznachenij_integral': 'calculus',
    'kombinatorni_pravila': 'probability', 'jmovirnist_vypadkovoyi_podiyi': 'probability',
    'elementarni_geometrichni_figuri': 'triangles', 'trikutniki': 'triangles', 'prjamokutni_trykutnyky': 'triangles',
    'chotirikutniki': 'polygons', 'prjamokutnyk_kvadrat': 'polygons', 'kolo_ta_krugh_mnoghokutnyky': 'circles',
    'koordinati_ta_vektori': 'vectors', 'koordinati_ta_vektori_u_prostori': 'vectors',
    'pryami_ta_ploshini_u_prostori': 'solids', 'mnogogranniki': 'solids', 'piramida': 'solids', 'tila_obertannja': 'rotation',
}
TRIG = re.compile(r'\\(sin|cos|tg|ctg|tan|cot|arcsin|arccos|arctg)(?![a-zA-Z])|operatorname\{(tg|ctg)\}|\\text\{(tg|ctg)\}|(?<![a-z])(sin|cos|tg|ctg)(?![a-z])', re.I)
MATH_KEYS = [  # fallback for tasks without a topic collection: first match wins
    (r'sin|cos|tg\b|ctg|тригонометр', 'trigonometry'), (r'\\log|\\lg|логарифм|log', 'logs'), (r'похідн|первісн|\\int|інтеграл', 'calculus'),
    (r'ймовірн|комбінац|способами|вибірк|медіан|мода|розмах', 'probability'), (r'вектор', 'vectors'),
    (r'пірамід|призм|паралелепіпед|куб', 'solids'), (r'циліндр|конус|куля|кулі|сфер', 'rotation'),
    (r'коло|круг|хорд|дотичн', 'circles'), (r'паралелограм|ромб|трапеці|прямокутник|квадрат', 'polygons'), (r'трикутник', 'triangles'),
    (r'прогрес|послідовн', 'sequences'), (r'нерівн', 'inequalities'), (r'рівнян', 'equations'), (r'функці|графік', 'functions'),
    (r'відсотк|пропорці|знижк|ціна', 'numbers'),
]


def math_topic(q):
    text = q['prompt'] + ' ' + ' '.join(q.get('options', [])) + ' ' + ' '.join(q.get('left', []))
    topics = [MATH_TOPIC[s] for s in q['slugs'] if s in MATH_TOPIC]
    if 'pokaznykovi_logharyfmichni_vyrazy' in q['slugs']:
        topics.insert(0, 'trigonometry' if TRIG.search(text) else 'logs')
    if 'irracionalni_tryghonometrychni_rivnjannja_ta_systemy_rivnjan' in q['slugs']:
        topics.insert(0, 'trigonometry' if TRIG.search(text) else 'equations')
    if topics:
        return 'math-' + topics[0]
    low = text.lower()
    for pat, t in MATH_KEYS:
        if re.search(pat, low):
            return 'math-' + t
    return 'math-numbers'


# ---------------------------------------------------------------- shared
def key(url):
    parts = url.rstrip('/').split('/')
    return re.sub(r'[^a-z0-9]+', '-', (parts[-2] + '-' + os.path.splitext(parts[-1])[0]).lower()).strip('-')


def blob(url, stats):
    k = 'zno2-' + key(url)
    path = os.path.join(BLOBS, k + '.txt')
    if os.path.exists(path):
        return k
    raw = os.path.join(RAW, key(url) + os.path.splitext(url)[1].lower())
    if not os.path.exists(raw):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(raw + '.part', 'wb') as fh:
            fh.write(data)
        os.replace(raw + '.part', raw)
        time.sleep(0.15)
    im = Image.open(raw)
    im.load()
    if max(im.size) > MAX_SIDE:
        s = MAX_SIDE / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    if im.mode in ('P', 'LA') or (im.mode == 'RGBA'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA')
        bg.paste(im, mask=im.split()[3])
        im = bg
    elif im.mode != 'RGB':
        im = im.convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=82, method=6)
    lossless = io.BytesIO()
    im.save(lossless, 'WEBP', lossless=True, method=6)
    data = lossless.getvalue() if len(lossless.getvalue()) <= len(buf.getvalue()) * 1.15 else buf.getvalue()  # line art stays crisp
    stats[0] += os.path.getsize(raw)
    stats[1] += len(data)
    open(path, 'w', encoding='ascii').write('data:image/webp;base64,' + base64.b64encode(data).decode())
    return k


def convert(q, stats, assets, topic_of):
    pre = PREFIX[q['subject']]
    out = {'id': '%s-%d' % (pre, q['zid']), 'subject': q['subject'], 'topicId': q['_topic'], 'type': q['type'], 'prompt': q['prompt'],
           'answer': q['answer'], 'level': 3 if q['type'] == 'numeric' else 2, 'source': q['source'], 'testName': q['source'], 'year': q['year'], 'test': q['test'],
           'number': q['number'], 'kind': q['kind'], 'session': q['session'], 'tags': [q['_topic'].split('-', 1)[1]]}
    for k in ('passage', 'format'):
        if q.get(k):
            out[k] = q[k]
    if q['type'] == 'numeric':
        out['tolerance'] = 1e-05
    else:
        out['options'] = q['options']
    if q['type'] == 'match':
        out['left'] = q['left']
        out['right'] = q['options']
    imgs = [blob(u, stats) for u in q['images']]
    if imgs:
        out['images'] = imgs
        # Sentence marks (△ ○ ◇ □ ▽): the page shows each picture in a table cell before its sentence, which the text
        # keeps as a «|» at the start of the line. Put the picture back in its place as ⟦§m§key⟧ (55-math.js draws it).
        marks = [x for x in imgs if re.search(r'-(treug|treyg|krug|kryg|romb|kvadrat|trapeciya|trapec)$', x)]
        for k in ('passage', 'prompt'):
            places = re.findall(r'(?m)^(?:⟦§\w§)?\|(?:⟧)?', out.get(k) or '')
            if len(places) == len(marks) > 1:
                it = iter(marks)
                out[k] = re.sub(r'(?m)^(?:⟦§\w§)?\|(?:⟧)?', lambda m: '⟦§m§%s⟧' % next(it), out[k])
                out[k] = re.sub(r'(⟦§m§[^⟧]*⟧)[ \t]*\n+[ \t]*', r'\1 ', out[k])
    opt = [[blob(u, stats) for u in l][:1] for l in q.get('optionImages', [])]
    if any(opt):
        out['optionImages'] = [x[0] if x else None for x in opt]
    row = [[blob(u, stats) for u in l][:1] for l in q.get('leftImages', [])]
    if any(row):
        out['rowImages'] = [x[0] if x else None for x in row]
    for k in [k for k in ('images', 'optionImages', 'rowImages') if k in out]:
        for v in (out[k] if isinstance(out[k], list) else []):
            if v:
                assets[v] = '@@blob:' + v
    return out


def select_math(tasks):
    for q in tasks:
        q['_topic'] = math_topic(q)
    return tasks


def select_eng(tasks):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import zno2_eng
    return zno2_eng.select(tasks)


def select_ukr(tasks):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import zno2_ukr
    return zno2_ukr.select(tasks)


SELECT = {'math': select_math, 'eng': select_eng, 'ukr': select_ukr}


def main(subjects):
    bank = json.load(open(BANK, encoding='utf-8'))
    os.makedirs(RAW, exist_ok=True)
    try:
        cur = json.load(open(OUT, encoding='utf-8'))
    except FileNotFoundError:
        cur = {'questions': [], 'assets': {}}
    questions = [q for q in cur['questions'] if q['subject'] not in subjects]
    assets = {}
    stats = [0, 0]
    for s in subjects:
        sel = SELECT[s]([q for q in bank if q['subject'] == s])
        new = []
        for q in sel:
            new.append(convert(q, stats, assets, None))
        questions += new
        print(s, len(new), Counter(q['topicId'] for q in new).most_common())
    assets = {}
    for q in questions:
        for k in q.get('images', []) + [x for x in q.get('optionImages') or [] if x] + [x for x in q.get('rowImages') or [] if x]:
            assets[k] = '@@blob:' + k
    json.dump({'questions': questions, 'assets': assets}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(questions), 'tasks;', len(assets), 'images;', round(stats[0] / 1e6, 1), 'MB ->', round(stats[1] / 1e6, 1), 'MB')


if __name__ == '__main__':
    main(sys.argv[1:] or ['math'])
