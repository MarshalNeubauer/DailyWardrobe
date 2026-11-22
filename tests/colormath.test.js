// One copy of the colour arithmetic (Round B, CR-2-15 / CR-2-17, 2026-11-17): the server's worker/colormath.js (describe.js and
// tools/describe-eval.js each had their own rgbLab/dE00) gives exactly core.js's numbers; core.js labOf is rgbLab of the colour's hex (it
// had its own copy); the tagging files' sRGB <-> linear (tagging.js sLin/linS) is srgb.js's srgbLin8/linSrgb8, the same to the last bit on
// both engines. Every comparison is exact (===), not within a tolerance.
const path=require('path'),fs=require('fs'),vm=require('vm'),{pathToFileURL}=require('url');
const {appSrc}=require('./appsrc');
// the copies that were removed, frozen here as the reference
const OLD_SRC=`
const oldLab=hex=>{const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).map(u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92});
  const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116,X=f((v[0]*.4124+v[1]*.3576+v[2]*.1805)/.95047),Y=f(v[0]*.2126+v[1]*.7152+v[2]*.0722),Z=f((v[0]*.0193+v[1]*.1192+v[2]*.9505)/1.08883);
  return [116*Y-16,500*(X-Y),200*(Y-Z)]};
const sLin=u=>{u/=255;return u>.04045?((u+.055)/1.055)**2.4:u/12.92},linS=u=>255*(u>.0031308?1.055*u**(1/2.4)-.055:12.92*u);`;
/* the sRGB checks, run in Node and in each browser: every byte, bytes times white-balance gains (measureCloth, matchMean), and linear
   values 0..1 on a fine grid plus the curve's knee */
const SRGB_CHECK=`(()=>{const bad=[];let n=0;const same=(a,b)=>a===b||(a!==a&&b!==b);
  for(let u=0;u<=255;u++){n++;if(!same(srgbLin8(u),sLin(u)))bad.push('lin '+u)}
  for(let u=0;u<=255;u++)for(const g of [.85,.9,1.03,1.1,1.18])for(const e of [1,1.37,2.2]){const v=Math.min(255,u*g)*1;n++;if(!same(srgbLin8(v),sLin(v)))bad.push('lin '+v);
    const w=Math.min(1,sLin(v)*e);n++;if(!same(linSrgb8(w),linS(w)))bad.push('gam '+w)}
  for(let k=0;k<=200000;k++){const w=k/200000;n++;if(!same(linSrgb8(w),linS(w)))bad.push('gam '+w)}
  for(const w of [.0031308,.0031307999,.0031308001,0,1,1e-9]){n++;if(!same(linSrgb8(w),linS(w)))bad.push('gam '+w)}
  return {n,bad:bad.slice(0,5),nbad:bad.length}})()`;
