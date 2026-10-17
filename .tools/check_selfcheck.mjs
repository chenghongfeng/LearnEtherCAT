/**
 * 自检徽标专项：
 *  ① 正常页面 → sc-ok，点开面板能看到检查项
 *  ② 故意去掉脚本的页面 → sc-idle 且文案为“脚本未执行”
 * 用法: node .tools/check_selfcheck.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9488;

// 造一个“没有脚本”的页面
const src = fs.readFileSync('frame.html', 'utf8');
const broken = src
  .replace(/<script src="assets\/js\/ec-core\.js"><\/script>/g, '')
  .replace(/<script>\n[\s\S]*?<\/script>/g, '');
const brokenPath = path.resolve('.tmp_broken.html');
fs.writeFileSync(brokenPath, broken, 'utf8');

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1200,900',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_sc')}`, 'about:blank',
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
  return r.exceptionDetails ? { ERROR: r.exceptionDetails.text } : r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');

// ---------- ① 正常页 ----------
await send('Page.navigate', { url: pathToFileURL(path.resolve('frame.html')).href });
await sleep(1300);
console.log('正常页:', await evalJs(`(() => {
  const el = document.getElementById('selfcheck');
  el.click();
  const panel = el.querySelector('.sc-panel');
  return {
    state: el.dataset.state,
    text: el.querySelector('.sc-text').textContent,
    ms: el.dataset.ms,
    open: el.classList.contains('open'),
    rows: panel ? panel.querySelectorAll('.sc-row').length : 0,
    rowsText: panel ? [...panel.querySelectorAll('.sc-row')].map(r => r.textContent.trim()).join(' | ') : '',
    hint: panel ? panel.querySelector('.sc-hint')?.textContent : '',
  };
})()`));

// ---------- ①b warn 场景 + 面板交互 ----------
await send('Page.navigate', { url: pathToFileURL(path.resolve('frame.html')).href });
await sleep(1200);
console.log('warn 场景:', await evalJs(`(() => {
  document.querySelectorAll('.cell').forEach(n => n.remove());
  const st = window.EC_SELFCHECK.run();
  const el = document.getElementById('selfcheck');
  return {
    state: el.dataset.state,
    text: el.querySelector('.sc-text').textContent,
    failed: st.checks.filter(c => !c.ok).map(c => c.name),
  };
})()`));

console.log('重新检查/外部关闭:', await evalJs(`(async () => {
  const el = document.getElementById('selfcheck');
  el.click();
  const opened = el.classList.contains('open');
  const btn = el.querySelector('.sc-act');
  btn.click();
  await new Promise(r => setTimeout(r, 300));
  const afterRecheck = { state: el.dataset.state, open: el.classList.contains('open') };
  document.body.click();
  await new Promise(r => setTimeout(r, 50));
  return { opened, afterRecheck, closedByOutside: !el.classList.contains('open') };
})()`));

// ---------- ② 无脚本页 ----------
await send('Page.navigate', { url: pathToFileURL(brokenPath).href });
await sleep(1500);
console.log('无脚本页:', await evalJs(`(() => {
  const el = document.getElementById('selfcheck');
  return {
    exists: !!el,
    state: el?.dataset.state,
    text: el?.querySelector('.sc-text')?.textContent,
    nav: document.querySelectorAll('.nav a').length,
    cells: document.querySelectorAll('.cell').length,
  };
})()`));

ws.close(); proc.kill(); await sleep(300);
fs.unlinkSync(brokenPath);
process.exit(0);
