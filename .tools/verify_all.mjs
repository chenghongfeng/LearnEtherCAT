/**
 * 全站真实浏览器回归：遍历页面，检查脚本是否执行、关键交互是否生效。
 * 用法:
 *   node .tools/verify_all.mjs file   # 用 file:// 打开
 *   node .tools/verify_all.mjs http   # 用 http://127.0.0.1:4173
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mode = process.argv[2] || 'file';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PAGES = ['index', 'frame', 'network', 'master', 'al', 'eoe-foe-soe', 'slave', 'dc', 'spec', 'guide', 'glossary'];
const port = 9722;

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_verify')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const p = list.find(t => t.type === 'page');
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(250);
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { ERROR: r.exceptionDetails.text };
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');

const base = mode === 'file'
  ? pathToFileURL(path.resolve('.')).href + '/'
  : 'http://127.0.0.1:4173/';

let failures = 0;
for (const name of PAGES) {
  await send('Page.navigate', { url: `${base}${name}.html` });
  await sleep(900);
  const r = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const out = {
      nav: document.querySelectorAll('.nav a').length,
      lib: typeof window.EC_UI + '/' + typeof window.EC_DATA,
      badge: document.getElementById('selfcheck')?.dataset.state,
    };
    if (${JSON.stringify(name)} === 'frame') {
      out.cells = document.querySelectorAll('.cell').length;
      out.bits = document.querySelectorAll('.bit').length;
      q('#mode button[data-m="multi"]')?.click();
      out.click = document.querySelectorAll('.cell').length;
      out.ok = out.click > out.cells && out.bits === 96;
    }
    if (${JSON.stringify(name)} === 'network') {
      out.svg = document.querySelectorAll('svg').length;
      q('#scenario button[data-s="bc"]')?.click();
      q('#btn-step')?.click();
      out.click = q('#log')?.children.length ?? -1;
      out.ok = out.click >= 2 && out.svg === 1;
    }
    if (${JSON.stringify(name)} === 'al') {
      out.svg = document.querySelectorAll('svg').length;
      q('#trans-btns button')?.click();
      out.click = q('#esm-state')?.textContent;
      out.ok = out.click === 'PREOP';
    }
    if (${JSON.stringify(name)} === 'eoe-foe-soe') {
      out.bits = document.querySelectorAll('.bit').length;
      q('#ptab button[data-p="foe"]')?.click();
      out.click = q('#sec-foe')?.style.display === '' ? 'foe-on' : 'foe-off';
      out.ok = out.click === 'foe-on' && out.bits === 48;
    }
    if (${JSON.stringify(name)} === 'dc') {
      out.svg = document.querySelectorAll('svg').length;
      q('#btn-run')?.click();
      out.click = q('#btn-run')?.textContent;
      out.ok = out.svg === 1 && out.click.includes('暂停');
    }
    if (${JSON.stringify(name)} === 'index') {
      out.layers = document.querySelectorAll('.layer').length;
      q('.layer[data-k="al"]')?.click();
      out.click = q('#layer-detail')?.textContent?.includes('应用层') ? 'layer-ok' : 'layer-no';
      out.ok = out.layers === 3 && out.click === 'layer-ok';
    }
    if (${JSON.stringify(name)} === 'slave') {
      out.tree = document.querySelectorAll('.tree .t').length;
      out.cards = document.querySelectorAll('.dev-card').length;
      out.ok = out.tree > 100 && out.cards >= 1;
    }
    if (${JSON.stringify(name)} === 'guide') {
      out.h2 = document.querySelectorAll('article.doc h2').length;
      out.toc = document.querySelectorAll('.toc a').length;
      out.ok = out.h2 > 8 && out.toc > 20;
    }
    if (${JSON.stringify(name)} === 'spec') {
      out.rows = document.querySelectorAll('.maprow').length;
      q('.maprow')?.click();
      out.click = document.querySelectorAll('.detailrow[style=""]').length;
      out.ok = out.rows === 17 && out.click === 1;
    }
    if (${JSON.stringify(name)} === 'glossary') {
      out.terms = document.querySelectorAll('.g-term').length;
      out.ok = out.terms >= 30;
    }
    if (${JSON.stringify(name)} === 'master') {
      out.svg = document.querySelectorAll('svg').length;
      out.rows = document.querySelectorAll('#matrix-tbl tbody tr').length;
      out.ok = out.svg === 1 && out.rows === 27;
    }
    return out;
  })()`);
  const ok = r && r.nav >= 9 && r.lib === 'object/object' && r.badge === 'ok' && r.ok !== false;
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(12)}`, JSON.stringify(r));
}

console.log(failures ? `\n${failures} page(s) failed` : '\nall pages ok');
ws.close(); proc.kill(); await sleep(300);
process.exit(failures ? 1 : 0);
