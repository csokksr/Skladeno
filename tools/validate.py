"""Structural checks for every question in the built data (ids, keys, options, explanations)."""
import glob, json, os, re, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(_root, 'dist', 'skladeno-nmt.html'), encoding='utf-8').read()
o = '<script id="data" type="application/json">'
a = t.index(o) + len(o)
d = json.loads(t[a:t.index('</script><script>', a)])
qs = [('hist', q['topic'], {**q, 'answer': q['correct'], 'left': q.get('rows'), 'right': q.get('options')}) for q in d['questions']]
for s in d['subjects']:
    for tp in s['topics']:
        qs += [(s['id'], tp['id'], q) for q in tp['questions']]
for k in ('advanced', 'auditQuestions', 'visualBank', 'controlBank'):
    qs += [(q.get('subject'), q.get('topicId'), q) for q in d.get(k, [])]
problems = collections.defaultdict(list)
_leftover = re.compile(r'\\\)|\\\(|</?latex|</?nobr|&lt;|&gt;|&nbsp;|[\x00-\x08\x0b-\x1f\u00ad]')
_word = re.compile(r"[A-Za-z\u0400-\u04ff]+(?:['’ʼ][A-Za-z\u0400-\u04ff]+)*")
_mixed_ok = {'zu-21254', 'zu-15199'}
ids = collections.Counter(q['id'] for _, _, q in qs)
for sid, tid, q in qs:
    p = lambda m: problems[m].append(q['id'])
    if ids[q['id']] > 1: p('duplicate id')
    typ, ans, opts = q.get('type'), q.get('answer'), q.get('options') or []
    # Official ZNO/НМТ tasks cite their source instead of a written analysis.
    if not str(q.get('explanation', '')).strip() and not q.get('source'): p('no explanation')
    for k in (q.get('images') or []) + [x for x in q.get('optionImages') or [] if x] + [x for x in q.get('rowImages') or [] if x]:
        if k not in d['assets']: p('missing image asset')
    if q.get('optionImages') and len(q['optionImages']) != len(opts): p('optionImages length')
    if not str(q.get('prompt', '')).strip(): p('no prompt')
    # Text the importer failed to clean, and words that mix look-alike letters of both alphabets (build.py repairs the
    # unambiguous ones; zu-21254 and zu-15199 are spelling tasks where the letters themselves are the content).
    for k in ('prompt', 'passage', 'options', 'left', 'right', 'rows'):
        v = q.get(k)
        for s in [v] if isinstance(v, str) else v if isinstance(v, list) else []:
            if not isinstance(s, str): continue
            if _leftover.search(s): p('unconverted markup in text')
            if q['id'] not in _mixed_ok and any(re.search('[A-Za-z]', w) and re.search('[\u0400-\u04ff]', w) for w in _word.findall(re.sub('⟦.*?⟧', '', s, flags=re.S))): p('word mixes Latin and Cyrillic letters')
    if typ == 'single':
        if not isinstance(ans, int) or not 0 <= ans < len(opts): p('single: key out of range')
        if len(opts) < 3: p('single: fewer than 3 options')
        if len(set(zip(map(str, opts), q.get('optionImages') or [None] * len(opts)))) != len(opts): p('single: repeated option')
    elif typ == 'multi':
        if not isinstance(ans, list) or len(set(ans)) != len(ans) or any(not 0 <= x < len(opts) for x in ans): p('multi: bad key')
    elif typ == 'order':
        if sorted(ans or []) != list(range(len(ans or []))) or len(ans or []) < 3: p('order: key not a permutation')
        elif opts and len(ans) != len(opts): p('order: key length differs from options')
    elif typ == 'match':
        right = q.get('right') or opts
        left = q.get('left') or []
        if not isinstance(ans, list) or len(ans) != len(left) or len(set(ans)) != len(ans) or any(not 0 <= x < len(right) for x in ans): p('match: bad key')
    elif typ == 'numeric':
        try: float(str(ans).replace(',', '.'))
        except ValueError: p('numeric: key not a number')
    else: p('unknown type ' + str(typ))
for s in d['subjects']:
    for i, st in enumerate(s.get('mockSets', [])):
        if len(st) != 32 or len(set(st)) != 32: problems['eng mock set size'].append(i + 1)
for i, st in enumerate(d.get('ukrainianFiveOptionSets') or []):
    if len(st) != 15 or len(set(st)) != 15: problems['ukr five set size'].append(i + 1)
# Every list of task ids anywhere in the data (guides, checklists, chronology, audit/syllabus units, quality rows,
# maps, mock sets) must name tasks that exist, otherwise a practice button starts an empty or broken session.
_ids = set(ids)
_id_keys = ('questionIds', 'extraQuestionIds', 'questions')
def _refs(v, path):
    if isinstance(v, dict):
        for k, x in v.items():
            if path == '' and k in ('questions', 'assets', 'officialPapers', 'officialSolutions'): continue
            if k == 'questionId' and isinstance(x, str):
                if x not in _ids: problems['dangling task id in ' + path + '/' + k].append(x)
            elif k in _id_keys and isinstance(x, list) and x and all(isinstance(y, str) for y in x):
                bad = [y for y in x if y not in _ids]
                if bad: problems['dangling task ids in ' + path + '/' + k].extend(bad)
            else:
                _refs(x, path + '/' + k)
    elif isinstance(v, list):
        for x in v: _refs(x, path + '[]')
