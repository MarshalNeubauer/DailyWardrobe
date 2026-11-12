/* Daily Wardrobe: the torso figure for the Today tab (suit, vest, shirt, tie, clip, watch). Redrawn to the proportions of
   the realistic outfit photos: a man from the chin to the hips, broad shoulders filling the frame, the shirt collar
   standing around the neck with its points resting on the tie knot under notched lapels, the left forearm crossing the
   chest (hand on the jacket front, the watch at the wrist) and the right hand raised to the jacket's waist button, right
   under the other wrist: the pose of the photo the owner chose as the model, which the photo generator copies.
   Fabrics are ready-made <pattern>s (spec.def) or a flat colour; sleeves are drawn in their own rotated frames so a
   stripe follows the arm. WebKit-safe: no <use> inside <clipPath>. */
(function(){
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const hex = (c, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : fallback);
const VIEWBOX = { w: 390, h: 400 };
// centre points of the pieces, in viewBox units (kept for anything that wants to point at them)
const HOTSPOTS = { suit: { x: 110, y: 150 }, shirt: { x: 172, y: 60 }, tie: { x: 195, y: 110 }, clip: { x: 195, y: 150 }, watch: { x: 232, y: 209 } };

function pattern(id, spec, extraRotate) {
  const s = spec || {};
  if (typeof s.def === 'function') return s.def(id, (Number(s.rotate) || 0) + extraRotate);
  const rot = (Number(s.rotate) || 0) + extraRotate, tf = rot ? ` patternTransform="rotate(${rot})"` : '';
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"${tf}><rect width="8" height="8" fill="${hex(s.color, '#555B66')}"/></pattern>`;
}
const f = n => +n.toFixed(2);
/* a limb segment from (x1,y1) to (x2,y2), drawn in its own frame (local +y runs along it) so fabric follows the arm */
function frame(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return { len: Math.hypot(dx, dy), rot: f(Math.atan2(-dx, dy) * 180 / Math.PI), tr: `translate(${f(x1)} ${f(y1)})` }; }

function outfitFigureSvg({ suit, shirt, tie, skin = '#D6B89E', bg = '#F5F2EC', idPrefix = 'ofig-',
  ariaLabel = "Torso wearing today's outfit", watch = { metal: ['#F4F6F8', '#9AA1AA', '#5C636D'], dial: '#F6F6F3', strap: '#9AA1AA', marks: '#1D2125' },
  clip = { color: '#A9AFB8' }, vest = false, jacket = true } = {}) {
  /* jacket:false draws the same torso in shirt sleeves (the caller passes the shirt's fabric as `suit`): no lapels, jacket
     collar, pockets or sleeve buttons; a button placket runs down the front instead */
  const P = String(idPrefix).replace(/[^A-Za-z0-9_-]/g, '');
  skin = hex(skin, '#D6B89E'); bg = hex(bg, '#F5F2EC');
  const wm = (watch && watch.metal) || ['#F4F6F8', '#9AA1AA', '#5C636D'];
  const fabrics = [pattern(`${P}suitB`, suit, 0), pattern(`${P}suitL`, suit, -16), pattern(`${P}suitR`, suit, 16), pattern(`${P}shirt`, shirt, 0), pattern(`${P}tie`, tie, 0)].join('\n');

  /* ---- arms: [shoulder, elbow, wrist] in viewBox units ---- */
  const L = { up: [318, 30, 340, 290], fo: [340, 290, 250, 256] };   // the left arm (viewer's right): forearm across the chest
  const R = { up: [72, 30, 54, 338], fo: [54, 338, 140, 312] };      // the right arm (viewer's left): hand at the button
  const sleeve = (seg, w1, w2, id) => { const fr = frame(...seg), h = fr.len;
    const d = `M ${-w1 / 2} 0 L ${w1 / 2} 0 L ${w2 / 2} ${f(h)} L ${-w2 / 2} ${f(h)} Z`;
    return `<g transform="${fr.tr} rotate(${fr.rot})"><path d="${d}" fill="url(#${P}suitB)"/><path d="${d}" fill="url(#${P}gSleeve)"/>${id ? `<path id="${P}${id}" d="${d}" fill="none"/>` : ''}</g>`; };
  const joint = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${P}suitB)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${P}gJoint)"/>`;
  /* the end of a forearm: sleeve hem, shirt cuff, wrist, hand (and the watch on the left wrist) */
  const hand = (seg, w, withWatch, flip) => { const fr = frame(...seg), h = fr.len;
    return `<g transform="${fr.tr} rotate(${fr.rot})">
<rect x="-14" y="${f(h + 8)}" width="28" height="30" rx="12" fill="${skin}"/>
<g class="fig-hand ${flip ? 'fig-hand-r' : 'fig-hand-l'}" transform="translate(0 ${f(h + 30)}) scale(${flip ? -0.92 : 0.92} 0.92)"><use href="#${P}handSil" fill="#000" fill-opacity="0.25" filter="url(#${P}fBlurS)" transform="translate(3 4)"/><use href="#${P}handArt" color="${skin}"/></g>
<rect x="-14" y="${f(h + 10)}" width="28" height="8" fill="url(#${P}gWristShade)"/>
<rect x="${-w / 2 + 2}" y="${f(h - 6)}" width="${w - 4}" height="18" rx="3" fill="url(#${P}shirt)"/><rect x="${-w / 2 + 2}" y="${f(h - 6)}" width="${w - 4}" height="18" rx="3" fill="url(#${P}gCuff)"/>
${jacket ? `<path d="M ${-w / 2 - 1} ${f(h - 4)} L ${w / 2 + 1} ${f(h - 4)} L ${w / 2 + 1} ${f(h - 1)} L ${-w / 2 - 1} ${f(h - 1)} Z" fill="url(#${P}suitB)"/><path d="M ${-w / 2 - 1} ${f(h - 1)} L ${w / 2 + 1} ${f(h - 1)}" stroke="#000" stroke-opacity=".45" stroke-width="1.2"/>
${[0, 7, 14].map(k => `<circle cx="${flip ? -w / 2 + 6 : w / 2 - 6}" cy="${f(h - 10 - k)}" r="2" fill="#0E1424"/>`).join('')}` : `<path d="M ${-w / 2 + 2} ${f(h - 6)} L ${w / 2 - 2} ${f(h - 6)}" stroke="#000" stroke-opacity=".3" stroke-width="1.2"/><circle cx="${flip ? -w / 2 + 8 : w / 2 - 8}" cy="${f(h + 3)}" r="2" fill="#FFFFFF" fill-opacity=".8" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>`}
${withWatch && watch ? `<g class="fig-watch" transform="translate(0 ${f(h + 19)})">
<rect x="-16" y="-11" width="32" height="22" rx="3" fill="${hex(watch.strap, '#9AA1AA')}"/><rect x="-16" y="-11" width="32" height="22" rx="3" fill="url(#${P}gCuff)"/>
<rect class="fig-crown" x="-3" y="14" width="6" height="5" rx="1.5" fill="${hex(wm[1], '#9AA1AA')}"/>
<circle r="15" fill="url(#${P}gCase)"/><circle r="12" fill="${hex(watch.dial, '#F6F6F3')}"/>
${watch.img ? `<clipPath id="${P}wface"><circle r="15"/></clipPath><image href="${watch.img}" x="-15" y="-15" width="30" height="30" preserveAspectRatio="xMidYMid slice" transform="rotate(90)" clip-path="url(#${P}wface)"/>` : ''}
${watch.blank ? '' : `<g stroke="${hex(watch.marks, '#1D2125')}" stroke-width="1" stroke-linecap="round"><path d="M 0 -10.5 L 0 -8"/><path d="M 0 8 L 0 10.5"/><path d="M -10.5 0 L -8 0"/><path d="M 8 0 L 10.5 0"/></g>
<path d="M 0 0 L 0 -7" stroke="${hex(watch.marks, '#1D2125')}" stroke-width="1.4" stroke-linecap="round"/><path d="M 0 0 L 5 3" stroke="${hex(watch.marks, '#1D2125')}" stroke-width="1.4" stroke-linecap="round"/>`}
${watch.img ? '' : `<path d="M -9 -7 A 12 12 0 0 1 4 -11.3" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}</g>` : ''}
</g>`; };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 400" width="100%" role="img" aria-label="${esc(ariaLabel)}" style="display:block;height:auto">
<defs>
${fabrics}
<linearGradient id="${P}gSleeve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".3" stop-color="#000" stop-opacity=".04"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
<radialGradient id="${P}gJoint" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
<linearGradient id="${P}gBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".25" stop-color="#000" stop-opacity=".02"/><stop offset=".62" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
<linearGradient id="${P}gBodyV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<linearGradient id="${P}gLapel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="${P}gTie" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
<linearGradient id="${P}gShirtV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".3" stop-color="#000" stop-opacity=".04"/><stop offset=".7" stop-color="#000" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
<linearGradient id="${P}gCollar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
<linearGradient id="${P}gCuff" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
<linearGradient id="${P}gNeck" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A3A28" stop-opacity=".38"/><stop offset=".35" stop-color="#5A3A28" stop-opacity=".05"/><stop offset=".65" stop-color="#5A3A28" stop-opacity=".05"/><stop offset="1" stop-color="#5A3A28" stop-opacity=".42"/></linearGradient>
<linearGradient id="${P}gChin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#5A3A28" stop-opacity=".25"/></linearGradient>
<linearGradient id="${P}gCase" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(wm[0], '#F4F6F8')}"/><stop offset=".5" stop-color="${hex(wm[1], '#9AA1AA')}"/><stop offset="1" stop-color="${hex(wm[2], '#5C636D')}"/></linearGradient>
<linearGradient id="${P}gFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="1"/></linearGradient>
<linearGradient id="${P}gSkinSoft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A3A28" stop-opacity=".14"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#5A3A28" stop-opacity=".18"/></linearGradient>
<linearGradient id="${P}gWristShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2518" stop-opacity=".45"/><stop offset="1" stop-color="#3A2518" stop-opacity="0"/></linearGradient>
<filter id="${P}fBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="${P}fBlurS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="${P}fBlurXS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
<clipPath id="${P}clipShoulder"><path d="M 10 440 L 38 130 C 40 90 56 68 84 60 C 110 52 138 44 166 36 L 224 36 C 252 44 280 52 306 60 C 334 68 350 90 352 130 L 380 440 Z"/></clipPath>
<clipPath id="${P}clipVee"><path d="M 156 40 L 158 46 C 166 130 180 210 195 262 C 210 210 224 130 232 46 L 234 40 Z"/></clipPath>
<path id="${P}bodyP" d="M 166 36 C 138 44 110 52 84 60 C 64 66 52 80 50 104 C 48 160 70 230 84 290 C 88 330 86 380 84 470 L 306 470 C 304 380 302 330 306 290 C 320 230 342 160 340 104 C 338 80 326 66 306 60 C 280 52 252 44 224 36 Z"/>
<path id="${P}shirtV" d="M 154 46 L 158 46 C 166 130 180 210 195 262 C 210 210 224 130 232 46 L 236 46 L 236 50 L 154 50 Z"/>
<path id="${P}bladeP" d="M 186 74 L 204 74 C 207 120 212 172 217 222 L 195 256 L 173 222 C 178 172 183 120 186 74 Z"/>
<path id="${P}knotP" d="M 182 50 L 208 50 C 211 60 210 70 205 79 C 199 83 191 83 185 79 C 180 70 179 60 182 50 Z"/>
<path id="${P}lapL" d="M 158 46 L 150 38 L 134 94 L 142 100 L 126 108 C 136 172 164 226 195 262 C 180 210 166 130 158 46 Z"/>
<path id="${P}lapR" d="M 232 46 L 240 38 L 256 94 L 248 100 L 264 108 C 254 172 226 226 195 262 C 210 210 224 130 232 46 Z"/>
<path id="${P}hPalm" d="M -13.5 -8 L 13.5 -8 C 15.5 4 19.5 14 20.8 27 L -20.8 27 C -20.3 14 -16.5 4 -13.5 -8 Z"/>
<path id="${P}hThumbP" d="M -5.9 -8 L 5.9 -8 L 5 30 A 5 5 0 0 1 -5 30 Z"/>
<path id="${P}hF1" d="M -19.8 18 L -19.22 53.73 A 4.27 4.27 0 0 0 -10.68 53.73 L -10.1 18 Z"/>
<path id="${P}hF2" d="M -10.1 18 L -9.49 57.56 A 4.44 4.44 0 0 0 -0.61 57.56 L 0 18 Z"/>
<path id="${P}hF3" d="M 0 18 L 0.6 54.1 A 4.4 4.4 0 0 0 9.4 54.1 L 10 18 Z"/>
<path id="${P}hF4" d="M 10 18 L 10.59 45.69 A 4.31 4.31 0 0 0 19.21 45.69 L 19.8 18 Z"/>
<g id="${P}handSil"><use href="#${P}hThumbP" transform="translate(-15 8) rotate(28)"/><use href="#${P}hPalm"/><use href="#${P}hF1"/><use href="#${P}hF2"/><use href="#${P}hF3"/><use href="#${P}hF4"/></g>
<clipPath id="${P}clipHand"><path d="M -5.9 -8 L 5.9 -8 L 5 30 A 5 5 0 0 1 -5 30 Z" transform="translate(-15 8) rotate(28)"/><path d="M -13.5 -8 L 13.5 -8 C 15.5 4 19.5 14 20.8 27 L -20.8 27 C -20.3 14 -16.5 4 -13.5 -8 Z"/><path d="M -19.8 18 L -19.22 53.73 A 4.27 4.27 0 0 0 -10.68 53.73 L -10.1 18 Z"/><path d="M -10.1 18 L -9.49 57.56 A 4.44 4.44 0 0 0 -0.61 57.56 L 0 18 Z"/><path d="M 0 18 L 0.6 54.1 A 4.4 4.4 0 0 0 9.4 54.1 L 10 18 Z"/><path d="M 10 18 L 10.59 45.69 A 4.31 4.31 0 0 0 19.21 45.69 L 19.8 18 Z"/></clipPath>
<g id="${P}handArt">
<use href="#${P}handSil" fill="currentColor"/>
<rect x="-34" y="-12" width="55.5" height="76" fill="url(#${P}gSkinSoft)" clip-path="url(#${P}clipHand)"/>
<g fill="#FFFFFF" fill-opacity="0.2" stroke="#5A3A28" stroke-opacity="0.18" stroke-width="0.6"><rect x="-17.72" y="46.0" width="5.55" height="8" rx="2.13"/><rect x="-7.94" y="50.0" width="5.78" height="8" rx="2.22"/><rect x="2.14" y="46.5" width="5.72" height="8" rx="2.20"/><rect x="12.10" y="38.0" width="5.61" height="8" rx="2.16"/></g>
<g transform="translate(-15 8) rotate(28)"><rect x="-2.9" y="23" width="5.8" height="8" rx="2.2" fill="#FFFFFF" fill-opacity="0.2" stroke="#5A3A28" stroke-opacity="0.18" stroke-width="0.6"/></g>
</g>
</defs>

<g transform="translate(0 -40)">
<!-- jacket body -->
<use href="#${P}bodyP" fill="url(#${P}suitB)"/>
<use href="#${P}bodyP" fill="url(#${P}gBody)"/>
<use href="#${P}bodyP" fill="url(#${P}gBodyV)"/>
<!-- no head or neck: the collar opening shows the inside back of the collar band -->
<path d="M 156 -40 L 234 -40 L 234 44 C 216 38 174 38 156 44 Z" fill="url(#${P}suitB)"/><path d="M 156 -40 L 234 -40 L 234 44 C 216 38 174 38 156 44 Z" fill="#000" fill-opacity=".42"/>
<!-- jacket collar behind the neck -->
${jacket ? `<path d="M 148 46 C 150 30 166 22 195 22 C 224 22 240 30 242 46 L 246 56 C 228 46 162 46 144 56 Z" fill="url(#${P}suitB)"/><path d="M 148 46 C 150 30 166 22 195 22 C 224 22 240 30 242 46 L 246 56 C 228 46 162 46 144 56 Z" fill="#000" fill-opacity=".3"/>` : ''}
<!-- shirt collar band standing around the neck -->
<path d="M 156 44 C 158 26 172 14 195 14 C 218 14 232 26 234 44 L 236 52 C 220 44 170 44 154 52 Z" fill="url(#${P}shirt)"/><path d="M 156 44 C 158 26 172 14 195 14 C 218 14 232 26 234 44 L 236 52 C 220 44 170 44 154 52 Z" fill="url(#${P}gCollar)"/>
<path d="M 156 44 C 158 26 172 14 195 14 C 218 14 232 26 234 44" stroke="#000" stroke-opacity=".22" stroke-width="1" fill="none"/>
<!-- shirt front between the lapels -->
<use href="#${P}shirtV" fill="url(#${P}shirt)"/>
${jacket ? `<use href="#${P}shirtV" fill="url(#${P}gShirtV)"/>` : ''}
<path d="M 195 80 L 195 262" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
${tie ? `<use href="#${P}bladeP" fill="url(#${P}tie)"/>
<use href="#${P}bladeP" fill="url(#${P}gTie)"/>
<path d="M 195 80 L 195 100" stroke="#000" stroke-opacity=".3" stroke-width="5" filter="url(#${P}fBlurS)"/>
<use href="#${P}knotP" fill="url(#${P}tie)"/>
<use href="#${P}knotP" fill="url(#${P}gTie)"/>
<path d="M 185 77 C 191 84 199 84 205 77" stroke="#000" stroke-opacity=".3" stroke-width="1.2" fill="none"/>` : `<!-- no tie: the collar open on the throat, the placket buttoned below it -->
<g class="fig-open"><path d="M 176 36 L 214 36 L 195 108 Z" fill="${skin}"/><path d="M 176 36 L 214 36 L 195 108 Z" fill="url(#${P}gNeck)"/>
<path d="M 177 40 L 195 108 L 213 40" stroke="#000" stroke-opacity=".28" stroke-width="5" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 177 40 L 195 108 L 213 40" stroke="#000" stroke-opacity=".3" stroke-width="1" fill="none"/>
${jacket ? `<path d="M 189 110 L 189 262 M 201 110 L 201 262" stroke="#000" stroke-opacity=".16" stroke-width="1"/>
${[128, 170, 212].map(y => `<circle cx="195" cy="${y}" r="3.2" fill="#FFFFFF" fill-opacity=".85" stroke="#000" stroke-opacity=".4" stroke-width=".7"/><circle cx="195" cy="${y}" r=".9" fill="#000" fill-opacity=".35"/>`).join('')}` : ''}</g>`}
${tie ? `<!-- collar points resting on the knot -->
<path d="M 152 62 L 180 100 L 190 52 M 238 62 L 210 100 L 200 52" stroke="#000" stroke-opacity=".35" stroke-width="5" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 154 50 C 166 45 180 46 189 51 L 178 98 C 166 90 155 76 148 62 Z" fill="url(#${P}shirt)"/><path d="M 154 50 C 166 45 180 46 189 51 L 178 98 C 166 90 155 76 148 62 Z" fill="url(#${P}gCollar)"/>
<path d="M 189 51 L 178 98 C 166 90 155 76 148 62" stroke="#000" stroke-opacity=".32" stroke-width="1.1" fill="none"/>
<path d="M 236 50 C 224 45 210 46 201 51 L 212 98 C 224 90 235 76 242 62 Z" fill="url(#${P}shirt)"/><path d="M 236 50 C 224 45 210 46 201 51 L 212 98 C 224 90 235 76 242 62 Z" fill="url(#${P}gCollar)"/>
<path d="M 201 51 L 212 98 C 224 90 235 76 242 62" stroke="#000" stroke-opacity=".32" stroke-width="1.1" fill="none"/>` : `<!-- collar leaves lying open, their points on the shirt front -->
<path d="M 152 62 L 170 98 L 178 46 M 238 62 L 220 98 L 212 46" stroke="#000" stroke-opacity=".35" stroke-width="5" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 154 50 C 162 45 171 43 178 44 L 169 96 C 160 88 152 76 148 62 Z" fill="url(#${P}shirt)"/><path d="M 154 50 C 162 45 171 43 178 44 L 169 96 C 160 88 152 76 148 62 Z" fill="url(#${P}gCollar)"/>
<path d="M 178 44 L 169 96 C 160 88 152 76 148 62" stroke="#000" stroke-opacity=".32" stroke-width="1.1" fill="none"/>
<path d="M 236 50 C 228 45 219 43 212 44 L 221 96 C 230 88 238 76 242 62 Z" fill="url(#${P}shirt)"/><path d="M 236 50 C 228 45 219 43 212 44 L 221 96 C 230 88 238 76 242 62 Z" fill="url(#${P}gCollar)"/>
<path d="M 212 44 L 221 96 C 230 88 238 76 242 62" stroke="#000" stroke-opacity=".32" stroke-width="1.1" fill="none"/>`}
${tie && clip ? `<g class="fig-clip"><rect x="178" y="152" width="36" height="5" rx="2.5" fill="#000" fill-opacity=".35" filter="url(#${P}fBlurXS)"/>
<rect x="179" y="148" width="34" height="3.8" rx="1.9" fill="${hex(clip.color, '#A9AFB8')}"/>
<rect x="179" y="148" width="34" height="1.4" rx=".7" fill="#FFFFFF" fill-opacity=".65"/></g>` : ''}
${vest ? `<g class="fig-vest" clip-path="url(#${P}clipVee)">
<path d="M 176 92 C 180 140 188 182 195 210 C 202 182 210 140 214 92" stroke="#000" stroke-opacity=".45" stroke-width="6" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 140 40 L 170 40 L 176 92 C 180 140 188 182 195 210 L 196 280 L 140 280 Z" fill="url(#${P}suitB)"/><path d="M 140 40 L 170 40 L 176 92 C 180 140 188 182 195 210 L 196 280 L 140 280 Z" fill="url(#${P}gLapel)"/>
<path d="M 250 40 L 220 40 L 214 92 C 210 140 202 182 195 210 L 194 280 L 250 280 Z" fill="url(#${P}suitB)"/><path d="M 250 40 L 220 40 L 214 92 C 210 140 202 182 195 210 L 194 280 L 250 280 Z" fill="url(#${P}gLapel)"/>
<path d="M 140 40 L 170 40 L 176 92 C 180 140 188 182 195 210 L 196 280 L 140 280 Z M 250 40 L 220 40 L 214 92 C 210 140 202 182 195 210 L 194 280 L 250 280 Z" fill="#000" fill-opacity=".14"/>
<path d="M 176 92 C 180 140 188 182 195 210 M 214 92 C 210 140 202 182 195 210" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="1.3" fill="none"/>
<path d="M 195 210 L 195 280" stroke="#000" stroke-opacity=".45" stroke-width="1.2"/>
${[220, 238, 256].map(y => `<circle cx="196" cy="${y}" r="3" fill="#0E1424"/><circle cx="195.3" cy="${y - .8}" r=".9" fill="#FFFFFF" fill-opacity=".35"/>`).join('')}
</g>` : ''}
${jacket ? `<!-- lapels -->
<path d="M 158 46 C 166 130 180 210 195 262" stroke="#000" stroke-opacity=".45" stroke-width="7" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 232 46 C 224 130 210 210 195 262" stroke="#000" stroke-opacity=".45" stroke-width="7" fill="none" filter="url(#${P}fBlurS)"/>
<use href="#${P}lapL" fill="url(#${P}suitL)"/><use href="#${P}lapL" fill="url(#${P}gLapel)"/>
<use href="#${P}lapR" fill="url(#${P}suitR)"/><use href="#${P}lapR" fill="url(#${P}gLapel)"/>
<path d="M 150 38 L 134 94 L 142 100 L 126 108 C 136 172 164 226 195 262" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="1.3" fill="none"/>
<path d="M 240 38 L 256 94 L 248 100 L 264 108 C 254 172 226 226 195 262" stroke="#FFFFFF" stroke-opacity=".1" stroke-width="1.3" fill="none"/>
<path d="M 126 108 C 136 172 164 226 195 262" stroke="#000" stroke-opacity=".4" stroke-width="1" fill="none" transform="translate(-1.5 1.5)"/>
<path d="M 264 108 C 254 172 226 226 195 262" stroke="#000" stroke-opacity=".4" stroke-width="1" fill="none" transform="translate(1.5 1.5)"/>
<!-- front: buttons, chest pocket, flap pockets -->
<path d="M 195 262 L 195 440" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>
<circle cx="195" cy="276" r="5.5" fill="#0E1424"/><circle cx="193.6" cy="274.6" r="1.6" fill="#FFFFFF" fill-opacity=".35"/>
<circle cx="195" cy="336" r="5.5" fill="#0E1424"/><circle cx="193.6" cy="334.6" r="1.6" fill="#FFFFFF" fill-opacity=".35"/>
<path class="fig-welt" d="M 236 150 L 284 144 L 284 152 L 236 158 Z" fill="url(#${P}suitB)"/><path d="M 236 150 L 284 144 L 284 152 L 236 158 Z" fill="#000" fill-opacity=".12"/><path d="M 236 150 L 284 144" stroke="#000" stroke-opacity=".4" stroke-width="1"/><path d="M 236 158 L 284 152" stroke="#000" stroke-opacity=".22" stroke-width=".8"/>
<path d="M 106 362 L 168 368 L 168 380 L 106 374 Z" fill="url(#${P}suitB)"/><path d="M 106 362 L 168 368 L 168 380 L 106 374 Z" fill="#000" fill-opacity=".16"/><path d="M 106 374 L 168 380" stroke="#000" stroke-opacity=".6" stroke-width="2"/>
<path d="M 284 362 L 222 368 L 222 380 L 284 374 Z" fill="url(#${P}suitB)"/><path d="M 284 362 L 222 368 L 222 380 L 284 374 Z" fill="#000" fill-opacity=".16"/><path d="M 284 374 L 222 380" stroke="#000" stroke-opacity=".6" stroke-width="2"/>

` : `<!-- no jacket: a shirt front with its button placket -->
<path d="M 188 100 L 188 440 M 202 100 L 202 440" stroke="#000" stroke-opacity=".16" stroke-width="1"/>
${[124, 172, 220, 268, 316, 364].map(y => `<circle cx="195" cy="${y}" r="3.4" fill="#FFFFFF" fill-opacity=".85" stroke="#000" stroke-opacity=".4" stroke-width=".7"/><circle cx="195" cy="${y}" r=".9" fill="#000" fill-opacity=".35"/>`).join('')}
<path d="M 236 150 L 276 146 L 278 196 L 257 206 L 238 198 Z" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2"/>
`}
<path d="M 84 60 C 68 66 58 76 54 90 M 306 60 C 322 66 332 76 336 90" stroke="#000" stroke-opacity=".25" stroke-width="1.6" fill="none"/>
<!-- the right arm (viewer's left): upper arm down the side, forearm to the button -->
<path d="M 60 346 L 140 322 L 144 342 L 62 370 Z" fill="#000" fill-opacity=".35" filter="url(#${P}fBlur)"/>
<g clip-path="url(#${P}clipShoulder)">${sleeve(R.up, 58, 50)}</g>${joint(54, 338, 25)}${sleeve(R.fo, 50, 42)}
${hand(R.fo, 42, false, true)}
<!-- the left arm (viewer's right): forearm across the chest, hand at the lapel, the watch at the wrist -->
<path d="M 340 298 L 250 268 L 246 290 L 336 322 Z" fill="#000" fill-opacity=".35" filter="url(#${P}fBlur)"/>
<g clip-path="url(#${P}clipShoulder)">${sleeve(L.up, 58, 50)}</g>${joint(340, 290, 25)}${sleeve(L.fo, 50, 42)}
${hand(L.fo, 42, true, false)}
<path d="M 324 278 Q 332 290 324 304 M 68 326 Q 60 338 68 352" stroke="#000" stroke-opacity=".3" stroke-width="1.6" fill="none"/>

</g>
<rect x="0" y="330" width="390" height="70" fill="url(#${P}gFade)"/>
</svg>`;
}
window.outfitFigureSvg = outfitFigureSvg; window.FIG_HOTSPOTS = HOTSPOTS; window.FIG_VIEWBOX = VIEWBOX;
})();