module.exports=async({ok,engines,ROOT})=>{
  /* ---- core.js and srgb.js in Node */
  const ctx={console,localStorage:{getItem(){return null},setItem(){}},document:{querySelector(){return null}}};vm.createContext(ctx);
  vm.runInContext(appSrc(ROOT,'core.js')+';this.K={rgbLab,dE00,labOf,hexRgb,COLORS}',ctx);
  vm.runInContext(appSrc(ROOT,'srgb.js')+OLD_SRC+';this.S={oldLab,run:()=>'+SRGB_CHECK+'}',ctx);
  const K=ctx.K,W=await import(pathToFileURL(path.join(ROOT,'worker','colormath.js')).href);
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  // a fixed spread of colours: every grey, every key colour, and 20,000 from a seeded generator
  let seed=12345;const rnd=()=>(seed=(Math.imul(seed,1103515245)+12345)>>>0)/4294967296,hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
  const cols=[];for(let v=0;v<256;v++)cols.push([v,v,v]);for(let i=0;i<20000;i++)cols.push([0,0,0].map(()=>Math.floor(rnd()*256)));
  for(const h of Object.values(K.COLORS))if(/^#[0-9a-f]{6}$/i.test(h))cols.push(K.hexRgb(h));
  let bad=cols.filter(c=>!same(W.rgbLab(...c),K.rgbLab(...c))||!same(W.hexLab(hex(c)),K.rgbLab(...c))||!same(W.hexLab(hex(c)),ctx.S.oldLab(hex(c))));
  ok(!bad.length,`the worker's rgbLab and hexLab give exactly core.js's L*a*b* and the removed copies' (${cols.length} colours${bad.length?', differ: '+bad.slice(0,3).join(' | '):''})`);
  const keys=Object.keys(K.COLORS).filter(k=>/^#[0-9a-f]{6}$/i.test(K.COLORS[k])),badK=keys.filter(k=>!same(K.labOf(k),ctx.S.oldLab(K.COLORS[k].toLowerCase()))&&!same(K.labOf(k),ctx.S.oldLab(K.COLORS[k])));
  ok(keys.length>30&&!badK.length,`core.js labOf gives the same L*a*b* as its removed copy for every colour key (${keys.length}${badK.length?', differ: '+badK.join(','):''})`);
  // dE00 on pairs: random, near pairs, greys (no hue), opposite hues (the hue wrap), and identical colours
  const labs=cols.map(c=>K.rgbLab(...c)),pairs=[];
  for(let i=0;i<20000;i++)pairs.push([labs[Math.floor(rnd()*labs.length)],labs[Math.floor(rnd()*labs.length)]]);
  for(let i=0;i<2000;i++){const a=labs[Math.floor(rnd()*labs.length)];pairs.push([a,[a[0]+rnd()*2-1,a[1]+rnd()*2-1,a[2]+rnd()*2-1]],[a,a])}
  for(let v=0;v<256;v+=5)pairs.push([labs[v],labs[255-v]]);pairs.push([[50,30,0],[50,-30,0]],[[50,0,30],[50,0,-30]],[[60,20,-1],[60,20,1]]);
  bad=pairs.filter(([a,b])=>W.dE00(a,b)!==K.dE00(a,b));
  ok(!bad.length,`the worker's dE00 gives exactly core.js's (${pairs.length} pairs${bad.length?', differ: '+JSON.stringify(bad.slice(0,2)):''})`);
  const sn=ctx.S.run();
  ok(sn.n>200000&&!sn.nbad,`Node: srgb.js srgbLin8/linSrgb8 give exactly the removed sLin/linS (${sn.n} values${sn.nbad?', '+sn.nbad+' differ: '+sn.bad.join(', '):''})`);
  /* ---- one copy each: nothing defines its own any more */
  const src=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const copies=['worker/describe.js','tools/describe-eval.js'].filter(f=>/function (rgbLab|dE00|lab|dE)\(|\*\*2\.4|\*\* 2\.4/.test(src(f)));
  ok(!copies.length&&/from '\.\/colormath\.js'/.test(src('worker/describe.js'))&&/colormath\.js/.test(src('tools/describe-eval.js')),`describe.js and describe-eval import worker/colormath.js and keep no copy of their own (${copies.join(', ')||'none'})`);
  const tagFiles=['tag-request.js','migrate.js','measure.js','tagging.js','own-lists.js','pattern-read.js'],tagCopies=tagFiles.filter(f=>/\*\*2\.4|12\.92|\b(sLin|linS)\b/.test(src(f)));
  ok(!tagCopies.length,`the photo tagging files use srgb.js for sRGB <-> linear (${tagCopies.join(', ')||'no copy of their own'})`);
  /* ---- the same in each browser (the app runs there) */
  for(const [eng,launch] of engines){let browser;
    try{browser=await launch()}catch(e){ok(false,`${eng}: the browser starts (${e.message.split('\n')[0]})`);continue}
    try{const p=await browser.newPage();
      await p.addScriptTag({content:src('srgb.js')+OLD_SRC});
      const r=await p.evaluate(SRGB_CHECK);
      ok(r.n>200000&&!r.nbad,`${eng}: srgb.js srgbLin8/linSrgb8 give exactly the removed sLin/linS (${r.n} values${r.nbad?', '+r.nbad+' differ: '+r.bad.join(', '):''})`)}
    finally{await browser.close()}}
};
