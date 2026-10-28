"""Claude Code PreToolUse hook: refuse Edit/Write on generated or downloaded files.
Generated files are rebuilt by tools/*.py, so a manual edit would be lost; downloaded sources must stay as published."""
import json, os, sys

sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (kind, path relative to ROOT, advice); 'tree' = everything below the folder, 'file' = one file, 'pdf' = *.pdf directly in the folder
RULES = [
    ('tree', 'dist', 'згенеровано збіркою (tools/build.py): правте src/ і перезбирайте'),
    ('file', 'skladeno-nmt-latest.html', 'застаріла копія сайту, не редагується'),
    ('file', 'src/history-bank.json', 'пише tools/zno_bank.py; виправляйте tools/zno_overrides.json і перезапускайте zno_import.py, zno_topics.py, zno_bank.py'),
    ('file', 'sources/zno/bank.json', 'пише tools/zno_import.py (виправлення ключів і тем у tools/zno_overrides.json)'),
    ('tree', 'sources/zno/html', 'завантажені сторінки zno.osvita.ua, не редагуються'),
    ('tree', 'sources/zno/img', 'пише tools/zno_images.py'),
    ('pdf', 'sources/keys', 'офіційні аркуші відповідей УЦОЯО, не редагуються (ручні ключі — у sources/keys/manual.json)'),
]


def norm(*parts):
    return os.path.normcase(os.path.abspath(os.path.join(ROOT, *parts)))


def main():
    try:
        path = json.loads(sys.stdin.buffer.read().decode('utf-8-sig')).get('tool_input', {}).get('file_path', '')
    except ValueError:
        return 0
    if not path:
        return 0
    full = os.path.normcase(os.path.abspath(path))
    for kind, rel, advice in RULES:
        target = norm(*rel.split('/'))
        hit = (full == target if kind == 'file' else
               full.startswith(target + os.sep) if kind == 'tree' else
               os.path.dirname(full) == target and full.endswith('.pdf'))
        if hit:
            print('%s: %s.' % (path, advice), file=sys.stderr)
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
