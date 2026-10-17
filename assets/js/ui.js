/* =========================================================
   共享 UI 框架：导航 / 顶栏 / 提示气泡 / 小工具
   ========================================================= */

export const NAV = [
  { group: '开始' },
  { id: 'index',    num: '00', href: 'index.html',    title: '学习总览',     tag: '地图' },
  { id: 'frame',    num: '01', href: 'frame.html',    title: '帧解剖',       tag: 'DLL' },
  { id: 'network',  num: '02', href: 'network.html',  title: '网络实验室',   tag: 'DLL' },
  { group: '主站 / 从站' },
  { id: 'master',   num: '03', href: 'master.html',   title: '主站视角',     tag: 'MainDevice' },
  { id: 'al',       num: '04', href: 'al.html',       title: '从站与状态机', tag: 'AL' },
  { id: 'mbx',      num: '05', href: 'eoe-foe-soe.html', title: 'EoE/FoE/SoE', tag: '邮箱' },
  { id: 'slave',    num: '06', href: 'slave.html',    title: 'ESI / SII',    tag: 'SubDevice' },
  { id: 'dc',       num: '07', href: 'dc.html',       title: '分布式时钟',   tag: 'DC' },
  { group: '参考' },
  { id: 'spec',     num: '08', href: 'spec.html',     title: '规范地图',     tag: 'ETG' },
  { id: 'guide',    num: '09', href: 'guide.html',    title: '学习手册',     tag: '通读' },
  { id: 'glossary', num: '10', href: 'glossary.html', title: '术语表',       tag: 'KW' },
];

export function renderShell({ active, crumbs = [], title = 'EtherCAT 可视化学习站', docCount = 17 }) {
  const nav = NAV.map(n => {
    if (n.group) return `<div class="nav-group">${n.group}</div>`;
    return `<a href="${n.href}" class="${n.id === active ? 'active' : ''}">
      <span class="num">${n.num}</span><span>${n.title}</span>
      <span class="tag">${n.tag}</span></a>`;
  }).join('');

  const crumb = crumbs.map((c, i) =>
    i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span><span>›</span>`
  ).join('');

  const side = document.createElement('aside');
  side.className = 'side';
  side.innerHTML = `
    <div class="brand">
      <div class="logo">EC</div>
      <div><b>EtherCAT 可视化</b><span>Protocol Stack Lab</span></div>
    </div>
    <nav class="nav">${nav}</nav>
    <div class="nav-group" style="margin-top:22px">本地资料</div>
    <a class="nav" style="display:block;padding:6px 10px;font-size:12px;color:var(--text-faint)"
       href="spec.html">etg_doc/ · ${docCount} 份文档</a>
  `;

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="crumbs">${crumb}</div>
    <div class="spacer"></div>
    <span class="pill"><span class="dot"></span>${title}</span>
    <span class="pill mono" title="术语已对齐 ETG 新命名">MainDevice / SubDevice</span>  `;

  const existingSide = document.querySelector('.side');
  if (existingSide) existingSide.replaceWith(side); else document.body.prepend(side);
  const main = document.querySelector('.main');
  if (main) main.prepend(top);

  document.title = `${crumbs[crumbs.length - 1] || ''} · EtherCAT 可视化学习站`;
  injectTip();
}

/* ---------- 悬浮提示 ---------- */
function injectTip() {
  if (document.getElementById('ec-tip')) return;
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.id = 'ec-tip';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    tip.innerHTML = t.dataset.tip;
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    let y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tip]')) tip.style.display = 'none';
  });
}

/* ---------- 工具 ---------- */
export const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');
export const hex0x = (n, w = 2) => '0x' + hex(n, w);
export const bin = (n, w = 8) => n.toString(2).padStart(w, '0');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (n, d = 1) => Number(n).toFixed(d);
export const rnd = (a, b) => a + Math.random() * (b - a);

export function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  if (html) n.innerHTML = html;
  return n;
}

