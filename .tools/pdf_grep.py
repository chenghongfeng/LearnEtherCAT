# -*- coding: utf-8 -*-
"""按关键词在 PDF 里定位页码并打印片段。
用法: python .tools/pdf_grep.py <pdf> <regex> [max_pages] [context_chars]
"""
import sys
import re
sys.path.insert(0, '.dsh_py')
from pypdf import PdfReader

pdf = sys.argv[1]
pattern = sys.argv[2]
max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 10
ctx = int(sys.argv[4]) if len(sys.argv) > 4 else 1200

r = PdfReader(pdf)
if r.is_encrypted:
    r.decrypt('')
count = 0
for i, page in enumerate(r.pages):
    t = page.extract_text() or ''
    if re.search(pattern, t, re.I):
        print(f'===== PAGE {i+1}')
        print(t[:ctx])
        print()
        count += 1
        if count >= max_pages:
            break
