/* Daily Wardrobe: the torso figure for the Today tab (suit, shirt, tie, clip, watch), from the design handoff
   (daily-wardrobe-figure/outfit-figure.js). The drawing is unchanged. App changes: loaded as a classic script;
   a fabric can be a ready-made <pattern> (spec.def) so the app's tagged-colour fabrics are used instead of photo
   crops; the tie, clip and watch are optional and take the item's metal and dial colours; clip paths are inlined
   (no <use> inside <clipPath>) for WebKit. */
(function(){
// outfit-figure.js
// Torso figure for the "Daily outfit" tab: suit, shirt, tie, tie clip and watch,
// drawn as one SVG (viewBox 390x400) in the pose "forearms crossed at the waist,
// one hand at the cuff next to the watch". No dependencies, no framework.
//
//   import { outfitFigureSvg, HOTSPOTS } from './outfit-figure.js';
//   el.innerHTML = outfitFigureSvg({ suit, shirt, tie });
//
// Each fabric is a swatch: { image, tile, mirror, rotate, color }
//   image   URL / data URI / blob URL of the extracted swatch (optional)
//   color   flat fallback colour when there is no image (hex)
//   tile    swatch width in viewBox units (how big the weave looks on the figure)
//   mirror  false (default): repeat the swatch as-is. true: tile as 2x2 mirrored copies, which hides seams on
//          plain / twill / flannel swatches but breaks diagonal stripes, checks and dots - do not use it on those
//   rotate  extra rotation in degrees (e.g. to turn stripes on the tie)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const hex = (c, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : fallback);
const href = (u) => (/^\s*javascript:/i.test(String(u)) ? '' : esc(u));

const VIEWBOX = { w: 390, h: 400 };

// Tap targets, in viewBox units (centre points). Overlay 44x44 CSS-px buttons on these.
const HOTSPOTS = {
  suit: { x: 128, y: 118 },
  shirt: { x: 160, y: 32 },
  tie: { x: 195, y: 72 },
  clip: { x: 196, y: 117 },
  watch: { x: 236, y: 158 },
};

const DEFAULT_TILE = { suit: 90, shirt: 48, tie: 60 };

function pattern(id, spec, kind, extraRotate) {
  const s = spec || {};
  if (typeof s.def === 'function') return s.def(id, (Number(s.rotate) || 0) + extraRotate);
  const rot = (Number(s.rotate) || 0) + extraRotate;
  const tf = rot ? ` patternTransform="rotate(${rot})"` : '';
  if (!s.image) {
    return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"${tf}><rect width="8" height="8" fill="${hex(s.color, '#555B66')}"/></pattern>`;
  }
  const t = Number(s.tile) > 0 ? Number(s.tile) : DEFAULT_TILE[kind];
  const u = href(s.image);
  const img = (extra) => `<image href="${u}" width="${t}" height="${t}" preserveAspectRatio="xMidYMid slice"${extra}/>`;
  if (s.mirror !== true) {
    return `<pattern id="${id}" width="${t}" height="${t}" patternUnits="userSpaceOnUse"${tf}>${img('')}</pattern>`;
  }
  const d = t * 2;
  return `<pattern id="${id}" width="${d}" height="${d}" patternUnits="userSpaceOnUse"${tf}>` +
    img('') +
    img(` transform="translate(${d} 0) scale(-1 1)"`) +
    img(` transform="translate(0 ${d}) scale(1 -1)"`) +
    img(` transform="translate(${d} ${d}) scale(-1 -1)"`) +
    `</pattern>`;
}

function outfitFigureSvg({
  suit,
  shirt,
  tie,
  skin = '#D6B89E',
  bg = '#F5F2EC',
  idPrefix = 'ofig-',
  ariaLabel = "Torso wearing today's outfit, adjusting the cuff next to the watch",
  watch = { metal: ['#F4F6F8', '#9AA1AA', '#5C636D'], dial: '#12151A', strap: '#16181C', marks: '#D9DEE6' },
  clip = { color: '#A9AFB8' },
  vest = false,
} = {}) {
  const wm = (watch && watch.metal) || ['#F4F6F8', '#9AA1AA', '#5C636D'];
  const P = String(idPrefix).replace(/[^A-Za-z0-9_-]/g, '');
  skin = hex(skin, '#D6B89E');
  bg = hex(bg, '#F5F2EC');
  const fabrics = [
    pattern(`${P}suitB`, suit, 'suit', 0),
    pattern(`${P}suitL`, suit, 'suit', -16), // left lapel: weave follows the lapel roll
    pattern(`${P}suitR`, suit, 'suit', 16),  // right lapel
    pattern(`${P}shirt`, shirt, 'shirt', 0),
    pattern(`${P}tie`, tie, 'tie', 0),
  ].join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 400" width="100%" role="img" aria-label="${esc(ariaLabel)}" style="display:block;height:auto">
<defs>
${fabrics}



<linearGradient id="${P}gSleeve" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="0.25" stop-color="#000" stop-opacity="0.06"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.78" stop-color="#000" stop-opacity="0.14"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>
<linearGradient id="${P}gBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.4"/><stop offset="0.22" stop-color="#000" stop-opacity="0"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>
<linearGradient id="${P}gBodyV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></linearGradient>
<linearGradient id="${P}gLapel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>
<linearGradient id="${P}gTie" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.42"/><stop offset="0.3" stop-color="#000" stop-opacity="0"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>
<linearGradient id="${P}gShirtV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.3"/><stop offset="0.3" stop-color="#000" stop-opacity="0.05"/><stop offset="0.7" stop-color="#000" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>
<linearGradient id="${P}gCuff" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.3"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
<linearGradient id="${P}gSkin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A3A28" stop-opacity="0.26"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.14"/><stop offset="1" stop-color="#5A3A28" stop-opacity="0.32"/></linearGradient>
<linearGradient id="${P}gCase" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(wm[0],'#F4F6F8')}"/><stop offset="0.5" stop-color="${hex(wm[1],'#9AA1AA')}"/><stop offset="1" stop-color="${hex(wm[2],'#5C636D')}"/></linearGradient>
<linearGradient id="${P}gFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="1"/></linearGradient>
<linearGradient id="${P}gMaskTop" gradientUnits="userSpaceOnUse" x1="0" y1="-2" x2="0" y2="46"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
<mask id="${P}mUp" maskUnits="userSpaceOnUse" x="-70" y="-30" width="140" height="280"><rect x="-70" y="-30" width="140" height="280" fill="url(#${P}gMaskTop)"/></mask>
<filter id="${P}fBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="${P}fBlurS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="${P}fBlurXS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>

<path id="${P}bodyP" d="M 150 -4 C 118 4 84 20 58 46 C 46 58 40 76 40 98 L 80 150 C 86 192 91 242 94 300 L 98 430 L 292 430 L 296 300 C 299 242 304 192 310 150 L 350 98 C 350 76 344 58 332 46 C 306 20 272 4 240 -4 Z"/>
<path id="${P}lapL" d="M 137 -4 L 114 -4 L 114 22 L 96 58 C 116 134 158 198 195 244 C 160 160 146 80 137 -4 Z"/>
<path id="${P}lapR" d="M 253 -4 L 276 -4 L 276 22 L 294 58 C 274 134 232 198 195 244 C 230 160 244 80 253 -4 Z"/>
<path id="${P}upR" d="M -28 -8 L 28 -8 L 25 173 C 25 183 -25 183 -25 173 Z"/>
<path id="${P}foreR" d="M -25 0 C -25 -12 25 -12 25 0 L 19 104 L -19 104 Z"/>
<path id="${P}upL" d="M -28 -8 L 28 -8 L 25 153 C 25 163 -25 163 -25 153 Z"/>
<path id="${P}foreL" d="M -25 0 C -25 -12 25 -12 25 0 L 19 120 L -19 120 Z"/>
<path id="${P}silL" d="M 336.9 43 L 376.2 199.1 C 379.9 212.6 361.7 233 347.9 230.7 L 230.6 205.1 L 236.8 167.7 L 317.6 177 L 282.9 57.6 Z"/>
<path id="${P}silR" d="M 52.6 43.7 L 13.6 220.5 C 10.8 232.2 18 245.7 29.3 249.8 L 129 280 L 142.1 244.4 L 67.4 211.9 L 107.1 56.7 Z"/>
<path id="${P}upSegL" d="M -28 -8 L 28 -8 L 25 153 L 24 196 L -24 196 L -25 153 Z"/>
<path id="${P}foSegL" d="M -25 -30 L 25 -30 L 25 0 L 19 120 L -19 120 L -25 0 Z"/>
<path id="${P}upSegR" d="M -28 -8 L 28 -8 L 25 173 L 24 216 L -24 216 L -25 173 Z"/>
<path id="${P}foSegR" d="M -25 -30 L 25 -30 L 25 0 L 19 104 L -19 104 L -25 0 Z"/>
<clipPath id="${P}clipVee"><path d="M 132 -4 L 258 -4 L 197 248 L 193 248 Z"/></clipPath>
<clipPath id="${P}clipSilL"><path d="M 336.9 43 L 376.2 199.1 C 379.9 212.6 361.7 233 347.9 230.7 L 230.6 205.1 L 236.8 167.7 L 317.6 177 L 282.9 57.6 Z"/></clipPath>
<clipPath id="${P}clipShoL"><polygon points="129.4,4.7 574.6,407.3 574.6,-300 129.4,-300"/></clipPath>
<clipPath id="${P}clipCufL"><polygon points="129.4,4.7 574.6,407.3 574.6,600 129.4,600"/></clipPath>
<clipPath id="${P}clipSilR"><path d="M 52.6 43.7 L 13.6 220.5 C 10.8 232.2 18 245.7 29.3 249.8 L 129 280 L 142.1 244.4 L 67.4 211.9 L 107.1 56.7 Z"/></clipPath>
<clipPath id="${P}clipShoR"><polygon points="-226.4,368.2 302.2,84.4 302.2,-300 -226.4,-300"/></clipPath>
<clipPath id="${P}clipCufR"><polygon points="-226.4,368.2 302.2,84.4 302.2,600 -226.4,600"/></clipPath>
<path id="${P}bladeP" d="M 182 22 L 208 22 C 211 70 215 120 219 170 L 195 244 L 171 170 C 175 120 179 70 182 22 Z"/>
<path id="${P}knotP" d="M 181 -6 L 209 -6 C 212 10 214 22 211 32 C 203 42 187 42 179 32 C 176 22 178 10 181 -6 Z"/>
<path id="${P}shirtV" d="M 132 -4 L 258 -4 L 197 248 L 193 248 Z"/>
<path id="${P}wingL" d="M 136 -4 L 192 -4 L 169 64 Z"/>
<path id="${P}wingR" d="M 254 -4 L 198 -4 L 221 64 Z"/>
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
<linearGradient id="${P}gSkinSoft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A3A28" stop-opacity="0.14"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.08"/><stop offset="1" stop-color="#5A3A28" stop-opacity="0.18"/></linearGradient>
<linearGradient id="${P}gWristShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2518" stop-opacity="0.5"/><stop offset="1" stop-color="#3A2518" stop-opacity="0"/></linearGradient>
</defs>

<use href="#${P}bodyP" fill="url(#${P}suitB)"/>
<use href="#${P}bodyP" fill="url(#${P}gBody)"/>
<use href="#${P}bodyP" fill="url(#${P}gBodyV)"/>

<use href="#${P}shirtV" fill="url(#${P}shirt)"/>
<use href="#${P}shirtV" fill="url(#${P}gShirtV)"/>

${tie ? `<use href="#${P}bladeP" fill="url(#${P}tie)"/>
<use href="#${P}bladeP" fill="url(#${P}gTie)"/>
<path d="M 195 42 L 195 70" stroke="#000" stroke-opacity="0.35" stroke-width="5" filter="url(#${P}fBlurS)"/>
<use href="#${P}knotP" fill="url(#${P}tie)"/>
<use href="#${P}knotP" fill="url(#${P}gTie)"/>` : ''}

<use href="#${P}wingL" fill="url(#${P}shirt)"/>
<use href="#${P}wingL" fill="url(#${P}gCuff)"/>
<path d="M 192 -4 L 169 64" stroke="#000" stroke-opacity="0.28" stroke-width="1.2"/>
<use href="#${P}wingR" fill="url(#${P}shirt)"/>
<use href="#${P}wingR" fill="url(#${P}gCuff)"/>
<path d="M 198 -4 L 221 64" stroke="#000" stroke-opacity="0.28" stroke-width="1.2"/>

${tie && clip ? `<g class="fig-clip"><rect x="178" y="116" width="34" height="5" rx="2.5" fill="#000" fill-opacity="0.35" filter="url(#${P}fBlurXS)"/>
<rect x="179" y="112" width="32" height="3.8" rx="1.9" fill="${hex(clip.color, '#A9AFB8')}"/>
<rect x="179" y="112" width="32" height="1.4" rx="0.7" fill="#FFFFFF" fill-opacity="0.65"/></g>` : ''}

${vest ? `<g class="fig-vest" clip-path="url(#${P}clipVee)">
<path d="M 172 40 C 178 86 187 124 195 156 C 203 124 212 86 218 40" stroke="#000" stroke-opacity="0.45" stroke-width="7" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 120 -4 L 160 -4 L 165 38 C 172 86 184 124 195 156 L 196 262 L 120 262 Z" fill="url(#${P}suitB)"/>
<path d="M 270 -4 L 230 -4 L 225 38 C 218 86 206 124 195 156 L 194 262 L 270 262 Z" fill="url(#${P}suitB)"/>
<path d="M 120 -4 L 160 -4 L 165 38 C 172 86 184 124 195 156 L 196 262 L 120 262 Z" fill="url(#${P}gLapel)"/>
<path d="M 270 -4 L 230 -4 L 225 38 C 218 86 206 124 195 156 L 194 262 L 270 262 Z" fill="url(#${P}gLapel)"/>
<path d="M 165 38 C 172 86 184 124 195 156 M 225 38 C 218 86 206 124 195 156" stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="1.2" fill="none"/>
<path d="M 195 156 L 195 262" stroke="#000" stroke-opacity="0.45" stroke-width="1.2"/>
${[170, 190, 210, 230, 250].map(y => `<circle cx="196" cy="${y}" r="3.4" fill="#0E1424"/><circle cx="195.2" cy="${y - 0.9}" r="1" fill="#FFFFFF" fill-opacity="0.35"/>`).join('')}
</g>` : ''}
<path d="M 137 -4 C 146 80 160 160 195 244" stroke="#000" stroke-opacity="0.5" stroke-width="9" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 253 -4 C 244 80 230 160 195 244" stroke="#000" stroke-opacity="0.5" stroke-width="9" fill="none" filter="url(#${P}fBlurS)"/>

<use href="#${P}lapL" fill="url(#${P}suitL)"/>
<use href="#${P}lapL" fill="url(#${P}gLapel)"/>
<use href="#${P}lapR" fill="url(#${P}suitR)"/>
<use href="#${P}lapR" fill="url(#${P}gLapel)"/>
<path d="M 114 22 L 96 58 C 116 134 158 198 195 244" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="1.4" fill="none"/>
<path d="M 276 22 L 294 58 C 274 134 232 198 195 244" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1.4" fill="none"/>
<path d="M 114 22 L 96 58 C 116 134 158 198 195 244" stroke="#000" stroke-opacity="0.45" stroke-width="1" fill="none" transform="translate(-1.5 1.5)"/>
<path d="M 276 22 L 294 58 C 274 134 232 198 195 244" stroke="#000" stroke-opacity="0.45" stroke-width="1" fill="none" transform="translate(1.5 1.5)"/>

<path d="M 195 244 L 195 430" stroke="#000" stroke-opacity="0.5" stroke-width="1.6"/>
<path d="M 197 244 L 197 430" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
<path d="M 238 138 L 282 132" stroke="#000" stroke-opacity="0.55" stroke-width="2.6"/>
<path d="M 238 140.5 L 282 134.5" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1"/>
<path d="M 108 330 L 172 336 L 172 348 L 108 342 Z" fill="url(#${P}suitB)"/>
<path d="M 108 330 L 172 336 L 172 348 L 108 342 Z" fill="#000" fill-opacity="0.16"/>
<path d="M 108 342 L 172 348" stroke="#000" stroke-opacity="0.6" stroke-width="2"/>
<path d="M 282 330 L 218 336 L 218 348 L 282 342 Z" fill="url(#${P}suitB)"/>
<path d="M 282 330 L 218 336 L 218 348 L 282 342 Z" fill="#000" fill-opacity="0.16"/>
<path d="M 282 342 L 218 348" stroke="#000" stroke-opacity="0.6" stroke-width="2"/>
<circle cx="195" cy="290" r="5.5" fill="#0E1424"/>
<circle cx="193.6" cy="288.6" r="1.6" fill="#FFFFFF" fill-opacity="0.35"/>

<use href="#${P}silL" fill="#000" fill-opacity="0.4" filter="url(#${P}fBlur)" transform="translate(-8 6)"/>
<g transform="translate(352 206) rotate(99.4)">
<g transform="translate(0 164) scale(1 0.86)">
<use href="#${P}handSil" fill="#000" fill-opacity="0.28" filter="url(#${P}fBlurS)" transform="translate(3 4)"/>
<use href="#${P}handArt" color="${skin}"/>
</g>
<rect x="-20" y="112" width="40" height="26" rx="3" fill="url(#${P}shirt)"/>
<rect x="-20" y="112" width="40" height="26" rx="3" fill="url(#${P}gCuff)"/>
<path d="M -20 128 L 20 128" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>
</g>
<g clip-path="url(#${P}clipSilL)">
<g clip-path="url(#${P}clipShoL)">
<g transform="translate(312 58) rotate(-15.2)"><g mask="url(#${P}mUp)">
<use href="#${P}upSegL" fill="url(#${P}suitB)"/>
<use href="#${P}upSegL" fill="url(#${P}gSleeve)"/>
</g></g>
</g>
<g clip-path="url(#${P}clipCufL)">
<g transform="translate(352 206) rotate(99.4)">
<use href="#${P}foSegL" fill="url(#${P}suitB)"/>
<use href="#${P}foSegL" fill="url(#${P}gSleeve)"/>
</g>
</g>
<path d="M 318 177.5 L 362 219" stroke="#000" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 318 177.5 L 360 217" stroke="#000" stroke-opacity="0.4" stroke-width="1.1" fill="none"/>
<path d="M 319.5 175.8 L 361.5 215.3" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1" fill="none"/>
<ellipse cx="367" cy="213" rx="8" ry="14" fill="#FFFFFF" fill-opacity="0.14" filter="url(#${P}fBlurS)" transform="rotate(-18 367 213)"/>
<g fill="none" stroke-linecap="round">
<path d="M 303.7 175.6 Q 311 177 316 186" stroke="#000" stroke-opacity="0.32" stroke-width="1.6"/>
<path d="M 290 174 Q 300 177 306 188" stroke="#000" stroke-opacity="0.28" stroke-width="1.6"/>
<path d="M 276 172.5 Q 285 176 291 188" stroke="#000" stroke-opacity="0.24" stroke-width="1.6"/>
<path d="M 313.5 163.6 Q 322 166 330 176" stroke="#000" stroke-opacity="0.3" stroke-width="1.6"/>
<path d="M 309 148.3 Q 317 150 324 158" stroke="#000" stroke-opacity="0.24" stroke-width="1.6"/>
<path d="M 305 177 Q 312 179 317.5 188" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
<path d="M 291.5 175.5 Q 301 178.5 307.5 190" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1"/>
<path d="M 315 165 Q 323 168 331 178" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1"/>
</g>
</g>
<g transform="translate(352 206) rotate(99.4)">
<circle cx="-17" cy="104" r="2.3" fill="#0E1424"/><circle cx="-17" cy="96" r="2.3" fill="#0E1424"/><circle cx="-17" cy="88" r="2.3" fill="#0E1424"/>
${watch ? `<g class="fig-watch"><rect x="-19" y="137" width="38" height="26" rx="2" fill="${hex(watch.strap, '#16181C')}"/>
<rect x="-19" y="137" width="38" height="26" rx="2" fill="url(#${P}gCuff)"/>
<rect x="17" y="147" width="5" height="7" rx="1.5" fill="#7C838D"/>
<circle cx="0" cy="150" r="18" fill="url(#${P}gCase)"/>
<circle cx="0" cy="150" r="14.5" fill="${hex(watch.dial, '#12151A')}"/>
<g stroke="${hex(watch.marks, '#D9DEE6')}" stroke-width="1.2" stroke-linecap="round">
<path d="M 0 137.5 L 0 140.5"/><path d="M 0 159.5 L 0 162.5"/><path d="M -12.5 150 L -9.5 150"/><path d="M 9.5 150 L 12.5 150"/>
</g>
<path d="M 0 150 L 0 142" stroke="${hex(watch.marks, '#FFFFFF')}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M 0 150 L 6 153" stroke="${hex(watch.marks, '#FFFFFF')}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M -11 142 A 14.5 14.5 0 0 1 4 136" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</g>` : ''}
</g>

<use href="#${P}silR" fill="#000" fill-opacity="0.4" filter="url(#${P}fBlur)" transform="translate(8 8)"/>
<g transform="translate(38 226) rotate(-69.8)">
<rect x="-12" y="106" width="24" height="34" rx="12" fill="${skin}"/>
<g transform="translate(0 132) rotate(-52)">
<circle r="12.5" fill="${skin}"/>
<g transform="scale(-1 1.1)">
<use href="#${P}handSil" fill="#000" fill-opacity="0.3" filter="url(#${P}fBlurS)" transform="translate(3 3)"/>
<use href="#${P}handArt" color="${skin}"/>
</g>
</g>
<rect x="-12" y="122" width="24" height="7" fill="url(#${P}gWristShade)"/>
<rect x="-20" y="96" width="40" height="26" rx="3" fill="url(#${P}shirt)"/>
<rect x="-20" y="96" width="40" height="26" rx="3" fill="url(#${P}gCuff)"/>
<path d="M -20 112 L 20 112" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>
</g>
<g clip-path="url(#${P}clipSilR)">
<g clip-path="url(#${P}clipShoR)">
<g transform="translate(78 58) rotate(13.4)"><g mask="url(#${P}mUp)">
<use href="#${P}upSegR" fill="url(#${P}suitB)"/>
<use href="#${P}upSegR" fill="url(#${P}gSleeve)"/>
</g></g>
</g>
<g clip-path="url(#${P}clipCufR)">
<g transform="translate(38 226) rotate(-69.8)">
<use href="#${P}foSegR" fill="url(#${P}suitB)"/>
<use href="#${P}foSegR" fill="url(#${P}gSleeve)"/>
</g>
</g>
<path d="M 67 212.5 L 22 235" stroke="#000" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round" fill="none" filter="url(#${P}fBlurS)"/>
<path d="M 67 212.5 L 24 234" stroke="#000" stroke-opacity="0.4" stroke-width="1.1" fill="none"/>
<path d="M 66 210.6 L 23 232" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1" fill="none"/>
<ellipse cx="22" cy="231" rx="8" ry="14" fill="#FFFFFF" fill-opacity="0.14" filter="url(#${P}fBlurS)" transform="rotate(25 22 231)"/>
<g fill="none" stroke-linecap="round">
<path d="M 80.2 217.5 Q 73 222 68 232" stroke="#000" stroke-opacity="0.32" stroke-width="1.6"/>
<path d="M 93.1 223 Q 85 229 80 241" stroke="#000" stroke-opacity="0.28" stroke-width="1.6"/>
<path d="M 105.9 228.7 Q 97 236 93 249" stroke="#000" stroke-opacity="0.24" stroke-width="1.6"/>
<path d="M 70.9 198.3 Q 64 201 56 210" stroke="#000" stroke-opacity="0.3" stroke-width="1.6"/>
<path d="M 74.9 182.8 Q 68 186 62 194" stroke="#000" stroke-opacity="0.24" stroke-width="1.6"/>
<path d="M 82.5 219 Q 75.5 224 70.5 234" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
<path d="M 95 224.5 Q 87 230.5 82 242.5" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1"/>
<path d="M 72.5 199.5 Q 65.5 202.5 57.5 211.5" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="1"/>
</g>
</g>
<g transform="translate(38 226) rotate(-69.8)">
<circle cx="17" cy="96" r="2.3" fill="#0E1424"/><circle cx="17" cy="88" r="2.3" fill="#0E1424"/><circle cx="17" cy="80" r="2.3" fill="#0E1424"/>
</g>

<rect x="0" y="300" width="390" height="100" fill="url(#${P}gFade)"/>
</svg>`;
}

window.outfitFigureSvg=outfitFigureSvg;window.FIG_HOTSPOTS=HOTSPOTS;window.FIG_VIEWBOX=VIEWBOX;
})();
