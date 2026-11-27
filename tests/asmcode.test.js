// The colour-coded painter's code is in every picture's key (asm-color.js asmCmCode / asmCmCodeSig) and in the kept setup's key
// (asmCmPrepCode / asmCmSrcSig), so a change to how pictures are painted repaints them without anyone remembering ASM_CM_PAINTV
// (2026-11-14 audit: three changes shipped without the bump). This reads asm-keys.js, assemble.js, asm-color.js and the page's asm-look.js and asm-cm-job.js (the restructure S6p moved the
// painter's page parts there), follows every top-level function
// and constant the painting reaches (asmCmJob, asmCmPrep, asmCmBuild, and asmCmLightPrep for the setup) and fails when one is missing
// from its list; then, in the page, a changed painter function changes the look's key and the setup's key.
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
// top-level declarations of a classic script: name -> {kind, text} (the declaration's own text, for the names it uses)
function decls(src){const out=new Map(),n=src.length,isId=c=>/[\w$]/.test(c);let i=0,depth=0;
  const skipStr=(j)=>{const q=src[j];j++;while(j<n&&src[j]!==q){if(src[j]==='\\')j++;j++}return j+1};
  while(i<n){const c=src[i];
    if(c==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue}
    if(c==='/'&&src[i+1]==='*'){i=src.indexOf('*/',i+2)+2;continue}
    if(c==='"'||c==="'"||c==='`'){i=skipStr(i);continue}
    if('([{'.includes(c)){depth++;i++;continue}
    if(')]}'.includes(c)){depth--;i++;continue}
    if(depth===0&&(i===0||!isId(src[i-1]))){
      let m=/^(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(src.slice(i,i+200));
      if(m){const start=i;let j=i+m[0].length,d=0,seen=false;
        while(j<n){const ch=src[j];
          if(ch==='/'&&src[j+1]==='/'){while(j<n&&src[j]!=='\n')j++;continue}
          if(ch==='/'&&src[j+1]==='*'){j=src.indexOf('*/',j+2)+2;continue}
          if(ch==='"'||ch==="'"||ch==='`'){j=skipStr(j);continue}
          if('([{'.includes(ch)){d++;if(ch==='{')seen=true}else if(')]}'.includes(ch)){d--;if(d===0&&seen&&ch==='}'){j++;break}}j++}
        out.set(m[1],{kind:'function',text:src.slice(start,j)});i=j;continue}
      m=/^(const|let|var)\s+/.exec(src.slice(i,i+10));
      if(m){i+=m[0].length;const kind=m[1];
        for(;;){const nm=/^([\w$]+)/.exec(src.slice(i,i+100));if(!nm)break;i+=nm[1].length;const start=i;let d=0;
          while(i<n){const ch=src[i];
            if(ch==='/'&&src[i+1]==='/'){if(d===0)break;while(i<n&&src[i]!=='\n')i++;continue}
            if(ch==='/'&&src[i+1]==='*'){i=src.indexOf('*/',i+2)+2;continue}
            if(ch==='"'||ch==="'"||ch==='`'){i=skipStr(i);continue}
            if('([{'.includes(ch))d++;else if(')]}'.includes(ch))d--;else if(d===0&&(ch===','||ch===';'||ch==='\n'))break;i++}
          out.set(nm[1],{kind,text:src.slice(start,i)});
          if(src[i]===','){i++;while(/\s/.test(src[i]))i++;continue}break}
        continue}}
    i++}
  return out}
// not painting: memo caches and other state, the keys themselves (already in every key), the kept setup's storage
const SKIP=new Set(['asmMmMemo','asmSuitTexMemo','asmTieMemo','asmTweedMemo','asmLinenMemo','asmCmMem','asmCmSrc','asmCmCodeH','asmCmDiskPut','asmCmDb','asmCmPack',
  'ASM_CM_BIG','asmCmDiskGet','asmCmUnpack','ASM_CM_PACKV','asmCmSrcSig','asmCmHash','asmCmKey','asmKey','ASM_CMV','ASM_VER','asmCmBgKey','asmCmCode','asmCmPrepCode',
  'asmCmCodeSig','asmCmCodeText','asmCmPref','ASM_CM',
  'asmCmGeoKeys','asmCmLightKeys','asmCmMipM','ASM_CM_T3','asmCuMem','asmCrMem',   // (asmCmMipM, ASM_CM_T3: a tile's kept halvings and a scratch colour, state)
  'asmData']);   // (the image decoder: the Web Worker swaps in its own, the same pixels, so it is left out of the setup's key; asm-color.js before asmCmCodeText)   // (which records a master has, from the manifest, whose dates are in every look's key: asmCmRev)
function reach(D,roots){const seen=new Set(),q=[...roots];
  while(q.length){const n=q.pop();if(seen.has(n)||!D.has(n)||SKIP.has(n))continue;seen.add(n);
    const t=D.get(n).text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'');for(const id of t.match(/[A-Za-z_$][\w$]*/g)||[])if(D.has(id)&&!seen.has(id))q.push(id)}
  return seen}