_refs(d, '')
for s in d['subjects']:
    for i, st in enumerate(s.get('mockSets') or []):
        bad = [y for y in st if y not in _ids]
        if bad: problems['dangling task ids in mockSets'].extend(bad)
# Colour tokens: text, controls and field borders must stay readable in the light and the dark theme.
_css = open(os.path.join(_root, 'src', 'theme', '10-tokens.css'), encoding='utf-8').read()
_sets = [dict(re.findall(r'(--[\w-]+):(#[0-9a-fA-F]{6})\b', b)) for b in re.findall(r'--paper:#[0-9a-fA-F]{6}.*?color-scheme:(?:light|dark)', _css, re.S)]
def _lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
def _ratio(a, b):
    x, y = sorted((_lum(a), _lum(b)), reverse=True)
    return (x + .05) / (y + .05)
if len(_sets) != 3 or _sets[1] != _sets[2]:
    problems['colour tokens: expected light, dark (media) and dark (data-theme) sets, the two dark sets equal'].append(len(_sets))
else:
    for name, tokens in (('light', _sets[0]), ('dark', _sets[1])):
        pairs = [('--ink', '--paper', 4.5), ('--ink-2', '--paper', 4.5), ('--muted', '--paper', 4.5), ('--muted', '--sheet', 4.5), ('--link', '--paper', 4.5),
                 ('--pen-ink', '--pen', 4.5), ('--pen-ink', '--pen-hover', 4.5), ('--on-mark', '--mark', 4.5), ('--on-ok', '--ok', 4.5),
                 ('--mark', '--paper', 4.5), ('--ok', '--paper', 4.5), ('--warn', '--paper', 4.5), ('--line-2', '--paper', 3.0)]
        pairs += [('--on-subject', k, 3.0) for k in tokens if k.startswith('--s-')]  # 22 px, weight 600 in .p-subject-mark: large text
        for fg, bg, need in pairs:
            if fg not in tokens or bg not in tokens: problems['colour tokens: missing ' + fg + ' or ' + bg].append(name)
            elif _ratio(tokens[fg], tokens[bg]) < need: problems['low contrast'].append('%s %s on %s %.2f<%s' % (name, fg, bg, _ratio(tokens[fg], tokens[bg]), need))
# Every script module is described in the README, and every library link is a plain https URL listed once.
_readme = open(os.path.join(_root, 'README.md'), encoding='utf-8').read()
for f in sorted(glob.glob(os.path.join(_root, 'src', 'modules', '*.js'))):
    if os.path.basename(f) not in _readme: problems['module missing from README'].append(os.path.basename(f))
for s in d['subjects']:
    urls = [x.get('url', '') for x in s.get('sources') or []]
    for u in urls:
        if not u.startswith('https://'): problems['source link is not https'].append(u[:60])
    for u in set(urls):
        if urls.count(u) > 1: problems['source link listed twice'].append(u[:60])
# Secrets and risky sinks in the code we write (the data blobs are base64 and would give false hits).
import glob, os
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_secret = re.compile(r'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|(?:api[_-]?key|secret|token|passwd|password)[\x22\x27]?\s*[:=]\s*[\x22\x27][^\x22\x27]{8,}[\x22\x27]', re.I)
_sink = re.compile(r'(?<![\w$.])(?:eval\(|new Function\(|debugger\b|console\.(?:log|debug)\()|document\.write\(|javascript:')
_files = [os.path.join(_root, f) for f in ('src/app.js', 'src/shell.html', 'README.md', 'CLAUDE.md')]
_files += glob.glob(os.path.join(_root, 'src/content/*.json')) + glob.glob(os.path.join(_root, 'tools/*.json'))
_files += glob.glob(os.path.join(_root, 'src/modules/*.js')) + glob.glob(os.path.join(_root, 'src/web/*.js')) + glob.glob(os.path.join(_root, 'tools/*.py')) + glob.glob(os.path.join(_root, '.claude/**/*.*'), recursive=True)
for f in _files:
    t = open(f, encoding='utf-8').read()
    if f.endswith('validate.py'): continue
    for m in _secret.finditer(t): problems['secret-like text in ' + os.path.relpath(f, _root)].append(m.group(0)[:30])
    if f.endswith('.js') or f.endswith('.html'):
        for m in _sink.finditer(t): problems['risky call in ' + os.path.relpath(f, _root)].append(m.group(0))
print('questions checked:', len(qs))
# Official tasks cite their source instead of a written analysis, so a missing explanation is not an error; show the coverage.
_bare = collections.Counter(s for s, _, q in qs if not str(q.get('explanation', '')).strip())
print('without explanation (source only):', dict(_bare) if _bare else 0)
for k, v in problems.items(): print(f'{k}: {len(v)}  e.g. {v[:8]}')
print('OK' if not problems else 'PROBLEMS FOUND')
sys.exit(1 if problems else 0)
