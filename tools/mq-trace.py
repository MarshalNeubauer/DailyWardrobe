"""Daily Wardrobe: traces one colour-coded master into the mannequin's pose data (mq/<kind>.js, drawn by mannequin.js).

Run on the PC (read-only on every source):
    python tools/mq-trace.py <kind> [out.js]
with numpy, scipy, opencv-python and Pillow (C:\\code\\geo3d\\.venv has them). Sources, at 2048:
    C:\\code\\watch-test\\colormaster\\out-<kind>\\   alpha-<zone>.png (zone masks), uv-u.png / uv-v.png (solved cloth pieces:
                                                  blue = piece id, R/G = position), light.png (R form light, G edge glow,
                                                  B collar shadow), colormaster-2048.png (or -2880, scaled) for its own light,
                                                  skin and watch tones
    C:\\code\\watch-test\\geo3d\\sapiens-2b\\<kind>-cc\\normal.npy   the master's surface normals (lit edges facing the window)
Outlines: OpenCV contours, Gaussian-smoothed along the curve, Douglas-Peucker, then Catmull-Rom cubics with sharp corners kept,
in a 390 x 390 viewBox. The form shading is one small lossless WebP (black where the cloth is in shadow, white where it is lit),
blurred at 2048 and scaled to SHADE_PX: the browser scales it up smoothly, so it needs no SVG blur filter.
"""
import base64, io, json, math, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = dict((a[2:].split('=') + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
KIND = ARGS[0] if ARGS else 'vest'
OUT = ARGS[1] if len(ARGS) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mq', KIND + '.js')
# the office behind the mannequin: a tiny copy of the painted pictures' background (the colour-coded painter's asmCmBgKey; on the PC
# BG_PLATE, or --bg=<file>), BG_PX square, with this pose's wall shadow baked in (one picture to draw, not two); re-run every pose
# whenever that background changes
BG_PLATE = FLAGS.get('bg') or r'C:\code\watch-test\colormaster\bg\office-plate-desk-extended.png'
BG_PX, BG_Q = 200, 82
D = rf'C:\code\watch-test\colormaster\out-{KIND}'
G3 = rf'C:\code\watch-test\geo3d\sapiens-2b\{KIND}-cc'
N = 2048; VB = 390; K = VB / N
SHADE_PX = 195   # the shading picture's size (2 viewBox units a pixel; lossless WebP, about 7 KB)
JACKET = KIND in ('vest', 'suit', 'suit-open')
TIE = KIND in ('vest', 'suit', 'shirt-tie')
PXMM = {'shirt-tie': 116 / 174, 'shirt-open': 116 / 174 * 1.05}.get(KIND, 1) * 3.2   # px a millimetre at 2048 (asm-color.js pxmm x ASM_PX_MM)


def load_rgb(name):
    p = os.path.join(D, name)
    im = Image.open(p).convert('RGB')
    if im.size != (N, N):
        im = im.resize((N, N), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def zone(n):
    p = os.path.join(D, f'alpha-{n}.png')
    if not os.path.exists(p):
        return np.zeros((N, N), np.float32)
    im = Image.open(p)
    a = np.asarray(im.convert('RGBA'))[..., 0] if im.mode in ('RGBA', 'RGB', 'P') else np.asarray(im.convert('L'))
    return a.astype(np.float32) / 255


ZN = ['jacket', 'waistcoat', 'shirt', 'tie', 'skin', 'watch', 'dark', 'background', 'trousers', 'belt', 'buckle']
Z = {z: zone(z) for z in ZN}
photo = load_rgb('colormaster-2048.png') if os.path.exists(os.path.join(D, 'colormaster-2048.png')) else load_rgb('colormaster-2880.png')
lum = (0.2126 * photo[..., 0] + 0.7152 * photo[..., 1] + 0.0722 * photo[..., 2]) / 255
light = np.asarray(Image.open(os.path.join(D, 'light.png')).convert('RGB')).astype(np.float32)
uvu = np.asarray(Image.open(os.path.join(D, 'uv-u.png')).convert('RGB')).astype(np.int32)
piece = uvu[..., 2]
U = (uvu[..., 0] * 256 + uvu[..., 1]) / 16.0 - 1024
nrm = np.load(os.path.join(G3, 'normal.npy')).astype(np.float32)   # +x right, +y up, +z to camera


def binm(a, s=1.0, t=0.5):
    return ndi.gaussian_filter(a.astype(np.float32), s) > t if s else a > t


def dil(m, r=1):
    return ndi.binary_dilation(m, iterations=r) if r > 0 else m


def tenth(v):
    v = int(v); sgn = '-' if v < 0 else ''; v = abs(v)
    w, f = divmod(v, 10)
    if f == 0: return sgn + str(w)
    return sgn + ('' if w == 0 else str(w)) + '.' + str(f)


def nums(vs):
    s = ''
    for v in vs:
        t = tenth(v)
        if s and not t.startswith('-') and not (t.startswith('.') and '.' in s.split(' ')[-1].split('-')[-1]):
            s += ' '
        s += t
    return s


EDGE = 6    # px at 2048: a mask's last rows and columns at the frame are its line EDGE px inside, carried straight out
PAD = 16    # px: the mask is traced on a canvas this much larger each side, so its outline crosses the frame outside the picture


def edge_fix(mask):
    """the frame cuts the figure (the neck at the top, the trousers at the bottom): the soft masks' last few pixels at the border are
    unreliable (a zone a pixel or two wider there made thin spikes along the crop, 2026-11-14), and an outline that runs along the border
    gets rounded and simplified into slivers at its corners. So each border band is the line EDGE px inside, and the mask is padded by
    repeating its border: the outline then leaves the frame square, its corners PAD px outside the picture"""
    m = mask.astype(np.uint8).copy()
    m[:EDGE] = m[EDGE]; m[-EDGE:] = m[-EDGE - 1]
    m[:, :EDGE] = m[:, EDGE:EDGE + 1]; m[:, -EDGE:] = m[:, -EDGE - 1:-EDGE]
    return np.pad(m, PAD, mode='edge')


def to_path(mask, eps=1.1, min_area=40, smooth=1.6, corner=55):
    m = edge_fix(mask)
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if abs(cv2.contourArea(c)) < min_area:
            continue
        p = c[:, 0, :].astype(np.float64)
        if len(p) > 8 and smooth:
            p = np.stack([ndi.gaussian_filter1d(p[:, i], smooth, mode='wrap') for i in range(2)], 1)
        a = cv2.approxPolyDP(p.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :].astype(np.float64)
        if len(a) < 3:
            continue
        a = (a + 0.5 - PAD) * K
        n = len(a)
        T = np.zeros_like(a)   # Catmull-Rom tangents, zero at sharp corners
        for i in range(n):
            p0, p1, p2 = a[i - 1], a[i], a[(i + 1) % n]
            d1, d2 = p1 - p0, p2 - p1
            l1, l2 = np.hypot(*d1), np.hypot(*d2)
            if l1 < 1e-6 or l2 < 1e-6:
                continue
            ang = math.degrees(math.acos(max(-1, min(1, (d1 @ d2) / (l1 * l2)))))
            if ang < corner:
                T[i] = (p2 - p0) / 6
        q = lambda v: np.round(v * 10).astype(np.int64)
        A = q(a)
        s = 'M' + nums([A[0][0], A[0][1]])
        for i in range(n):
            last = i == n - 1
            p1, p2 = A[i], A[(i + 1) % n]
            if not T[i].any() and not T[(i + 1) % n].any():
                if last: break
                s += 'l' + nums([p2[0] - p1[0], p2[1] - p1[1]])
            else:
                # a control point never reaches past a third of its own segment: beside a long straight run (the frame's top edge
                # between the shoulders, 115 units) the Catmull-Rom tangent, (p2 - p0) / 6, was 20 units long, and the curve overshot the
                # corner into a thin spike out of the neck (the owner's report, 2026-11-14)
                seg = np.hypot(*(a[(i + 1) % n] - a[i])); lim = seg / 3
                cl = lambda t: t * min(1.0, lim / max(np.hypot(*t), 1e-9))
                c1, c2 = q(a[i] + cl(T[i])), q(a[(i + 1) % n] - cl(T[(i + 1) % n]))
                s += 'c' + nums([c1[0] - p1[0], c1[1] - p1[1], c2[0] - p1[0], c2[1] - p1[1], p2[0] - p1[0], p2[1] - p1[1]])
        out.append(s + 'z')
    return ''.join(out)


def stripe_rot(m):
    """the angle (deg, SVG rotate) of lines of constant u inside piece mask m: the cloth's stripes"""
    gy, gx = np.gradient(U)
    ok = m & ndi.binary_erosion(m, iterations=3)
    gx, gy = gx[ok], gy[ok]
    g = np.hypot(gx, gy)
    sel = (g > 0.2) & (g < 5)
    if sel.sum() < 50:
        return 0.0
    th = np.arctan2(gy[sel], gx[sel])
    c, s = np.cos(2 * th).mean(), np.sin(2 * th).mean()
    t = 0.5 * math.atan2(s, c)
    dx, dy = -math.sin(t), math.cos(t)
    r = math.degrees(math.atan2(-dx, dy))
    while r > 90: r -= 180
    while r < -90: r += 180
    return round(r, 1)


def pca_rot(m):
    ys, xs = np.nonzero(m)
    c = np.cov(np.stack([xs, ys]).astype(np.float64))
    w, v = np.linalg.eigh(c)
    dx, dy = v[:, 1]
    if dy < 0: dx, dy = -dx, -dy
    r = math.degrees(math.atan2(-dx, dy))
    while r > 90: r -= 180
    while r < -90: r += 180
    return round(r, 1)


def centre(m):
    ys, xs = np.nonzero(m)
    return {'x': round(float(xs.mean()) * K, 1), 'y': round(float(ys.mean()) * K, 1)} if len(xs) else None


bg = binm(Z['background'], 1.2)
fig = ~bg
B = {z: binm(Z[z], 1.0) for z in Z}
data = {'kind': KIND, 'vb': VB, 'sil': to_path(fig, eps=1.0, min_area=200)}

# ---- the jacket's parts (sleeves, lapels, collar leaves) from the solved pieces ----
jac = B['jacket']
# (named from the viewer's side, as figure.js was: lapL is the lapel on the left of the picture, the wearer's right)
NAMES = {14: 'sleeveL-up', 15: 'sleeveL-fo', 18: 'sleeveR-up', 19: 'sleeveR-fo', 43: 'lapL', 44: 'lapR', 45: 'collarL', 46: 'collarR'}
parts = []
if JACKET:
    for pid in sorted(set(np.unique(piece)) - {0}):
        if not 10 <= pid < 60: continue
        m = binm(piece == pid, 0.8) & dil(jac, 2)
        if m.sum() < 500: continue
        rot = pca_rot(m) if 40 <= pid < 60 else stripe_rot(piece == pid)   # lapels and collar leaves: their long axis
        parts.append({'id': NAMES.get(int(pid), 'p%d' % pid), 'rot': rot, 'd': to_path(dil(m, 1))})
else:   # the shirt masters: the shirt's sleeves (14 the hanging arm, 18/19 the raised one) are the turned parts, in the shirt's cloth
    shz = B['shirt']
    for pid in (14, 15, 18, 19):
        m = binm(piece == pid, 0.8) & dil(shz, 2)
        if m.sum() < 500: continue
        parts.append({'id': NAMES[pid], 'rot': stripe_rot(piece == pid), 'd': to_path(dil(m, 1))})
data['parts'] = parts
data['bodyRot'] = stripe_rot(piece == 1) if JACKET else stripe_rot(piece == 2)

# ---- trousers, belt and buckle (the shirt masters): each leg its own part, turned as the solved positions run down it (the painter's
# leg flow, asm-color.js asmLegsAt: the stripes follow each leg), split at the fly (the middle of the trousers on each row) ----
if B['trousers'].sum() > 1000:
    tr = B['trousers']; legs = []
    xs = np.arange(N)[None, :].repeat(N, 0)
    rows = tr.any(1); xl = np.where(rows, tr.argmax(1), 0); xr = np.where(rows, N - 1 - tr[:, ::-1].argmax(1), 0)
    xf = ndi.gaussian_filter1d(((xl + xr) / 2).astype(np.float64), 20)
    left = xs < xf[:, None]
    for nm, m in (('legL', tr & left), ('legR', tr & ~left)):
        if m.sum() < 500: continue
        rot = stripe_rot((piece == 3) & m)
        legs.append({'id': nm, 'rot': rot, 'd': to_path(dil(m, 1))})
    data['legs'] = legs
    data['belt'] = to_path(dil(B['belt'], 1)) if B['belt'].sum() > 300 else ''

# ---- the other garments ----
if B['waistcoat'].sum() > 1000:
    data['waistcoat'] = to_path(dil(B['waistcoat'], 1))
shirt = B['shirt']
data['shirt'] = to_path(dil(shirt, 1))
cuffs = []
for pid in range(60, 80 if TIE else 90):   # (a master without a tie numbers a cuff 81 too: suit-open's are 72 and 81)
    pm = binm(piece == pid, 0.8) & dil(shirt, 2)
    if pm.sum() > 300:
        cuffs.append({'rot': stripe_rot(piece == pid), 'd': to_path(dil(pm, 1))})
data['cuffs'] = cuffs
tie = B['tie']
data['tie'] = []
if TIE:
    for pid, nm in [(80, 'knot'), (81, 'blade')]:
        pm = binm(piece == pid, 0.8) & dil(tie, 2)
        if pm.sum() > 300:
            data['tie'].append({'id': nm, 'rot': stripe_rot(piece == pid), 'd': to_path(dil(pm, 1), corner=40)})
    rest = tie & ~dil(binm((piece == 80) | (piece == 81), 0.8), 1)
    if rest.sum() > 300:
        data['tie'].append({'id': 'rest', 'rot': data['tie'][-1]['rot'] if data['tie'] else 0, 'd': to_path(dil(rest, 1))})


# ---- the tie clip's place: the painter's rule (assemble.js asmBarDraw) on the tie's mask ----
def clip_place(tm):
    lab, n = ndi.label(tm)
    if not n: return None
    ys, xs = np.nonzero(tm)
    first = lab[ys[0], xs[0]]
    m = lab == first
    rows = np.nonzero(m.any(1))[0]
    y0, y1 = rows[0], rows[-1]
    if y1 - y0 < 40: return None
    xl = np.full(N, -1.0); xr = np.full(N, -1.0)
    for y in rows:
        xx = np.nonzero(m[y])[0]; xl[y] = xx[0]; xr[y] = xx[-1]
    R, Dd = 10, 40
    at = lambda y, f: np.median([f(yy) for yy in range(y - R, y + R + 1) if 0 <= yy < N and xl[yy] >= 0] or [np.nan])
    ctr = lambda y: at(y, lambda yy: (xl[yy] + xr[yy]) / 2)
    yb = int(round(y0 + 0.6 * (y1 - y0)))
    wd = at(yb, lambda yy: xr[yy] - xl[yy] + 1); cx = ctr(yb)
    ya, yz = max(y0, yb - Dd), min(y1, yb + Dd)
    sl = (ctr(yz) - ctr(ya)) / (yz - ya)
    if not np.isfinite(sl): sl = 0
    nn = math.hypot(1, sl); ux, uy = 1 / nn, -sl / nn
    Lh = 0.8 * wd / nn / 2; Hh = 5.5 * PXMM / 2
    sh0 = -(wd / nn / 2) + Lh - 1
    cx += sh0 * ux; cy = yb + sh0 * uy
    return {'x': round(cx * K, 1), 'y': round(cy * K, 1), 'w': round(2 * Lh * K, 1), 'h': round(2 * Hh * K, 1), 'a': round(math.degrees(math.atan2(uy, ux)), 1)}


if TIE:
    data['clip'] = clip_place(B['tie'])

# ---- the shirt's visible buttons, as the painter draws them (asm-color.js ASM_CM_BTN, [x, y, radius] px at 2048), those on the shirt ----
BTN = {'shirt-open': [[1029, 428, 10.5], [1015, 835, 10.5], [1014, 1031, 10.5], [1013, 1224, 10.5]], 'shirt-tie': [[1299, 870, 10], [1440, 955, 9]],
       'suit-open': [[919, 312, 12], [974, 508, 12], [954, 714, 12]]}.get(KIND, [])
data['btn'] = [[round(x * K, 1), round(y * K, 1), round(r * K, 2)] for x, y, r in BTN if Z['shirt'][int(round(y)), int(round(x))] > 200 / 255]

# ---- form shading: the painter's light = the master's brightness over the zone's lit level x the form light (R/128),
# as dark (black) and lit (white) shares, one picture ----
R = light[..., 0] / 128.0
Gl = light[..., 1] / 255.0
Bl = light[..., 2] / 255.0
lb = ndi.gaussian_filter(lum, 5.0)
Rs = ndi.gaussian_filter(R, 2)
CLOTH = [z for z in ['jacket', 'waistcoat', 'shirt', 'tie', 'trousers', 'belt'] if B[z].sum() > 1000]
ad = np.zeros((N, N), np.float32); al = np.zeros((N, N), np.float32); cm = np.zeros((N, N), np.float32)
for zn in CLOTH:
    zm = B[zn]
    core = ndi.binary_erosion(zm, iterations=3)
    lit = np.percentile(lum[core], 90 if zn == 'shirt' else 75)
    s = (lb / max(lit, 1e-3)) * Rs
    n = np.clip((0.92 - s) / 0.125, 0, 5)          # the five dark steps (0.86 .. 0.36) made continuous
    ad = np.where(zm, 1 - 0.9 ** n, ad)
    al = np.where(zm, 0.035 * np.clip((s - 1.1) / 0.1, 0, 1), al)
    cm = np.where(zm, 1.0, cm)
SIG = 8.0   # about 1.5 viewBox units: the prototype's blur (2 units) on its smoothed steps
wb = ndi.gaussian_filter(cm, SIG) + 1e-6
ad = ndi.gaussian_filter(ad * cm, SIG) / wb
al = ndi.gaussian_filter(al * cm, SIG) / wb
near = ndi.binary_dilation(cm > 0, iterations=24)
ad[~near] = 0; al[~near] = 0
cov = 1 - Z['background']   # the figure's share of each pixel: the shading never reaches the wall (the office shows there, untinted)
ad *= cov; al *= cov
def down(a):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((SHADE_PX, SHADE_PX), Image.BOX))
ad_s, al_s = down(ad), down(al)
alpha = np.clip(ad_s + al_s, 0, 1)
grey = np.where(al_s > ad_s, 255, 0)   # black (shadow) or white (lit): the two never meet in one pixel
A8 = np.round(np.clip(alpha * 255, 0, 255) / 3) * 3   # steps of 1.2% opacity (a third of the bytes; no visible bands once scaled up)
img = np.stack([grey, grey, grey, A8], -1).astype(np.uint8)
buf = io.BytesIO(); Image.fromarray(img, 'RGBA').save(buf, 'WEBP', lossless=True, quality=100, method=6)
data['shade'] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

# ---- the office, with the figure's soft shadow on the wall as the painter makes it (asm-color.js asmCmPrep bgShadow): everything but
# the wall, moved 34/20 px down-right at 2048, three box blurs of radius 50, the background multiplied by s = 1 - ASM_CM_BG_SHADOW (.22)
# x shadow in linear light. Only the wall shows it (the figure is drawn over it). One small JPEG, scaled up smoothly by the browser ----
BG_SHADOW = 0.22
wsh = np.zeros((N, N), np.float32)
wsh[20:, 34:] = 1 - Z['background'][:-20, :-34]
for _ in range(3):
    wsh = ndi.uniform_filter(wsh, size=101, mode='constant')
s_lin = np.asarray(Image.fromarray((1 - BG_SHADOW * np.clip(wsh, 0, 1)).astype(np.float32), 'F').resize((BG_PX, BG_PX), Image.BOX))
plate = np.asarray(Image.open(BG_PLATE).convert('RGB').resize((BG_PX, BG_PX), Image.LANCZOS)).astype(np.float32) / 255
lin = np.where(plate <= 0.04045, plate / 12.92, ((plate + 0.055) / 1.055) ** 2.4) * s_lin[..., None]
srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1 / 2.4) - 0.055)
obuf = io.BytesIO(); Image.fromarray(np.round(np.clip(srgb, 0, 1) * 255).astype(np.uint8)).save(obuf, 'JPEG', quality=BG_Q, optimize=True)
data['office'] = 'data:image/jpeg;base64,' + base64.b64encode(obuf.getvalue()).decode()
data['wallShadow'] = round(float(1 - s_lin.min()), 3)   # (the deepest darkening the shadow gives, for the tests: about .22)

