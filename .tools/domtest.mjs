/**
 * jsdom 测试 harness（classic script 版）。
 * 页面现在是 classic 脚本 + assets/js/ec-core.js：
 *   - 把 ec-core.js 内联进页面（jsdom 对 file:// 外部脚本加载不稳）
 *   - 直接执行页面内联脚本
 * 兼容旧的 module 版页面（若还有 type="module"，则走原先的 import 注入逻辑）。
 * 用法: node .tools/domtest.mjs frame.html
 */
import { JSDOM, VirtualConsole } from './node_modules/jsdom/lib/api.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
const abs = path.resolve(file);
const dir = path.dirname(abs);
let html = fs.readFileSync(abs, 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const corePath = path.join(dir, 'assets', 'js', 'ec-core.js');
if (fs.existsSync(corePath) && html.includes('assets/js/ec-core.js')) {
  const core = fs.readFileSync(corePath, 'utf8');
  html = html.replace(
    /<script src="assets\/js\/ec-core\.js"><\/script>/,
    `<script>${core.replace(/<\/script>/g, '<\\/script>')}</script>`
  );
} else {
  // 兼容 module 版：在 Node 侧 import，再注入同名变量
  const mods = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  if (mods.length) {
    const modCode = mods[mods.length - 1][1];
    const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g;
    const bindings = []; const specs = [];
    let code = modCode.replace(importRe, (m, names, src) => {
      const url = pathToFileURL(path.resolve(dir, src)).href;
      let idx = specs.indexOf(url);
      if (idx < 0) { specs.push(url); idx = specs.length - 1; }
      for (const n of names.split(',')) {
        const [orig, alias] = n.split(/\s+as\s+/).map(s => s.trim());
        bindings.push([orig, alias || orig, idx]);
      }
      return '';
    });
    const loaded = [];
    for (const u of specs) loaded.push(await import(u));
    const injected = bindings.map(([o, l, i]) => `const ${l} = window.__NS${i}[${JSON.stringify(o)}];`).join('\n');
    const preload = specs.map((u, i) => {
      const ns = {};
      for (const [o, , j] of bindings) if (j === i) ns[o] = loaded[i][o];
      return `window.__NS${i} = ${JSON.stringify(ns)};`;
    }).join('\n');
    html = html
      .replace(/<script type="module">[\s\S]*?<\/script>/g, '')
      .replace('</body>', `<script>${preload}\n${injected}\n${code}</script></body>`);
  }
}

const dom = new JSDOM(html, {
  url: pathToFileURL(abs).href,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    globalThis.document = w.document;
    globalThis.window = w;
  },
});

const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + (e.message || e)));
w.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason?.stack || e.reason)));

await new Promise(r => setTimeout(r, 1200));

const doc = w.document;
const counts = {
  'nav links': doc.querySelectorAll('.nav a').length,
  '.card': doc.querySelectorAll('.card').length,
  '.cell': doc.querySelectorAll('.cell').length,
  '.bit': doc.querySelectorAll('.bit').length,
  'svg': doc.querySelectorAll('svg').length,
  'tbl tr': doc.querySelectorAll('table.tbl tr').length,
  'buttons': doc.querySelectorAll('button').length,
  'selfcheck': doc.getElementById('selfcheck')?.dataset.state || 'missing',
};
console.log('---', path.basename(file), '| title:', doc.title);
console.log('   ', JSON.stringify(counts));
console.log('    body chars:', (doc.body.textContent || '').replace(/\s+/g, ' ').length);

if (errors.length) {
  console.log('ERRORS:');
  [...new Set(errors)].slice(0, 8).forEach(e => console.log('  ' + String(e).slice(0, 700)));
  process.exitCode = 1;
} else {
  console.log('    no runtime errors');
}
w.close();
