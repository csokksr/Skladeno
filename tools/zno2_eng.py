"""English part of tools/zno2_bank.py: which official tasks are kept and how they are shaped.

Kept: НМТ 2023–2026 and ЗНО 2016–2021 (the format with advertisements, reading and gap-filling), without listening tasks.
A gap-filling text is repeated in every task of the site; the task names its gap. Reading tasks keep the text apart from
the question. Topics follow the site's ten English topics."""
import re
from collections import defaultdict

PREPS = set('in on at to for with by from of about into over under between among through during before after against across along around behind beside beyond despite except inside like near off onto out outside past since than toward towards until upon within without up down'.split())
MODALS = set('can could may might must should shall ought need cannot'.split())
DETS = set('a an the some any much many few little each every another other others such this that these those both either neither all enough no none whose which who whom what its their his her'.split())
AUX = set('have has had having will would was were is are been being be am do does did'.split())
GAP = re.compile(r'\((\d+)\)\s*_{2,}')


def norm(t):
    return re.sub(r'[\s_]+', '', t)


def listening(q):
    p = q['prompt']
    opts = [o.strip() for o in q['options']]
    if q['kind'] == 'ЗНО' and q['number'] <= 16 and len(p) < 200 and not q['images']:
        return True
    if opts == ['True', 'False'] and len(p) < 220:
        return True
    if re.search(r'\bthe speakers?\b|\blisten', p, re.I) and len(p) < 300:
        return True
    if all(not o for o in opts) and not any(q['optionImages'][i] for i in range(len(opts))):
        return True
    return False


def word_topic(opts, ctx):
    low = [o.lower().replace('’', "'").strip() for o in opts]
    first = [o.split()[0] if o.split() else '' for o in low]
    if sum(o in PREPS for o in low) >= 3:
        return 'eng-prepositions'
    if sum(f in MODALS or o in ('have to', 'has to', 'ought to', 'be able to') for f, o in zip(first, low)) >= 2:
        return 'eng-modals'
    if sum(o in DETS for o in low) >= 3:
        return 'eng-determiners'
    if re.search(r'\b(if|unless|wish(es)?|provided|as long as|supposing)\b[^.]{0,120}$', ctx, re.I) and any(f in AUX or f in MODALS or o.endswith(('ed', 'ing', 's')) for f, o in zip(first, low)):
        return 'eng-conditionals'
    pats = {('to' if o.startswith('to ') else 'ing' if o.endswith('ing') else 'base') for o in low if not o.startswith(('having', 'being'))}
    if len(pats) >= 2 and sum(o.startswith('to ') for o in low) >= 1 and sum(o.endswith('ing') for o in low) >= 1:
        return 'eng-verb-patterns'
    if sum(f in AUX or f.endswith("n't") for f in first) >= 2 or sum(o.endswith(('ing', 'ed')) for o in low) >= 2 and len(set(w[:3] for w in low)) <= 2:
        return 'eng-tenses'
    return 'eng-vocabulary'


def select(tasks):
    keep = [q for q in tasks if (q['kind'] == 'НМТ' and q['year'] >= 2023) or (q['kind'] == 'ЗНО' and 2016 <= q['year'] <= 2021)]
    keep = [q for q in keep if q['type'] == 'single' and not listening(q)]
    # gap texts: the k-th task of a group of identical texts asks about the k-th gap
    groups = defaultdict(list)
    for q in keep:
        if len(GAP.findall(q['prompt'])) >= 2:
            groups[(q['test'], tuple(sorted(int(g) for g in GAP.findall(q['prompt']))))].append(q)
    out = []
    for q in keep:
        text = q['prompt']
        gaps = [int(g) for g in GAP.findall(text)]
        if len(gaps) >= 2:
            grp = sorted(groups[(q['test'], tuple(sorted(gaps)))], key=lambda x: x['number'])
            if len(grp) != len(gaps):
                continue  # cannot tell which gap the task asks about
            n = sorted(gaps)[grp.index(q)]
            ctx = text[:text.index('(%d)' % n)] if '(%d)' % n in text else text
            q['passage'] = text
            q['prompt'] = 'Choose the best option for gap (%d).' % n
            words = sum(len(o.split()) for o in q['options']) / max(1, len(q['options']))
            q['_topic'] = 'eng-cohesion' if words >= 3.5 else word_topic(q['options'], ctx[-200:])
            q['format'] = 'gapfill'
        else:
            paras = [p for p in text.split('\n\n') if p.strip()]
            if q['images'] and len(paras) <= 2:  # an advertisement or a notice with an image
                q['_topic'] = 'eng-matching'
            elif len(paras) >= 2 and len(paras[-1]) <= 220 and (paras[-1].rstrip().endswith(('?', '.')) or '___' in paras[-1]):
                q['passage'] = '\n\n'.join(paras[:-1])
                q['prompt'] = paras[-1]
                q['_topic'] = 'eng-reading'
                q['format'] = 'reading'
            elif len(text) > 400:
                q['_topic'] = 'eng-reading'
                q['format'] = 'reading'
            else:  # a single sentence with a gap
                gap = re.search(r'_{3,}', text)
                q['_topic'] = word_topic(q['options'], text[:gap.start()] if gap else text) if gap else 'eng-vocabulary'
                q['format'] = 'gapfill'
        out.append(q)
    return out
