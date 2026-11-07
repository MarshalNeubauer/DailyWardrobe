/* Daily Wardrobe: shared constants and item helpers (no DOM access; also loaded by the analysis worker) */
const TYPES={suit:'Suit',blazer:'Blazer',pants:'Dress pants',shirt:'Dress shirt',tie:'Tie',tieclip:'Tie clip',watch:'Watch',shoes:'Shoes',belt:'Belt',socks:'Socks'};
const COLORS={black:'#16161a',charcoal:'#3b3f46',darkgrey:'#5e6269',grey:'#8b8f96',lightgrey:'#babdc2',white:'#f6f6f3',cream:'#efe4c8',lightblue:'#a9c7e4',blue:'#3f6fb5',navy:'#1b2a4a',brown:'#5a3a22',tan:'#b8946a',olive:'#5b5d36',green:'#2f6b4a',burgundy:'#6d1f2c',oxblood:'#4a1a1e',red:'#b3262e',purple:'#5d3a7a',pink:'#e3a5b4',gold:'#c9a227',silver:'#c3c6cb'};
const METAL={gold:'#c9a227',silver:'#c3c6cb',other:'#7d8187'},PATS_BY=(()=>{const suiting=['solid','pinstripe','chalk-stripe','herringbone','birdseye','nailhead','sharkskin','houndstooth','glen-check','windowpane','tweed','twill','other'];
  return{suit:suiting,blazer:suiting,pants:suiting,shirt:['solid','stripe','pinstripe','gingham','tattersall','check','herringbone','oxford','twill','other'],tie:['solid','stripe','polka-dot','paisley','check','foulard','knit','other']}})(),
PAT_ALIAS={suit:{stripe:'pinstripe',check:'glen-check',plaid:'glen-check',texture:'twill'},shirt:{texture:'oxford',plaid:'check'},tie:{texture:'knit',dots:'polka-dot',plaid:'check'}},
normPat=(t,p)=>{const l=PATS_BY[t]||['solid'],g=PAT_ALIAS[t==='blazer'||t==='pants'?'suit':t]||{};p=String(p||'').toLowerCase().trim().replace(/[\s_]+/g,'-');return l.includes(p)?p:l.includes(g[p])?g[p]:'solid'},
patLabel=p=>String(p||'').replace(/-/g,' '),
COL_ALIAS={gray:'grey',lightgray:'lightgrey',palegrey:'lightgrey',palegray:'lightgrey',silvergrey:'silver',silvergray:'silver',darkgray:'darkgrey',slate:'darkgrey',mediumgrey:'grey',mediumgray:'grey',
  lightblue:'lightblue',skyblue:'lightblue',babyblue:'lightblue',paleblue:'lightblue',powderblue:'lightblue',royalblue:'blue',cobalt:'blue',
  darkblue:'navy',midnightblue:'navy',midnight:'navy',ivory:'cream',offwhite:'cream',ecru:'cream',beige:'tan',khaki:'tan',camel:'tan',sand:'tan',taupe:'tan',
  darkbrown:'brown',chocolate:'brown',cognac:'brown',maroon:'burgundy',wine:'burgundy',cordovan:'oxblood',color8:'oxblood',darkred:'burgundy',
  yellow:'gold',mustard:'gold',lavender:'purple',violet:'purple',plum:'purple',rose:'pink',salmon:'pink',teal:'green',emerald:'green',forestgreen:'green',darkgreen:'green',olivegreen:'olive'},
normCol=c=>{if(!c)return null;const k=String(c).toLowerCase().replace(/[^a-z]/g,'');if(!k||k==='none'||k==='null')return null;return COLORS[k]?k:COL_ALIAS[k]||null},FABRIC=['suit','blazer','pants','shirt','tie'],COOL=3;
const $=s=>document.querySelector(s),key=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),di=d=>Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
let items=[];

/* matching logic & helpers */
const primaryCol=i=>i?i.primaryColor||i.color||'grey':'grey';
const colorDesc = i => {
  if(!i) return '';
  let cols=[primaryCol(i)];
  if(i.secondaryColor&&i.secondaryColor!=='none') cols.push(i.secondaryColor);
  if(i.tertiaryColor&&i.tertiaryColor!=='none') cols.push(i.tertiaryColor);
  return cols.join(' & ');
};
const desc=i=>i?(i.type==='watch'&&watchOpts(i).band==='bracelet'?'':colorDesc(i))+(i.pattern&&i.pattern!=='solid'?' '+patLabel(i.pattern):'')+(i.type==='shoes'||i.type==='belt'?' '+patLabel(i.leather||'calf'):'')+(i.metal?(i.type==='watch'&&watchOpts(i).band==='bracelet'?'':' · ')+i.metal:'')+(i.type==='watch'?` · ${watchOpts(i).dial} dial · ${watchOpts(i).band}`:''):'';
const nm=i=>i?colorDesc(i)+(i.pattern&&i.pattern!=='solid'?' '+patLabel(i.pattern):'')+' '+(TYPES[i.type]||'item').toLowerCase():'none';
const bg=i=>i?(i.swatch?`url(${i.swatch})`:COLORS[primaryCol(i)]||METAL[i.metal]||'#ccc'):'#ccc';

const LUM=i=>{const h=COLORS[primaryCol(i)];return h?(parseInt(h.slice(1,3),16)*.3+parseInt(h.slice(3,5),16)*.59+parseInt(h.slice(5,7),16)*.11):128};
const WEAVES=['texture','twill','herringbone','birdseye','nailhead','sharkskin','tweed','oxford','knit'];
const pw=i=>!i||!i.pattern||i.pattern==='solid'?0:WEAVES.includes(i.pattern)?.5:1;

// accepts #rgb and #rrggbb (the 3-digit form used to yield NaN, which rendered as black)
const hexRgb=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0)};
const rgbHex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const lum=h=>{const [r,g,b]=hexRgb(h);return (.2126*r+.7152*g+.0722*b)/255};
const mix=(h,t,k)=>{const a=hexRgb(h),b=hexRgb(t);return rgbHex(a.map((v,i)=>v+(b[i]-v)*k))};
const colOf=i=>COLORS[primaryCol(i)]||'#8b8f96';
const thirdOf=i=>i&&i.tertiaryColor&&COLORS[i.tertiaryColor]||null;
const accentOf=i=>{const s=i&&i.secondaryColor&&COLORS[i.secondaryColor];if(s)return s;const b=colOf(i);return lum(b)>.55?mix(b,'#000',.35):mix(b,'#fff',.45)};

/* accessory option lists */
const LEATHERS=['calf','cordovan','suede','patent','pebble-grain','scotch-grain'];
const WATCH_STYLES=[['annual-calendar','Dual time + annual calendar'],['date','Three hands + date'],['no-date','Three hands']];
const BANDS=[['bracelet','Metal bracelet'],['leather','Leather strap']],BEZELS=[['fluted','Fluted'],['smooth','Smooth']];
const watchOpts=w=>({dial:w&&w.dial||'white',band:w&&w.band||'bracelet',bezel:w&&w.bezel||'fluted',style:w&&w.watchStyle||'annual-calendar'});
const METAL_TONES={gold:['#fbefc4','#d4b04a','#8a6d12'],silver:['#f7f8f9','#c4c8cd','#767b82'],other:['#d2d4d7','#868a90','#45494e']};

