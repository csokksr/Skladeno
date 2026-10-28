"""Merge a JSON file of task analyses ({"zno-<id>": text}) into src/history-explanations.json."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, 'src', 'history-explanations.json')
data = json.load(open(path, encoding='utf-8'))
new = json.load(open(sys.argv[1], encoding='utf-8'))
data.update(new)
json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(new), 'added;', len(data), 'in total')
