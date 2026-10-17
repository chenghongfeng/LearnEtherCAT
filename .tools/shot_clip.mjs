/**
 * 按纵向区间截图（用于检查长页面）。
 * 用法: node .tools/shot_clip.mjs <url> <out.png> <y> <height> [evalExpr]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [url, out, yArg, hArg, expr, wArg] = process.argv.slice(2);
const W = Number(wArg || 1440);
const y = Number(yArg || 0), h = Number(hArg || 900);
const port = 9727;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_shot')}`, 'about:blank',
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

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: 1000, deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url });
await sleep(1500);
let code = expr;
if (code && code.startsWith('@')) code = fs.readFileSync(code.slice(1), 'utf8');
if (code) {
  await send('Runtime.evaluate', { expression: code, returnByValue: true });
  await sleep(400);
}
const { data } = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y, width: W, height: h, scale: 1 },
});
fs.writeFileSync(out, Buffer.from(data, 'base64'));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
ws.close(); proc.kill(); await sleep(200); process.exit(0);