/** 生成确定性的伪随机字节（便于复现同样的帧） */
export function prng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

export function toast(msg, kind = 'ok') {
  const d = el('div', {
    class: 'pill',
    style: `position:fixed;right:22px;bottom:22px;z-index:200;padding:10px 16px;
            border-color:${kind === 'ok' ? '#2f6f45' : '#7a3b3b'};
            background:${kind === 'ok' ? '#0e2016' : '#241012'};color:#e9fff2;
            box-shadow:0 12px 40px rgba(0,0,0,.6)`
  }, msg);
  document.body.appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = 0; }, 1800);
  setTimeout(() => d.remove(), 2300);
}

/** 页码脚注：标注数据来源 */
export function sourceNote(text) {
  return `<span class="src">${text}</span>`;
}

/* =========================================================
   页面自检徽标（右下角）
   - 静态 HTML 里预置 .selfcheck；脚本没跑起来时它保持“脚本未执行”
   - ec-core.js 加载后切到“检查中”，load 后按页面逐项检查
   - 结果：通过 / 异常 N 项 / 脚本未执行；点击展开明细
   ========================================================= */
const EC_ERRORS = [];
if (typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    EC_ERRORS.push({ kind: 'error', msg: e.message || String(e.error || '(unknown)'), src: e.filename || '' });
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    EC_ERRORS.push({ kind: 'promise', msg: (r && (r.stack || r.message)) || String(r) });
  });
}

const CHECK_NAV = ['导航渲染', () => document.querySelectorAll('.nav a').length >= 9];

const PAGE_CHECKS = {
  index: [
    ['分层堆栈', () => document.querySelectorAll('.layer').length === 3],
    ['资料表', () => document.querySelectorAll('#spec-table tbody tr').length >= 10],
  ],
  frame: [
    ['帧单元', () => document.querySelectorAll('.cell').length >= 10],
    ['位图', () => document.querySelectorAll('.bit').length > 0],
    ['命令 chips', () => document.querySelectorAll('#cmdpick button').length >= 14],
  ],
  network: [
    ['拓扑图', () => !!document.querySelector('#stage svg')],
    ['WKC 面板', () => !!document.getElementById('wkc-now')],
  ],
  master: [
    ['能力矩阵', () => document.querySelectorAll('#matrix-tbl tbody tr').length >= 20],
    ['周期时间线', () => !!document.querySelector('#timeline svg')],
  ],
  al: [
    ['ESM 状态图', () => !!document.querySelector('#esm-stage svg')],
    ['邮箱报文', () => (document.getElementById('mb-body')?.textContent || '').length > 100],
  ],
  'eoe-foe-soe': [
    ['EoE 位图', () => document.querySelectorAll('#eoe-bits .bit').length === 32],
    ['报文条', () => document.querySelectorAll('.pkt .b').length >= 10],
  ],
  slave: [
    ['ESI 树', () => document.querySelectorAll('.tree .t').length > 100],
    ['SII 表', () => document.querySelectorAll('.sii-row').length >= 10],
  ],
  dc: [
    ['时钟图', () => !!document.querySelector('#stage svg')],
    ['寄存器表', () => !!document.querySelector('#dc-reg-tbl tbody tr')],
  ],
  spec: [
    ['文档行', () => document.querySelectorAll('.maprow').length >= 15],
    ['覆盖矩阵', () => document.querySelectorAll('#cov-tbl tbody tr').length >= 15],
  ],
  guide: [
    ['目录', () => document.querySelectorAll('.toc a').length >= 20],
    ['正文标题', () => document.querySelectorAll('article.doc h2').length >= 8],
  ],
  glossary: [
    ['术语卡片', () => document.querySelectorAll('.g-term').length >= 30],
    ['搜索框', () => !!document.getElementById('g-search')],
  ],
};

function selfCheckPageKey() {
  const f = (location.pathname.split('/').pop() || 'index.html');
  return f.replace(/\.html$/i, '') || 'index';
}

