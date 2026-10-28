"""Split the single-file build into editable sources: shell.html, app.js, data.json, blobs/."""
import json, os, re, sys
src, out = sys.argv[1], sys.argv[2]
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
