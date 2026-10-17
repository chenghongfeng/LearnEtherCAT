# -*- coding: utf-8 -*-
"""打印指定页范围。用法: python .tools/pdf_pages.py <pdf> <from> <to> [chars]"""
import sys
sys.path.insert(0, '.dsh_py')
from pypdf import PdfReader

pdf, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
chars = int(sys.argv[4]) if len(sys.argv) > 4 else 3000
r = PdfReader(pdf)
if r.is_encrypted:
    r.decrypt('')
for i in range(a - 1, min(b, len(r.pages))):
    print(f'===== PAGE {i+1}')
    print((r.pages[i].extract_text() or '')[:chars])
    print()
