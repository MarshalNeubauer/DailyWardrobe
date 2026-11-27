// A band reading far from the selected color is drawn in the selected color (detect.js settToTag; 2026-11-15, the owner's checkered blue
// pants: tagged a heathered navy, read from a lifted close-up as a gray ground with pale blue-gray lines, every drawing L* 50 against 22,
// "washed out"). A seeded blue micro-check pair of pants: the item sheet's swatch, the small swatch, the mannequin's cloth and the painter's
// tile each average within a few ΔE00 of the selected color (ground exactly it, lines lighter and blue); a reading near the tag, a tie and a
// shirt keep their measured colors; the shade follows.
module.exports=async({ok,chromium,url})=>{
  const browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  try{
    await p.goto(url);await p.waitForFunction(()=>window.appReady);
    const r=await p.evaluate(async()=>{
      settings.custom={colors:[{key:'ownheatherednavy',name:'Heathered navy',hex:'#27344f',base:'navy',types:['suit','blazer','pants'],accent:false}],patterns:[{key:'own-micro-check',name:'micro check',desc:'Fine mid-blue lines on navy.',base:'other',types:['pants']}]};
      applyCustom(settings.custom);
      const sett={v:2,a:0,bands:[['#616870',.78],['#93a1b2',.22]],cross:{d:90,bands:[[null,.78],['#93a1b2',.22]],r:1},cr:40,tr:60,src:'claude+pixels'};
      const pants={id:'p1',type:'pants',primaryColor:'ownheatherednavy',secondaryColor:'blue',tertiaryColor:'black',pattern:'own-micro-check',sett,added:1};
      const near={id:'p2',type:'pants',primaryColor:'charcoal',pattern:'check',sett:{...sett,bands:[[COLORS.charcoal,.78],['#7a808a',.22]],cross:{d:90,bands:[[null,.78],['#7a808a',.22]],r:1}},added:2};
      const tie={id:'t1',type:'tie',primaryColor:'navy',pattern:'stripe',sett:{v:2,a:45,bands:[['#2a2a43',.5],['#6498d1',.5]],cr:6,tr:20},added:3};
      const shirt={id:'s1',type:'shirt',primaryColor:'blue',pattern:'stripe',sett:{v:2,a:0,bands:[['#ffffff',.6],['#888888',.4]],cr:8,tr:60},added:4};
      HOOK.items=[pants,near,tie,shirt];
      const lin=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)},gam=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055));
      const hex=s=>'#'+s.map(v=>gam(v).toString(16).padStart(2,'0')).join('');
      const img=src=>new Promise((res,rej)=>{const m=new Image();m.onload=()=>res(m);m.onerror=rej;m.src=src});
      const mean=async def=>{const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 120 120"><defs>${def}</defs><rect width="120" height="120" fill="url(#q)"/></svg>`;
        const m=await img('data:image/svg+xml;base64,'+btoa(svg)),c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.drawImage(m,0,0);
        const d=x.getImageData(0,0,300,300).data,s=[0,0,0];for(let k=0;k<d.length;k+=4)for(let q=0;q<3;q++)s[q]+=lin(d[k+q]);return hex(s.map(v=>v/(d.length/4)))};
      const L=h=>rgbLab(...hexRgb(h)),de=(a,b)=>+dE00(L(a),L(b)).toFixed(1),tag=colOf(pants),u=usableSett(pants);
      const m={sheet:await mean(HOOK.fabricDef('q',pants,'bot')),dot:await mean(HOOK.fabricDef('q',pants,'bot','dot')),fig:await mean(HOOK.figFabric(pants,'bot').def('q'))};
      const T=await HOOK.asmCmTile(pants,'bot'),n=T.TW*T.TH,ts=[0,0,0];for(let k=0;k<n;k++)for(let q=0;q<3;q++)ts[q]+=T.t[3*k+q];m.painter=hex(ts.map(v=>v/n));
      const shaded={...pants,shade:3},us=usableSett(shaded);
      return {tag,tagL:L(tag),bands:u.bands,cross:u.cross.bands,m:Object.fromEntries(Object.entries(m).map(([k,v])=>[k,{hex:v,dE:de(v,tag),L:+L(v)[0].toFixed(1),C:+Math.hypot(L(v)[1],L(v)[2]).toFixed(1)}])),
        lineL:L(u.bands[1][0])[0],lineB:L(u.bands[1][0])[2],before:{dE:de('#707984',tag)},
        nearSame:usableSett(near)===near.sett,tieSame:usableSett(tie)===tie.sett,shirtSame:usableSett(shirt)===shirt.sett,memo:usableSett(pants)===u,
        shadeGround:us.bands[0][0]===colOf(shaded)&&colOf(shaded)!==tag,
        again:HOOK.settToTag(pants,u)===u,route:HOOK.asmCmRoute(pants,'trousers').how,way:HOOK.figWay(pants,'trousers').way}});
    ok(r.bands[0][0]===r.tag&&r.cross[0][0]===null,`the micro check's ground is the selected color (${r.bands[0][0]} = ${r.tag})`);
    ok(r.lineL>r.tagL[0]+8&&r.lineB<-15,`its lines stay lighter than the ground and blue (${r.bands[1][0]}, L* ${r.lineL.toFixed(1)}, b* ${r.lineB.toFixed(1)})`);
    for(const k of ['sheet','dot','fig','painter'])ok(r.m[k].dE<=6&&Math.abs(r.m[k].L-r.tagL[0])<=6,`${k}: the drawn check averages ${r.m[k].hex} (L* ${r.m[k].L}, C ${r.m[k].C}), ΔE00 ${r.m[k].dE} from the selected ${r.tag} (L* ${r.tagL[0].toFixed(1)}; before about ${r.before.dE})`);
    ok(r.route==='tile'&&r.way==='drawn',`the painter tiles it and the mannequin draws it (${r.route}, ${r.way})`);
    ok(r.nearSame&&r.tieSame&&r.shirtSame,'a reading near its tag, a tie and a shirt keep their measured colors (the same object)');
    ok(r.memo&&r.again,'kept per reading and color; a drawn reading is not moved again');
    ok(r.shadeGround,'a shade changes the drawn ground with it');
    ok(errs.length===0,'no page errors '+errs.join('; '));
  }finally{await browser.close()}
};