function runSelfChecks() {
  const list = [CHECK_NAV, ...(PAGE_CHECKS[selfCheckPageKey()] || []),
    ['核心库加载', () => typeof window.EC_DATA === 'object' && typeof window.EC_UI === 'object']];
  return list.map(([name, fn]) => {
    try { return { name, ok: !!fn(), err: '' }; }
    catch (e) { return { name, ok: false, err: e.message }; }
  });
}

function paintBadge(el, state, text) {
  el.classList.remove('sc-idle', 'sc-running', 'sc-ok', 'sc-warn', 'sc-fail');
  el.classList.add('sc-' + state);
  el.dataset.state = state;
  const t = el.querySelector('.sc-text');
  if (t) t.textContent = text;
  el.title = state === 'ok'
    ? '页面自检通过：脚本已执行，关键内容已渲染'
    : state === 'running'
      ? '页面自检中…'
      : state === 'warn'
        ? '页面自检异常：点击查看未通过的检查项'
        : '脚本未执行：请按 F12 查看控制台，或确认 assets/js/ec-core.js 存在';
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initSelfCheck() {
  const el = document.getElementById('selfcheck');
  if (!el) return null;

  const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  paintBadge(el, 'running', '检查中…');

  let state = { checks: [], errors: [], ms: 0, page: selfCheckPageKey(), proto: location.protocol };

  const finish = () => {
    const checks = runSelfChecks();
    const bad = checks.filter(c => !c.ok);
    const ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
    state = { checks, errors: EC_ERRORS.slice(0, 5), ms, page: selfCheckPageKey(), proto: location.protocol };

    if (typeof window.EC_UI !== 'object' || typeof window.EC_DATA !== 'object') {
      paintBadge(el, 'fail', '脚本未执行');
    } else if (bad.length === 0) {
      paintBadge(el, 'ok', '自检通过');
    } else {
      paintBadge(el, 'warn', `自检异常 ${bad.length}`);
    }
    el.dataset.ms = String(ms);
    renderSelfPanel(el, state);
    return state;
  };

  const schedule = () => setTimeout(finish, 150);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  if (!el.dataset.scBound) {
    el.dataset.scBound = '1';
    el.addEventListener('click', e => {
      if (e.target.closest('.sc-act')) return;
      el.classList.toggle('open');
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.classList.toggle('open'); }
      if (e.key === 'Escape') el.classList.remove('open');
    });
    document.addEventListener('click', e => {
      if (!el.contains(e.target)) el.classList.remove('open');
    });
  }

  window.EC_SELFCHECK = { run: finish, state: () => state };
  return { finish };
}

function renderSelfPanel(el, state) {
  const rows = state.checks.map(c =>
    `<div class="sc-row ${c.ok ? 'ok' : 'bad'}"><span>${c.ok ? '✓' : '✗'}</span>${escHtml(c.name)}${c.err ? `<i>${escHtml(c.err)}</i>` : ''}</div>`
  ).join('');
  const errs = state.errors.length
    ? `<div class="sc-sec">捕获到 ${state.errors.length} 个脚本错误</div>` +
      state.errors.map(e => `<pre class="sc-err">${escHtml(e.msg).slice(0, 400)}</pre>`).join('')
    : `<div class="sc-sec ok-note">无脚本错误</div>`;
  const protoHint = state.proto === 'file:'
    ? 'file:// 模式：脚本已按 classic 方式加载，无需服务器。'
    : `协议：${state.proto} // ${escHtml(location.host || 'local')}`;

  el.querySelectorAll('.sc-panel').forEach(n => n.remove());
  const panel = document.createElement('div');
  panel.className = 'sc-panel';
  panel.innerHTML = `
    <div class="sc-head">
      <b>页面自检</b>
      <span class="sc-meta">${escHtml(state.page)}.html · ${state.ms} ms</span>
    </div>
    <div class="sc-rows">${rows}</div>
    ${errs}
    <div class="sc-foot">
      <span class="sc-hint">${protoHint}</span>
      <button class="sc-act" type="button">重新检查</button>
    </div>`;
  el.appendChild(panel);
  panel.querySelector('.sc-act').addEventListener('click', ev => {
    ev.stopPropagation();
    initSelfCheck();
    el.classList.add('open');
  });
}

