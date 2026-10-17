/**
 * 专测 frame.html 的交互（file://）：场景按钮、命令 chips、滑块、PDU 构造器。
 * 用法: node .tools/check_frame_interactions.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = pathToFileURL(path.resolve('frame.html')).href;
const port = 9477;
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_fi')}`, 'about:blank',
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
  if (r.exceptionDetails) return { ERROR: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1200);

console.log('初始:', await evalJs(`({
  cells: document.querySelectorAll('.cell').length,
  bits: document.querySelectorAll('.bit').length,
  chips: document.querySelectorAll('#cmdpick button').length,
  selectedChip: document.querySelector('#cmdpick button.on')?.textContent,
})`));

console.log('点 APRD chip:', await evalJs(`(() => {
  const b = document.querySelector('#cmdpick button[data-c="1"]');
  b.scrollIntoView({block:'center'}); b.click();
  return {
    chipOn: document.querySelector('#cmdpick button.on')?.textContent,
    selectedCmd: [...document.querySelectorAll('#hdr-fields > div')][0]?.textContent.trim().slice(0,20),
    cells: document.querySelectorAll('.cell').length,
    summary: document.getElementById('summary').textContent.replace(/\\s+/g,' ').slice(0,50),
  };
})()`));
await sleep(200);

console.log('点 BRD chip:', await evalJs(`(() => {
  const b = document.querySelector('#cmdpick button[data-c="7"]');
  b.scrollIntoView({block:'center'}); b.click();
  return {
    chipOn: document.querySelector('#cmdpick button.on')?.textContent,
    wkc: document.getElementById('wkc-total')?.textContent,
    exp: document.getElementById('wkc-exp')?.textContent,
  };
})()`));
await sleep(200);

console.log('拖 LEN 滑块:', await evalJs(`(() => {
  const s = document.getElementById('b-len');
  s.value = 20; s.dispatchEvent(new Event('input', {bubbles:true}));
  return {
    lenOut: document.getElementById('b-len-o').textContent,
    dump: document.getElementById('bdump').textContent.replace(/\\s+/g,' ').trim(),
    explain: document.getElementById('bexplain').textContent.replace(/\\s+/g,' ').slice(0,60),
  };
})()`));
await sleep(200);

console.log('拖 IRQ 滑块:', await evalJs(`(() => {
  const s = document.getElementById('b-irq');
  s.value = 4660; s.dispatchEvent(new Event('input', {bubbles:true}));
  return {
    irqOut: document.getElementById('b-irq-o').textContent,
    dumpHas1234: document.getElementById('bdump').textContent.includes('34'),
  };
})()`));
await sleep(200);

console.log('点整帧格子:', await evalJs(`(() => {
  const c = document.querySelector('.cell[data-f="cmd"]');
  c.click();
  return {
    inspector: document.getElementById('inspector').textContent.replace(/\\s+/g,' ').slice(0,60),
    selected: document.querySelectorAll('.cell.sel').length,
  };
})()`));

ws.close(); proc.kill(); await sleep(300); process.exit(0);
