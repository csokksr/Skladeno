"""Merge a JSON file of task analyses ({"zno-<id>": text}) into src/history-explanations.json and rebuild src/history-bank.json
(the site reads the analyses only through the bank). Usage: python -I tools/zno_explain_merge.py <file.json>"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, 'src', 'history-explanations.json')
if len(sys.argv) != 2:
    sys.exit(__doc__)
data = json.load(open(path, encoding='utf-8'))
new = json.load(open(sys.argv[1], encoding='utf-8'))
known = {q['id'] for q in json.load(open(os.path.join(ROOT, 'src', 'history-bank.json'), encoding='utf-8'))['questions']}
bad = sorted(i for i, t in new.items() if i not in known or not isinstance(t, str) or len(t.strip()) < 20)
if bad:
    sys.exit('REJECT: unknown id or text shorter than 20 characters: %s' % bad[:10])
data.update(new)
json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(new), 'added;', len(data), 'in total')
code = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'zno_bank.py')], cwd=ROOT).returncode
sys.exit(code)