/* 自动挂载：页面脚本执行完后自检 */
if (typeof document !== 'undefined') {
  const boot = () => {
    if (!document.getElementById('selfcheck')) {
      const d = document.createElement('div');
      d.id = 'selfcheck';
      d.className = 'selfcheck sc-idle';
      d.setAttribute('role', 'status');
      d.setAttribute('aria-live', 'polite');
      d.tabIndex = 0;
      d.innerHTML = '<span class="sc-dot"></span><span class="sc-text">脚本未执行</span>';
      document.body.appendChild(d);
    }
    initSelfCheck();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0), { once: true });
  } else {
    setTimeout(boot, 0);
  }
}

/* =========================================================
   术语关键词：自动给正文里的术语加下划线，悬停/点击弹出解释
   ========================================================= */
const KW_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'PRE', 'CODE', 'TEXTAREA', 'SELECT', 'OPTION', 'A', 'BUTTON', 'H1', 'H2', 'H3']);
const KW_SKIP_ZONES = '.kw, .nav, .side, .topbar, .toc, .crumbs, #kw-tip, .cell, .pkt, .mail, [data-nokw]';
const KW_MAX_PER_RUN = 140;   // 单次扫描最多新增多少个高亮（性能保护）

let KW_INDEX = null;
let KW_BY_KEY = null;
let kwObserver = null;
let kwTimer = null;
let kwActive = null;
let kwPinned = null;
let kwHideTimer = null;

function kwInitData() {
  if (KW_INDEX) return;
  const list = (window.EC_DATA && window.EC_DATA.GLOSSARY) || [];
  KW_BY_KEY = {};
  KW_INDEX = [];
  for (const g of list) {
    KW_BY_KEY[g.k] = g;
    const names = [g.t, ...(g.alias || [])].filter(Boolean);
    for (const n of names) {
      KW_INDEX.push({ key: g.k, needle: n, latin: /^[\x20-\x7e]+$/.test(n) });
    }
  }
  KW_INDEX.sort((a, b) => b.needle.length - a.needle.length);
}

function kwBoundaryOk(text, at, len, latin) {
  if (!latin) return true;
  const before = at > 0 ? text[at - 1] : '';
  const after = text[at + len] || '';
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

function kwNextMatch(text, from) {
  let best = null;
  for (const item of KW_INDEX) {
    let i = text.indexOf(item.needle, from);
    while (i >= 0) {
      if (kwBoundaryOk(text, i, item.needle.length, item.latin)) {
        if (!best || i < best.start) {
          best = { start: i, end: i + item.needle.length, key: item.key, text: item.needle };
        }
        break;
      }
      i = text.indexOf(item.needle, i + 1);
    }
  }
  return best;
}

const KW_BLOCK_SEL = 'p, li, td, th, blockquote, section, article, header, footer';
const KW_BLOCK_MAX = 8;
const KW_BLOCK_PER_KEY = 1;
const KW_BLOCK_USAGE = new WeakMap();

function kwWrapNode(node, budget) {
  const parent = node.parentElement;
  if (!parent) return;
  if (KW_SKIP_TAGS.has(parent.tagName)) return;
  if (parent.closest(KW_SKIP_ZONES)) return;
  const text = node.nodeValue;
  if (!text || !text.trim()) return;

  // 每个文本块（段落/单元格）自己计数：动态重渲染的新段落也能正常标注
  const block = parent.closest(KW_BLOCK_SEL) || parent;
  let usage = KW_BLOCK_USAGE.get(block);
  if (!usage) {
    usage = { total: 0, perKey: Object.create(null) };
    KW_BLOCK_USAGE.set(block, usage);
  }

  let pos = 0;
  let frag = null;
  while (true) {
    const m = kwNextMatch(text, pos);
    if (!m) break;
    if (!frag) frag = document.createDocumentFragment();
    if (m.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, m.start)));

    const underCap = budget.total < budget.maxTotal
      && usage.total < KW_BLOCK_MAX
      && (usage.perKey[m.key] || 0) < KW_BLOCK_PER_KEY;
    if (!KW_BY_KEY[m.key] || !underCap) {
      frag.appendChild(document.createTextNode(text.slice(m.start, m.end)));
      pos = m.end;
      continue;
    }
    const span = document.createElement('span');
    span.className = 'kw';
    span.dataset.k = m.key;
    span.textContent = m.text;
    frag.appendChild(span);
    usage.total++;
    usage.perKey[m.key] = (usage.perKey[m.key] || 0) + 1;
    budget.total++;
    pos = m.end;
  }
  if (!frag) return;
  if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
  node.parentNode.replaceChild(frag, node);
}

