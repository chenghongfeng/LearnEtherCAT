/**
 * 截一张“关键词弹窗”的图：滚到第 3 节，悬停 ADP。
 * 用法: node .tools/shot_keyword.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9728;
const url = pathToFileURL(path.resolve('frame.html')).href;

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_kwshot')}`, 'about:blank',
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

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1500);

// 滚动到第 3 节，把标题放在视口上方一点，然后悬停正文里的 ADP
await evalJs(`(() => {
  const h = document.getElementById('f3');
  window.scrollTo(0, h.offsetTop - 90);
  return h.offsetTop;
})()`);
await sleep(500);

const info = await evalJs(`(() => {
  const spans = [...document.querySelectorAll('.kw[data-k="adp"]')];
  const visible = spans.find(s => { const r = s.getBoundingClientRect(); return r.top > 120 && r.top < 700; });
  if (!visible) return { n: spans.length };
  visible.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }));
  const tip = document.getElementById('kw-tip');
  const r = tip.getBoundingClientRect();
  return { n: spans.length, text: visible.textContent, tip: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hidden: tip.hidden };
})()`);
console.log('hover:', JSON.stringify(info));

await sleep(350);
const { data } = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('docs/assets/kw-tip.png', Buffer.from(data, 'base64'));
console.log('wrote docs/assets/kw-tip.png');

ws.close(); proc.kill(); await sleep(200); process.exit(0);
