# -*- coding: utf-8 -*-
"""
把 docs/guide.md 编译成 guide.html（带站点外壳、目录、代码/表格样式）。
不引第三方依赖，只覆盖本仓库用到的 Markdown 子集：
标题、段落、加粗/行内代码/链接、有序/无序列表、表格、引用、代码块、分隔线。
用法: python .tools/build_guide.py
"""
import html
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'guide.md'
OUT = ROOT / 'guide.html'


def inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)
    return s


def slug(s: str) -> str:
    s = re.sub(r'[`*\[\]()]', '', s).strip()
    # 保留中英文数字，其它变连字符；避免纯数字/特殊字符导致的非法选择器
    s = re.sub(r'[^\w\u4e00-\u9fff]+', '-', s, flags=re.UNICODE).strip('-')
    return ('t-' + s) if s else 't'


def convert(md: str):
    lines = md.split('\n')
    out, toc = [], []
    i = 0
    in_ul = in_ol = False
    while i < len(lines):
        ln = lines[i]
        # 代码块
        if ln.startswith('```'):
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith('```'):
                buf.append(html.escape(lines[i], quote=False))
                i += 1
            i += 1
            out.append('<pre class="code"><code>' + '\n'.join(buf) + '</code></pre>')
            continue
        # 分隔线
        if re.match(r'^---+\s*$', ln):
            out.append('<hr>')
            i += 1
            continue
        # 标题
        m = re.match(r'^(#{1,4})\s+(.*)$', ln)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            sid = slug(text)
            if level == 1:
                out.append(f'<h1 id="{sid}">{inline(text)}</h1>')
            elif level == 2:
                out.append(f'<h2 id="{sid}">{inline(text)}</h2>')
                toc.append((2, sid, text))
            elif level == 3:
                out.append(f'<h3 id="{sid}">{inline(text)}</h3>')
                toc.append((3, sid, text))
            else:
                out.append(f'<h4 id="{sid}">{inline(text)}</h4>')
            i += 1
            continue
        # 表格
        if '|' in ln and i + 1 < len(lines) and re.match(r'^\s*\|?[\s:\-|]+\|', lines[i + 1]):
            header = [c.strip() for c in ln.strip().strip('|').split('|')]
            i += 2
            rows = []
            while i < len(lines) and '|' in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            th = ''.join(f'<th>{inline(c)}</th>' for c in header)
            trs = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in rows)
            out.append(f'<div class="scroll"><table class="tbl"><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>')
            continue
        # 引用
        if ln.startswith('>'):
            buf = []
            while i < len(lines) and lines[i].startswith('>'):
                buf.append(lines[i].lstrip('> ').rstrip())
                i += 1
            out.append('<div class="note">' + inline(' '.join(buf)) + '</div>')
            continue
        # 列表
        if re.match(r'^\s*[-*]\s+', ln):
            if not in_ul:
                out.append('<ul>')
                in_ul = True
            item = re.sub(r'^\s*[-*]\s+', '', ln)
            item = re.sub(r'^\s{2,}', '', item)
            out.append(f'<li>{inline(item)}</li>')
            i += 1
            continue
        if re.match(r'^\s*\d+\.\s+', ln):
            if not in_ol:
                out.append('<ol>')
                in_ol = True
            item = re.sub(r'^\s*\d+\.\s+', '', ln)
            out.append(f'<li>{inline(item)}</li>')
            i += 1
            continue
        if in_ul:
            out.append('</ul>'); in_ul = False
        if in_ol:
            out.append('</ol>'); in_ol = False

        if not ln.strip():
            i += 1
            continue

        # 段落（连续非空行合并）
        buf = [ln]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r'^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+\.\s|---)', lines[i]) and '|' not in lines[i]:
            buf.append(lines[i])
            i += 1
        out.append('<p>' + inline(' '.join(x.strip() for x in buf)) + '</p>')

    if in_ul:
        out.append('</ul>')
    if in_ol:
        out.append('</ol>')
    return '\n'.join(out), toc


