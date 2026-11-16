"""Перевіряє модулі src/content/*.json за tools/content.schema.json.

Валідатор власний і працює з підмножиною JSON Schema (бібліотеки jsonschema у проєкті немає): type (рядок або список),
properties, required, additionalProperties (false або схема), items, enum, minLength, minimum, maximum, minItems, maxItems, $ref на #/$defs/….
Завершується кодом 0 лише без помилок. Запуск: python -I tools/check_schema.py [файл.json ...]"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, 'tools', 'content.schema.json')
KNOWN = {'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'minLength', 'minimum', 'maximum', 'minItems', 'maxItems',
         '$ref', '$schema', '$defs', 'title', 'description'}
_TYPES = {'object': dict, 'array': list, 'string': str, 'boolean': bool, 'null': type(None)}


def _is(value, name):
    if name == 'integer':
        return isinstance(value, int) and not isinstance(value, bool)
    if name == 'number':
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return isinstance(value, _TYPES[name]) and not (name != 'boolean' and isinstance(value, bool))


def validate(value, schema, root, path='$'):
    """Список повідомлень про невідповідність value схемі (порожній, якщо все гаразд)."""
    errors = [f'{path}: непідтримуване ключове слово схеми «{k}»' for k in schema if k not in KNOWN]
    if '$ref' in schema:
        node = root
        for part in schema['$ref'][2:].split('/'):
            node = node[part]
        return validate(value, node, root, path)
    t = schema.get('type')
    if t is not None:
        names = t if isinstance(t, list) else [t]
        if not any(_is(value, n) for n in names):
            return [f'{path}: очікується {"/".join(names)}, є {type(value).__name__}']
    if 'enum' in schema and value not in schema['enum']:
        errors.append(f'{path}: значення {value!r} не з переліку {schema["enum"]}')
    if isinstance(value, str) and len(value) < schema.get('minLength', 0):
        errors.append(f'{path}: рядок коротший за {schema["minLength"]}')
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if 'minimum' in schema and value < schema['minimum']:
            errors.append(f'{path}: {value} менше за {schema["minimum"]}')
        if 'maximum' in schema and value > schema['maximum']:
            errors.append(f'{path}: {value} більше за {schema["maximum"]}')
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0):
            errors.append(f'{path}: елементів менше за {schema["minItems"]}')
        if len(value) > schema.get('maxItems', 10 ** 9):
            errors.append(f'{path}: елементів більше за {schema["maxItems"]}')
        if 'items' in schema:
            for i, item in enumerate(value):
                errors += validate(item, schema['items'], root, f'{path}[{i}]')
    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                errors.append(f'{path}: бракує поля «{key}»')
        props = schema.get('properties', {})
        extra = schema.get('additionalProperties', True)
        for key, item in value.items():
            if key in props:
                errors += validate(item, props[key], root, f'{path}.{key}')
            elif extra is False:
                errors.append(f'{path}: невідоме поле «{key}»')
            elif isinstance(extra, dict):
                errors += validate(item, extra, root, f'{path}.{key}')
    return errors


def check_files(files, schema):
    problems = {}
    for f in files:
        try:
            with open(f, encoding='utf-8') as fh:
                data = json.load(fh)
        except (OSError, ValueError) as e:
            problems[f] = [f'не читається: {e}']
            continue
        errs = validate(data, schema, schema)
        if errs:
            problems[f] = errs
    return problems


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    with open(SCHEMA, encoding='utf-8') as fh:
        schema = json.load(fh)
    files = argv or sorted(glob.glob(os.path.join(ROOT, 'src', 'content', '*.json')))
    problems = check_files(files, schema)
    for f, errs in problems.items():
        try:
            name = os.path.relpath(f, ROOT)
        except ValueError:  # інший диск (Windows): показуємо повний шлях
            name = f
        print(name)
        for e in errs[:20]:
            print('  ', e)
        if len(errs) > 20:
            print('   … ще', len(errs) - 20)
    print('модулів перевірено:', len(files), '· з помилками:', len(problems))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
