/**
 * 术语表与关键词弹窗专项。
 * 用法: node .tools/check_glossary.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = pathToFileURL(path.resolve('.')).href + '/';
const port = 9726;

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--window-size=1440,1000',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve('.tmp_gw')}`, 'about:blank',
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
const log = (t, v) => console.log(t.padEnd(16), typeof v === 'string' ? v : JSON.stringify(v));

await send('Page.enable'); await send('Runtime.enable');

// ---------- 术语表页 ----------
await send('Page.navigate', { url: base + 'glossary.html' });
await sleep(1100);
log('术语表', await evalJs(`(() => ({
  terms: document.querySelectorAll('.g-term').length,
  groups: document.querySelectorAll('#g-chips button').length,
  count: document.getElementById('g-count').textContent.replace(/\\s+/g, ' ').trim(),
  ids: !!document.getElementById('k-adp') && !!document.getElementById('k-wkc'),
}))()`));

log('搜索 adp', await evalJs(`(() => {
  const i = document.getElementById('g-search');
  i.value = 'adp'; i.dispatchEvent(new Event('input', { bubbles: true }));
  const names = [...document.querySelectorAll('.g-term h3')].map(n => n.textContent);
  return { n: names.length, names: names.slice(0, 6) };
})()`));

log('清空+分组', await evalJs(`(() => {
  const i = document.getElementById('g-search');
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#g-chips button[data-g="dc"]').click();
  return {
    n: document.querySelectorAll('.g-term').length,
    first: document.querySelector('.g-term h3')?.textContent,
  };
})()`));

log('哈希定位', await evalJs(`(async () => {
  document.querySelector('#g-chips button[data-g="all"]').click();
  location.hash = 'k-soe';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise(r => setTimeout(r, 200));
  const el = document.getElementById('k-soe');
  return { hit: el?.classList.contains('hit'), term: el?.querySelector('h3')?.textContent };
})()`));

// ---------- frame 页关键词 ----------
await send('Page.navigate', { url: base + 'frame.html' });
await sleep(1200);
log('关键词数', await evalJs(`(() => {
  const all = [...document.querySelectorAll('.kw')];
  const byKey = {};
  all.forEach(k => byKey[k.dataset.k] = (byKey[k.dataset.k] || 0) + 1);
  return {
    total: all.length,
    adp: byKey.adp || 0,
    ado: byKey.ado || 0,
    wkc: byKey.wkc || 0,
    hint: !!document.querySelector('.kw-hint'),
    firstAdp: document.querySelector('.kw[data-k="adp"]')?.textContent,
  };
})()`));

log('悬停 ADP', await evalJs(`(() => {
  const s = document.querySelector('.kw[data-k="adp"]');
  s.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }));
  const tip = document.getElementById('kw-tip');
  return {
    hidden: tip.hidden,
    head: tip.querySelector('.kt-head')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60),
    short: tip.querySelector('.kt-short')?.textContent.slice(0, 40),
    href: tip.querySelector('.kt-more')?.getAttribute('href'),
    rect: (() => { const r = tip.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(),
  };
})()`));

log('点击固定', await evalJs(`(() => {
  const s = document.querySelector('.kw[data-k="ado"]');
  s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const tip = document.getElementById('kw-tip');
  return { hidden: tip.hidden, term: tip.querySelector('.kt-head b')?.textContent, pinned: s.classList.contains('kw-on') };
})()`));

log('ESC 关闭', await evalJs(`(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { hidden: document.getElementById('kw-tip').hidden };
})()`));

log('相关词跳转', await evalJs(`(() => {
  const s = document.querySelector('.kw[data-k="wkc"]');
  s.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const a = document.querySelector('#kw-tip .kt-rel a');
  return { text: a?.textContent, href: a?.getAttribute('href') };
})()`));

// ---------- 全站关键词计数 ----------
const PAGES = ['index', 'frame', 'network', 'master', 'al', 'eoe-foe-soe', 'slave', 'dc', 'spec', 'guide', 'glossary'];
for (const name of PAGES) {
  await send('Page.navigate', { url: base + name + '.html' });
  await sleep(1000);
  const r = await evalJs(`(() => ({
    kw: document.querySelectorAll('.kw').length,
    inNav: document.querySelectorAll('.nav .kw, .side .kw').length,
    inCode: document.querySelectorAll('pre .kw, code .kw').length,
  }))()`);
  console.log(`kw ${name.padEnd(12)}`, JSON.stringify(r));
}

ws.close(); proc.kill(); await sleep(200); process.exit(0);
