# -*- coding: utf-8 -*-
"""
把 assets/data/esi-examples.json 内联进 slave.html，
这样直接双击（file://）打开也能看到真实 ESI 示例树。
用法: python .tools/embed_esi.py   （修改 ESI 数据后需重新运行）
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / 'slave.html'
DATA = ROOT / 'assets' / 'data' / 'esi-examples.json'

BEGIN = '<!-- ESI_DATA_BEGIN -->'
END = '<!-- ESI_DATA_END -->'

html = PAGE.read_text(encoding='utf-8')
data = json.loads(DATA.read_text(encoding='utf-8'))
payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
# 防止提前闭合 script
payload = payload.replace('</', '<\\/')

block = (f'{BEGIN}\n<script id="esi-data" type="application/json">{payload}</script>\n{END}')

if BEGIN in html and END in html:
    pre = html.split(BEGIN)[0]
    post = html.split(END, 1)[1]
    html = pre + block + post
else:
    # 插在第一个 module script 之前
    idx = html.index('<script type="module">')
    html = html[:idx] + block + '\n' + html[idx:]

PAGE.write_text(html, encoding='utf-8')
print(f'embedded {len(payload)/1024:.1f} KB into {PAGE.name}')
