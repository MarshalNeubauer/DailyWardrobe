// Claude's herringbone or twill reading is drawn with the woven tile (columns of slanted twill lines turning at each column edge),
// not by tiling Claude's one-repeat bitmap: the user's blue shirt came back as one V ("10000001/01000010/00100100/00011000"),
// which tiles into horizontal zigzags. Figured weaves (a diamond dobby) keep the bitmap.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();
  try{
    const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(()=>{const hb={id:'b',type:'shirt',primaryColor:'blue',pattern:'herringbone',sett:{v:4,tex:{kind:'herringbone',grid:['10000001','01000010','00100100','00011000'],aspect:.6,lighter:true,contrast:'subtle',rel:.35},a:0,cr:60,tr:80}};
      const tw={...hb,id:'t',pattern:'twill',sett:{...hb.sett,tex:{...hb.sett.tex,kind:'twill',grid:['10','01']}}};
      const dm={...hb,id:'d',pattern:'dobby',sett:{...hb.sett,tex:{...hb.sett.tex,kind:'diamond'}}};
      const cols=s=>(s.match(/<svg [^>]*width=/g)||[]).length,lines=s=>(s.match(/stroke-opacity/g)||[]).length,w=s=>+(s.match(/<pattern[^>]*width="([\d.]+)"/)||[])[1];
      const sw=fabricDef('a',hb,'shirt'),dot=fabricDef('b',hb,'shirt','dot'),fig=fabricDef('c',hb,'shirt','fig'),dia=fabricDef('d',hb,'shirt','dia');
      const ln=s=>+((s.match(/stroke-opacity="([\d.]+)"/)||[])[1]);
      return {img:/<image/.test(sw+dot+fig+dia),cols:[sw,dot,fig,dia].every(s=>cols(s)===2),swW:w(sw),dotW:w(dot),k:[ln(sw),ln(dot),ln(dia)],
        twill:!/<image/.test(fabricDef('e',tw,'shirt'))&&lines(fabricDef('e',tw,'shirt'))>=2,diamond:/<image/.test(fabricDef('f',dm,'shirt'))}});
    ok(!r.img&&r.cols,'a herringbone reading is drawn as two columns of slanted lines that turn at the edge, in every size (not Claude\'s bitmap)');
    ok(r.swW>=5&&r.swW<=10&&Math.abs(r.dotW-16/3)<.01,`at a scale that shows: at most 20 column pairs in a swatch though Claude counted 60 (repeat ${r.swW}), three in Today's small squares (${r.dotW.toFixed(2)})`);
    ok(r.k[1]>r.k[0]&&r.k[2]>r.k[0],`stronger where it's small and for the photo generator (line opacity ${r.k.join(' / ')})`);
    ok(r.twill&&r.diamond,'a twill reading is drawn as twill; a diamond dobby keeps Claude\'s bitmap');
    ok(errs.length===0,'no page errors ('+errs.join('; ')+')');
  }finally{await browser.close()}
};
