#!/usr/bin/env python3
# Regenerates src/assets/clover-leaf-{1..4}.png (the lit-leaf fills used by SpendClover)
# from src/assets/clover-outline.png. Run from the repo root; needs only Python 3 stdlib:
#   python3 scripts/make-clover-leaf-masks.py src/assets/clover-outline.png src/assets /tmp/clover-debug.png 7
# Open the debug PNG to check the fills sit inside the outline. If the outline art changes,
# update SEEDS below (one point inside each leaf, in source-image pixels).
"""Build one pixel-aligned fill PNG per clover leaf from clover-outline.png (stdlib only).

Ink is sealed by a Chebyshev dilation (so the leaves' small openings at the centre
don't leak), each leaf interior is flood-filled from a seed, then the fill is grown
back by the same radius so it tucks under the outline stroke.
"""
import sys, zlib, struct
from itertools import accumulate

SRC, OUT, DEBUG = sys.argv[1], sys.argv[2], sys.argv[3]
R = int(sys.argv[4]) if len(sys.argv) > 4 else 7
FILL = (33, 196, 93)  # hsl(142 71% 45%)

# seeds per leaf id (in source-pixel coords); a leaf can have several regions
SEEDS = {
    1: [(450, 650)],                 # top-left
    2: [(1050, 650)],                # top-right
    3: [(450, 1230)],                # bottom-left
    4: [(1000, 1300), (1150, 1100)], # bottom-right (main lobe + flap beyond club shaft)
}

def read_png(path):
    d = open(path, "rb").read()
    pos, idat, w, h = 8, b"", 0, 0
    while pos < len(d):
        n, t = struct.unpack(">I4s", d[pos:pos + 8])
        body = d[pos + 8:pos + 8 + n]
        if t == b"IHDR":
            w, h = struct.unpack(">II", body[:8])
        elif t == b"IDAT":
            idat += body
        pos += 12 + n
    raw = zlib.decompress(idat)
    bpp, stride = 4, w * 4
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for i in range(bpp, stride): line[i] = (line[i] + line[i - bpp]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, out

def write_png(path, w, h, rgba):
    def chunk(t, b):
        c = struct.pack(">I", len(b)) + t + b
        return c + struct.pack(">I", zlib.crc32(t + b) & 0xffffffff)
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride:(y + 1) * stride]
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)

def dilate(mask, w, h, r):
    """Chebyshev dilation of a 0/1 bytearray by r (separable, prefix sums)."""
    def pass_rows(m):
        o = bytearray(w * h)
        for y in range(h):
            row = m[y * w:(y + 1) * w]
            ps = [0] + list(accumulate(row))
            base = y * w
            for x in range(w):
                lo = x - r if x >= r else 0
                hi = x + r + 1 if x + r + 1 <= w else w
                if ps[hi] - ps[lo]:
                    o[base + x] = 1
        return o
    def transpose(m, w, h):
        o = bytearray(w * h)
        for y in range(h):
            row = m[y * w:(y + 1) * w]
            o[y::h] = row
        return o
    a = pass_rows(mask)
    t = transpose(a, w, h)          # now h-wide, w-tall
    # dilate along former columns
    o = bytearray(w * h)
    for y in range(w):
        row = t[y * h:(y + 1) * h]
        ps = [0] + list(accumulate(row))
        base = y * h
        for x in range(h):
            lo = x - r if x >= r else 0
            hi = x + r + 1 if x + r + 1 <= h else h
            if ps[hi] - ps[lo]:
                o[base + x] = 1
    return transpose(o, h, w)

def flood(barrier, w, h, seed):
    sx, sy = seed
    if barrier[sy * w + sx]:
        raise SystemExit(f"seed {seed} sits on ink; pick another")
    seen = bytearray(w * h)
    stack = [(sx, sy)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i] or barrier[i]:
            continue
        # scanline expand
        x0 = x
        while x0 > 0 and not barrier[y * w + x0 - 1] and not seen[y * w + x0 - 1]:
            x0 -= 1
        x1 = x
        while x1 < w - 1 and not barrier[y * w + x1 + 1] and not seen[y * w + x1 + 1]:
            x1 += 1
        for xx in range(x0, x1 + 1):
            seen[y * w + xx] = 1
        for ny in (y - 1, y + 1):
            if 0 <= ny < h:
                prev_in = False
                for xx in range(x0, x1 + 1):
                    j = ny * w + xx
                    ok = not barrier[j] and not seen[j]
                    if ok and not prev_in:
                        stack.append((xx, ny))
                    prev_in = ok
    return seen

w, h, px = read_png(SRC)
ink = bytearray(w * h)
for i in range(w * h):
    r, g, b, a = px[4 * i:4 * i + 4]
    if a > 100 and (r < 200 or g < 200 or b < 200):
        ink[i] = 1
print("size", w, h, "ink px", sum(ink))

sealed = dilate(ink, w, h, R)
dbg = bytearray(px)  # copy outline to overlay fills on a white ground
for i in range(w * h):
    if dbg[4 * i + 3] < 255:
        dbg[4 * i:4 * i + 4] = bytes((255, 255, 255, 255))

for leaf_id, seeds in SEEDS.items():
    region = bytearray(w * h)
    for s in seeds:
        r_ = flood(sealed, w, h, s)
        n = sum(r_)
        print(f"leaf {leaf_id} seed {s}: {n} px ({100 * n / (w * h):.1f}% of image)")
        for i in range(w * h):
            if r_[i]: region[i] = 1
    grown = dilate(region, w, h, R)   # tuck under the stroke
    # keep the stroke itself empty at the outer edge: only grow where it was ink-sealed band
    out = bytearray(w * h * 4)
    for i in range(w * h):
        if grown[i] and (region[i] or sealed[i]):
            out[4 * i:4 * i + 4] = bytes((*FILL, 255))
            if not ink[i]:
                pass
    write_png(f"{OUT}/clover-leaf-{leaf_id}.png", w, h, out)
    for i in range(w * h):
        if out[4 * i + 3]:
            dbg[4 * i:4 * i + 3] = bytes(
                (min(255, (dbg[4 * i] * 0 + FILL[0] + 60)), FILL[1], FILL[2])
            ) if not ink[i] else dbg[4 * i:4 * i + 3]

write_png(DEBUG, w, h, dbg)
print("done")