# ---- edge glow (G) where cloth turns away from the camera; collar shadow (B); the rim from the normals ----
cloth = B['jacket'] | B['waistcoat'] if JACKET else B['shirt'] & ~dil(B['tie'], 2)
data['glow'] = to_path(cloth & (ndi.gaussian_filter(Gl, 1.5) > 0.42), eps=1.3, min_area=120, smooth=2.5, corner=0)
data['glow2'] = to_path(cloth & (ndi.gaussian_filter(Gl, 1.5) > 0.70), eps=1.3, min_area=120, smooth=2.5, corner=0)
data['collarShadow'] = to_path((B['shirt'] | B['tie']) & (ndi.gaussian_filter(Bl, 1.0) > 0.18), eps=0.9, min_area=20, smooth=1.0)
nl = -nrm[..., 0]
rimz = B['jacket'] if JACKET else B['shirt']
data['rim'] = to_path(rimz & (ndi.gaussian_filter(nl, 2) > 0.62) & ndi.binary_erosion(fig, iterations=1), eps=1.3, min_area=150, smooth=2.5, corner=0)

# ---- ink: the master's thin dark lines (pocket flaps, seams, collar edges, creases), a difference of Gaussians ----
dog = ndi.gaussian_filter(lum, 1.0) - ndi.gaussian_filter(lum, 5.0)
garm = (B['jacket'] | B['waistcoat'] | B['shirt'] | B['tie'] | B['trousers']) & ndi.binary_erosion(fig, iterations=4)
loc = ndi.gaussian_filter(lum, 12) + 0.02
def keep_big(m, mn):
    lab, n = ndi.label(m)
    if not n: return m
    sz = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool); keep[1:] = sz > mn
    return keep[lab]
