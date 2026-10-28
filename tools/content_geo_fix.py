"""Map questions: no two marked points closer than MIN_KM, otherwise their letters overlap on the small map.
Replaces the distractor of a too-close pair with a seeded-random distant unused point. Writes src/content/58-geo-fixes.json."""
import json, math, os, random, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_KM = 70
d = json.load(open(os.path.join(ROOT, 'src', 'data.json'), encoding='utf-8'))
pts = d['geo']['points']


def km(a, b):
    (x1, y1), (x2, y2) = pts[a][1:3], pts[b][1:3]
    return math.hypot((x1 - x2) * 111 * math.cos(math.radians((y1 + y2) / 2)), (y1 - y2) * 111)


def close(m):
    return [(a, b) for i, a in enumerate(m) for b in m[i + 1:] if km(a, b) < MIN_KM]


patch = {}
for q in d['questions']:
    if not q['id'].startswith('geo'):
        continue
    m, key = list(q['map']), q['map'][q['correct']]
    while close(m):
        a, b = close(m)[0]
        out = b if b != key else a
        pool = [p for p in range(len(pts)) if p not in m and all(km(p, x) >= MIN_KM for x in m if x != out)]
        m[m.index(out)] = random.Random(q['id']).choice(pool)
    if m != q['map']:
        assert m[q['correct']] == key
        patch[q['id']] = {'map': m}
        print(q['id'], [pts[i][0] for i in q['map']], '->', [pts[i][0] for i in m])
assert patch
json.dump({'patch': patch}, open(os.path.join(ROOT, 'src', 'content', '58-geo-fixes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
