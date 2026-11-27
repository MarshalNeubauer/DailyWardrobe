/* Daily Wardrobe: the traced mannequin, Today's outfit figure (2026-11-14, the owner's choice from a prototype). One vector torso per
   colour-coded master (mq/<kind>.js, made by tools/mq-trace.py from the master's zone masks, solved cloth pieces, light map and photo),
   so the drawing has exactly the pose and proportions of the painted outfit picture. Every garment piece takes the day's fabrics as
   ready-made <pattern>s (figFabric in draw.js: spec.def(id, rot)); each sleeve, lapel, collar leaf, cuff and tie piece gets its own
   rotated copy, so stripes follow the part at the angle of the solved cloth positions. The pattern ids suitB (body and waistcoat),
   suitL/suitR (the lapels, viewer's left and right), shirt and tie (kept from the earlier drawn figure), bladeP (the tie's blade), lapL/lapR,
   .fig-clip, .fig-watch, .fig-vest and .fig-open are the names other code and the tests look for; on the shirt masters suitB is the
   shirt and the trousers' legs are leg<i> (base pants). Skin and the watch are the master's own tones in bands (the watch is always the master's steel
   watch, as in the painted picture). The form shading is one small picture scaled up (no blur filter: it cost a fifth of the drawing
   time on a phone). Behind the figure is the painted pictures' office (G.office: a 200-pixel copy of the painter's background with the
   pose's soft wall shadow baked in, scaled up smoothly), in the light and dark themes alike, so the switch to the painted picture is
   seamless; nothing of the mannequin's own covers the wall (office:false draws the plain bg colour instead). WebKit-safe: no <use>
   inside <clipPath>. */
