# -*- coding: utf-8 -*-
"""给所有页面插入内联 SVG favicon（避免 file:// 下的 404 与控制台噪音）。"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SVG = (
    "data:image/svg+xml,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
    "%3Crect width='32' height='32' rx='8' fill='%230b1c26'/%3E"
    "%3Crect x='5' y='5' width='22' height='22' rx='5' fill='none' stroke='%2338bdf8' stroke-width='2'/%3E"
    "%3Ctext x='16' y='21' font-family='monospace' font-size='11' font-weight='700' "
    "fill='%237dd3fc' text-anchor='middle'%3EEC%3C/text%3E%3C/svg%3E"
)
TAG = f'<link rel="icon" href="{SVG}">\n'

for p in sorted(ROOT.glob('*.html')):
    s = p.read_text(encoding='utf-8')
    if 'rel="icon"' in s:
        print('skip', p.name)
        continue
    s = s.replace('<link rel="stylesheet" href="assets/css/style.css">',
                  TAG + '<link rel="stylesheet" href="assets/css/style.css">', 1)
    p.write_text(s, encoding='utf-8')
    print('icon ->', p.name)
