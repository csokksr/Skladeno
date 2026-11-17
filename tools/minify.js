// Мініфікація коду сторінки під час збірки (викликається з tools/build.py): stdin -> stdout.
// Лише пробіли й синтаксис: назви не скорочуємо, бо обробники onclick="..." в розмітці викликають глобальні функції за іменем.
const esbuild = require('esbuild');
let src = '';
process.stdin.setEncoding('utf8');
process.stdin
  .on('data', d => (src += d))
  .on('end', () => {
    const r = esbuild.transformSync(src, {
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: false,
      charset: 'utf8',
      legalComments: 'none',
      target: 'esnext',
    });
    process.stdout.write(r.code);
  });
