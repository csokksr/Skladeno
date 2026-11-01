// Regression tests for the built page. Needs Node 18+ and a fresh `python -I tools/build.py`.  Usage: node tests/run.js
// Each file in tests/cases runs in tests/harness.js (stub DOM) and prints PASS/FAIL lines; a first line `// LS: <file>` preloads localStorage.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
let failed = 0, total = 0;
for (const name of fs.readdirSync(path.join(__dirname, 'cases')).filter(f => f.endsWith('.js')).sort()) {
  const file = path.join(__dirname, 'cases', name), head = fs.readFileSync(file, 'utf8').split('\n', 1)[0], env = { ...process.env };
  const ls = /^\/\/ LS: (\S+)/.exec(head);
  if (ls) env.LS = path.join(root, ls[1]);
  const r = spawnSync(process.execPath, [path.join(__dirname, 'harness.js'), file], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(l => /^(PASS|FAIL|THROW)/.test(l));
  const bad = lines.filter(l => !l.startsWith('PASS')).length + (r.status === 0 ? 0 : 1);
  total += lines.length; failed += bad;
  console.log((bad ? 'FAIL ' : 'ok   ') + name + ' (' + lines.length + ' checks)');
  if (bad) console.log(out.split('\n').filter(l => !l.startsWith('PASS')).join('\n'));
}
console.log(failed ? failed + ' failed of ' + total : 'all ' + total + ' checks passed');
process.exit(failed ? 1 : 0);
