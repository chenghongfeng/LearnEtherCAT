# -*- coding: utf-8 -*-
"""把学习站整理成一个可以直接发布的静态目录（默认 public/）。

发布内容只包含站点自身需要的文件：
  *.html           12 个页面
  assets/          CSS / JS / ESI 数据
  docs/            学习手册源文件与配图
  README.md        仓库说明

etg_doc/、et1000_doc/、KickCAT/ 属于版权材料或第三方源码，.gitignore 已排除，
不会出现在 CI 的 clone 里，这里也显式跳过。

用法: python .tools/build_site.py [输出目录]
"""
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'public')
if not OUT.is_absolute():
    OUT = ROOT / OUT

INCLUDE_DIRS = ['assets', 'docs']
INCLUDE_FILES = ['README.md']
SKIP_NAMES = {'etg_doc', 'et1000_doc', 'KickCAT', 'public', '.git'}

# 页面加载的唯一脚本是 assets/js/ec-core.js（build_core.py 生成）
REQUIRED = [
    'index.html',
    'assets/css/style.css',
    'assets/js/ec-core.js',
    'assets/data/esi-examples.json',
]


def reset(out: pathlib.Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)


def ignore(_dir, names):
    return [n for n in names if n in SKIP_NAMES or n.startswith('.tmp')]


def main() -> int:
    reset(OUT)

    pages = sorted(p for p in ROOT.glob('*.html') if p.name not in SKIP_NAMES)
    if not pages:
        raise SystemExit('没有找到任何 .html 页面')
    for page in pages:
        shutil.copy2(page, OUT / page.name)

    for name in INCLUDE_DIRS:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, OUT / name, ignore=ignore)

    for name in INCLUDE_FILES:
        src = ROOT / name
        if src.is_file():
            shutil.copy2(src, OUT / name)

    missing = [p for p in REQUIRED if not (OUT / p).is_file()]
    if missing:
        raise SystemExit('发布目录缺少必需文件: ' + ', '.join(missing))

    total = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
    count = sum(1 for f in OUT.rglob('*') if f.is_file())
    print(f'public/ ← {len(pages)} 个页面, {count} 个文件, {total / 1024:.0f} KB')
    for page in pages:
        print(f'  {page.name}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())