function kwWrapRoot(root, opts = {}) {
  if (!root) return 0;
  kwInitData();
  if (!KW_INDEX || !KW_INDEX.length) return 0;
  const budget = { total: 0, maxTotal: opts.maxTotal || KW_MAX_PER_RUN };
  const active = kwActive;
  const activeKey = active && active.dataset ? active.dataset.k : null;
  const activeText = active ? active.textContent : null;
  const activeInside = active && root.contains(active);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (KW_SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.closest(KW_SKIP_ZONES)) return NodeFilter.FILTER_REJECT;
      return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n => kwWrapNode(n, budget));

  // 文本被重新包过之后，把正在显示的 tip 接到新的同名 span 上
  if (activeInside && active && !active.isConnected) {
    let alt = null;
    if (activeKey) {
      alt = [...root.querySelectorAll('.kw[data-k="' + activeKey + '"]')]
        .find(el => el.textContent === activeText) || null;
    }
    if (alt) {
      kwActive = alt;
      if (kwPinned) kwPinned = alt;
      alt.classList.add('kw-on');
      const tip = document.getElementById('kw-tip');
      if (tip && !tip.hidden) kwRenderTip(alt);
    } else {
      kwHide(true);
    }
  }
  return budget.total;
}

function kwTipEl() {
  let tip = document.getElementById('kw-tip');
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = 'kw-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  tip.addEventListener('mouseenter', () => clearTimeout(kwHideTimer));
  tip.addEventListener('mouseleave', () => kwScheduleHide());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { kwPinned = null; kwHide(true); }
  });
  window.addEventListener('scroll', () => { if (!kwTipEl().hidden) kwPosition(); }, { passive: true });
  window.addEventListener('resize', () => { if (!kwTipEl().hidden) kwPosition(); });
  return tip;
}

function kwRenderTip(span) {
  const g = KW_BY_KEY[span.dataset.k];
  const tip = kwTipEl();
  if (!g) return;
  const rel = (g.rel || []).map(k => KW_BY_KEY[k]).filter(Boolean);
  tip.innerHTML = `
    <div class="kt-head"><b>${g.t}</b> <span class="kt-full">${g.full}</span></div>
    <div class="kt-zh">${g.zh}</div>
    <div class="kt-short">${g.short}</div>
    <div class="kt-detail">${g.detail}</div>
    <div class="kt-foot">
      <span class="src">${g.src}</span>
      ${rel.length ? `<span class="kt-rel">相关：${rel.map(r => `<a href="glossary.html#k-${r.k}">${r.t}</a>`).join(' · ')}</span>` : ''}
      <a class="kt-more" href="glossary.html#k-${g.k}">术语表 →</a>
    </div>`;
  tip.hidden = false;
  kwActive = span;
  kwPosition();
}

