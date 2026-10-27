#!/usr/bin/env python3
"""Make web-sized WebP copies of the big PNGs the app shows (run from the repo root).

Products are shown at about 160-200px wide, so 600px covers 3x screens; the clover wallpaper tile is
drawn at 120px; the leprechaun mascot at 128px. The PNG originals are removed once the WebP exists.
"""
from pathlib import Path
from PIL import Image

JOBS = [
    *[(p, 600) for p in sorted(Path("public/products").glob("*.png"))],
    (Path("public/images/clover-pattern.png"), 360),
    (Path("public/images/leprechaun-mascot-transparent.png"), 384),
]

for src, max_w in JOBS:
    if not src.exists():
        continue
    out = src.with_suffix(".webp")
    with Image.open(src) as im:
        im = im.convert("RGBA")
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        im.save(out, "WEBP", quality=82, method=6)
    print(f"{src} {src.stat().st_size // 1024}KB -> {out} {out.stat().st_size // 1024}KB")
    src.unlink()
