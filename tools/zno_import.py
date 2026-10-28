"""Parse official ZNO/NMT history tests saved from zno.osvita.ua (sources/zno/html) into sources/zno/bank.json.

Only tasks that appear in a full official test are kept; the site's own extra tasks and explanations are skipped.
Each task records its source test so the app can cite it (УЦОЯО materials, retyped by zno.osvita.ua)."""
import glob, html, json, os, re, sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sources', 'zno', 'html')
OUT = os.path.join(ROOT, 'sources', 'zno', 'bank.json')

# zno.osvita.ua topic collections -> programme topic (Вступ + 31 розділ програми, наказ МОН № 696 від 26.06.2018).
TOPIC = {
    'vstup_do_istoriyi_ukrayini': 1, 'starodavnya_istoriya_ukrayini': 2, 'vynyknennja_kyyivskoyi_derzhavy': 3,
    'rozkvit_kyyivskoyi_derzhavy': 3, 'korolivstvo_ruske_mongolska_navala': 4,
    'knyazivstva_u_skladi_inozemnih_derzhav_krimske_hanstvo': 5,
    'ukrayinski_zemli_v_rechi_pospolytij_drughoyi_polovyny_khvi_st': 6, 'u_skladi_rechi_pospolitoyi_v_xvii_st': 7,
    'vizvolna_vijna_ukrayinskogo_narodu_xvii_st': 8, 'kozacka_ukrayina_kincja_50kh_80kh_rr_khvii_st': 9,
    'ukrayinski_zemli_kincja_khvii_pershoyi_polovyny_khviii_st': 10, 'ukrayinski_zemli_drughoyi_polovyny_khviii_st': 11,
    'ukrayinski_zemli_v_rosijskij_imperiyi_kincja_khviii_pershoyi_polovyny_khikh_st': 12,
    'ukrayinski_zemli_v_avstrijskij_imperiyi_kincja_khviii_pershoyi_polovyny_khikh_st': 13,
    'kultura_ukrayini_xviii_xix_st': 14, 'ukrayinski_zemli_v_rosijskij_imperiyi_drughoyi_polovyny_khikh_st': 15,
    'ukrayinski_zemli_v_avstroughorshhyni_drughoyi_polovyny_khikh_st': 16,
    'kultura_ukrayiny_drughoyi_polovyny_khikh_pochatku_khkh_st': 17,
    'ukrayinski_zemli_v_rosijskij_imperiyi_19001914_rr': 18, 'ukrayinski_zemli_v_avstroughorshhyni_19001914_rr': 19,
    'ukrayina_v_roki_pershoyi_svitovoyi_vijni': 20, 'pochatok_ukrayinskoyi_revolyuciyi': 21, 'period_ghetmanatu': 22,
    'dyrektorija_unr': 22, 'vstanovlennja_komunistychnogho_rezhymu_v_ukrayini': 23,
    'utverdzhennja_bilshovyckogho_rezhymu_v_ukrayini': 24, 'zahidnoukrayinski_zemli_v_mizhvoyennij_period': 25,
    'pochatok_drughoyi_svitovoyi_vijny_1939_1941': 26, 'rukh_oporu_1941_1943': 26,
    'voyenni_diyi_na_terenakh_ukrayiny_1943_1945': 26, 'ukrayina_v_pershi_povoyenni_roki': 27,
    'ukrayina_v_umovah_destalinizaciyi': 28, 'ukrayina_v_period_zagostrennya_krizi_radyanskoyi_sistemi': 29,
    'vidnovlennya_nezalezhnosti_ukrayini': 30, 'stanovlennya_ukrayini_yak_nezalezhnoyi_derzhavi': 31,
    'tvorennya_novoyi_ukrayini': 32,
    # Culture IX – first half XVI ст. spans programme topics 3–5; resolved per task in tools/zno_topics.json.
    'ukrayinska_kultura_ix_pershoyi_polovyny_xvi_st': None,
}
VISUAL = {'arkhitektura_fortyfikacijnykh_sporud_v_ukrayini', 'arkhitektura_kultovykh_sporud_v_ukrayini',
          'dijachi_kultury_osvity_i_nauky', 'ghromadskopolitychni_ta_vijskovi_dijachi', 'ikony_obrazotvorche_mystectvo',
          'khudozhni_roboty_obrazotvorche_mystectvo', 'miniatjury_ghravjury_portrety', 'pamjatky_starodavnoyi_istoriyi_ukrayiny',
          'skulptura_pamjatnyky', 'svitska_arkhitektura_mistobuduvannja'}
LETTERS = 'abcde'
FIX = {}  # zid -> corrected answer for keys that are wrong on zno.osvita.ua (see zno_overrides.json)


def text(fragment):
    """Readable plain text from a small HTML fragment; keeps list numbering and line breaks."""
    s = re.sub(r'<(style|xml|script)\b.*?</\1>', '', fragment, flags=re.S | re.I)
    s = re.sub(r'<img\b[^>]*>', '', s, flags=re.I)
    ols = []

    def ol(m):
        items = re.findall(r'<li\b[^>]*>(.*?)</li>', m.group(1), re.S | re.I)
        return '\n' + '\n'.join('%d) %s' % (i + 1, it) for i, it in enumerate(items)) + '\n'
    s = re.sub(r'<ol\b[^>]*>(.*?)</ol>', ol, s, flags=re.S | re.I)
    s = re.sub(r'<li\b[^>]*>', '\n• ', s, flags=re.I)
    s = re.sub(r'</t[dh]>\s*<t[dh]\b[^>]*>', ' | ', s, flags=re.I)
    s = re.sub(r'<br\s*/?>|</p>|</div>|</li>|</tr>|<p\b[^>]*>|<div\b[^>]*>', '\n', s, flags=re.I)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ').replace('​', '')
    lines = [re.sub(r'[ \t]+', ' ', l).strip() for l in s.split('\n')]
    out = []
    for l in lines:
        if l or (out and out[-1]):
            out.append(l)
    return '\n'.join(out).strip()