data['ink'] = to_path(keep_big(garm & (dog / loc < -0.16), 60), eps=0.8, min_area=30, smooth=1.0, corner=0)
data['inkHi'] = to_path(keep_big(garm & (dog / loc > 0.14), 80), eps=0.8, min_area=40, smooth=1.0, corner=0)


# ---- skin and watch: tone bands of the photo itself ----
def hexc(c):
    return '#%02x%02x%02x' % tuple(int(v) for v in c)


def bands(zm, nb, sig=1.4, eps=1.2):
    L = ndi.gaussian_filter(lum, sig)
    qs = np.quantile(L[zm], np.linspace(0, 1, nb + 1)[1:-1])[::-1]
    out = []
    edges = [1e9] + list(qs) + [-1e9]
    for i in range(nb):
        hi_, lo_ = edges[i], edges[i + 1]
        sel = zm & (L <= hi_) & (L > lo_)
        col = np.median(photo[sel], 0) if sel.any() else np.array([128, 128, 128])
        reg = dil(zm, 1) if i == 0 else (zm & (L <= hi_))
        p = to_path(reg, eps=eps, min_area=12, smooth=0.8, corner=40 if i == 0 else 0)
        if p: out.append({'d': p, 'c': hexc(col)})
    return out


def bands2(zm, nb, sig=1.2, eps=1.3):
    """the zone in its median tone, darker bands nested from the middle down, lighter ones from the middle up (no light halo)"""
    L = ndi.gaussian_filter(lum, sig)
    qs = np.quantile(L[zm], np.linspace(0, 1, nb + 1))
    mid = nb // 2
    colof = lambda lo, hi: np.median(photo[zm & (L >= lo) & (L <= hi)], 0)
    out = [{'d': to_path(dil(zm, 1), eps=eps, min_area=30, smooth=1.4, corner=40), 'c': hexc(colof(qs[mid - 1], qs[mid + 1]))}]
    for i in range(mid - 1, 0, -1):
        p = to_path(ndi.binary_opening(zm & (L < qs[i]), iterations=1), eps=eps, min_area=30, smooth=1.4, corner=0)
        if p: out.append({'d': p, 'c': hexc(colof(qs[i - 1], qs[i]))})
    for i in range(mid + 1, nb):
        p = to_path(ndi.binary_opening(zm & (L > qs[i]), iterations=1), eps=eps, min_area=30, smooth=1.4, corner=0)
        if p: out.append({'d': p, 'c': hexc(colof(qs[i], qs[i + 1]))})
    return out


