"""Download the official ZNO/НМТ test pages of ukrainian, mathematics and english from zno.osvita.ua into sources/zno2/html
(and the topic collections of mathematics). Ids come from the subject index pages saved as sources/zno2/idx-<subject>.html.
Skips files that exist. Run with `python -I tools/zno2_fetch.py`; with the argument `zno3` it takes biology and geography
instead (sources/zno3; their topic collections come from the tema-<subject>.html pages saved next to the indexes)."""
import html, json, os, re, sys, time, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA = sys.argv[1:] == ['zno3']
BASE = os.path.join(ROOT, 'sources', 'zno3' if EXTRA else 'zno2')
HTML = os.path.join(BASE, 'html')
SUBJECTS = ['biology', 'geography'] if EXTRA else ['ukrainian', 'mathematics', 'english']


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def tests():
    out = []
    for s in SUBJECTS:
        t = open(os.path.join(BASE, 'idx-%s.html' % s), encoding='utf-8').read()
        ids = sorted({int(i) for i in re.findall(r'href="/%s/(\d+)/"' % s, t)})
        out += [(s, i) for i in ids]
    return out


def pages():
    os.makedirs(HTML, exist_ok=True)
    jobs = [('%s_%d.html' % (s, i), 'https://zno.osvita.ua/%s/%d/' % (s, i)) for s, i in tests()]
    # Topic collections (zno.osvita.ua/<subject>/tag-<slug>/): mathematics, and biology and geography (tema-<subject>.html lists them).
    for s in (['biology', 'geography'] if EXTRA else ['mathematics']):
        t = open(os.path.join(BASE, 'tema-%s.html' % s), encoding='utf-8').read()
        for slug in sorted(set(re.findall(r'href="/%s/tag-([^"/]+)/"' % s, t))):
            jobs.append(('tag-%s-%s.html' % (s, slug), 'https://zno.osvita.ua/%s/tag-%s/' % (s, slug)))
    for name, url in jobs:
        path = os.path.join(HTML, name)
        if os.path.exists(path):
            continue
        data = get(url)  # download first: a failed request must not leave an empty file that later runs skip
        with open(path + '.part', 'wb') as fh:
            fh.write(data)
        os.replace(path + '.part', path)
        print(name, os.path.getsize(path))
        time.sleep(0.4)
    print(len(jobs), 'pages')


if __name__ == '__main__':
    pages()
