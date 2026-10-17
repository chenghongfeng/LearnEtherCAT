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