def main():
    md = SRC.read_text(encoding='utf-8')
    body, toc = convert(md)
    toc_html = '\n'.join(
        f'<a href="#{sid}" class="lvl{lvl}">{html.escape(text)}</a>' for lvl, sid, text in toc
    )
    page = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EtherCAT 学习手册 · 通读版</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230b1c26'/%3E%3Crect x='5' y='5' width='22' height='22' rx='5' fill='none' stroke='%2338bdf8' stroke-width='2'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='11' font-weight='700' fill='%237dd3fc' text-anchor='middle'%3EEC%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/css/style.css">
<style>
  .doc-grid{{display:grid;grid-template-columns:250px minmax(0,1fr);gap:34px;align-items:start}}
  .toc{{position:sticky;top:64px;max-height:calc(100vh - 90px);overflow:auto;border-left:1px solid var(--line);padding-left:14px}}
  .toc a{{display:block;color:var(--text-dim);font-size:12.5px;padding:3px 0;text-decoration:none;border-left:2px solid transparent;padding-left:8px;margin-left:-16px}}
  .toc a:hover{{color:var(--text);border-left-color:#2b415a}}
  .toc a.lvl3{{font-size:11.5px;color:var(--text-faint);padding-left:20px}}
  .toc a.on{{color:#9fe0ff;border-left-color:var(--master)}}
  .doc h1{{font-size:32px;margin:0 0 8px}}
  .doc h2{{font-size:22px;margin:38px 0 12px}}
  .doc h3{{font-size:16px;margin:22px 0 8px}}
  .doc p{{color:#c3d5e4;max-width:82ch}}
  .doc li{{color:#c3d5e4;margin:4px 0}}
  .doc code{{background:#0c1620;border:1px solid #1b2a3a;border-radius:4px;padding:0 4px;font-size:12.5px;color:#9fe0ff}}
  .doc pre.code code{{background:none;border:0;padding:0;color:#cfe6f5}}
  .doc .note{{margin:16px 0}}
  .doc .scroll{{margin:12px 0}}
  @media (max-width:1000px){{.doc-grid{{grid-template-columns:minmax(0,1fr)}} .toc{{display:none}}}}
</style>
</head>
<body>
<div class="shell">
  <div class="side" id="side-slot"></div>
  <div class="main">
    <div class="topbar" id="top-slot"></div>
    <div class="wrap">
      <div class="doc-grid">
        <aside class="toc" id="toc">{toc_html}</aside>
        <article class="doc">
{body}
        </article>
      </div>
      <footer class="end">
        <a href="index.html">← 回到总览</a>
        <span>生成自 docs/guide.md · 用 .tools/build_guide.py 重新编译</span>
      </footer>
    </div>
  </div>
</div>

<script src="assets/js/ec-core.js"></script>
<script>
const {{ renderShell }} = EC_UI;
renderShell({{ active: 'guide', crumbs: ['学习站', '参考', '学习手册'], title: '通读版' }});

/* 目录高亮 */
const links = [...document.querySelectorAll('.toc a')];
const heads = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
function spy() {{
  let idx = 0;
  heads.forEach((h, i) => {{ if (h.getBoundingClientRect().top < 120) idx = i; }});
  links.forEach((a, i) => a.classList.toggle('on', i === idx));
}}
document.addEventListener('scroll', spy, {{ passive: true }});
spy();
</script>
<div class="selfcheck sc-idle" id="selfcheck" data-state="idle" role="status" aria-live="polite" tabindex="0"
     title="脚本未执行：若通过 file:// 打开，请确认 assets/js/ec-core.js 存在；否则按 F12 查看控制台">
  <span class="sc-dot"></span><span class="sc-text">脚本未执行</span>
</div>

</body>
</html>
'''
    OUT.write_text(page, encoding='utf-8')
    print(f'wrote {OUT} ({len(page)/1024:.1f} KB), toc entries: {len(toc)}')


if __name__ == '__main__':
    main()
