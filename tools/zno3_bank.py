"""Turn sources/zno3/bank.json (biology and geography, tools/zno2_import.py zno3) into the site's question format:
src/zno3-bank.json (subjects with topics, tasks, image keys) plus compressed images in src/blobs/zno3-*.txt.

Topics are the topic collections of zno.osvita.ua («Біологія / Географія: завдання за темами», saved as sources/zno3/tema-<subject>.html
and sources/zno3/html/tag-*.html); the site says they follow the official programme, and their five (biology) and six (geography)
sections have the names of the sections of the programme (tools: sources/zno3/program, the orders of the Ministry of Education
№ 1426 of 20.12.2018 and № 696 of 26.06.2018). A task with several collections goes to the smallest one (the most specific);
a task without any collection goes to «без позначеної теми». Nothing here is written by hand except the titles of the sections.
The ids of tasks whose key agrees with an official answer sheet are in sources/zno3/verified.json (tools/zno3_keycheck.py);
every other task gets keyUnverified: true, and the page says so.
Run with plain `python` (needs Pillow): python tools/zno3_bank.py"""
import html, json, os, re, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zno2_bank as zb  # noqa: E402  blob() converts and stores the images

sys.stdout.reconfigure(encoding='utf-8')
ROOT = zb.ROOT
SRC = os.path.join(ROOT, 'sources', 'zno3')
OUT = os.path.join(ROOT, 'src', 'zno3-bank.json')
PREFIX = {'bio': 'zb', 'geo': 'zg'}
PAGE = {'bio': 'biology', 'geo': 'geography'}
SUBJECTS = {
    'bio': {'id': 'bio', 'name': 'Біологія', 'short': 'Біологія', 'color': '#4f7a2c',
            'sources': [{'title': 'УЦОЯО: біологія НМТ-2026, загальна характеристика й оцінювання',
                         'url': 'https://testportal.gov.ua/wp-content/uploads/2026/01/Harakterystyka-NMT_biologiya_2026.pdf'},
                        {'title': 'Програма ЗНО з біології (наказ МОН № 1426 від 20.12.2018)', 'url': 'https://zakon.rada.gov.ua/laws/show/v1426729-18'}]},
    'geo': {'id': 'geo', 'name': 'Географія', 'short': 'Географія', 'color': '#2f6d8a',
            'sources': [{'title': 'УЦОЯО: географія НМТ-2026, загальна характеристика й оцінювання',
                         'url': 'https://testportal.gov.ua/wp-content/uploads/2026/01/Harakterystyka-NMT_geografiya_2026.pdf'},
                        {'title': 'Програма ЗНО з географії (наказ МОН № 696 від 26.06.2018)', 'url': 'https://testportal.gov.ua/proggeo/'}]},
}
# Section names of the biology programme (the collection page shortens the first two); geography uses the page's own names.
SECTION = {
    '1.1': 'Вступ. Хімічний склад, структура і функціонування клітин. Реалізація спадкової інформації',
    '1.2': 'Закономірності спадковості і мінливості', '1.3': 'Біорізноманіття',
    '1.4': 'Організм людини як біологічна система', '1.5': 'Основи екології і еволюційного вчення',
}
TITLE_FIX = {'Різмноманітність, розмноження голонасінних і покритонасінних рослин': 'Різноманітність, розмноження голонасінних і покритонасінних рослин'}
NONE_TOPIC = 'Завдання без позначеної теми'


def structure(sub):
    """[(section number, section title, [(tag id, slug, title)])] from the collection page, in programme order."""
    t = open(os.path.join(SRC, 'tema-%s.html' % PAGE[sub]), encoding='utf-8').read()
    out = []
    for part in re.split(r'<li class="tag-item main">', t)[1:]:
        m = re.search(r'<b>([\d.]+)&nbsp;(.*?)</b>', part, re.S)
        tags = re.findall(r'data-tag_id="(\d+)" data-cnt="(\d+)">\s*<a href="/%s/tag-([^"/]+)/".*?<span>(.*?)</span>' % PAGE[sub], part, re.S)
        title = html.unescape(m.group(2)).strip()
        out.append((m.group(1).rstrip('.'), title, [(int(i), int(c), slug, TITLE_FIX.get(html.unescape(n).strip(), html.unescape(n).strip()))
                                                   for i, c, slug, n in tags]))
    return out


