"""Claude Code Stop hook: rebuild the site and validate it before the turn ends.
On failure exit 2 hands the output back to Claude to fix; stop_hook_active prevents an endless loop."""
import json, os, subprocess, sys

sys.stderr.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(script):
    r = subprocess.run([sys.executable, '-I', os.path.join('tools', script)], cwd=ROOT, capture_output=True,
                       text=True, encoding='utf-8', errors='replace', timeout=170)
    return r.returncode, (r.stdout + r.stderr).strip()


def main():
    try:
        if json.loads(sys.stdin.buffer.read().decode("utf-8-sig")).get('stop_hook_active'):
            return 0
    except ValueError:
        pass
    for script in ('build.py', 'validate.py'):
        try:
            code, out = run(script)
        except subprocess.TimeoutExpired:
            print('%s не завершився за 170 с' % script, file=sys.stderr)
            return 2
        if code:
            print('%s завершився з кодом %d:\n%s' % (script, code, '\n'.join(out.splitlines()[-25:])), file=sys.stderr)
            return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
