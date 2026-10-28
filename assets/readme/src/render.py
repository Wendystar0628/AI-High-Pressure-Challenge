"""Render README figures to PNG with headless Chrome.

python render.py [name ...]   renders figs/<name>.html (all figures when no name is given) to
E:\\Project\\AI_OneShot_Bench\\assets\\readme\\<name>.png at 2x, transparent outside the rounded card.
Each figure declares its CSS size with <meta name="size" content="960x540">.
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = Path(r'E:\Project\AI_OneShot_Bench\assets\readme')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

names = sys.argv[1:] or [p.stem for p in sorted((HERE / 'figs').glob('*.html'))]
OUT.mkdir(parents=True, exist_ok=True)
for name in names:
    src = HERE / 'figs' / f'{name}.html'
    m = re.search(r'<meta name="size" content="(\d+)x(\d+)">', src.read_text(encoding='utf-8'))
    if not m:
        sys.exit(f'{src} has no <meta name="size" content="WxH">')
    w, h = m.groups()
    out = OUT / f'{name}.png'
    # Headless Chrome's layout viewport can be wider than the screenshot, so pin the page to the declared size.
    pinned = src.with_name(f'.{name}.render.html')
    pinned.write_text(src.read_text(encoding='utf-8').replace(
        '</head>', f'<style>html,body{{width:{w}px;height:{h}px;position:relative;overflow:hidden}}</style></head>', 1),
        encoding='utf-8')
    subprocess.run([CHROME, '--headless=new', '--hide-scrollbars', '--default-background-color=00000000',
                    '--force-device-scale-factor=2', f'--window-size={w},{h}', '--virtual-time-budget=3000',
                    f'--screenshot={out}', pinned.as_uri()], check=True, capture_output=True, timeout=60)
    pinned.unlink()
    print(f'{out}  ({w}x{h} css, {out.stat().st_size // 1024} KB)')
