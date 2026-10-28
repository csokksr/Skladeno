"""Point fixes to existing questions (wrong keys against the 2019 правопис, explanations that refer to
"the first sentence" after options were shuffled, junk distractors). Writes src/content/54-fixes.json."""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, 'src', 'data.json'), encoding='utf-8'))
content = {}
for name in ('20-ukr-five.json', '21-ukr-five-2.json'):
    for q in json.load(open(os.path.join(ROOT, 'src', 'content', name), encoding='utf-8'))['topicQuestions']:
        content[q['id']] = q
bank = {q['id']: q for s in d['subjects'] for t in s['topics'] for q in t['questions']}
bank.update(content)

patch = {
    'ukr-five-20261018-07': {
        'prompt': 'У якому словосполученні прикметник правильно узгоджено з невідмінюваним іменником?',
        'options': ['простора фоє', 'новий кафе', 'просторе фоє', 'смачна какао', 'просторий фоє'], 'answer': 2,
        'explanation': 'Невідмінювані іменники на позначення неживих предметів належать до середнього роду: просторе фоє, нове кафе, смачне какао.\nЧому не інші: простора фоє і просторий фоє — жіночий і чоловічий рід; новий кафе й смачна какао — так само неправильний рід прикметника.'},
    'ukr-five-20261018-29': {
        'options': ['знаня, віддати', 'знання, беззаконя', 'знаннья, віддати', 'знання, відддати', 'знання, віддати'], 'answer': 4,
        'explanation': 'Знання — подовжений м’який [н’:] перед я, тому нн. Віддати — збіг однакових приголосних на межі префікса від- і кореня, тому дд.\nЧому не інші: знаня — без подовження; беззаконня теж має подовження (нн); у знаннья зайвий ь; у відддати зайве третє д.'},
    'ukr-sounds-22': {'prompt': 'Виберіть милозвучне заповнення: «Він навчався … Львові».',
        'explanation': 'Перед сполученням льв пишемо у: у Львові. Так уникаємо збігу приголосних в-льв.\nЧому не інші: до й із змінюють значення («до Львові» — ще й неправильна форма); вв — помилка.'},
    'ukr-spell-29': {'_replace': ['відати (передати)', 'від’дати'],
        'explanation': 'На межі префікса від- і кореня -да- збігаються два д, тому пишемо дд: віддати.\nЧому не інші: апостроф після д не ставимо; вітдати — неправильний префікс; у відддати зайве третє д.'},
    # «половина дев’ятої» теж нормативне позначення 08:30 — два правильні варіанти.
    'ukr-forms-17': {'_replace': ['половина дев’ятої (форма години)', 'пів на дев’ять']},
    'ukr-spell-12': {'_replace': ['меншій (ступінь)', 'меньшій'],
        'explanation': 'Перед суфіксом -ш- м’який знак не пишемо: менший, тонший.\nЧому не інші: меньший і меньшій — зайвий ь; меншьший — зайвий ь і подвоєний суфікс.'},
}
# Пояснення, що називали правильний варіант «першим реченням» до перемішування варіантів.
for qid in ('ukr-five-20261018-36', 'ukr-five-20261018-40', 'ukr-five-20261018-19', 'ukr-simple-26',
            'ukr-five-20261021-11', 'ukr-complex-01', 'ukr-five-20261020-27'):
    q = bank[qid]
    key = q['options'][q['answer']]
    patch.setdefault(qid, {})['explanation'] = q['explanation'].replace('У першому реченні', f'У реченні «{key.rstrip(".")}»', 1)

out = {}
for qid, p in patch.items():
    q = bank[qid]
    p = dict(p)
    opts = list(q['options'])
    if '_replace' in p:
        old, new = p.pop('_replace')
        opts[opts.index(old)] = new
        p['options'] = opts
    if '_key' in p:
        p['answer'] = opts.index(p.pop('_key'))
    if p.get('answer', 0) is None:
        del p['answer']
    out[qid] = p

path = os.path.join(ROOT, 'src', 'content', '54-fixes.json')
json.dump({'patch': out}, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(path, len(out))
for k in ('ukr-sounds-22', 'ukr-complex-01', 'ukr-five-20261021-11'):
    print(k, out[k])
