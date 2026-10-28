"""Assign a programme topic (1–32) to every task in sources/zno/bank.json.

Order of evidence: the zno.osvita.ua topic collection; for the culture IX–XVI collection, visual-only collections and
tasks missing from every collection — the years named in the task, then the neighbours of the same type in the same
test (ZNO tests list tasks chronologically). Manual decisions in tools/zno_overrides.json win over everything."""
import json, os, re, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zno_import import TOPIC, VISUAL  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, 'sources', 'zno', 'bank.json')
OVR = os.path.join(ROOT, 'tools', 'zno_overrides.json')

# Upper year bound of each programme topic (topic 1 is methodological and has no period).
UPPER = [(2, -1), (3, 1199), (4, 1340), (5, 1568), (6, 1599), (7, 1647), (8, 1657), (9, 1687), (10, 1763), (11, 1795),
         (12, 1847), (14, 1860), (15, 1899), (18, 1913), (20, 1917), (21, 1918), (22, 1921), (23, 1928), (24, 1938),
         (26, 1945), (27, 1953), (28, 1964), (29, 1985), (30, 1991), (31, 2004), (32, 2100)]
WEST = re.compile(r'Галич|Буковин|Закарпат|Австр|Габсбург|Львів|Перемишл|Русалк|Головн\w+ руськ', re.I)
CULT = re.compile(r'культур|архітектур|собор|церкв|мистец|літератур|живопис|ікон|книг|друк|освіт|школ|театр|музик|поем|твір|пам.ятк', re.I)


def years(t):
    s = ' '.join([t['prompt']] + t['options'] + t.get('left', []))
    ys = [int(y) for y in re.findall(r'(?<![\d.,])(1[0-9]{3}|[89][0-9]{2})(?![\d])', s)]
    return [y for y in ys if 800 <= y <= 2030]


def by_year(t):
    ys = years(t)
    if not ys:
        return None
    y = sorted(ys)[len(ys) // 2]
    for topic, hi in UPPER:
        if y <= hi:
            if topic == 12 and WEST.search(t['prompt']):
                return 13
            if topic in (12, 15, 18) and CULT.search(t['prompt']):
                return {12: 14, 15: 17, 18: 17}[topic]
            if topic == 15 and WEST.search(t['prompt']):
                return 16
            if topic == 18 and WEST.search(t['prompt']):
                return 19
            return topic
    return None


STOP = set('який яка яке які було була були його їхні цього цієї того також серед після внаслідок період років року роки укажіть установіть визначте відповідність послідовність завдання зображено зображені фото уривку уривок джерела історичного'.split())


def tokens(t):
    s = ' '.join([t['prompt']] + t['options'] + t.get('left', [])).lower()
    words = [w[:6] for w in re.findall(r"[а-яіїєґ']{4,}", s) if w not in STOP]
    ys = ['y%d' % (int(y) // 10) for y in re.findall(r'(?<![\d])(1[0-9]{3}|[89][0-9]{2})(?![\d])', s)]
    return words + ys


class NB:
    def __init__(self, items):
        import math
        self.math = math
        self.prior, self.counts, self.total, self.vocab = Counter(), {}, Counter(), set()
        for t in items:
            k = t['topic']
            self.prior[k] += 1
            c = self.counts.setdefault(k, Counter())
            for w in tokens(t):
                c[w] += 1
                self.total[k] += 1
                self.vocab.add(w)

    def predict(self, t):
        ws, V, n = tokens(t), len(self.vocab), sum(self.prior.values())
        best = max(self.prior, key=lambda k: self.math.log(self.prior[k] / n) + sum(
            self.math.log((self.counts[k][w] + 0.5) / (self.total[k] + 0.5 * V)) for w in ws))
        return best


def main():
    bank = json.load(open(BANK, encoding='utf-8'))
    ovr = json.load(open(OVR, encoding='utf-8'))
    bank = [t for t in bank if t['zid'] not in set(ovr['exclude'])]
    for t in bank:
        known = {TOPIC[s] for s in t['slugs'] if s in TOPIC and TOPIC[s]}
        t['topic'] = min(known) if len(known) == 1 else None
        t['how'] = 'collection' if t['topic'] else None
    labelled = [t for t in bank if t['topic']]
    # Cross-validated accuracy of the word model, so its share of decisions can be judged.
    folds, hits = 5, 0
    for f in range(folds):
        model = NB([t for i, t in enumerate(labelled) if i % folds != f])
        hits += sum(model.predict(t) == t['topic'] for i, t in enumerate(labelled) if i % folds == f)
    print('word model accuracy %.1f%%' % (100 * hits / len(labelled)))
    model = NB(labelled)
    for t in bank:
        if not t['topic']:
            t['topic'], t['how'] = model.predict(t), 'model'
    for t in bank:
        if str(t['zid']) in ovr['topics']:
            t['topic'], t['how'] = ovr['topics'][str(t['zid'])], 'manual'
    left = [t['zid'] for t in bank if t['how'] == 'model']
    assert not left, 'tasks without a checked topic: %s' % left
    json.dump(bank, open(BANK, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(Counter(t['how'] for t in bank))
    print(sorted(Counter(t['topic'] for t in bank).items()))


if __name__ == '__main__':
    main()
