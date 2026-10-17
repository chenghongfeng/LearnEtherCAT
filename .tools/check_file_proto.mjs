/**
 * 验证 file:// 下页面是否因 ES module CORS 而完全不执行。
 * 用法: node .tools/check_file_proto.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const target = pathToFileURL(path.resolve('frame.html')).href;
const port = 9734;
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1200,900',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_file')}`,
  'about:blank',
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
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled') logs.push('LOG ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Log.entryAdded') logs.push('LOGENTRY ' + m.params.entry.level + ': ' + m.params.entry.text);
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.exceptionDetails ? { ERROR: r.exceptionDetails.text } : r.result.value;
};

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Page.navigate', { url: target });
await sleep(2000);

console.log('target:', target);
console.log('state:', await evalJs(`(() => ({
  navLinks: document.querySelectorAll('.nav a').length,
  cells: document.querySelectorAll('.cell').length,
  bits: document.querySelectorAll('.bit').length,
  modeButtons: document.querySelectorAll('#mode button').length,
}))()`));
console.log('mode button on-click test:', await evalJs(`(() => {
  const b = document.querySelector('#mode button[data-m="multi"]');
  if (!b) return 'no button';
  b.click();
  return { cls: b.className, cells: document.querySelectorAll('.cell').length };
})()`));
console.log('console/log entries:');
logs.slice(0, 8).forEach(l => console.log('  ' + l.slice(0, 300)));

ws.close(); proc.kill(); await sleep(300); process.exit(0);
