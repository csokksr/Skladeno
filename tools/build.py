"""Assemble src/ into the site.

  python -I tools/build.py        -> dist/skladeno-nmt.html (one self-contained offline file)
  python -I tools/build.py --web  -> dist/web/ (claude.ai artifact: index.html + files/ + offline parts)
"""
import base64, glob, hashlib, json, os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'src')
WEB = '--web' in sys.argv


# Official texts typed on the source site sometimes mix look-alike letters of the two alphabets in one word («нa», «Нow», «ХVІІ»).
# A word whose letters can be unified in only one direction is repaired; a tie stays as it is. Formulas (⟦…⟧) are never touched.
_C2L = dict(zip('АВЕКМНОРСТХІаеорсхуі', 'ABEKMHOPCTXIaeopcxyi'))
_L2C = {v: k for k, v in _C2L.items()}
_WORD = re.compile(r"[A-Za-z\u0400-\u04ff]+(?:['’ʼ][A-Za-z\u0400-\u04ff]+)*")
_TEXT_FIELDS = ('prompt', 'passage', 'options', 'left', 'right', 'rows')


def _scripts(w):
    lat = [c for c in w if c.isascii() and c.isalpha()]
    return lat, [c for c in w if '\u0400' <= c <= '\u04ff']


_ROMAN = re.compile(r'(?=[IVXLCDM])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})')


def _fix_word(w, prefer='cyr'):
    lat, cyr = _scripts(w)
    if not lat or not cyr:
        return w
    to_cyr, to_lat = all(c in _L2C for c in lat), all(c in _C2L for c in cyr)
    as_lat = ''.join(_C2L.get(c, c) for c in w)
    if to_lat and _ROMAN.fullmatch(as_lat):  # Roman numerals are always Latin: XVII, not ХVІІ
        return as_lat
    if to_cyr and (not to_lat or len(cyr) > len(lat) or (len(cyr) == len(lat) and prefer == 'cyr')):
        return ''.join(_L2C.get(c, c) for c in w)
    if to_lat and (not to_cyr or len(lat) > len(cyr) or (len(cyr) == len(lat) and prefer == 'lat')):
        return as_lat
    return w


def fix_scripts(s, prefer='cyr'):
    parts = re.split(r'(⟦.*?⟧)', s.replace('\u00ad', ''), flags=re.S)
    for i in range(0, len(parts), 2):
        parts[i] = _WORD.sub(lambda m: _fix_word(m.group(0), prefer), parts[i])
    return ''.join(parts)


def fix_question_scripts(q):
    """Repair mixed-script words in the visible texts of one official task; returns True if anything changed. Ukrainian-language
    tasks that mix scripts inside their answer options are left alone: there the letters themselves can be the point."""
    if q.get('subject') == 'ukr' and any(
            all(_scripts(w)) for k in ('options', 'left', 'right', 'rows') for s in q.get(k) or []
            if isinstance(s, str) for w in _WORD.findall(re.sub(r'⟦.*?⟧', '', s, flags=re.S))):
        return False
    changed, prefer = False, 'lat' if q.get('subject') == 'eng' else 'cyr'
    for k in _TEXT_FIELDS:
        v = q.get(k)
        if isinstance(v, str):
            new = fix_scripts(v, prefer)
        elif isinstance(v, list):
            new = [fix_scripts(x, prefer) if isinstance(x, str) else x for x in v]
        else:
            continue
        if new != v:
            q[k], changed = new, True
    return changed