def main():
    bank = json.load(open(os.path.join(SRC, 'bank.json'), encoding='utf-8'))
    verified = set(json.load(open(os.path.join(SRC, 'verified.json'))))
    raw_dir = os.path.join(SRC, 'img')
    os.makedirs(raw_dir, exist_ok=True)
    subjects, topic_of_slug, rank = [], {}, {}
    for sub in ('bio', 'geo'):
        s = dict(SUBJECTS[sub], topics=[], groups=[])
        for num, title, tags in structure(sub):
            gid = '%s-g%s' % (sub, num.split('.')[-1])
            s['groups'].append({'id': gid, 'title': SECTION.get(num, title) if sub == 'bio' else title})
            for tag_id, cnt, slug, name in tags:
                tid = '%s-%d' % (sub, tag_id)
                s['topics'].append({'id': tid, 'title': name, 'group': gid, 'notes': [], 'questions': [],
                                    'summary': 'Розділ програми УЦОЯО «%s». Лише офіційні завдання, без конспекту.' % s['groups'][-1]['title']})
                topic_of_slug[(sub, slug)] = tid
                rank[tid] = (cnt, len(rank))
        s['topics'].append({'id': sub + '-none', 'title': NONE_TOPIC, 'group': s['groups'][-1]['id'], 'notes': [], 'questions': [],
                            'summary': 'Офіційні завдання, яким zno.osvita.ua не позначив тему.'})
        rank[sub + '-none'] = (10 ** 9, len(rank))
        subjects.append(s)
    stats, assets, questions = [0, 0], {}, []
    for q in bank:
        sub = q['subject']
        tids = [topic_of_slug[(sub, sl)] for sl in q['slugs'] if (sub, sl) in topic_of_slug]
        assert len(tids) == len(q['slugs']), (q['zid'], q['slugs'])
        tid = min(tids, key=rank.get) if tids else sub + '-none'
        out = {'id': '%s-%d' % (PREFIX[sub], q['zid']), 'subject': sub, 'topicId': tid, 'type': q['type'], 'prompt': q['prompt'],
               'answer': q['answer'], 'level': 3 if q['type'] == 'numeric' else 2, 'source': q['source'], 'testName': q['source'],
               'year': q['year'], 'test': q['test'], 'number': q['number'], 'kind': q['kind'], 'session': q['session'],
               'tags': [tid.split('-', 1)[1]]}
        if q.get('part'):
            out['part'] = q['part']
        if q['zid'] not in verified:
            out['keyUnverified'] = True
        if q['type'] == 'numeric':
            out['tolerance'] = 1e-05
        else:
            out['options'] = q['options']
        if q['type'] == 'match':
            out['left'] = q['left']
            out['right'] = q['options']
        imgs = [zb.blob(u, stats, 'zno3-', raw_dir) for u in q['images']]
        if imgs:
            out['images'] = imgs
        opt = [[zb.blob(u, stats, 'zno3-', raw_dir) for u in l][:1] for l in q.get('optionImages', [])]
        if any(opt):
            out['optionImages'] = [x[0] if x else None for x in opt]
        row = [[zb.blob(u, stats, 'zno3-', raw_dir) for u in l][:1] for l in q.get('leftImages', [])]
        if any(row):
            out['rowImages'] = [x[0] if x else None for x in row]
        for k in ('images', 'optionImages', 'rowImages'):
            for v in out.get(k) or []:
                if v:
                    assets[v] = '@@blob:' + v
        questions.append(out)
    used = {q['topicId'] for q in questions}
    for s in subjects:  # build.py attaches the tasks to the topics; a topic without tasks is left out
        s['topics'] = [t for t in s['topics'] if t['id'] in used]
        s['groups'] = [g for g in s['groups'] if any(t['group'] == g['id'] for t in s['topics'])]
    count = Counter(q['topicId'] for q in questions)
    json.dump({'subjects': subjects, 'questions': questions, 'assets': assets}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(questions), 'tasks;', len(assets), 'images;', round(stats[0] / 1e6, 1), 'MB ->', round(stats[1] / 1e6, 1), 'MB')
    print(Counter(q['subject'] for q in questions), 'unverified', sum(1 for q in questions if q.get('keyUnverified')))
    for s in subjects:
        print(s['id'], len(s['topics']), 'topics;', sorted((count[t['id']], t['title'][:30]) for t in s['topics'])[:4])


if __name__ == '__main__':
    main()
