"""Download the images of sources/zno/bank.json and store compressed WebP copies as blobs.

Originals go to sources/zno/img (untrusted downloads, kept apart from code); compressed data URIs go to
src/blobs/zno-<key>.txt so the build can reference them as @@blob:zno-<key>. Run with plain `python` (needs Pillow)."""
import base64, io, json, os, re, sys, time, urllib.request

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, 'sources', 'zno', 'bank.json')
RAW = os.path.join(ROOT, 'sources', 'zno', 'img')
BLOBS = os.path.join(ROOT, 'src', 'blobs')
MAX_SIDE, QUALITY = 960, 72


def key(url):
    parts = url.rstrip('/').split('/')
    return re.sub(r'[^a-z0-9]+', '-', (parts[-2] + '-' + os.path.splitext(parts[-1])[0]).lower()).strip('-')


def main():
    os.makedirs(RAW, exist_ok=True)
    bank = json.load(open(BANK, encoding='utf-8'))
    urls = []
    for t in bank:
        urls += t['images']
        for k in ('optionImages', 'leftImages'):
            for lst in t.get(k, []):
                urls += lst
    urls = sorted(set(urls))
    raw_total = out_total = 0
    for i, url in enumerate(urls):
        k = key(url)
        raw = os.path.join(RAW, k + os.path.splitext(url)[1].lower())
        if not os.path.exists(raw):
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(raw + '.part', 'wb') as fh:
                fh.write(data)
            os.replace(raw + '.part', raw)
            time.sleep(0.2)
        raw_total += os.path.getsize(raw)
        blob = os.path.join(BLOBS, 'zno-%s.txt' % k)
        if not os.path.exists(blob):
            im = Image.open(raw)
            im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') else im.convert('RGB')
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=QUALITY, method=6)
            open(blob, 'w', encoding='ascii').write('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
        out_total += os.path.getsize(blob)
        if i % 200 == 0:
            print(i, '/', len(urls))
    print(len(urls), 'images; originals %.1f MB, blobs %.1f MB' % (raw_total / 2**20, out_total / 2**20))


if __name__ == '__main__':
    main()