def load_data():
    data = json.load(open(f'{S}/data.json', encoding='utf-8'))
    # Content modules: each src/content/*.json is {"merge": {key: value}, "extend": {key: [items]}}
    for path in sorted(glob.glob(f'{S}/content/*.json')):
        mod = json.load(open(path, encoding='utf-8'))
        for k, v in mod.get('merge', {}).items():
            data[k] = v
        for k, v in mod.get('extend', {}).items():
            data.setdefault(k, []).extend(v)
        # Questions go into their subject topic; extra mock sets into the subject.
        topics = {t['id']: t for s in data['subjects'] for t in s['topics']}
        for q in mod.get('topicQuestions', []):
            topics[q['topicId']]['questions'].append(q)
        for tid, notes in mod.get('topicNotes', {}).items():
            topics[tid]['notes'].extend(notes)
        # Replacement explanations by question id; every id must exist.
        new = dict(mod.get('explanations', {}))
        if new:
            for q in [q for t in topics.values() for q in t['questions']] + data['questions'] + [q for k in ('advanced', 'auditQuestions', 'visualBank', 'controlBank') for q in data.get(k, [])]:
                if q['id'] in new:
                    q['explanation'] = new.pop(q['id'])
            assert not new, f'{path}: unknown ids {list(new)[:5]}'
        # Field-level fixes to existing questions: {"patch": {id: {field: value}}}; every id must exist.
        patch = dict(mod.get('patch', {}))
        if patch:
            for q in [q for t in topics.values() for q in t['questions']] + data['questions']:
                if q['id'] in patch:
                    q.update(patch.pop(q['id']))
            assert not patch, f'{path}: unknown ids {list(patch)[:5]}'
        # Text corrections everywhere a fact is quoted (facts, questions, explanations, cards): {"replace": [[old, new]]}.
        for old, new in mod.get('replace', []):
            text = json.dumps(data, ensure_ascii=False)
            old_j, new_j = json.dumps(old, ensure_ascii=False)[1:-1], json.dumps(new, ensure_ascii=False)[1:-1]
            assert old_j in text, f'{path}: text not found: {old}'
            data = json.loads(text.replace(old_j, new_j))
        # New history cards and cards withdrawn (with every list that mentions them): {"addFacts": {topic: [fact]}, "dropFacts": [id]}.
        for tid, new_facts in mod.get('addFacts', {}).items():
            next(t for t in data['topics'] if t['id'] == int(tid))['facts'].extend(new_facts)
        gone = set(mod.get('dropFacts', []))
        if gone:
            known = {f['id'] for t in data['topics'] for f in t['facts']}
            assert gone <= known, f'{path}: unknown fact ids {sorted(gone - known)[:5]}'
            def prune_facts(v):
                if isinstance(v, list):
                    return [prune_facts(x) for x in v if not (isinstance(x, str) and x in gone) and not (isinstance(x, dict) and x.get('id') in gone)]
                if isinstance(v, dict):
                    return {k: prune_facts(x) for k, x in v.items()}
                return v
            data = prune_facts(data)
        # Field-level fixes to history facts: {"factPatch": {factId: {field: value}}}; every id must exist.
        fpatch = dict(mod.get('factPatch', {}))
        for f in [f for t in data['topics'] for f in t['facts']]:
            if f['id'] in fpatch:
                f.update(fpatch.pop(f['id']))
        assert not fpatch, f'{path}: unknown fact ids {list(fpatch)[:5]}'
        # Questions withdrawn entirely, together with every id list that mentions them: {"drop": [id]}.
        drop = set(mod.get('drop', []))
        if drop:
            assert drop <= {q['id'] for q in data['questions']}, f'{path}: unknown drop ids'
            def prune(v):
                if isinstance(v, list):
                    return [prune(x) for x in v if not (isinstance(x, str) and x in drop) and not (isinstance(x, dict) and x.get('id') in drop)]
                if isinstance(v, dict):
                    return {k: prune(x) for k, x in v.items()}
                return v
            data = prune(data)
        for sid, sets in mod.get('mockSets', {}).items():
            next(s for s in data['subjects'] if s['id'] == sid).setdefault('mockSets', []).extend(sets)
    # The programme's «знає» lists per history topic (transcribed in sources/program/hist.md), shown on topic pages.
    prog_path = os.path.join(ROOT, 'sources', 'program', 'hist.md')
    if os.path.exists(prog_path):
        prog, topic = {}, None
        for line in open(prog_path, encoding='utf-8'):
            m = re.match(r'## (\d+)\. (.*)', line)
            if m:
                topic = prog.setdefault(m.group(1), {'title': m.group(2).strip()})
                continue
            m = re.match(r'([DTPCG]|Зміст): (.*)', line)
            if m and topic is not None:
                items = [x.strip(' .') for x in m.group(2).split(';') if x.strip(' .')]
                topic[m.group(1)] = items if m.group(1) != 'Зміст' else m.group(2).strip()
        data['historyProgramme'] = prog
    # Real ZNO/НМТ history tasks (tools/zno_bank.py) replace the generated history bank; every id list that named
    # a generated task is pruned, and each topic lists its real tasks.
    bank_path = f'{S}/history-bank.json'
    if os.path.exists(bank_path):
        bank = json.load(open(bank_path, encoding='utf-8'))
        print('history tasks with repaired letters:', sum(fix_question_scripts(q) for q in bank['questions']))
        old = {q['id'] for q in data['questions']}
        # «L» cards were phrases lifted from generated tasks (answers, «Послідовність: …»), not facts of the programme.
        lifted = {f['id'] for t in data['topics'] for f in t['facts'] if f['kind'] == 'L'}
        for t in data['topics']:
            t['facts'] = [f for f in t['facts'] if f['id'] not in lifted]
        old |= lifted
        # One card per name within a topic: the analytical extras repeated core cards («Голодомор», «Коновалець» …).
        same = {}
        for t in data['topics']:
            seen, keep = {}, []
            for f in sorted(t['facts'], key=lambda f: f['id'].startswith('enrich-')):
                k = re.sub(r'\W+', '', f['label'].lower())
                if k in seen:
                    same[f['id']] = seen[k]
                else:
                    seen[k] = f['id']
                    keep.append(f)
            t['facts'] = [f for f in t['facts'] if f in keep]
        old |= set(same)
        # Generated history drills (the «understand» extras and audit/portrait/chronology sets) are removed below, so every
        # list that names them must be pruned together with the other generated history ids.
        old |= {q['id'] for k in ('advanced', 'auditQuestions') for q in data.get(k, []) if q.get('subject') == 'hist'}
        valid = {f['id'] for t in data['topics'] for f in t['facts']}
        for q in bank['questions']:
            q['facts'] = [f for f in dict.fromkeys(same.get(f, f) for f in q['facts']) if f in valid]
        def prune(v):
            if isinstance(v, list):
                return [prune(x) for x in v if not (isinstance(x, str) and x in old) and not (isinstance(x, dict) and x.get('id') in old)]
            if isinstance(v, dict):
                return {k: prune(x) for k, x in v.items()}
            return v
        rest = prune({k: v for k, v in data.items() if k != 'questions'})
        data = {**rest, 'questions': bank['questions']}
        data['assets'].update(bank['assets'])
        for t in data['topics']:
            t['questions'] = [q['id'] for q in bank['questions'] if q['topic'] == t['id']]
        # Self-check items and quality rows that only pointed at generated tasks would show «0/0» and start empty runs.
        for g in data.get('historyGuides', []):
            g['checklist'] = [c for c in g.get('checklist', []) if c['questionIds']]
        # No generated history tasks anywhere: the «understand» extras and audit/portrait drills go, and the 8 history
        # items of the diagnostic become official single-choice tasks spread over the course (ЗНО ≤ 2021, so they never
        # repeat a НМТ mock), text-only because the diagnostic shows no images.
        for p in data.get('portraitAtlas', {}).get('items', []):
            p.pop('questionId', None)  # the generated recognition task is gone; the card still shows the portrait
        data['advanced'] = [q for q in data.get('advanced', []) if q.get('subject') != 'hist']
        data['auditQuestions'] = [q for q in data.get('auditQuestions', []) if q.get('subject') != 'hist']
        pick = []
        for topic in (2, 4, 7, 8, 11, 15, 21, 26):
            pool = [q for q in bank['questions'] if q['topic'] == topic and q['type'] == 'single' and q['year'] <= 2021
                    and not q.get('images') and not q.get('optionImages') and len(q['prompt']) <= 220]
            q = max(pool, key=lambda q: (q['year'], -q['number']))
            pick.append({'id': 'control-' + q['id'], 'subject': 'hist', 'topicId': 'hist-%d' % topic, 'type': 'single',
                         'prompt': q['prompt'], 'options': q['options'], 'answer': q['correct'],
                         'explanation': 'Офіційне завдання УЦОЯО (%s). Правильна відповідь: %s.' % (q['source'], q['options'][q['correct']].rstrip('.'))})
        data['controlBank'] = [q for q in data.get('controlBank', []) if q.get('subject') != 'hist'] + pick
        by_topic = {'hist-%d' % t['id']: t['questions'] for t in data['topics']}
        for t in data.get('quality', {}).get('topics', []):
            if t['id'] in by_topic:
                t['questions'] = by_topic[t['id']]
    return refresh_quality(official_subjects(data))


