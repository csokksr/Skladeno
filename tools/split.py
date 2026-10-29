"""Split the single-file build into editable sources: shell.html, app.js, data.json, blobs/.
One-off migration helper: the project is now edited in src/ directly, and a split of the built page would flatten modules, theme and
content into the sources. It refuses to write into a folder that already holds sources unless --force is given.
Usage: python -I tools/split.py <file.html> <empty folder> [--force]"""
import json, os, re, sys
args = [a for a in sys.argv[1:] if a != '--force']
if len(args) != 2:
    sys.exit(__doc__)
src, out = args
if '--force' not in sys.argv and any(os.path.exists(os.path.join(out, f)) for f in ('app.js', 'data.json', 'shell.html')):
    sys.exit('Refusing to overwrite %s: it already holds sources (pass --force to override).' % out)
t = open(src, encoding='utf-8').read()
OPEN = '<script id="data" type="application/json">'
a = t.index(OPEN) + len(OPEN)
b = t.index('</script><script>', a)
c = b + len('</script><script>')
d = t.rindex('</script></body></html>')
os.makedirs(out + '/blobs', exist_ok=True)
data = json.loads(t[a:b])
n = 0
def pull(x, path):
    global n
    if isinstance(x, dict):
        return {k: pull(v, f'{path}.{k}') for k, v in x.items()}
    if isinstance(x, list):
        return [pull(v, f'{path}.{i}') for i, v in enumerate(x)]
    if isinstance(x, str) and x.startswith('data:') and len(x) > 2000:
        key = re.sub(r'[^A-Za-z0-9_.-]', '_', path.strip('.'))
        open(f'{out}/blobs/{key}.txt', 'w', encoding='ascii').write(x)
        n += 1
        return '@@blob:' + key
    return x
data = pull(data, '')
json.dump(data, open(out + '/data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(out + '/shell.html', 'w', encoding='utf-8', newline='').write(t[:a] + '@@DATA@@</script><script>@@APP@@' + t[d:])
open(out + '/app.js', 'w', encoding='utf-8', newline='').write(t[c:d])
print('blobs', n)