data['skin'] = bands2(B['skin'], 9, eps=1.35)
data['sleeveEdge'] = ''.join(to_path(dil(binm(np.isin(piece, ids), 0.8) & dil(jac if JACKET else B['shirt'], 2), 1)) for ids in ([14, 15], [18, 19]))
data['watch'] = bands(B['watch'] | binm(Z['watch'], 1.0, 0.35), 7, sig=0.9, eps=1.0)
if B['buckle'].sum() > 100:   # the belt buckle: the master's own metal, in tone bands like the watch
    data['buckle'] = bands(B['buckle'] | binm(Z['buckle'], 1.0, 0.35), 5, sig=0.9, eps=1.0)
data['dark'] = to_path(dil(B['dark'], 1), eps=0.8, min_area=20)
sk = B['skin'] | B['watch']
cast = ndi.shift(ndi.gaussian_filter(sk.astype(np.float32), 6), (10, 8), order=1) > 0.35
data['cast'] = to_path(cast & ~sk & fig, eps=1.3, min_area=200, smooth=3, corner=0)

# ---- centre points of the pieces (FIG_HOTSPOTS), in viewBox units ----
hot = {'suit': centre(jac & ~dil(B['skin'], 6)) if JACKET else centre(B['trousers']), 'shirt': centre(shirt), 'watch': centre(B['watch'])}
if TIE:
    hot['tie'] = centre(tie)
    if data.get('clip'): hot['clip'] = {'x': data['clip']['x'], 'y': data['clip']['y']}
data['hot'] = hot

js = json.dumps(data, separators=(',', ':'))
assert "'" not in js and '\\' not in js
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, 'w', newline='\n') as f:
    f.write(f"/* Daily Wardrobe: the {KIND} mannequin's pose (tools/mq-trace.py from the colour-coded master; drawn by mannequin.js) */\n")
    f.write(f"(self.MQ_RAW=self.MQ_RAW||{{}})['{KIND}']='{js}';\n")
print('wrote', OUT, len(js), 'bytes; shade png', len(buf.getvalue()))
for k, v in data.items():
    print(' ', k, len(json.dumps(v)))
print('parts', [(p['id'], p['rot']) for p in parts], 'body', data['bodyRot'], 'clip', data.get('clip'))