module.exports=async({ok,chromium,url})=>{
  const FILES=['asm-keys.js','assemble.js','asm-color.js','asm-look.js','asm-cm-job.js'],color=FILES.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n'),D=new Map();
  for(const f of FILES)for(const [k,v] of decls(fs.readFileSync(path.join(ROOT,f),'utf8')))D.set(k,v);
  const listOf=name=>{const m=new RegExp('const '+name+'=\\(\\)=>\\[([^\\]]*)\\]').exec(color);return new Set(m?m[1].split(',').map(s=>s.trim()).filter(Boolean):[])};
  const code=listOf('asmCmCode'),prep=listOf('asmCmPrepCode');
  ok(D.size>300&&D.has('asmCmBuild')&&D.has('ASM_CM_RIM')&&D.has('asmCmHandEdge'),`the declarations of ${FILES.join(', ')} are read (${D.size})`);
  const miss=[...reach(D,['asmCmJob','asmCmPrep','asmCmBuild'])].filter(n=>!code.has(n)),missP=[...reach(D,['asmCmPrep','asmCmLightPrep'])].filter(n=>!prep.has(n));
  ok(code.size>100&&!miss.length,`every function and constant the painting reaches is in asmCmCode, the picture key's code hash (${code.size}; missing: ${miss.join(', ')||'none'})`);
  ok(prep.size>20&&!missP.length&&['asmCmHandEdge','asmCmBlur','asmTubeTabs','ASM_CM_RIM','ASM_LEG_K'].every(n=>prep.has(n)),`every function and constant the master's setup reaches is in asmCmPrepCode, the kept setup's key (${prep.size}; missing: ${missP.join(', ')||'none'})`);
  const stale=[...code,...prep].filter(n=>!D.has(n));
  ok(!stale.length,`both lists name only what exists (${stale.join(', ')||'all there'})`);
  // srgb.js (the code review R8 N2, 2026-11-24): the painted code calls its curves (asmCmBuild's gam = linSrgb8, asmCmBtnCol, ASM_LIN),
  // but its four names are in neither list, so an edit to srgb.js would change every painted pixel and no picture's key. Adding them
  // to asmCmCode changes every key (every phone repaints every look), so until a planned repaint its code is pinned here instead
  const SRGB_PIN='1033611a2f0c';
  const S=decls(fs.readFileSync(path.join(ROOT,'srgb.js'),'utf8')),srgbH=require('crypto').createHash('sha256').update([...S].map(([n,v])=>n+v.text.replace(/\s+/g,'')).join('\n')).digest('hex').slice(0,12);
  const painted=[...reach(D,['asmCmJob','asmCmPrep','asmCmBuild','asmCmLightPrep'])].map(n=>D.get(n).text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'')).join('\n');
  const uses=[...S.keys()].filter(n=>new RegExp('\\b'+n.replace('$','\\$')+'\\b').test(painted)),open=uses.filter(n=>!code.has(n));
  ok(S.size===4&&uses.length>0,`srgb.js's names are read and the painted code calls them (${[...S.keys()].join(', ')}; called: ${uses.join(', ')})`);
  ok(!open.length||srgbH===SRGB_PIN,open.length?`srgb.js is pinned (${srgbH}${srgbH===SRGB_PIN?'':', pinned '+SRGB_PIN}): the painter calls ${open.join(', ')}, which no picture key covers. A change to srgb.js changes every painted pixel without changing any key, so phones would keep old pictures beside new ones. Change it only together with a planned repaint: bump ASM_CM_PAINTV in asm-color.js (or add ${open.join(', ')} to asmCmCode; either way every phone repaints every look), then update SRGB_PIN here`:'srgb.js\'s names the painter calls are all in asmCmCode: no pin needed');
  const browser=await chromium.launch();const p=await (await browser.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{renders[HOOK.asmCmKey('suit','master')]={t:1,img:'',sig:''};let n=0;const I=(type,primaryColor,x={})=>({id:type+(n++),type,primaryColor,pattern:'solid',...x});
      const o={top:I('suit','navy'),shirt:I('shirt','white'),tie:I('tie','burgundy'),watch:I('watch','silver')},out={use:HOOK.asmCmUse(o),k0:HOOK.asmOutKey(o),s0:HOOK.asmCmSrcSig(),c0:HOOK.asmCmCodeSig(),again:HOOK.asmOutKey(o)};
      const keep=HOOK.asmCmHandEdge;HOOK.asmCmHandEdge=function(A,M,S,N){return keep(A,M,S,N)};   // the same painting, other source
      HOOK.asmCmCodeH=null;HOOK.asmCmSrc=null;out.k1=HOOK.asmOutKey(o);out.s1=HOOK.asmCmSrcSig();
      HOOK.asmCmHandEdge=keep;HOOK.asmCmCodeH=null;HOOK.asmCmSrc=null;out.k2=HOOK.asmOutKey(o);out.s2=HOOK.asmCmSrcSig();
      out.sig=HOOK.asmCmSig(o);return out});
    ok(r.use==='suit'&&r.k0===r.again&&new RegExp('^suit\\|p'+'\\d+\\.'+r.c0).test(r.sig),`the look's key carries the painter's code hash and is stable (${r.sig.slice(0,24)}…)`);
    ok(r.k1!==r.k0&&r.s1!==r.s0&&r.k2===r.k0&&r.s2===r.s0,'a changed painter function (asmCmHandEdge) changes the look\'s key and the setup\'s key; put back, both are as before');
    ok(!errs.length,'no page errors ('+errs.join('; ')+')')}
  finally{await browser.close()}};
module.exports.assembled=true;   // tests assembled pictures (assemble.js)
