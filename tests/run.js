// Regression tests for the built page. Needs Node 18+ and a fresh `python -I tools/build.py`.  Usage: node tests/run.js
// Each file in tests/cases runs in tests/harness.js (stub DOM) and prints PASS/FAIL lines; within the first 3 lines `// LS: <file>` preloads
// localStorage and `// TZ: <zone>` runs the case in that time zone. Files run in parallel (each loads the 100 MB page), results print in file order.
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..');

function runCase(name) {
  const file = path.join(__dirname, 'cases', name), head = fs.readFileSync(file, 'utf8').split('\n', 3).join('\n'), env = { ...process.env };
  const ls = /^\/\/ LS: (\S+)/m.exec(head);
  if (ls) env.LS = path.join(root, ls[1]);
  const tz = /^\/\/ TZ: (\S+)/m.exec(head);
  if (tz) env.TZ = tz[1];
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(__dirname, 'harness.js'), file], { env });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', status => resolve({ name, out, status }));
  });
}

async function main() {
  const names = fs.readdirSync(path.join(__dirname, 'cases')).filter(f => f.endsWith('.js')).sort();
  const results = new Array(names.length);
  let next = 0;
  const worker = async () => { for (let i = next++; i < names.length; i = next++) results[i] = await runCase(names[i]); };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, os.cpus().length)) }, worker));
  let failed = 0, total = 0;
  for (const { name, out, status } of results) {
    const lines = out.split('\n').filter(l => /^(PASS|FAIL|THROW)/.test(l));
    const bad = lines.filter(l => !l.startsWith('PASS')).length + (status === 0 ? 0 : 1);
    total += lines.length; failed += bad;
    console.log((bad ? 'FAIL ' : 'ok   ') + name + ' (' + lines.length + ' checks)');
    if (bad) console.log(out.split('\n').filter(l => !l.startsWith('PASS')).join('\n'));
  }
  console.log(failed ? failed + ' failed of ' + total : 'all ' + total + ' checks passed');
  process.exit(failed ? 1 : 0);
}
main();