def imgs(fragment):
    res = []
    for src in re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', fragment, re.I):
        if src.startswith('/'):
            src = 'https://zno.osvita.ua' + src
        res.append(src)
    return res


def answers(block):
    """[(marker, text, [images])] for one answers block."""
    items = re.findall(r'<div class="answer"><span class="marker">([^<]*)</span>(.*?)</div>(?=\s*(?:<div class="answer">|<!--|</div>|$))',
                       block, re.S)
    return [(m.strip(), text(t), imgs(t)) for m, t in items]


def label(title):
    m = re.match(r'(ЗНО|НМТ) онлайн (\d{4}) року з історії України – (.+?) – сайт', title)
    kind, year, session = m.groups()
    session = session.replace('демоваріант', 'демонстраційний варіант')
    return '%s-%s, %s' % (kind, year, session), int(year)


def main():
    FIX.update(json.load(open(os.path.join(ROOT, 'tools', 'zno_overrides.json'), encoding='utf-8')).get('answerFix', {}))
    topics_of = defaultdict(set)
    for p in glob.glob(os.path.join(SRC, 'tag-*.html')):
        slug = os.path.basename(p)[4:-5]
        for i in re.findall(r'name="q\[id\]"[^>]*value="(\d+)"', open(p, encoding='utf-8').read()):
            topics_of[i].add(slug)
    bank, problems = [], []
    for p in sorted(glob.glob(os.path.join(SRC, 't[0-9]*.html'))):
        h = open(p, encoding='utf-8').read()
        test = int(os.path.basename(p)[1:-5])
        src, year = label(html.unescape(re.search(r'<title>(.*?)</title>', h, re.S).group(1)))
        for f in re.findall(r'<form class="q-test".*?</form>', h, re.S):
            g = lambda n: re.search(r'name="q\[%s\]"[^>]*value="(\d+)"' % n, f).group(1)
            zid, tip, num = g('id'), g('tip'), int(g('out_order'))
            qm = re.search(r'<div class="question">(.*?)</div>\s*<div class="clear">', f, re.S)
            res = re.search(r'name="result" value="([^"]*)"', f).group(1)
            blocks = re.findall(r'<div class="answers[^"]*"[^>]*>(.*?)</div>\s*(?=<div class="answers|<div class="clear)', f, re.S)
            item = {'zid': int(zid), 'test': test, 'source': src, 'year': year, 'number': num,
                    'prompt': text(qm.group(1)) if qm else '', 'images': imgs(qm.group(1)) if qm else [],
                    'slugs': sorted(topics_of.get(zid, ()))}
            try:
                if tip == '1':
                    a = answers(blocks[0])
                    item.update(type='single', options=[x[1] for x in a], optionImages=[x[2] for x in a],
                                answer=LETTERS.index(res))
                elif tip == '7':
                    a = answers(blocks[0])
                    item.update(type='multi', options=[x[1] for x in a], optionImages=[x[2] for x in a],
                                answer=sorted(int(x) - 1 for x in res.split(';')))
                elif tip == '5' and zid in FIX:
                    a = answers(blocks[0])
                    item.update(type='order', options=[x[1] for x in a], optionImages=[x[2] for x in a],
                                answer=FIX[zid]['answer'], keyFixed=FIX[zid]['why'])
                elif tip == '5':
                    a = answers(blocks[0])
                    pairs = dict(x.split('|') if '|' in x else (x[0], x[1:]) for x in res.split(';'))
                    item.update(type='order', options=[x[1] for x in a], optionImages=[x[2] for x in a],
                                answer=[LETTERS.index(pairs[str(k)]) for k in range(1, len(a) + 1)])
                elif tip == '4':
                    left, right = answers(blocks[0]), answers(blocks[1])
                    pairs = dict((x[0], x[1:]) for x in res.split(';'))
                    item.update(type='match', left=[x[1] for x in left], leftImages=[x[2] for x in left],
                                options=[x[1] for x in right], optionImages=[x[2] for x in right],
                                answer=[LETTERS.index(pairs[str(k)]) for k in range(1, len(left) + 1)])
                else:
                    raise ValueError('tip ' + tip)
            except Exception as e:  # noqa: BLE001 - report and keep going
                problems.append((src, num, zid, repr(e)))
                continue
            bank.append(item)
    seen, uniq = set(), []
    for it in bank:  # the same task may be reused in several tests; keep the first (newest file order is not guaranteed)
        if it['zid'] in seen:
            continue
        seen.add(it['zid'])
        uniq.append(it)
    json.dump(uniq, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    c = Counter(it['type'] for it in uniq)
    print(len(uniq), 'tasks', dict(c), '| problems', len(problems))
    for pr in problems[:20]:
        print('  ', pr)


if __name__ == '__main__':
    main()