function kwPosition() {
  const tip = document.getElementById('kw-tip');
  if (!tip || tip.hidden || !kwActive) return;
  const r = kwActive.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(10, Math.min(x, window.innerWidth - w - 10));
  let y = r.top - h - 10;
  if (y < 8) y = r.bottom + 10;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

function kwShow(span) {
  clearTimeout(kwHideTimer);
  kwRenderTip(span);
}

function kwScheduleHide() {
  clearTimeout(kwHideTimer);
  kwHideTimer = setTimeout(() => { if (!kwPinned) kwHide(); }, 180);
}

function kwHide(force) {
  if (kwPinned && !force) return;
  const tip = document.getElementById('kw-tip');
  if (tip) { tip.hidden = true; tip.innerHTML = ''; }
  if (kwActive) kwActive.classList.remove('kw-on');
  kwActive = null;
}

function kwBind() {
  document.addEventListener('mouseover', e => {
    const span = e.target.closest && e.target.closest('.kw');
    if (span && !span.contains(e.relatedTarget)) { span.classList.add('kw-on'); kwShow(span); }
  });
  document.addEventListener('mouseout', e => {
    const span = e.target.closest && e.target.closest('.kw');
    if (span && !span.contains(e.relatedTarget)) { span.classList.remove('kw-on'); kwScheduleHide(); }
  });
  document.addEventListener('focusin', e => {
    const span = e.target.closest && e.target.closest('.kw');
    if (span) kwShow(span);
  });
  document.addEventListener('click', e => {
    const span = e.target.closest && e.target.closest('.kw');
    if (span) {
      e.preventDefault();
      if (kwPinned === span) { kwPinned = null; kwHide(true); }
      else { kwPinned = span; span.classList.add('kw-on'); kwShow(span); }
      return;
    }
    if (kwPinned) { kwPinned = null; kwHide(true); }
    else if (!e.target.closest || !e.target.closest('#kw-tip')) kwHide(true);
  });
}

function kwObserverStart() {
  if (kwObserver) return;
  const root = document.querySelector('.wrap') || document.body;
  kwObserver = new MutationObserver(() => {
    clearTimeout(kwTimer);
    kwTimer = setTimeout(() => {
      kwWrapRoot(root, { maxTotal: 120, maxPerKey: 3 });
    }, 140);
  });
  kwObserver.observe(root, { childList: true, subtree: true });
}

if (typeof window !== 'undefined') {
  window.EC_KW = { wrap: kwWrapRoot };
}

export function initGlossary() {
  kwInitData();
  if (!KW_INDEX || !KW_INDEX.length) return { count: 0 };

  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/i, '') || 'index';
  if (page === 'glossary') return { count: 0 };

  kwBind();
  const root = document.querySelector('.wrap');
  kwWrapRoot(root, { maxTotal: 420, maxPerKey: 4 });
  kwObserverStart();

  try {
    if (!sessionStorage.getItem('ec-kw-hint')) {
      sessionStorage.setItem('ec-kw-hint', '1');
      const hint = document.createElement('div');
      hint.className = 'kw-hint';
      hint.innerHTML = '<b>术语提示</b>：正文里带虚线下划线的词（例如 <span class="kw" data-k="adp">ADP</span>）可以悬停或点击，弹出它的解释与规范出处。';
      hint.addEventListener('click', e => {
        if (e.target.closest('.kw')) return;
        hint.remove();
      });
      const head = document.querySelector('.wrap .page-head');
      if (head) head.after(hint);
    }
  } catch (e) { /* file:// 下 sessionStorage 可能不可用，忽略 */ }

  const live = document.querySelectorAll('.kw').length;
  window.EC_GLOSSARY = { count: live, terms: KW_INDEX.length };
  return { count: live };
}

/* 自动挂载：页面脚本执行完后加关键词 */
if (typeof document !== 'undefined') {
  const bootGlossary = () => setTimeout(() => {
    try { initGlossary(); } catch (e) { /* 关键词失败不影响页面 */ }
  }, 80);
  if (document.readyState === 'complete') bootGlossary();
  else window.addEventListener('load', bootGlossary, { once: true });
}
