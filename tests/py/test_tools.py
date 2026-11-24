"""Тести Python-скриптів tools/. Лише стандартна бібліотека. Запуск: python -m unittest discover -s tests/py -v
build.py виконує збірку при імпорті, тому його чисті функції беруться з вихідного коду через ast без запуску решти."""
import ast, http.server, importlib, importlib.util, json, os, subprocess, sys, threading, time, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOLS = os.path.join(ROOT, 'tools')
sys.path.insert(0, TOOLS)


def load_build_functions(names, consts):
    """Виконує лише вказані функції й сталі з tools/build.py."""
    tree = ast.parse(open(os.path.join(TOOLS, 'build.py'), encoding='utf-8').read())
    keep = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in names:
            keep.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in consts for t in node.targets):
            keep.append(node)
    ns = {}
    module = ast.Module(body=[ast.Import(names=[ast.alias(name='re'), ast.alias(name='json')])] + keep, type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), 'build.py', 'exec'), ns)
    return ns


B = load_build_functions({'_scripts', '_fix_word', 'fix_scripts', 'fix_question_scripts', 'sniff', 'twin_index'},
                         {'_C2L', '_L2C', '_WORD', '_TEXT_FIELDS', '_ROMAN'})


class TwinIndex(unittest.TestCase):
    def mk(self, qid, year, opts, ans, **kw):
        return {'id': qid, 'year': year, 'type': 'single', 'prompt': 'Яка столиця?', 'options': opts, 'answer': ans, **kw}

    def run_index(self, *qs, hist=()):
        data = {'questions': list(hist), 'subjects': [{'id': 'geo', 'topics': [{'questions': list(qs)}]}], 'assetAlias': {'b': 'a'}}
        return B['twin_index'](data)['twins']

    def test_same_task_in_other_year_is_a_twin_and_newest_is_kept(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0), self.mk('b', 2023, ['Київ', 'Львів'], 0))
        self.assertEqual(t, {'a': 'b'})

    def test_reshuffled_options_still_match_by_answer_text(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0), self.mk('b', 2023, ['Львів', 'Київ'], 1))
        self.assertEqual(t, {'a': 'b'})

    def test_different_correct_answer_is_not_a_twin(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0), self.mk('b', 2023, ['Київ', 'Львів'], 1))
        self.assertEqual(t, {})

    def test_verified_key_beats_newer_year(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0), self.mk('b', 2023, ['Київ', 'Львів'], 0, keyUnverified=True))
        self.assertEqual(t, {'b': 'a'})

    def test_other_picture_or_tasks_without_year_are_left(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0, images=['x']), self.mk('b', 2023, ['Київ', 'Львів'], 0, images=['y']),
                           self.mk('c', None, ['Київ', 'Львів'], 0), self.mk('d', None, ['Київ', 'Львів'], 0))
        self.assertEqual(t, {})

    def test_same_picture_under_alias_keys_is_a_twin(self):
        t = self.run_index(self.mk('a', 2019, ['Київ', 'Львів'], 0, images=['a']), self.mk('b', 2023, ['Київ', 'Львів'], 0, images=['b']))
        self.assertEqual(t, {'a': 'b'})

    def test_match_compares_pairs_and_history_uses_correct(self):
        m = lambda i, y, ans: {'id': i, 'year': y, 'type': 'match', 'prompt': 'p', 'rows': ['x', 'y'], 'options': ['1', '2'], 'correct': ans}
        self.assertEqual(self.run_index(hist=[m('h1', 2019, [0, 1]), m('h2', 2020, [0, 1])]), {'h1': 'h2'})
        self.assertEqual(self.run_index(hist=[m('h1', 2019, [0, 1]), m('h2', 2020, [1, 0])]), {})


