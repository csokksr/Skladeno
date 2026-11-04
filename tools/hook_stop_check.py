"""Claude Code Stop hook: rebuild the site, validate it and run the regression tests before the turn ends.
On failure exit 2 hands the output back to Claude to fix; stop_hook_active prevents an endless loop."""
import json, os, subprocess, sys

sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# The hook itself has 180 s (.claude/settings.json); build + validate + tests must fit into it together.
LIMITS = {'build.py': 115, 'validate.py': 30, 'tests/run.js': 30}


def run(script):
    cmd = ['node', script] if script.endswith('.js') else [sys.executable, '-I', os.path.join('tools', script)]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=LIMITS[script])
    return r.returncode, (r.stdout + r.stderr).strip()


def main():
    try:
        if json.loads(sys.stdin.buffer.read().decode("utf-8-sig")).get('stop_hook_active'):
            return 0
    except ValueError:
        pass
    for script in ('build.py', 'validate.py', 'tests/run.js'):
        try:
            code, out = run(script)
        except subprocess.TimeoutExpired:
            print('%s не завершився за %d с' % (script, LIMITS[script]), file=sys.stderr)
            return 2
        except FileNotFoundError:  # node is needed only for the tests
            print('%s пропущено: програму не знайдено в PATH' % script, file=sys.stderr)
            continue
        if code:
            print('%s завершився з кодом %d:\n%s' % (script, code, '\n'.join(l[:300] for l in out.splitlines()[-25:])), file=sys.stderr)
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