import {ask, served} from './bus.js';
import {linSrgb,srgbLin8} from './srgb.js';
(function(){
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const hex = (c, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : fallback);
const VB = 390;
const SKIN_SOFT = .6;   // the skin's tone bands softened (only the hands' own box is blurred, a small share of the drawing)
const memo = {};
/* a pose's data, parsed once (the data files hold it as a JSON string: a string is far quicker to load than the same object literal) */
function mqData(kind) {
  if (memo[kind]) return memo[kind];
  const raw = (self.MQ_RAW || {})[kind]; if (!raw) return null;
  try { return (memo[kind] = JSON.parse(raw)); } catch (e) { return null; }
}
/* a fabric pattern turned by rot and, k != 1, its scale multiplied (a pinstripe's 1.6, draw.js figureSvg) */
function pattern(id, spec, rot, k = 1) {
  const s = spec || {};
  if (typeof s.def === 'function') { const p = s.def(id, rot); return k === 1 ? p : p.replace(/(patternTransform="[^"]*?scale\()([\d.]+)/, (m, a, b) => a + (+b * k).toFixed(3)); }
  const tf = rot ? ` patternTransform="rotate(${rot})"` : '';
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"${tf}><rect width="8" height="8" fill="${hex(s.color, '#555B66')}"/></pattern>`;
}

/* a shirt button where the painter draws one (asm-color.js ASM_CM_BTN): pearl mixed 55% with the shirt's colour in display values
   (ASM_CM_BTN_MIX, the owner's pick), a lit rim, four holes and a soft shadow down and to the right */
/* (CR-8-04, 2026-11-17) the painter's own rule (asmCmBtnCol) where asm-color.js is loaded, so the two can't drift; without it the same
   rule by hand: the pearl's linear values [.86, .84, .80] are [239, 236, 231] in display values (they were read as display values,
   up to 12 levels darker than the painted buttons) */
const btnCol = (c) => { const ok = /^#[0-9a-fA-F]{6}$/.test(String(c)), s = ok ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : [235, 235, 235];
  const hex = v => '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  if (served('asm-cm-btn-col')) return hex(ask('asm-cm-btn-col', s.map(srgbLin8)).map(v => 255 * linSrgb(v)));
  return hex([239, 236, 231].map((v, i) => v * .45 + s[i] * .55)); };
const shirtButton = (x, y, r, c) => `<circle cx="${x + r * .25}" cy="${y + r * .35}" r="${r * 1.05}" fill="#000" fill-opacity=".18"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`
  + `<circle cx="${x}" cy="${y}" r="${(r * .8).toFixed(2)}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${(r * .18).toFixed(2)}"/>`
  + [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => `<circle cx="${(x + a * r * .27).toFixed(2)}" cy="${(y + b * r * .27).toFixed(2)}" r="${(r * .12).toFixed(2)}" fill="#000" fill-opacity=".35"/>`).join('');

/* the pocket square (2026-11-16, the owner's "square fold, a bit out of the pocket"): the strip above the breast pocket's welt where the
   painter puts it (asm-pocket.js asmPocketQuad, measured at 2048 on the masters), crisp and straight: the cloth (pocket.def, its print),
   its contrast edge along the top (pocket.edge), the fold's top edge lit, darker into the pocket's mouth, a slight shadow on the welt
   under it; '' on a pose with no pocket (the shirt poses) or no square.
   (v2, 2026-11-16, the owner: "add more of a fold, it looks too cartoony") folded cloth in the drawing's style, as the painter does it: the
   fold's top very slightly uneven and rounded off at the corners, a lit crease along it with the roll's soft shadow under it, the two
   layers' edges at each end, two faint relaxed creases, and the cloth tucking into the opening at the bottom corners */
function pocketSvg(pocket, kind, P) {
  const Q = pocket && served('asm-pocket-quad') ? ask('asm-pocket-quad', kind) : null; if (!Q) return '';
  const s = VB / 2048, f2 = v => (v * s).toFixed(2), Ww = Q.b1[0] - Q.b0[0], sl = (Q.b1[1] - Q.b0[1]) / Ww, H = Q.b0[1] - Q.t0[1];
  // a point of the strip in 2048 px: uu along it from its left end, vv down from its top line
  const S = (uu, vv) => [Q.t0[0] + uu, Q.t0[1] + uu * sl + vv], dv = uu => .38 * Math.sin(uu * .034 + .4) + .22 * Math.sin(uu * .093 + 2.1) + Math.exp(-uu / 3) + Math.exp(-(Ww - uu) / 3);
  const pts = a => a.map(p => `${f2(p[0])},${f2(p[1])}`).join(' '), poly = (a, fill, extra = '') => `<polygon points="${pts(a)}" fill="${fill}"${extra}/>`;
  const N = 24, topE = [...Array(N + 1)].map((_, k) => S(Ww * k / N, dv(Ww * k / N))), band = (v0, v1) => [...topE.map(([x, y]) => [x, y + v0]), ...topE.slice().reverse().map(([x, y]) => [x, y + v1])];
  const shape = [...topE, Q.b1, Q.b0], strip = (x0, x1, v0, v1) => [S(x0, v0), S(x1, v0), S(x1, v1), S(x0, v1)];
  const fill = typeof pocket.def === 'function' ? `url(#${P}pq)` : hex(pocket.color, '#F4F4F2');
  return `<g class="fig-pocket">${typeof pocket.def === 'function' ? `<defs>${pocket.def(P + 'pq')}<linearGradient id="${P}pqs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".12" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>`
      + `<linearGradient id="${P}pqh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient></defs>` : ''}`
    + poly([Q.b0, Q.b1, [Q.b1[0], Q.b1[1] + 5], [Q.b0[0], Q.b0[1] + 5]], '#000', ' fill-opacity=".22"')   // its shadow on the welt
    + poly(shape, fill)
    + (pocket.edge ? poly(band(0, 7.6), hex(pocket.edge, '#1B2A4A')) : '')
    + poly(shape, `url(#${P}pqs)`) + poly(shape, `url(#${P}pqh)`)
    + poly(band(0, 2.2), '#fff', ' fill-opacity=".3"')   // the lit crease along the fold
    + poly(band(3.6, 6.2), '#000', ' fill-opacity=".1"')   // the roll's underside
    + [[.34, 1], [.71, .7]].map(([p, k]) => poly(strip(p * Ww - .6, p * Ww + .9, 5, H - 4), '#000', ` fill-opacity="${(.09 * k).toFixed(3)}"`) + poly(strip(p * Ww - 2.2, p * Ww - .6, 5, H - 4), '#fff', ` fill-opacity="${(.08 * k).toFixed(3)}"`)).join('')   // relaxed creases
    + [0, 2.2, Ww - 3, Ww - .9].map((x, k) => poly(strip(x, x + .9, dv(x) + .5, H), '#000', ` fill-opacity="${k > 1 ? .2 : .15}"`)).join('')   // the two layers' edges at each end
    + poly([Q.b0, S(7, H), S(0, H - 7)], '#000', ' fill-opacity=".2"') + poly([Q.b1, S(Ww - 7, H), S(Ww, H - 7)], '#000', ' fill-opacity=".26"')   // the corners tucking in
    + `<line x1="${f2(Q.b0[0])}" y1="${f2(Q.b0[1])}" x2="${f2(Q.b1[0])}" y2="${f2(Q.b1[1])}" stroke="#000" stroke-opacity=".35" stroke-width=".5"/></g>`;
}
function outfitMannequinSvg({ kind = 'vest', suit, shirt, tie, bot = null, beltColor = null, vest = true, clip = null, shirtColor = '#EEEEEE', bg = '#F5F2EC', idPrefix = 'mq-',
  ariaLabel = "Torso wearing today's outfit", fab = { suit: 1, shirt: 1, tie: 1 }, office = true, pocket = null } = {}) {
  const G = mqData(kind); if (!G) return '';
  const P = String(idPrefix).replace(/[^A-Za-z0-9_-]/g, '');
  const u = id => `url(#${P}${id})`;
  const pid = (p, i) => p.id === 'lapL' ? 'suitL' : p.id === 'lapR' ? 'suitR' : 'sp' + i;
  const tieSpec = tie || shirt;   // no tie on a pose that has one (a waistcoat without a tie): its place is shirt
  const defs = [pattern(`${P}suitB`, suit, G.bodyRot || 0, fab.suit), pattern(`${P}shirt`, shirt, 0, fab.shirt), pattern(`${P}tie`, tieSpec, 0, tie ? fab.tie : fab.shirt)];
  G.parts.forEach((p, i) => defs.push(pattern(P + pid(p, i), suit, p.rot, fab.suit)));
  for (const L of ['lapL', 'lapR']) if (!G.parts.some(p => p.id === L)) defs.push(pattern(P + (L === 'lapL' ? 'suitL' : 'suitR'), suit, 0, fab.suit));   // (a pose without lapels keeps every pattern id)
  G.cuffs.forEach((c, i) => defs.push(pattern(`${P}cuff${i}`, shirt, c.rot, fab.shirt)));
  if (tie) G.tie.forEach((t, i) => defs.push(pattern(`${P}tie${i}`, tie, t.rot, fab.tie)));
  if (G.legs) { defs.push(pattern(`${P}pants`, bot, 0, fab.bot || 1)); G.legs.forEach((l, i) => defs.push(pattern(`${P}leg${i}`, bot, l.rot, fab.bot || 1))); }
  const tieFill = i => tie ? u('tie' + i) : u('shirt');
  const blade = G.tie.findIndex(t => t.id === 'blade');
  const lapels = G.parts.map((p, i) => [p, i]).filter(([p]) => /^lap|^collar/.test(p.id));
  const partId = (p, i) => /^lap[LR]$/.test(p.id) ? P + p.id : `${P}pt${i}`;
  const c = clip && tie && !vest && G.clip ? G.clip : null;   // the painter's rule: no clip on a waistcoat day
  const cc = c && hex(clip.color, '#A9AFB8');
  const pq = pocketSvg(pocket, kind, P);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="100%" role="img" aria-label="${esc(ariaLabel)}" style="display:block;height:auto">
<defs>
${defs.join('\n')}
${G.parts.map((p, i) => `<path id="${partId(p, i)}" class="fig-${p.id}" d="${p.d}"/>`).join('')}
${blade >= 0 ? `<path id="${P}bladeP" d="${G.tie[blade].d}"/>` : ''}
<clipPath id="${P}clipSil"><path d="${G.sil}"/></clipPath>
<clipPath id="${P}clipSkin"><path d="${G.skin[0].d}"/></clipPath><filter id="${P}fSkin" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="${SKIN_SOFT}"/></filter>
</defs>
${office && G.office ? `<image class="fig-office" href="${G.office}" width="${VB}" height="${VB}" preserveAspectRatio="none"/>` : `<rect width="${VB}" height="${VB}" fill="${hex(bg, '#F5F2EC')}"/>`}
<g clip-path="url(#${P}clipSil)">
<rect width="${VB}" height="${VB}" fill="${u('suitB')}"/>
${G.parts.map((p, i) => `<use href="#${partId(p, i)}" fill="${u(pid(p, i))}"/>`).join('')}
${vest && G.waistcoat ? `<g class="fig-vest"><path d="${G.waistcoat}" fill="${u('suitB')}"/><path d="${G.waistcoat}" fill="#000" fill-opacity=".1"/></g>` : ''}
<path d="${G.shirt}" fill="${u('shirt')}"/>
${G.cuffs.map((x, i) => `<path d="${x.d}" fill="${u('cuff' + i)}"/>`).join('')}
${G.tie.map((t, i) => i === blade ? `<use href="#${P}bladeP" fill="${tieFill(i)}"/>` : `<path class="fig-tie-${t.id}" d="${t.d}" fill="${tieFill(i)}"/>`).join('')}
${(G.legs || []).map((l, i) => `<path class="fig-${l.id}" d="${l.d}" fill="${u('leg' + i)}"/>`).join('')}
${G.belt ? `<path class="fig-belt" d="${G.belt}" fill="${hex(beltColor, '#3A2A22')}"/>` : ''}
<image class="fig-shade" href="${G.shade}" width="${VB}" height="${VB}" preserveAspectRatio="none"/>
<path d="${G.collarShadow}" fill="#000" fill-opacity=".32"/>
<path d="${G.glow}" fill="#fff" fill-opacity=".05"/><path d="${G.glow2}" fill="#fff" fill-opacity=".05"/><path d="${G.rim}" fill="#fff" fill-opacity=".04"/>
<path d="${G.ink}" fill="#000" fill-opacity=".4"/><path d="${G.inkHi}" fill="#fff" fill-opacity=".08"/>
<g fill="none" stroke="#000" stroke-opacity=".32" stroke-width=".7">${lapels.map(([p, i]) => `<use href="#${partId(p, i)}"/>`).join('')}${G.sleeveEdge ? `<path d="${G.sleeveEdge}"/>` : ''}</g>
${pq ? pq + '\n' : ''}${c ? `<g class="fig-clip" transform="translate(${c.x} ${c.y}) rotate(${c.a})"><rect x="${-c.w / 2 + .4}" y="${-c.h / 2 + .9}" width="${c.w}" height="${c.h}" rx="${c.h / 2}" fill="#000" fill-opacity=".3"/>
<rect x="${-c.w / 2}" y="${-c.h / 2}" width="${c.w}" height="${c.h}" rx="${c.h / 2}" fill="${cc}"/><rect x="${-c.w / 2}" y="${-c.h / 2}" width="${c.w}" height="${(c.h * .38).toFixed(2)}" rx="${(c.h * .19).toFixed(2)}" fill="#FFFFFF" fill-opacity=".6"/></g>` : ''}
<path d="${G.cast}" fill="#000" fill-opacity=".12"/>
<g class="fig-skin${/-open$/.test(kind) ? ' fig-open' : ''}"><path d="${G.skin[0].d}" fill="${G.skin[0].c}"/><g clip-path="url(#${P}clipSkin)"><g filter="url(#${P}fSkin)">${G.skin.slice(1).map(b => `<path d="${b.d}" fill="${b.c}"/>`).join('')}</g></g></g>
<g class="fig-watch">${G.watch.map(b => `<path d="${b.d}" fill="${b.c}"/>`).join('')}</g>
${G.buckle ? `<g class="fig-buckle">${G.buckle.map(b => `<path d="${b.d}" fill="${b.c}"/>`).join('')}</g>` : ''}
<g class="fig-buttons"><path d="${G.dark}" fill="${u('suitB')}"/><path d="${G.dark}" fill="#000" fill-opacity=".45"/></g>
${(G.btn || []).length ? `<g class="fig-shirtbtn">${G.btn.map(([x, y, r]) => shirtButton(x, y, r, btnCol(shirtColor))).join('')}</g>` : ''}
</g>
</svg>`;
}
self.outfitMannequinSvg = outfitMannequinSvg; self.mqData = mqData;   // (CR-8-08: mqHas, FIG_VIEWBOX and FIG_HOTSPOTS, read by nothing, were removed)
})();
export {};
