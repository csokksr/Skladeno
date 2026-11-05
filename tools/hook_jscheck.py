"""Claude Code PostToolUse hook: after an Edit/Write of a JS file under src/, make sure it still parses (node --check).
The pages are one-line functions, so a missing bracket is easy to make and would otherwise show up only at the Stop hook."""
import json, os, subprocess, sys

sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    try:
        path = json.loads(sys.stdin.buffer.read().decode("utf-8-sig")).get('tool_input', {}).get('file_path', '')
    except ValueError:
        return 0
    full = os.path.normcase(os.path.abspath(path))
    if not (path.lower().endswith('.js') and full.startswith(os.path.normcase(os.path.join(ROOT, 'src')) + os.sep) and os.path.exists(full)):
        return 0
    try:
        r = subprocess.run(['node', '--check', full], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
    except (FileNotFoundError, subprocess.TimeoutExpired):  # no node: the Stop hook still builds the page
        return 0
    if r.returncode:
        print('Синтаксична помилка в %s:\n%s' % (path, '\n'.join(l[:300] for l in r.stderr.splitlines()[:8])), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
