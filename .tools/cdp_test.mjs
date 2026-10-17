/**
 * 用 Chrome DevTools Protocol 做真实浏览器交互测试：
 * 打开页面 → 点击元素 → 等待 → 读取 DOM → 截图。
 * 用法: node .tools/cdp_test.mjs http://127.0.0.1:4173/dc.html "#btn-run" 1200 out.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2];
const clickSel = process.argv[3] || '';
const waitMs = Number(process.argv[4] || 1000);
const shot = process.argv[5] || '';
const evalExpr = process.argv[6] || '';

const port = 9333;
const profile = '.tmp_cdp';
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1440,1000',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('chrome devtools not ready');
}

const wsUrl = await getWs();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1400);

const logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
});

if (clickSel) {
  const r = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(clickSel)}); if (!el) return 'NOT_FOUND'; el.click(); return 'CLICKED'; })()`,
    returnByValue: true,
  });
  console.log('click:', r.result.value);
  await sleep(waitMs);
}

const expr = evalExpr || `(() => ({
  title: document.title,
  svgCount: document.querySelectorAll('svg').length,
  sysTime: document.getElementById('sys-time')?.textContent || '',
  sync: document.getElementById('sync-info')?.textContent?.trim() || '',
  errs: [...document.querySelectorAll('#clocks .lag')].map(n => n.textContent.trim()),
  esm: document.getElementById('esm-state')?.textContent || '',
  logLines: document.querySelectorAll('#log div, #esm-log div').length,
}))()`;
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log('state:', JSON.stringify(out.result.value ?? out.result, null, 0));

if (shot) {
  const png = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(shot, Buffer.from(png.data, 'base64'));
  console.log('screenshot ->', shot);
}

if (logs.length) { console.log('console:'); logs.slice(0, 12).forEach(l => console.log('  ' + l)); }

ws.close();
proc.kill();
await sleep(300);
process.exit(0);
