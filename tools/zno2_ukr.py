"""Ukrainian part of tools/zno2_bank.py: which official tasks are kept and their topic.

Kept: the language part of ЗНО 2020–2021 (the 2019 Pravopys is in force; literature tasks are left out) and the НМТ language
tests 2022–2024. Older ЗНО tests follow earlier spelling rules, so they are not used."""
import re

LIT_TESTS = {567, 604, 605}  # НМТ-2024 literature tests
ZNO_LANG = {389: (1, 33), 401: (1, 33), 429: (1, 33), 436: (25, 63), 452: (25, 63), 471: (25, 63), 491: (25, 63)}

# ЗНО 2016–2019 follow the pre-2019 Pravopys: only topics whose norms did not change are used from them.
ZNO_OLD = {168: (1, 33), 189: (1, 33), 203: (1, 33), 206: (1, 33), 240: (1, 33), 254: (1, 33), 281: (1, 33), 299: (1, 33), 309: (1, 33), 335: (1, 33), 347: (1, 33), 363: (1, 33)}
OLD_TOPICS = {'ukr-simple', 'ukr-complex', 'ukr-service', 'ukr-verbs', 'ukr-text'}

# (pattern, topic): first match wins; patterns are tried on the prompt first line plus options and left rows
TOPICS = [
    (r'читання й аналіз тексту|(прочитайте|проаналізуйте|уважно прочитайте).{0,40}текст|тексти|первісн|речення розташ|речення розмісти', 'ukr-text'),
    (r'відповідник|іншомовн', 'ukr-lexis'),
    (r'послідовного заповнення пропусків|_{4,}', 'ukr-forms'),
    (r'наголос|на (перший|другий|третій|четвертий) склад|звук|орфоепі|вимов', 'ukr-sounds'),
    (r'не і ні|прийменник|сполучник|частк|вигук|службов', 'ukr-service'),
    (r'складнопідряд|складносурядн|безсполучник|підрядн|сурядн|складн(е|их) речен|складного речення|складними', 'ukr-complex'),
    (r'підмет|присудок|член(ом|и|ів)? речення|однорідн|відокремлен|вставн|звертан|односкладн|двоскладн|просте речення|простого речення|простих речень|пряму мову|пряма мова|прямої мови|тире|кому |кома|розділов|знак(и|ів)? пунктуац', 'ukr-simple'),
    (r'дієслов|дієприслівник|дієприкметник|наказов|спосіб|доконан|час(у|и|ів) дієслова', 'ukr-verbs'),
    (r'прикметник|числівник|займенник|прислівник|ступін|узгодж|частин(и|ами|а) мови|форм[аиуі] слова', 'ukr-forms'),
    (r'іменник|відмін|рід(у|і)?\b|множин', 'ukr-nouns'),
    (r'синонім|антонім|паронім|фразеологізм|лексичн|лексику|значення слова|застарі|запозичен|вжито (слово|прикметник|іменник)|неологізм|діалектн', 'ukr-lexis'),
    (r'суфікс|префікс|спільнокорен|словотвір|будов|морфем|корін|закінчен|основ(а|и) слова|утвор(ено|ити|ений)|складні слова', 'ukr-words'),
    (r'писати|написан|орфографічн|орфограм|дефіс|разом|окремо|апостроф|м.який знак|подвоєн|велик(ої|а) (літер|букв)|пропуск(у|ів)? (літер|букв)|літер(у|и|а) .{0,15}пропуск|букв(у|и|а) .{0,20}пропуск|пишемо|на письмі', 'ukr-spell'),
    (r'текст|стиль|мовлення|редагув|діалог|реплік|абзац|основн(а|у) думк|тип мовлення|послідовн|речення .{0,40}зв.язн', 'ukr-text'),
]


def topic(q):
    text = (q['prompt'].split('\n')[0] + ' ' + ' '.join(q.get('left', [])) + ' ' + ' '.join(q['options'])[:300]).lower()
    head = q['prompt'].split('\n')[0].lower()
    for pat, t in TOPICS:
        if re.search(pat, head):
            return t
    for pat, t in TOPICS:
        if re.search(pat, text):
            return t
    return 'ukr-text' if len(q['prompt']) > 300 else 'ukr-simple'


def select(tasks):
    keep = []
    for q in tasks:
        if q['test'] in LIT_TESTS:
            continue
        if q['kind'] == 'НМТ' and 2022 <= q['year'] <= 2024:
            pass
        elif q['test'] in ZNO_LANG and ZNO_LANG[q['test']][0] <= q['number'] <= ZNO_LANG[q['test']][1]:
            pass
        elif q['test'] in ZNO_OLD and ZNO_OLD[q['test']][0] <= q['number'] <= ZNO_OLD[q['test']][1]:
            q['_old'] = True
        else:
            continue
        if q['type'] in ('single', 'multi') and (not q['options'] or all(not o for o in q['options']) and not any(q['optionImages'])):
            continue
        keep.append(q)
    for q in keep:
        text = q['prompt']
        paras = [p for p in text.split('\n\n') if p.strip()]
        if len(text) > 500 and len(paras) >= 2 and len(paras[-1]) <= 260 and re.search(r'\?|:|…|\.\.\.|[Уу]кажіть|[Яя]к(ий|а|е|і)|[Щщ]о |[Ч]ому|Визначте|З.ясуйте', paras[-1]):
            q['passage'] = '\n\n'.join(paras[:-1])
            q['prompt'] = paras[-1]
        q['_topic'] = topic(q)
    return [q for q in keep if not q.get('_old') or q['_topic'] in OLD_TOPICS]