# Drills that belong to one lesson (syllabus gaps, tool pages, audits) stay; the generated per-topic banks go.
KEEP_DRILLS = re.compile(r'^(syllabus|audit|project|skill-gap)-|^(number-tools|powers-roots|real-fluency|ratios-models|algebra-tools|log-tools|trig-tools)-')


def official_subjects(data):
    """Real ZNO/НМТ tasks (tools/zno2_bank.py) replace the generated practice bank of every subject that has them: the topic
    banks, 'understand' extras, visual and control items, mock sets. Lesson-bound drills stay. Every id list that named a removed
    task is pruned; maps and quality rows are re-pointed to the official tasks of the same topic."""
    path = f'{S}/zno2-bank.json'
    if not os.path.exists(path):
        return data
    bank = json.load(open(path, encoding='utf-8'))
    # Hand corrections of texts that the importer could not read (src/zno2-fixes.json: {id: {field: value}}); every id must exist.
    fix_path = f'{S}/zno2-fixes.json'
    if os.path.exists(fix_path):
        fixes, by_id = json.load(open(fix_path, encoding='utf-8')), {q['id']: q for q in bank['questions']}
        assert set(fixes) <= set(by_id), 'zno2-fixes.json: unknown ids %s' % sorted(set(fixes) - set(by_id))[:5]
        for qid, fields in fixes.items():
            by_id[qid].update(fields)
    print('official tasks with repaired letters:', sum(fix_question_scripts(q) for q in bank['questions']))
    by_sub = {}
    for q in bank['questions']:
        by_sub.setdefault(q['subject'], []).append(q)
    old = set()
    for s in data['subjects']:
        if s['id'] not in by_sub:
            continue
        for t in s['topics']:
            keep = [q for q in t['questions'] if KEEP_DRILLS.match(q['id'])]
            old |= {q['id'] for q in t['questions']} - {q['id'] for q in keep}
            t['questions'] = keep + [q for q in by_sub[s['id']] if q['topicId'] == t['id']]
        s.pop('mockSets', None)
    for k in ('advanced', 'visualBank', 'controlBank'):
        gone = [q for q in data.get(k, []) if q.get('subject') in by_sub]
        old |= {q['id'] for q in gone}
        data[k] = [q for q in data.get(k, []) if q.get('subject') not in by_sub]
    if 'ukr' in by_sub:
        old |= {i for ids in data.get('ukrainianFiveOptionSets', []) for i in ids}
        data['ukrainianFiveOptionSets'] = []

    def prune(v):
        if isinstance(v, list):
            return [prune(x) for x in v if not (isinstance(x, str) and x in old) and not (isinstance(x, dict) and x.get('id') in old)]
        if isinstance(v, dict):
            return {k: prune(x) for k, x in v.items()}
        return v
    # the new tasks must not pass through prune (they hold images and long texts); detach, prune, re-attach
    fresh = {t['id']: [q for q in t['questions'] if q['id'].startswith(('zm-', 'ze-', 'zu-'))] for s in data['subjects'] for t in s['topics']}
    for s in data['subjects']:
        for t in s['topics']:
            t['questions'] = [q for q in t['questions'] if q['id'] not in {x['id'] for x in fresh[t['id']]}]
    data = prune(data)
    for s in data['subjects']:
        for t in s['topics']:
            t['questions'] = t['questions'] + fresh[t['id']]
    data['assets'].update(bank['assets'])
    # Own written analyses of official tasks: src/zno2-explanations.json {id: text}.
    ex_path = f'{S}/zno2-explanations.json'
    if os.path.exists(ex_path):
        notes = json.load(open(ex_path, encoding='utf-8'))
        known = {q['id']: q for s in data['subjects'] for t in s['topics'] for q in t['questions']}
        assert set(notes) <= set(known), 'unknown explanation ids: %s' % sorted(set(notes) - set(known))[:5]
        for qid, text in notes.items():
            known[qid]['explanation'] = text
    # Pointers: topic quality rows, skill items and programme-map blocks list official tasks of their topic.
    pool = {}
    for q in bank['questions']:
        pool.setdefault(q['topicId'], []).append(q['id'])
    def pick(ids, n):
        step = max(1, len(ids) // n)
        return ids[::step][:n]
    for t in data.get('quality', {}).get('topics', []):
        if t['id'] in pool:
            t['questions'] = pool[t['id']]
    for i in data.get('quality', {}).get('items', []):
        if i.get('subject') in by_sub and not i.get('questionIds') and i.get('topicId') in pool:
            i['questionIds'] = pick(pool[i['topicId']], 6)
    maps = data.get('officialMaps', {})
    for sid in by_sub:
        for b in maps.get(sid, {}).get('blocks', []):
            tid = b['lesson'].split('/')[-1]
            if tid in pool:
                b['questionIds'] = pick(pool[tid], 40)
    # Diagnostic: eight official single-choice tasks per subject spread over the topics, text only.
    extra = []
    for sid, qs in by_sub.items():
        tids = [t['id'] for s in data['subjects'] if s['id'] == sid for t in s['topics']]
        chosen = []
        for tid in tids:
            cand = [q for q in qs if q['topicId'] == tid and q['type'] == 'single' and q['year'] >= 2019 and not q.get('images')
                    and not q.get('optionImages') and len(q['prompt']) <= 200 and len(q['options']) in (4, 5)]
            if cand:
                chosen.append(max(cand, key=lambda q: (q['year'], -q['number'])))
        step = max(1, len(chosen) // 8)
        for q in chosen[::step][:8]:
            extra.append({'id': 'control-' + q['id'], 'subject': sid, 'topicId': q['topicId'], 'type': 'single', 'prompt': q['prompt'],
                          'options': q['options'], 'answer': q['answer'],
                          'explanation': 'Офіційне завдання УЦОЯО (%s). Правильна відповідь: %s.' % (q['source'], q['options'][q['answer']].rstrip('.'))})
    data['controlBank'] = data.get('controlBank', []) + extra
    return data


def refresh_quality(data):
    """The «what is checked» page quotes the bank size and the groups of similar wordings: take them from the final data."""
    bank = data.get('quality', {}).get('bank')
    if bank is None:
        return data
    bank['total'] = (len(data['questions']) + sum(len(t['questions']) for s in data['subjects'] for t in s['topics'])
                     + sum(len(data.get(k, [])) for k in ('advanced', 'auditQuestions', 'visualBank', 'controlBank')))
    bank['families'] = [f for f in bank.get('families', []) if f]
    return data


EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf'}


def fill(x, files_dir=None):
    """Inline every blob, or (web) write it next to the page and point to it."""
    if isinstance(x, dict):
        return {k: fill(v, files_dir) for k, v in x.items()}
    if isinstance(x, list):
        return [fill(v, files_dir) for v in x]
    if isinstance(x, str) and x.startswith('@@blob:'):
        uri = open(f'{S}/blobs/{x[7:]}.txt', encoding='ascii').read()
        if files_dir is None:
            return uri
        mime = uri[5:uri.index(';')]
        name = f'{x[7:]}.{EXT[mime]}'
        open(os.path.join(files_dir, name), 'wb').write(base64.b64decode(uri[uri.index(',') + 1:]))
        return 'files/' + name
    return x


def app_js(extra_dirs, offline_mb=100):
    app = open(f'{S}/app.js', encoding='utf-8').read()
    # Feature modules load after the base app and wrap its functions, like the layers inside app.js.
    # They go before the final first render so the first screen already uses them.
    boot = 'save();render();'
    assert app.rstrip().endswith(boot)
    app = app.rstrip()[:-len(boot)]
    for d in extra_dirs:
        for path in sorted(glob.glob(f'{S}/{d}/*.js')):
            app += '\n' + open(path, encoding='utf-8').read()
    app += '\n' + boot + '\n'
    app = app.replace('@@OFFLINE_MB@@', str(offline_mb))  # size quoted by the «offline version» page
    assert '</script' not in app.lower()
    return app


def page(data, modules, offline_mb=100):
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    shell = open(f'{S}/shell.html', encoding='utf-8').read()
    css = '\n'.join(open(p, encoding='utf-8').read() for p in sorted(glob.glob(f'{S}/theme/*.css')))
    assert '</style' not in css.lower()
    return shell.replace('@@CSS@@', css, 1).replace('@@DATA@@', blob, 1).replace('@@APP@@', app_js(modules, offline_mb), 1)


def build_offline():
    html = page(fill(load_data()), ['modules'])
    out = os.path.join(ROOT, 'dist', 'skladeno-nmt.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8', newline='').write(html)
    print(out, round(len(html.encode()) / 1e6, 1), 'MB')
    return html.encode()


def build_web(offline_bytes):
    out = os.path.join(ROOT, 'dist', 'web')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(os.path.join(out, 'files'), exist_ok=True)
    os.makedirs(os.path.join(out, 'offline'), exist_ok=True)
    data = load_data()
    # An artifact version holds at most 511 files, so the ~1100 images of official history tasks travel as one JSON
    # pack per topic (files/zno-t<N>.json: key -> data URI); the page loads a pack when a task needs it.
    topic_of = {}
    every = [(q, 't%d' % q['topic']) for q in data['questions']] + [(q, 's-' + t['id']) for s in data['subjects'] for t in s['topics'] for q in t['questions']]
    for q, name in every:
        for k in q.get('images', []) + [x for x in q.get('optionImages') or [] if x] + [x for x in q.get('rowImages') or [] if x]:
            topic_of.setdefault(k, name)
    packs = {}
    for k, name in topic_of.items():
        packs.setdefault(name, {})[k] = fill(data['assets'][k])
        data['assets'][k] = '@zno:' + name
    for name, pack in packs.items():
        json.dump(pack, open(os.path.join(out, 'files', 'zno-%s.json' % name), 'w', encoding='ascii'), separators=(',', ':'))
    html = page(fill(data, os.path.join(out, 'files')), ['modules', 'web'], round(len(offline_bytes) / 1e6))
    # The artifact viewer wraps the page in its own document: keep only title, style and body content.
    head, body = html.split('</head>', 1)
    style = head[head.index('<style>'):]
    body = body.strip()
    assert body.startswith('<body>') and body.endswith('</body></html>')
    body = body[len('<body>'):-len('</body></html>')]
    meta = '<title>Складено</title><meta name="description" content="Підготовка до НМТ з української мови, математики, історії України й англійської: конспекти, практика, пробні тести, прогноз бала 100–200 і план до дати іспиту.">'
    web = meta + style + body
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8', newline='').write(web)
    # The offline single file, in verified parts the in-app downloader reassembles (served as .txt bytes).
    # Parts end on a UTF-8 character boundary and stay under 16 MB: the artifact host rejects larger or non-UTF-8 .txt files.
    size, chunks, i = 15 * 1024 * 1024, [], 0
    while i < len(offline_bytes):
        j = min(i + size, len(offline_bytes))
        while j < len(offline_bytes) and 0x80 <= offline_bytes[j] < 0xC0:
            j -= 1
        chunks.append(offline_bytes[i:j])
        i = j
    assert len(chunks) <= 12 and len(offline_bytes) <= 200 * 1024 * 1024, 'offline file outgrew the limits in offlineValidate (src/app.js)'
    parts = []
    for chunk in chunks:
        sha = hashlib.sha256(chunk).hexdigest()
        open(os.path.join(out, 'offline', sha + '.txt'), 'wb').write(chunk)
        parts.append({'path': f'offline/{sha}.txt', 'sha256': sha, 'bytes': len(chunk)})
    manifest = {'schema': 1, 'filename': 'skladeno-nmt.html', 'bytes': len(offline_bytes),
                'sha256': hashlib.sha256(offline_bytes).hexdigest(), 'parts': parts}
    json.dump(manifest, open(os.path.join(out, 'offline-manifest.json'), 'w'), indent=1)
    files = sum(os.path.getsize(p) for p in glob.glob(os.path.join(out, 'files', '*')))
    print(os.path.join(out, 'index.html'), round(len(web.encode()) / 1e6, 1), 'MB;',
          len(os.listdir(os.path.join(out, 'files'))), 'files', round(files / 1e6, 1), 'MB;', len(parts), 'offline parts')


offline = build_offline()
if WEB:
    build_web(offline)
