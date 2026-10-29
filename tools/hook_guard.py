"""Claude Code PreToolUse hook: refuse Edit/Write on generated or downloaded files.
Generated files are rebuilt by tools/*.py, so a manual edit would be lost; downloaded sources must stay as published."""
import fnmatch, json, os, sys

sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (kind, path relative to ROOT, advice); 'tree' = everything below the folder, 'file' = one file, 'pdf' = *.pdf directly in the folder,
# 'glob' = files whose path relative to ROOT matches the pattern (fnmatch, '/' separators)
RULES = [
    ('tree', 'dist', 'згенеровано збіркою (tools/build.py): правте src/ і перезбирайте'),
    ('file', 'skladeno-nmt-latest.html', 'застаріла копія сайту, не редагується'),
    ('file', 'src/history-bank.json', 'пише tools/zno_bank.py; виправляйте tools/zno_overrides.json і перезапускайте zno_import.py, zno_topics.py, zno_bank.py'),
    ('file', 'sources/zno/bank.json', 'пише tools/zno_import.py (виправлення ключів і тем у tools/zno_overrides.json)'),
    ('tree', 'sources/zno/html', 'завантажені сторінки zno.osvita.ua, не редагуються'),
    ('tree', 'sources/zno/img', 'пише tools/zno_images.py'),
    ('pdf', 'sources/keys', 'офіційні аркуші відповідей УЦОЯО, не редагуються (ручні ключі — у sources/keys/manual.json)'),
    ('pdf', 'sources/keys/zno2', 'офіційні аркуші відповідей УЦОЯО, не редагуються (ручні ключі — у sources/keys/zno2/manual.json)'),
    ('file', 'src/zno2-bank.json', 'пише tools/zno2_bank.py; виправлення тексту — у tools/zno2_overrides.json'),
    ('file', 'sources/zno2/bank.json', 'пише tools/zno2_import.py'),
    ('tree', 'sources/zno2/html', 'завантажені сторінки zno.osvita.ua, не редагуються'),
    ('tree', 'sources/zno2/img', 'пише tools/zno2_bank.py'),
    ('glob', 'src/blobs/zno*.txt', 'пишуть tools/zno_images.py і tools/zno2_bank.py'),
    # Content modules written by tools/content_*.py (the hand-written ones are 10, 40, 52, 56, 57, 59, 61, 63, 64, 66).
    ('glob', 'src/content/2[0-2]-*.json', 'пише tools/content_*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/3[01]-*.json', 'пише tools/content_eng*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/50-*.json', 'пише tools/content_*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/53-*.json', 'пише tools/content_*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/54-*.json', 'пише tools/content_*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/55-*.json', 'пише tools/content_*.py; правте генератор або додайте власний модуль'),
    ('glob', 'src/content/58-*.json', 'пише tools/content_geo_fix.py'),
    ('glob', 'src/content/60-*.json', 'пише tools/content_nmt2025.py'),
    ('glob', 'src/content/62-*.json', 'пише tools/content_hist_enrich.py'),
    ('glob', 'src/content/65-*.json', 'пише tools/content_math_variants.py'),
]


def norm(*parts):
    return os.path.normcase(os.path.abspath(os.path.join(ROOT, *parts)))


def main():
    try:
        tool_input = json.loads(sys.stdin.buffer.read().decode('utf-8-sig')).get('tool_input', {})
    except ValueError:
        return 0
    path = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
    if not path:
        return 0
    full = os.path.normcase(os.path.abspath(path))
    rel = os.path.relpath(full, os.path.normcase(ROOT)).replace(os.sep, '/')
    for kind, rel_rule, advice in RULES:
        target = norm(*rel_rule.split('/'))
        if kind == 'glob':
            hit = fnmatch.fnmatchcase(rel, os.path.normcase(rel_rule).replace(os.sep, '/'))
        else:
            hit = (full == target if kind == 'file' else
                   full.startswith(target + os.sep) if kind == 'tree' else
                   os.path.dirname(full) == target and full.endswith('.pdf'))
        if hit:
            print('%s: %s.' % (path, advice), file=sys.stderr)
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
