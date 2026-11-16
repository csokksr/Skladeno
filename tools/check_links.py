"""Перевіряє, що зовнішні https-посилання з src/ відкриваються. Потрібна мережа, тому не входить у build, validate і звичайний CI:
запускається вручну або щотижня (.github/workflows/links.yml).

Запити легкі (HEAD; якщо HEAD не вдався, GET одного байта), без завантаження вмісту. Хости опитуються паралельно (до 4), а запити до одного хоста
йдуть по одному з паузою, щоб не навантажувати чужі сайти.
Класи відповіді:
  ok          2xx;
  blocked     401, 403, 429: сайт не пускає автоматичні запити, це не доказ, що посилання поламане;
  unreachable таймаут або обрив з'єднання: сайти бувають недоступні з серверів CI, це не доказ поломки;
  broken      404, 410, інші 4xx і 5xx, цикл перенаправлень, невідоме ім'я хоста, помилка сертифіката.
З --strict код 1 лише за broken.
Запуск: python -I tools/check_links.py [--strict] [--limit N] [--timeout 15] [--pause 0.5]"""
import concurrent.futures, glob, os, re, socket, ssl, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = re.compile(r'https://[^\s"\'<>\\\]}`]+')
SKIP_HOSTS = {'www.w3.org', 'json-schema.org', 'example.com', 'localhost'}
UA = 'Skladeno-link-check/1.0'  # лише ASCII: заголовки HTTP кодуються в latin-1
TRAILING = '.,;:!?»”’…'


def clean_url(u):
    """Прибирає розділові знаки з кінця адреси; закривна дужка лишається, якщо в адресі є відкривна."""
    while u:
        if u[-1] in TRAILING or (u[-1] == ')' and '(' not in u):
            u = u[:-1]
        else:
            break
    return u


def extract_urls(root=ROOT):
    """Унікальні https-адреси з src/ (без blobs і згенерованих банків із вбудованими даними)."""
    found = set()
    for pattern in ('src/*.json', 'src/content/*.json', 'src/modules/*.js', 'src/web/*.js', 'src/app.js', 'src/shell.html'):
        for f in glob.glob(os.path.join(root, pattern)):
            try:
                with open(f, encoding='utf-8') as fh:
                    text = fh.read()
            except OSError:
                continue
            for m in URL.findall(text):
                u = clean_url(m)
                host = urllib.parse.urlsplit(u).hostname or ''
                if host and host not in SKIP_HOSTS and '${' not in u:
                    found.add(u)
    return sorted(found)


def classify(status, note=''):
    if status is None:
        return 'unreachable' if any(w in note.lower() for w in ('timeout', 'timed out', 'connectionreset', 'connectionaborted', 'remotedisconnected')) else 'broken'
    if 200 <= status < 300:
        return 'ok'
    if status in (401, 403, 429):
        return 'blocked'
    return 'broken'  # 3xx тут означає цикл перенаправлень: urllib іде за звичайними сам


def _describe(e):
    reason = getattr(e, 'reason', None)
    return type(e).__name__ + (':' + (type(reason).__name__ if not isinstance(reason, str) else reason) if reason is not None else '')


def check(url, timeout=15):
    """(статус або None, пояснення). HEAD; після будь-якої помилки HEAD ще GET одного байта, бо частина сайтів відповідає на HEAD неправильно."""
    def once(method, extra=None):
        req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, **(extra or {})})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status
    try:
        return once('HEAD'), ''
    except urllib.error.HTTPError as e:
        e.close()
        first = (e.code, str(e.reason))
    except (urllib.error.URLError, socket.timeout, ssl.SSLError, OSError) as e:
        first = (None, _describe(e))
    except Exception as e:  # noqa: BLE001 — будь-який інший збій це «не відкрилось»
        first = (None, type(e).__name__)
    try:
        return once('GET', {'Range': 'bytes=0-0'}), ''
    except urllib.error.HTTPError as e:
        e.close()
        return e.code, str(e.reason)
    except Exception as e:  # noqa: BLE001
        return (None, _describe(e)) if first[0] is None else first


def check_all(urls, timeout=15, pause=0.5, workers=4):
    """[(адреса, статус, пояснення)] у порядку urls. Адреси одного хоста перевіряються по одній, з паузою."""
    by_host = {}
    for u in urls:
        by_host.setdefault(urllib.parse.urlsplit(u).hostname, []).append(u)
    out = {}

    def run_host(group):
        for i, u in enumerate(group):
            if i:
                time.sleep(pause)
            out[u] = check(u, timeout)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(run_host, by_host.values()))
    return [(u, *out[u]) for u in urls]


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    strict = '--strict' in argv

    def opt(name, default, cast):
        return cast(argv[argv.index(name) + 1]) if name in argv else default
    urls = extract_urls()
    limit = opt('--limit', 0, int)
    if limit:
        urls = urls[:limit]
    results = check_all(urls, opt('--timeout', 15, int), opt('--pause', 0.5, float))
    counts = {'ok': 0, 'blocked': 0, 'unreachable': 0, 'broken': 0}
    for u, status, note in results:
        c = classify(status, note)
        counts[c] += 1
        if c != 'ok':
            print(c.upper(), status if status is not None else '-', note, u)
    print('адрес перевірено:', len(urls), '·', ' · '.join(f'{k}: {v}' for k, v in counts.items()))
    return 1 if strict and counts['broken'] else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