class BuildScripts(unittest.TestCase):
    def test_mixed_word_becomes_cyrillic(self):
        self.assertEqual(B['fix_scripts']('нa каві'), 'на каві')  # латинська «a» у кириличному слові

    def test_english_prefers_latin(self):
        self.assertEqual(B['fix_scripts']('Нow are you', 'lat'), 'How are you')

    def test_roman_numerals_are_latin(self):
        self.assertEqual(B['fix_scripts']('ХVІІ століття'), 'XVII століття')

    def test_formulas_and_soft_hyphens(self):
        self.assertEqual(B['fix_scripts']('⟦нa⟧ м­ова'), '⟦нa⟧ мова')

    def test_pure_words_untouched(self):
        for s in ('Привіт, світе', 'Hello world', 'п’ять'):
            self.assertEqual(B['fix_scripts'](s), s)

    def test_idempotent(self):
        once = B['fix_scripts']('нa Нow ХVІІ')
        self.assertEqual(B['fix_scripts'](once), once)

    def test_question_fix_changes_fields(self):
        q = {'subject': 'hist', 'prompt': 'Яка дaта?', 'options': ['нa', 'так']}
        self.assertTrue(B['fix_question_scripts'](q))
        self.assertEqual(q['prompt'], 'Яка дата?')
        self.assertEqual(q['options'], ['на', 'так'])
        self.assertFalse(B['fix_question_scripts'](q))

    def test_ukrainian_letter_tasks_are_left(self):
        q = {'subject': 'ukr', 'prompt': 'Знайдіть слово', 'options': ['нa', 'так']}
        self.assertFalse(B['fix_question_scripts'](q))
        self.assertEqual(q['options'][0], 'нa')

    def test_sniff(self):
        S = B['sniff']
        self.assertEqual(S(bytes([255, 216, 255, 0])), 'image/jpeg')
        self.assertEqual(S(bytes([137, 80, 78, 71, 0])), 'image/png')
        self.assertEqual(S(b'RIFF\x00\x00\x00\x00WEBP'), 'image/webp')
        self.assertEqual(S(b'%PDF-1.7'), 'application/pdf')
        self.assertIsNone(S(b'GIF89a'))
        self.assertIsNone(S(b''))


class ZnoImport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = importlib.import_module('zno_import')

    def test_text_keeps_lists_and_breaks(self):
        t = self.m.text('<p>Перший</p><ol><li>а</li><li>б</li></ol><p>Другий&nbsp;рядок</p>')
        self.assertIn('1) а', t)
        self.assertIn('2) б', t)
        self.assertIn('Другий рядок', t)

    def test_text_drops_styles_images_and_tags(self):
        t = self.m.text('<style>p{color:red}</style><img src="x.png"><b>жирний</b> <i>курсив</i>')
        self.assertEqual(t, 'жирний курсив')

    def test_text_table_cells(self):
        self.assertIn('а | б', self.m.text('<tr><td>а</td><td>б</td></tr>'))

    def test_imgs_make_absolute_addresses(self):
        self.assertEqual(self.m.imgs('<img src="/img/a.png"><img class="x" src="https://h/b.png">'),
                         ['https://zno.osvita.ua/img/a.png', 'https://h/b.png'])

    def test_answers(self):
        block = '<div class="answer"><span class="marker">А</span>перша</div>\n<div class="answer"><span class="marker">Б</span>друга</div>'
        self.assertEqual([(a[0], a[1]) for a in self.m.answers(block)], [('А', 'перша'), ('Б', 'друга')])

    def test_label(self):
        self.assertEqual(self.m.label('ЗНО онлайн 2019 року з історії України – основна сесія – сайт ZNO.OSVITA.UA'), ('ЗНО-2019, основна сесія', 2019))
        self.assertEqual(self.m.label('НМТ онлайн 2024 року з історії України – демоваріант – сайт ZNO')[0], 'НМТ-2024, демонстраційний варіант')


