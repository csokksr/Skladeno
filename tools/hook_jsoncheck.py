"""Claude Code PostToolUse hook: after an Edit/Write of a JSON file under src/ or tools/, make sure it still parses."""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    try:
        path = json.loads(sys.stdin.buffer.read().decode("utf-8-sig")).get('tool_input', {}).get('file_path', '')
    except ValueError:
        return 0
    full = os.path.normcase(os.path.abspath(path))
    inside = any(full.startswith(os.path.normcase(os.path.join(ROOT, d)) + os.sep) for d in ('src', 'tools'))
    if not (path.lower().endswith('.json') and inside and os.path.exists(full)):
        return 0
    try:
        with open(full, encoding='utf-8') as f:
            json.load(f)
    except (ValueError, OSError) as e:
        print('Невалідний JSON у %s: %s' % (path, e), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
