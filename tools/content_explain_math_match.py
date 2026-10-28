"""Explanations for the math matching tasks (…-match-N): each row is recognised as a templated family,
solved by that family's function and checked against the key. Writes src/content/53-explain-math-match.json."""
import json, os, re, sys
from fractions import Fraction as Fr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content_explain_math as M  # noqa: E402

sig = lambda p: re.sub(r'[−-]?\d+(?:[.,]\d+)?', '#', p)
families = {}
for t in M.math_subject['topics']:
    for q in t['questions']:
        m = re.match(r'(.*-f\d+)-v\d+$', q['id'])
        if m and m.group(1) in M.F:
            families.setdefault(sig(q['prompt']), m.group(1))


def norm(text):
    sup = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')
    text = re.sub(r'\^(\d+)', lambda m: m.group(1).translate(sup), text)
    text = re.sub(r'(?<![\w)])-(?=\d)', '−', text)
    return re.sub(r'(?<=\d)\.(?=\d)', ',', text)


num = lambda s: Fr(str(s).replace(',', '.').replace('−', '-'))
out, missing = {}, []
for t in M.math_subject['topics']:
    for q in t['questions']:
        if q['type'] != 'match' or not re.search(r'-match-\d+$', q['id']):
            continue
        lines, used = [], set()
        for i, row in enumerate(q['left']):
            fam = families.get(sig(row))
            if not fam:
                missing.append((q['id'], row))
                break
            ans, steps, _trap = M.F[fam](M.ints(row), row)
            key = q['right'][q['answer'][i]]
            assert num(M.fmt(ans)) == num(key), (q['id'], row, ans, key)
            used.add(q['answer'][i])
            lines.append(f'{i + 1}. ' + ' '.join(steps) + f' Відповідь: {M.fmt(ans)}.')
        else:
            extra = [q['right'][j] for j in range(len(q['right'])) if j not in used]
            lines.append(f'Зайві варіанти ({", ".join(extra)}) не є відповіддю жодної з задач — перевір це підстановкою.')
            out[q['id']] = norm('\n'.join(lines))
assert not missing, missing[:5]
path = os.path.join(M.ROOT, 'src', 'content', '53-explain-math-match.json')
json.dump({'explanations': out}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(path, len(out))
print(out['math-numbers-match-2'])