class ZnoBank(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = importlib.import_module('zno_bank')

    def test_key(self):
        self.assertEqual(self.m.key('https://zno.osvita.ua/img/Test_12/pic-A.PNG'), 'zno-test-12-pic-a')

    def test_clean_removes_booklet_references(self):
        self.assertEqual(self.m.clean('Прочитайте текст та виконайте завдання 5–7 до нього.'), 'Прочитайте текст та виконайте завдання.')
        self.assertEqual(self.m.clean('Яка подія? (завдання 3–4)'), 'Яка подія?')

    def test_norm_unifies_apostrophes_and_case(self):
        self.assertEqual(self.m.norm("Пʼять ПЯТЬ п’ять п`ять"), "п'ять пять п'ять п'ять")

    def test_fact_patterns(self):
        rx = self.m.fact_patterns({'kind': 'P', 'label': 'Богдан Хмельницький'})
        self.assertTrue(rx.search('гетьман хмельницький очолив'))
        self.assertIsNone(self.m.fact_patterns({'kind': 'X', 'label': 'Щось'}))


class HookGuard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = importlib.import_module('hook_guard')

    def test_every_rule_has_advice_and_known_kind(self):
        for kind, path, advice in self.m.RULES:
            self.assertIn(kind, ('tree', 'file', 'pdf', 'glob'))
            self.assertTrue(path and advice)

    def test_norm_stays_in_root(self):
        self.assertTrue(self.m.norm('dist', 'x.html').startswith(os.path.normcase(os.path.abspath(ROOT))))


class CheckSchema(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = importlib.import_module('check_schema')
        cls.schema = json.load(open(cls.m.SCHEMA, encoding='utf-8'))

    def errs(self, doc):
        return self.m.validate(doc, self.schema, self.schema)

    def test_all_real_modules_pass(self):
        import glob
        self.assertEqual(self.m.check_files(sorted(glob.glob(os.path.join(ROOT, 'src', 'content', '*.json'))), self.schema), {})

    def test_good_documents(self):
        self.assertEqual(self.errs({}), [])
        self.assertEqual(self.errs({'drop': ['a'], 'replace': [['x', 'y']], 'explanations': {'a': 'текст'}}), [])

    def test_unknown_top_level_key(self):
        self.assertTrue(any('невідоме поле' in e for e in self.errs({'oops': 1})))

    def test_wrong_types(self):
        self.assertTrue(self.errs({'drop': 'a'}))
        self.assertTrue(self.errs({'replace': [['тільки одне']]}))
        self.assertTrue(self.errs({'replace': [['a', 1]]}))
        self.assertTrue(self.errs([]))

    def test_question_needs_required_fields_and_enums(self):
        q = {'id': 'q1', 'subject': 'ukr', 'topicId': 't', 'type': 'single', 'prompt': 'p'}
        self.assertEqual(self.errs({'topicQuestions': [q]}), [])
        self.assertTrue(any('бракує' in e for e in self.errs({'topicQuestions': [{k: v for k, v in q.items() if k != 'prompt'}]})))
        self.assertTrue(any('переліку' in e for e in self.errs({'topicQuestions': [{**q, 'subject': 'chem'}]})))
        self.assertTrue(self.errs({'topicQuestions': [{**q, 'level': 9}]}))

    def test_booleans_are_not_numbers(self):
        self.assertTrue(self.errs({'topicQuestions': [{'id': 'q', 'subject': 'ukr', 'topicId': 't', 'type': 'single', 'prompt': 'p', 'level': True}]}))

    def test_mock_sets_and_notes(self):
        self.assertEqual(self.errs({'mockSets': {'eng': [['a', 'b']]}}), [])
        self.assertTrue(self.errs({'mockSets': {'eng': [[]]}}))
        self.assertTrue(self.errs({'topicNotes': {'t': [{'title': 'x'}]}}))

    def test_error_paths_name_the_place(self):
        e = self.errs({'replace': [['a', 'b'], ['c']]})
        self.assertTrue(any(x.startswith('$.replace[1]') for x in e))

    def test_unknown_schema_keywords_are_rejected_not_ignored(self):
        errs = self.m.validate({'a': 1}, {'type': 'object', 'oneOf': []}, {})
        self.assertTrue(any('непідтримуване' in e for e in errs))

    def test_extend_must_hold_lists(self):
        self.assertTrue(self.errs({'extend': {'k': {'x': 1}}}))
        self.assertEqual(self.errs({'extend': {'k': [1]}}), [])

    def test_questions_reject_misspelled_fields(self):
        q = {'id': 'q1', 'subject': 'ukr', 'topicId': 't', 'type': 'single', 'prompt': 'p'}
        self.assertTrue(any('невідоме поле' in e for e in self.errs({'topicQuestions': [{**q, 'corect': 1}]})))

    def test_fact_kinds(self):
        fact = {'id': 'f', 'topic': 3, 'kind': 'L', 'label': 'l', 'text': 't'}
        self.assertEqual(self.errs({'addFacts': {'3': [fact]}}), [])
        self.assertTrue(self.errs({'addFacts': {'3': [{**fact, 'kind': 'Z'}]}}))

    def test_main_exit_codes(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            good, bad = os.path.join(d, 'g.json'), os.path.join(d, 'b.json')
            for path, doc in ((good, {'drop': ['a']}), (bad, {'oops': 1})):
                with open(path, 'w') as fh:
                    json.dump(doc, fh)
            self.assertEqual(self.m.main([good]), 0)
            self.assertEqual(self.m.main([bad]), 1)
            self.assertEqual(self.m.main([os.path.join(d, 'missing.json')]), 1)


class _Handler(http.server.BaseHTTPRequestHandler):
    log_message = lambda *a: None  # noqa: E731
    hits = []

    def _reply(self):
        _Handler.hits.append((self.command, self.path))
        code = {'/ok': 200, '/gone': 404, '/block': 403, '/boom': 500, '/nohead': 200, '/head404': 200, '/loop': 302}.get(self.path, 404)
        if self.command == 'HEAD' and self.path in ('/nohead', '/head404'):
            code = 405 if self.path == '/nohead' else 404
        if self.path == '/redirect':
            self.send_response(302)
            self.send_header('Location', '/ok')
            self.end_headers()
            return
        if self.path == '/loop':
            self.send_response(302)
            self.send_header('Location', '/loop')
            self.end_headers()
            return
        self.send_response(code)
        self.send_header('Content-Length', '1' if self.command == 'GET' else '0')
        self.end_headers()
        if self.command == 'GET':
            self.wfile.write(b'x')

    do_HEAD = do_GET = _reply


class CheckLinks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['NO_PROXY'] = os.environ['no_proxy'] = '127.0.0.1,localhost'  # тести ходять лише на loopback, навіть за корпоративного проксі
        cls.m = importlib.import_module('check_links')
        cls.srv = http.server.HTTPServer(('127.0.0.1', 0), _Handler)
        cls.base = 'http://127.0.0.1:%d' % cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def test_classify(self):
        c = self.m.classify
        self.assertEqual([c(200), c(204), c(404), c(410), c(500), c(403), c(429), c(401)], ['ok', 'ok', 'broken', 'broken', 'broken', 'blocked', 'blocked', 'blocked'])
        self.assertEqual(c(302), 'broken')  # 3xx після автоматичних перенаправлень означає цикл
        self.assertEqual(c(None, 'TimeoutError'), 'unreachable')
        self.assertEqual(c(None, 'URLError:timeout'), 'unreachable')
        self.assertEqual(c(None, 'ConnectionResetError'), 'unreachable')
        self.assertEqual(c(None, 'URLError:gaierror'), 'broken')
        self.assertEqual(c(None, 'URLError:SSLCertVerificationError'), 'broken')

    def test_statuses(self):
        for path, status in (('/ok', 200), ('/gone', 404), ('/block', 403), ('/boom', 500)):
            self.assertEqual(self.m.check(self.base + path, 5)[0], status, path)

    def test_redirect_is_followed(self):
        self.assertEqual(self.m.check(self.base + '/redirect', 5)[0], 200)

    def test_redirect_loop_is_not_ok(self):
        status, _ = self.m.check(self.base + '/loop', 5)
        self.assertEqual(self.m.classify(status), 'broken')

    def test_head_refused_falls_back_to_get(self):
        self.assertEqual(self.m.check(self.base + '/nohead', 5)[0], 200)

    def test_head_404_but_get_200_is_ok(self):
        self.assertEqual(self.m.check(self.base + '/head404', 5)[0], 200)

    def test_connection_failure_is_described(self):
        status, note = self.m.check('http://127.0.0.1:1/', 2)
        self.assertIsNone(status)
        self.assertTrue(note)

    def test_clean_url(self):
        c = self.m.clean_url
        self.assertEqual(c('https://a.ua/x.'), 'https://a.ua/x')
        self.assertEqual(c('https://a.ua/x)'), 'https://a.ua/x')
        self.assertEqual(c('https://a.ua/X_(Y)'), 'https://a.ua/X_(Y)')
        self.assertEqual(c('https://a.ua/x»'), 'https://a.ua/x')
        self.assertEqual(c('https://a.ua/x?y=1;'), 'https://a.ua/x?y=1')

    def test_extract_urls(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, 'src', 'modules'))
            with open(os.path.join(d, 'src', 'data.json'), 'w', encoding='utf-8') as f:
                f.write(json.dumps({'a': 'див. https://example.org/a, і https://example.org/a. Ще https://www.w3.org/2000/svg та https://h.ua/x?y=1; (https://b.ua/p)'}))
            with open(os.path.join(d, 'src', 'modules', 'm.js'), 'w', encoding='utf-8') as f:
                f.write("const u=`https://h.ua/${id}`,v='https://v.ua/p',w='https://w.ua/X_(Y)';")
            self.assertEqual(self.m.extract_urls(d), ['https://b.ua/p', 'https://example.org/a', 'https://h.ua/x?y=1', 'https://v.ua/p', 'https://w.ua/X_(Y)'])

    def test_check_all_keeps_order_and_spaces_requests_to_one_host(self):
        _Handler.hits.clear()
        urls = [self.base + p for p in ('/ok', '/gone', '/block')]
        t0 = time.monotonic()
        res = self.m.check_all(urls, timeout=5, pause=0.15)
        self.assertEqual([r[0] for r in res], urls)
        self.assertEqual([r[1] for r in res], [200, 404, 403])
        self.assertGreaterEqual(time.monotonic() - t0, 0.29)  # два перерви по 0,15 с: хост опитується по черзі
        self.assertEqual(len(_Handler.hits), 3 + 1 + 1)  # /gone і /block після HEAD ще раз GET

    def test_real_sources_have_urls(self):
        urls = self.m.extract_urls()
        self.assertGreater(len(urls), 50)
        self.assertTrue(all(u.startswith('https://') and ' ' not in u for u in urls))


class CheckText(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = importlib.import_module('check_text')

    def names(self, text):
        return [n for n, _, _ in self.m.scan_text(text)]

    def test_clean_text(self):
        for s in ('Це звичайне речення.', 'Файл HTML-файл PDF-оригінал', "Пʼять і п’ять", 'Ctrl+K відкриває перехід'):
            self.assertEqual(self.names(s), [], s)

    def test_mixed_script_word(self):
        self.assertIn('змішані літери в слові', self.names('слово нa мові'))  # латинська a

    def test_russian_letters(self):
        self.assertIn('літери, яких немає в українській', self.names('це слово ёж'))

    def test_ascii_apostrophe(self):
        self.assertIn('ASCII-апостроф у слові', self.names("м'ясо"))
        self.assertIn('ASCII-апостроф у слові', self.names("м\\'ясо"))  # так апостроф виглядає в одинарних лапках коду

    def test_space_before_punctuation(self):
        self.assertIn('пробіл перед розділовим знаком', self.names('так , ні'))

    def test_double_space(self):
        self.assertIn('два пробіли підряд', self.names('так  ні'))

    def test_repeated_word(self):
        self.assertIn('слово двічі підряд', self.names('дуже дуже слово'))
        self.assertEqual(self.names('і і'), [])  # короткі слова бувають повтором навмисно

    def test_source_scan_finds_literals_and_lines(self):
        src = "const a='ok';\nconst b=`тут  два`;\nconst c='нa' // check_text:ok\nconst d=\"Тест\\nЩо\";"
        self.assertEqual([(l, n) for l, n, _ in self.m.scan_source(src)], [(2, 'два пробіли підряд')])

    def test_escaped_apostrophe_in_single_quotes(self):
        found = self.m.scan_source("const a='м\\'ясо';")
        self.assertEqual([n for _, n, _ in found], ['ASCII-апостроф у слові'])

    def test_comments_are_not_scanned_and_do_not_open_strings(self):
        src = "// код `x\nconst a='так  ні';\n/* `y `*/\nconst b='ок';"
        self.assertEqual([(l, n) for l, n, _ in self.m.scan_source(src)], [(2, 'два пробіли підряд')])
        self.assertEqual(self.m.scan_source("const u='https://a.ua/x'; // тут  два"), [])

    def test_line_number_inside_multiline_template(self):
        src = "const t=`перший рядок\nдругий рядок\nтретій  рядок`;"
        self.assertEqual([(l, n) for l, n, _ in self.m.scan_source(src)], [(3, 'два пробіли підряд')])

    def test_ok_marker_applies_to_the_line_of_the_finding(self):
        src = "const t=`перший\nтретій  рядок // check_text:ok`;\nconst u='нa';"
        self.assertEqual([(l, n) for l, n, _ in self.m.scan_source(src)], [(3, 'змішані літери в слові')])

    def test_whole_project_is_clean(self):
        self.assertEqual(self.m.main(), 0)


def node(code):
    return subprocess.run(['node', '-e', code], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')


@unittest.skipUnless(subprocess.run(['node', '--version'], capture_output=True).returncode == 0, 'потрібен Node.js')
class NodeTools(unittest.TestCase):
    def test_changelog_years_and_grouping(self):
        r = node("""const c=require('./tools/changelog.js');
          const code="const ABOUT_YEAR=2027;\\nconst ABOUT_CHANGES=[['2 січня','a'],['2 січня','b'],['30 грудня','c'],['1 грудня','d']];\\n";
          const d=c.withYears(c.parse(code));console.log(JSON.stringify(d.map(x=>x[0])));
          const md=c.render(d);console.log(md.includes('## 2 січня 2027\\n\\n- a\\n- b')&&md.includes('## 30 грудня 2026')&&md.includes('## 1 грудня 2026'))""")
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = r.stdout.strip().split('\n')
        self.assertEqual(json.loads(lines[0]), ['2 січня 2027', '2 січня 2027', '30 грудня 2026', '1 грудня 2026'])
        self.assertEqual(lines[1], 'true')

    def test_changelog_rejects_unknown_month_and_missing_year(self):
        r = node("const c=require('./tools/changelog.js');try{c.withYears({year:2026,list:[['1 мартобря','x']]});console.log('no error')}catch(e){console.log(e.message)}")
        self.assertIn('невідомий місяць', r.stdout)
        r = node("const c=require('./tools/changelog.js');try{c.parse('const ABOUT_CHANGES=[];\\n');console.log('no error')}catch(e){console.log(e.message)}")
        self.assertIn('ABOUT_YEAR', r.stdout)

    def test_changelog_file_is_current(self):
        r = subprocess.run(['node', 'tools/changelog.js', '--check'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_coverage_collects_named_page_functions_only(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            def fn(name, start, count):
                return {'functionName': name, 'ranges': [{'startOffset': start, 'endOffset': start + 5, 'count': count}], 'isBlockCoverage': True}
            run1 = {'result': [{'url': 'file:///x/app.all.js', 'functions': [fn('a', 10, 3), fn('b', 50, 0), fn('', 60, 9), fn('testHelper', 900, 5)]},
                               {'url': 'file:///x/other.js', 'functions': [fn('zzz', 1, 1)]}]}
            run2 = {'result': [{'url': 'file:///x/app.all.js', 'functions': [fn('a', 10, 0), fn('b', 50, 2), fn('c', 70, 0)]}]}
            for name, run in (('r1.json', run1), ('r2.json', run2)):
                with open(os.path.join(d, name), 'w') as fh:
                    json.dump(run, fh)
            code = """const c=require('./tools/coverage.js');const fns=c.collect(process.argv[1],100);const s=c.summarize(fns);console.log(JSON.stringify(s))"""
            r = subprocess.run(['node', '-e', code, d], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(r.returncode, 0, r.stderr)
            s = json.loads(r.stdout)
            self.assertEqual((s['total'], s['hit'], s['missed']), (3, 2, ['c']))  # a, b покриті в різних запусках, c ні; testHelper за межею коду; анонімна й чужий скрипт не рахуються


@unittest.skipUnless(os.path.isdir(os.path.join(ROOT, 'node_modules', 'eslint')), 'потрібен npm ci (eslint)')
class DevTools(unittest.TestCase):
    """Лінтер і перевірка типів: чи справді вони ловлять помилки, а не мовчки пропускають усе."""

    def lint(self, code, names=''):
        r = node("const l=require('./tools/lint.js');l.lintSource(process.argv[1],JSON.parse(process.argv[2])).then(m=>console.log(JSON.stringify(m.map(x=>x.ruleId))))".replace('process.argv[1]', json.dumps(code)).replace('process.argv[2]', json.dumps(json.dumps(names.split() if names else []))))
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def test_lint_catches_typo_in_a_global_name(self):
        self.assertEqual(self.lint('pSavee();', 'pSave'), ['no-undef'])
        self.assertEqual(self.lint('pSave();', 'pSave'), [])

    def test_lint_catches_const_assignment_and_duplicate_keys(self):
        self.assertEqual(self.lint('const a=1;a=2;'), ['no-const-assign'])
        self.assertEqual(self.lint('({a:1,a:2});'), ['no-dupe-keys'])

    def test_lint_allows_the_wrapper_pattern(self):
        self.assertEqual(self.lint('const xBase=f;f=function(){xBase()};', 'f'), [])

    def test_lint_whole_project_is_clean(self):
        r = subprocess.run(['node', 'tools/lint.js'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_typecheck_keeps_real_errors_and_drops_known_noise(self):
        r = node("""const c=require('./tools/typecheck.js');
          const out=['a.js(1,1): error TS2630: Cannot assign','a.js(2,1): error TS2339: Property x','a.js(3,1): error TS2304: Cannot find name y','a.js(4,1): error TS2554: Expected 1 arguments, but got 2.'].join('\\n');
          console.log(JSON.stringify(c.filter(out)))""")
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = json.loads(r.stdout)
        self.assertEqual([k.split(': ')[0] for k in kept], ['a.js(3,1)', 'a.js(4,1)'])

    def test_typecheck_on_a_broken_project_fails_and_on_the_real_one_passes(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, 'jsconfig.json'), 'w') as f:
                json.dump({'compilerOptions': {'allowJs': True, 'checkJs': True, 'noEmit': True, 'strict': False, 'lib': ['ES2022']}, 'include': ['a.js']}, f)
            with open(os.path.join(d, 'a.js'), 'w') as f:
                f.write('function one(a){return a}\none(1,2);\nmissing();\n')
            bad = subprocess.run(['node', 'tools/typecheck.js', os.path.join(d, 'jsconfig.json')], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(bad.returncode, 1, bad.stdout + bad.stderr)
            self.assertIn('TS2554', bad.stdout)
            self.assertIn('TS2304', bad.stdout)
        good = subprocess.run(['node', 'tools/typecheck.js'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(good.returncode, 0, good.stdout)


class Zno3Keycheck(unittest.TestCase):
    """Звірка ключів біології й географії (tools/zno3_keycheck.py): формати відповідей в аркушах. Потрібен pymupdf, інакше пропускається."""

    @classmethod
    def setUpClass(cls):
        try:
            import pymupdf  # noqa: F401
        except ImportError:
            raise unittest.SkipTest('pymupdf не встановлено')
        spec = importlib.util.spec_from_file_location('zno3_keycheck', os.path.join(TOOLS, 'zno3_keycheck.py'))
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)

    def test_normalize_formats(self):
        n = self.m.normalize
        self.assertIn('1–Г 2–А 3–В 4–Б', n('1Г 2А 3В 4Б'))  # без тире
        self.assertIn('1–Б 2–Г', n('1Б, 2Г, 3Д, 4А'))  # через коми
        self.assertEqual(n('2, 3, 4').strip(), '234')  # множинний вибір цифрами
        self.assertEqual(n('\n'.join(['5', 'Г', '6'])).split('\n')[1], 'Г')  # мітка завдання й відповідь не склеюються

    def test_agrees_multi_digits_and_parts(self):
        a = self.m.agrees
        multi = {'type': 'multi', 'number': 25, 'answer': [1, 2, 3]}
        self.assertTrue(a(multi, {(25, 0): ('234.0', '234')}))
        self.assertFalse(a(multi, {(25, 0): ('235.0', '235')}))
        part = {'type': 'numeric', 'number': 29, 'part': 2, 'answer': '1'}
        self.assertTrue(a(part, {(29, 0): ('311.0', '311')}))
        self.assertFalse(a(part, {(29, 0): ('321.0', '321')}))
        self.assertIsNone(a({'type': 'single', 'number': 3, 'answer': 0}, {}))  # завдання немає в аркуші
        self.assertTrue(a({'type': 'single', 'number': 1, 'answer': 2}, {(1, 0): ('2', 'В (вручну)')}))

    def test_agrees_single_choice_parts_of_a_three_question_task(self):
        a = self.m.agrees
        part = {'type': 'single', 'number': 29, 'part': 3, 'answer': 2}  # біологія, відповідь «1;1;3»: частина 3 — варіант 3 (індекс 2)
        self.assertTrue(a(part, {(29, 0): ('113.0', '113')}))
        self.assertFalse(a(part, {(29, 0): ('111.0', '111')}))
        # хибно прочитаний рядок аркуша (одне число замість трьох цифр) не вважається ні згодою, ні розбіжністю
        self.assertIsNone(a(part, {(29, 0): ('50.0', '50')}))


class Zno3Topics(unittest.TestCase):
    """Теми біології й географії (tools/zno3_bank.py): розділи за сторінками тем osvita.ua, а дані — з уже завантажених файлів."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(os.path.join(ROOT, 'sources', 'zno3', 'tema-biology.html')):
            raise unittest.SkipTest('сторінки тем не завантажено')
        try:
            import PIL  # noqa: F401
        except ImportError:
            raise unittest.SkipTest('Pillow не встановлено')
        sys.path.insert(0, TOOLS)
        import zno3_bank
        cls.m = zno3_bank

    def test_structure_matches_the_programme_sections(self):
        bio, geo = self.m.structure('bio'), self.m.structure('geo')
        self.assertEqual([x[0] for x in bio], ['1.1', '1.2', '1.3', '1.4', '1.5'])  # 5 розділів програми з біології
        self.assertEqual(len(geo), 6)  # 6 розділів програми з географії
        self.assertEqual(sum(len(x[2]) for x in bio), 52)
        self.assertEqual(sum(len(x[2]) for x in geo), 80)
        self.assertNotIn('Різмноманітність', ' '.join(t[3] for x in bio for t in x[2]))  # описка джерела виправлена

    def test_site_bank_covers_every_task_once(self):
        bank = json.load(open(os.path.join(ROOT, 'src', 'zno3-bank.json'), encoding='utf-8'))
        src = json.load(open(os.path.join(ROOT, 'sources', 'zno3', 'bank.json'), encoding='utf-8'))
        ids = [q['id'] for q in bank['questions']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), len(src))
        topics = {t['id'] for s in bank['subjects'] for t in s['topics']}
        self.assertTrue(all(q['topicId'] in topics for q in bank['questions']))
        verified = set(json.load(open(os.path.join(ROOT, 'sources', 'zno3', 'verified.json'))))
        self.assertEqual(sum(1 for q in bank['questions'] if not q.get('keyUnverified')), len(verified))


if __name__ == '__main__':
    unittest.main()
