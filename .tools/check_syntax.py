# -*- coding: utf-8 -*-
"""对页面里的内联脚本做语法检查（classic 或 module 均可）。
用法: python .tools/check_syntax.py frame.html
"""
import re
import sys
import subprocess
import os

src = sys.argv[1]
s = open(src, encoding='utf-8').read()

blocks = []
for m in re.finditer(r'<script([^>]*)>([\s\S]*?)</script>', s):
    attrs, code = m.group(1), m.group(2)
    if 'src=' in attrs:
        continue
    if 'application/json' in attrs:
        continue
    if not code.strip():
        continue
    blocks.append((attrs.strip() or 'classic', code))

if not blocks:
    print(f'--- {src} 没有内联脚本')
    raise SystemExit(0)

for i, (attrs, code) in enumerate(blocks):
    out = f'.tmp_check_{i}.mjs' if 'module' in attrs else f'.tmp_check_{i}.cjs'
    open(out, 'w', encoding='utf-8').write(code)
    r = subprocess.run(['node', '--check', out], capture_output=True, text=True)
    if r.returncode != 0:
        print(f'--- {src} block {i} ({attrs}) FAILED')
        print(r.stderr[:1500])
        raise SystemExit(1)
    print(f'--- {src} block {i} ({attrs or "classic"}) ok ({len(code)} chars)')
    os.remove(out)
