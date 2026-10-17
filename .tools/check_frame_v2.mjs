/**
 * frame.html 新版交互专项：导览、帧头错位、命令矩阵、位翻转、小测、复位。
 * 用法: node .tools/check_frame_v2.mjs [url]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.argv[2] || pathToFileURL(path.resolve('frame.html')).href;
const port = 9725;

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_fv2')}`, 'about:blank',
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
  return r.exceptionDetails
    ? { ERROR: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') }
    : r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(1200);

const log = (t, v) => console.log(t.padEnd(18), typeof v === 'string' ? v : JSON.stringify(v));

log('初始', await evalJs(`(() => ({
  step: document.querySelector('#tour h3')?.textContent,
  glow: document.querySelectorAll('#strip .cell.glow').length,
  dim: document.querySelectorAll('#strip .cell.dim').length,
  inspect: document.querySelector('#inspector .big')?.textContent,
  cells: document.querySelectorAll('.cell').length,
}))()`));

log('导览下一步', await evalJs(`(() => {
  document.querySelector('#tour button[data-act="next"]').click();
  return {
    step: document.querySelector('#tour h3')?.textContent,
    glow: document.querySelectorAll('#strip .cell.glow').length,
    inspect: document.querySelector('#inspector .big')?.textContent,
    activeDot: document.querySelector('#tour .tour-dots button.on')?.textContent,
  };
})()`));

log('跳第5步', await evalJs(`(() => {
  document.querySelector('#tour .tour-dots button[data-i="4"]').click();
  return {
    step: document.querySelector('#tour h3')?.textContent,
    glow: document.querySelectorAll('#strip .cell.glow').length,
    inspect: document.querySelector('#inspector .big')?.textContent,
  };
})()`));

log('帧头改长度', await evalJs(`(() => {
  const bits = document.querySelectorAll('#fh-b0 .bit');
  bits[2].click();                       // 翻转 Length bit 2
  return {
    warn: (document.querySelector('#fh-warn')?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    badCells: document.querySelectorAll('#strip .cell.bad').length,
    summaryWarn: document.querySelectorAll('#warnings .warn').length,
    fixBtn: !!document.querySelector('#fix-len'),
  };
})()`));

log('恢复自动', await evalJs(`(() => {
  document.querySelector('#fix-len').click();
  return {
    warn: (document.querySelector('#fh-warn')?.textContent || '').trim(),
    badCells: document.querySelectorAll('#strip .cell.bad').length,
  };
})()`));

log('矩阵点 LWR', await evalJs(`(() => {
  document.querySelector('#cmdmatrix button[data-c="11"]').click();
  return {
    chip: document.querySelector('#cmdpick button.on')?.textContent,
    matrixOn: document.querySelector('#cmdmatrix button.on')?.textContent?.slice(0, 4),
    cmdField: document.querySelector('#hdr-fields > div .mono')?.textContent,
    wkc: document.getElementById('wkc-total').textContent + '/' + document.getElementById('wkc-exp').textContent,
  };
})()`));

log('翻转 NEXT 位', await evalJs(`(() => {
  const groups = document.querySelectorAll('#bitrow > div');
  const bits = groups[7].querySelectorAll('.bit');
  bits[7].click();                        // byte7 bit7 = NEXT
  return {
    last: document.getElementById('last-change').textContent.replace(/\\s+/g, ' ').trim(),
    lenCell: [...document.querySelectorAll('#strip .cell')].find(c => c.dataset.f === 'len')?.textContent.replace(/\\s+/g, ' '),
  };
})()`));

log('保留命令', await evalJs(`(() => {
  // 先切到 FRMW(0x0E)，再翻转 CMD bit0 => 0x0F（保留码）
  document.querySelector('#cmdpick button[data-c="14"]').click();
  document.querySelectorAll('#bitrow > div')[0].querySelectorAll('.bit')[0].click();
  return {
    cmd: document.querySelector('#hdr-fields > div .mono')?.textContent,
    warns: [...document.querySelectorAll('#warnings .warn')].map(n => n.textContent.replace(/\\s+/g, ' ').slice(0, 26)),
    wkc: document.getElementById('wkc-total').textContent,
    last: document.getElementById('last-change').textContent.replace(/\\s+/g, ' ').trim().slice(0, 40),
  };
})()`));

log('自动播放', await evalJs(`(async () => {
  document.querySelector('#tour button[data-act="play"]').click();
  const label1 = document.querySelector('#tour button[data-act="play"]').textContent;
  const step1 = document.querySelector('#tour .tour-dots button.on')?.textContent;
  await new Promise(r => setTimeout(r, 2900));
  const step2 = document.querySelector('#tour .tour-dots button.on')?.textContent;
  document.querySelector('#tour button[data-act="play"]').click();
  return { label1, step1, step2, stopped: document.querySelector('#tour button[data-act="play"]').textContent };
})()`));

log('键盘方向键', await evalJs(`(() => {
  document.querySelector('#tour .tour-dots button[data-i="1"]').click();
  const before = document.querySelector('#tour .tour-dots button.on')?.textContent;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  const afterRight = document.querySelector('#tour .tour-dots button.on')?.textContent;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  const afterLeft = document.querySelector('#tour .tour-dots button.on')?.textContent;
  return { before, afterRight, afterLeft };
})()`));

log('模拟掉线', await evalJs(`(() => {
  document.querySelector('#cmdpick button[data-c="12"]').click();
  const before = document.getElementById('wkc-total').textContent + '/' + document.getElementById('wkc-exp').textContent;
  document.querySelector('#wkc-slaves tbody tr[data-pos="2"]').click();
  const after = document.getElementById('wkc-total').textContent + '/' + document.getElementById('wkc-exp').textContent;
  const note = document.getElementById('wkc-note').textContent.replace(/\\s+/g, ' ').trim().slice(0, 46);
  const restore = !!document.getElementById('wkc-restore');
  document.getElementById('wkc-restore').click();
  const back = document.getElementById('wkc-total').textContent + '/' + document.getElementById('wkc-exp').textContent;
  return { before, after, note, restore, back };
})()`));

log('小测答对', await evalJs(`(() => {
  const q = document.querySelector('.q[data-q="1"]');
  q.querySelectorAll('button[data-o]')[2].click();
  return {
    done: q.classList.contains('done'),
    ok: !!q.querySelector('button.ok'),
    why: q.querySelector('.why').textContent.slice(0, 24),
    score: document.getElementById('quiz-score').textContent.replace(/\\s+/g, ' '),
  };
})()`));

log('小测答错', await evalJs(`(() => {
  const q = document.querySelector('.q[data-q="0"]');
  q.querySelectorAll('button[data-o]')[0].click();
  return {
    no: !!q.querySelector('button.no'),
    ok: !!q.querySelector('button.ok'),
    score: document.getElementById('quiz-score').textContent.replace(/\\s+/g, ' '),
  };
})()`));

log('复位', await evalJs(`(() => {
  document.getElementById('btn-reset').click();
  return {
    step: document.querySelector('#tour h3')?.textContent,
    chip: document.querySelector('#cmdpick button.on')?.textContent,
    cells: document.querySelectorAll('#strip .cell').length,
    warn: document.querySelectorAll('#warnings .warn').length,
  };
})()`));

ws.close(); proc.kill(); await sleep(200); process.exit(0);
