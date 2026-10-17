/**
 * 导览每一步的术语标注 + 真实鼠标悬停。
 * 用法: node .tools/check_kw_tour.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9733;
const url = pathToFileURL(path.resolve('frame.html')).href;

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_kwt')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const p = list.find(t => t.type === 'page');
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(300);
}
if (!ws) { console.error('no devtools'); process.exit(1); }
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
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
const clickAt = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1500);

for (let i = 0; i < 6; i++) {
  const info = await evalJs(`(() => {
    const dots = document.querySelectorAll('#tour .tour-dots button');
    dots[${i}].click();
    const t = document.getElementById('tour');
    return {
      step: t.querySelector('h3')?.textContent,
      kw: t.querySelectorAll('.kw').length,
      keys: [...t.querySelectorAll('.kw')].map(k => k.dataset.k),
    };
  })()`);
  await sleep(260);
  const late = await evalJs(`({ kw: document.querySelectorAll('#tour .kw').length })`);
  console.log(`step ${i + 1}`.padEnd(8), JSON.stringify(info), 'late:', late.kw);
}

// 真实鼠标：切到第 3 步，悬停导览里的 ADP，再切第 4 步悬停 LEN
await evalJs(`document.querySelectorAll('#tour .tour-dots button')[2].click()`);
await sleep(300);
let r = await evalJs(`(() => {
  const s = document.querySelector('#tour .kw[data-k="adp"]');
  if (!s) return null;
  const b = s.getBoundingClientRect();
  return { x: b.left + 4, y: b.top + b.height / 2 };
})()`);
if (r) {
  await move(r.x, r.y);
  await sleep(280);
  console.log('hover step3', JSON.stringify(await evalJs(`(() => {
    const t = document.getElementById('kw-tip');
    return { hidden: t.hidden, head: t.querySelector('.kt-head')?.textContent.slice(0, 20) };
  })()`)));
}

const next = await evalJs(`(() => { const b = document.querySelector('#tour button[data-act="next"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
await move(next.x, next.y);
await sleep(120);
await clickAt(next.x, next.y);
await sleep(400);

r = await evalJs(`(() => {
  const s = document.querySelector('#tour .kw[data-k="len"]');
  if (!s) return null;
  const b = s.getBoundingClientRect();
  return { x: b.left + 4, y: b.top + b.height / 2, text: s.textContent };
})()`);
if (r) {
  await move(r.x, r.y);
  await sleep(280);
  console.log('hover step4', JSON.stringify(await evalJs(`(() => {
    const t = document.getElementById('kw-tip');
    return { hidden: t.hidden, head: t.querySelector('.kt-head')?.textContent.slice(0, 22), text: document.querySelector('#tour .kw[data-k="len"]')?.textContent };
  })()`)));
}

ws.close(); proc.kill(); await sleep(200); process.exit(0);
