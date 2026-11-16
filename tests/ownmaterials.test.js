// Own materials (2026-11-16, the owner's approved design) and Claude's low-confidence material guess (the same day's addition). The Add
// card offers a material Claude names that is on no list ("Add cupro as a material") only at medium or high, never when it is on the list;
// adding puts it in settings.ownMaterials for that type (that type's dropdowns only), chooses it, says so, toasts with Undo; tag requests
// carry it; Settings → Your materials lists and removes it (an item using it keeps it); the close-up reader offers it too and "Use all"
// never adds it; a low-confidence guess is shown with "Use wool", never filled in; suits, blazers and pants with no material get "!"
// (Confirm still works). Light and dark, 390 wide. Claude is stubbed: nothing paid. OWNMAT_SHOTS=<dir> saves the screenshots.
const path=require('path'),fs=require('fs');
module.exports=async({ok,chromium,url,settle})=>{
  const b=await chromium.launch(),SHOTS=process.env.OWNMAT_SHOTS||'';
  const PH='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaGgAAAMEAYFL09IQAAAAAElFTkSuQmCC';
  try{
    for(const scheme of ['light','dark']){const T=`[${scheme}] `;
      const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:scheme});
      const S={reply:null,sent:[]};const H={'content-type':'application/json','access-control-allow-origin':'*'};
      await ctx.route('https://w.test/**',route=>{const q=route.request(),u=new URL(q.url());
        if(q.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,x-app-token','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}});
        if(u.pathname==='/describe'&&q.method()==='POST'){let bd={};try{bd=JSON.parse(q.postData()||'{}')}catch{}S.sent.push(bd);return route.fulfill({status:200,headers:H,body:JSON.stringify(S.reply)})}
        if(u.pathname==='/me')return route.fulfill({status:200,headers:H,body:JSON.stringify({id:'owner',role:'owner',caps:null,used:{}})});
        return route.fulfill({status:503,headers:H,body:'{"error":"server"}'})});
      const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.appReady);
      const ev=(f,a)=>p.evaluate(f,a);let e;
      await ev(()=>{localStorage.setItem('worker_url','https://w.test/');localStorage.setItem('app_token','tok');rememberRole({role:'owner'});delete settings.ownMaterials;CK_OPEN['*']=true});
      const shot=async(name,sel)=>{if(!SHOTS)return;fs.mkdirSync(SHOTS,{recursive:true});const el=sel&&await p.$(sel);if(el){await el.scrollIntoViewIfNeeded();await settle(p,200)}
        await (el||p).screenshot({path:path.join(SHOTS,`${name}-${scheme}.png`)})};
      // ---- the Add card: a shirt Claude reads as cupro (medium), on no list
      const card=(ph,mat)=>ev(([ph,mat])=>{openAdd();queue.length=0;
        const q={id:'q1',ai:true,type:'shirt',primaryColor:'white',secondaryColor:null,tertiaryColor:null,pattern:'solid',photo:ph,conf:{type:'high',primaryColor:'high',pattern:'high'},aiTag:{pattern:'solid'}};
        takeExtras(q,normTag({type:'shirt',primaryColor:'white',pattern:'solid',material:mat},'claude-x'));queue.unshift(q);renderAdd()},[ph,mat]);
      const look=()=>ev(()=>{const c=document.querySelector('#queue .qcard[data-q="q1"]'),f=c&&c.querySelector('[data-ck="fabric"]');if(!f)return null;const q=queue[0];
        return {offer:(f.querySelector('.matnew')||{}).textContent||'',btn:(f.querySelector('.matnew button')||{}).textContent||'',sel:f.querySelector('.wmat').value,mat:q.material||'',
          opts:[...f.querySelectorAll('.wmat option')].map(o=>o.value),note:(f.querySelector('.matadded')||{}).textContent||'',guess:(f.querySelector('.matguess')||{}).textContent||'',
          mark:(f.querySelector('.ckm').className.match(/ck-(\w+)/)||[])[1],sum:f.querySelector('.ckt small').textContent,checked:!!(q.checked&&q.checked.fabric),set:!!q.matSet}});
      await card(PH,{key:'cupro',confidence:'medium',why:'Silky, matte drape.',new:true});await settle(p,300);e=await look();
      ok(e&&/None of the materials fit: Claude calls it cupro, silky, matte drape \(medium confidence\)\./.test(e.offer)&&e.btn==='Add cupro as a material'&&e.sel===''&&e.mat==='',T+`a new material at medium: the dashed offer under Material, Material left None (${e&&e.offer})`);
      ok(await ev(()=>getComputedStyle(document.querySelector('#queue .matnew')).borderTopStyle==='dashed'),T+'the offer is the "Add as a new color" dashed box');
      await shot('add-offer-before','#queue .qcard [data-ck="fabric"]');
      for(const [m,why] of [[{key:'cupro',confidence:'low',why:'',new:true},'low confidence'],[{key:'linen',confidence:'medium',why:'Slubs.'},'a material on the list'],[{key:'cupro',confidence:'high',why:''},'an answer without new:true']]){
        await card(PH,m);e=await look();ok(!e.offer,T+`no offer for ${why}`)}
      await card(PH,{key:'linen',confidence:'medium',why:''});e=await look();ok(e.mat==='linen','(a listed one at medium is filled in as before)');
      // Add
      await card(PH,{key:'cupro',confidence:'medium',why:'Silky, matte drape.',new:true});await settle(p,200);
      await p.click('#queue .matnew button');await p.waitForFunction(()=>(ownMats('shirt')||[]).includes('cupro')&&queue[0].material==='cupro');await settle(p,300);e=await look();
      const st=await ev(()=>({own:JSON.stringify(settings.ownMaterials),toast:document.querySelector('#toast').textContent,undo:!!document.querySelector('#toast button'),stamped:!!(settings.ks&&settings.ks.ownMaterials)}));
      ok(st.own==='{"shirt":["cupro"]}'&&st.stamped,T+'Add puts it in settings.ownMaterials for shirts, stamped for sync '+st.own);
      ok(e.sel==='cupro'&&e.set&&e.checked&&!e.offer&&/Now one of your materials: it’s in the list for every shirt you add, on all your devices\./.test(e.note),T+'it is chosen (by hand: Fabric & fit checked), the offer goes and the note says so');
      ok(/Cupro added to your shirt materials\./.test(st.toast)&&st.undo,T+`toast with Undo (${st.toast})`);
      await shot('add-offer-after','#queue .qcard [data-ck="fabric"]');
      e=await ev(()=>({shirt:matsFor('shirt').includes('cupro'),tie:matsFor('tie').includes('cupro'),rowS:/value="cupro"/.test(matRow('shirt','','x(')),rowT:/value="cupro"/.test(matRow('tie','','x(')),ext:JSON.stringify(tagExtras({}).ownMaterials)}));
      ok(e.shirt&&e.rowS&&!e.tie&&!e.rowT,T+'the shirt dropdown lists it; the tie one does not');
      ok(e.ext==='{"shirt":["cupro"]}',T+'tag requests carry the person\'s own materials '+e.ext);
      // Undo takes it off the card and out of the list
      await p.click('#toast button');await p.waitForFunction(()=>!ownMats('shirt').length);await settle(p,200);e=await look();
      ok(e.mat===''&&e.btn==='Add cupro as a material'&&!e.opts.includes('cupro'),T+'Undo takes it off the card and out of the list; the offer is back');
      await p.click('#queue .matnew button');await p.waitForFunction(()=>ownMats('shirt').includes('cupro')&&queue[0].material==='cupro');await settle(p,200);
      // ---- Claude's low-confidence guess, and the "!" on suits, blazers and pants
      e=await ev(()=>{openAdd();queue.length=0;const q={id:'q1',ai:true,type:'suit',primaryColor:'navy',secondaryColor:null,tertiaryColor:null,pattern:'solid',photo:null,conf:{type:'high',primaryColor:'high',pattern:'high'},aiTag:{pattern:'solid'}};
        takeExtras(q,normTag({type:'suit',primaryColor:'navy',pattern:'solid',material:{key:'wool',confidence:'low',why:'A smooth worsted look.'}},'claude-x'));queue.unshift(q);renderAdd();return 1});await settle(p,200);e=await look();
      ok(e.mat===''&&/Claude’s guess: wool · A smooth worsted look/.test(e.guess)&&/Use wool/.test(e.guess),T+`a low guess is shown with "Use wool", not filled in (${e.guess})`);
      ok(e.mark==='warn'&&e.sum==='Material not set · Claude’s guess: wool',T+`suit with no material: Fabric & fit is "!" (${e.mark}; ${e.sum})`);
      await shot('add-guess','#queue .qcard [data-ck="fabric"]');
      await p.click('#queue .matguess button');await p.waitForFunction(()=>queue[0].material==='wool');await settle(p,200);e=await look();
      ok(e.sel==='wool'&&e.set&&e.checked&&e.mark==='good'&&!e.guess,T+'Use sets it as chosen by hand and checks Fabric & fit');
      e=await ev(()=>['suit','blazer','pants','shirt','tie'].map(t=>{const q={id:'z',type:t,primaryColor:'navy',pattern:'solid',manual:1};const s=addCkSecs(q,0).find(x=>x.k==='fabric');return t+':'+s.mark+':'+s.sum}).join('|'));
      ok(/suit:warn:Material not set\|blazer:warn:Material not set\|pants:warn:Material not set\|shirt:todo:[^|]*\|tie:todo/.test(e),T+'"!" and "Material not set" on suits, blazers and pants with no material, not on shirts or ties: '+e);
      const n0=await ev(()=>items.length);
      await ev(()=>{openAdd();queue.length=0;queue.unshift({id:'q2',ai:true,type:'pants',primaryColor:'navy',secondaryColor:null,tertiaryColor:null,pattern:'solid',photo:null,conf:{type:'high',primaryColor:'high',pattern:'high'},aiTag:{pattern:'solid'}});renderAdd()});
      await ev(()=>save('q2'));await p.waitForFunction(n=>items.length===n+1,n0);
      ok(await ev(()=>{const i=items.find(x=>x.type==='pants');return !!i&&!i.material}),T+'Confirm still works with the material empty');
      // ---- the item sheet's dropdown, Settings
      await ev(()=>{items.push({id:'s1',type:'shirt',primaryColor:'white',pattern:'solid',material:'cupro',added:5},{id:'t1',type:'tie',primaryColor:'navy',pattern:'solid',added:4});flt='all';editing=null;show('wardrobe')});
      await ev(()=>openItem('s1'));await settle(p,400);
      e=await ev(()=>({sel:document.querySelector('#item-view .wmat').value,other:!!document.querySelector('#item-view .wmat-o')}));
      ok(e.sel==='cupro'&&!e.other,T+'the item sheet lists the shirt\'s own material, chosen');
      await ev(()=>openItem('t1'));await settle(p,400);
      ok(await ev(()=>![...document.querySelectorAll('#item-view .wmat option')].some(o=>o.value==='cupro')),T+'a tie\'s dropdown does not');
      await ev(()=>{dropItem&&dropItem();openSettings('tagging')});await settle(p,400);
      e=await ev(()=>({rows:[...document.querySelectorAll('#ownmat-list .ownmatrow')].map(r=>r.textContent.replace(/\s+/g,' ').trim()),lab:[...document.querySelectorAll('#sp-tagging .slabel')].map(x=>x.textContent).join('|'),sum:document.querySelector('#sum-tagging').textContent}));
      ok(/Your colors & patterns\|Your materials/.test(e.lab)&&e.rows.length===1&&/Cupro/.test(e.rows[0])&&/shirt/i.test(e.rows[0])&&/1 item/.test(e.rows[0])&&/Remove/.test(e.rows[0])&&/1 material$/.test(e.sum),T+'Settings → Photo tagging → Your materials, next to Your colors & patterns, lists it per type: '+e.rows.join(' / ')+' ('+e.sum+')');
      await shot('settings-materials','#sp-tagging');
      await p.click('#ownmat-list .ownmatrow button');await p.waitForFunction(()=>!ownMats('shirt').length);await settle(p,200);
      e=await ev(()=>({empty:/None yet/.test(document.querySelector('#ownmat-list').textContent),kept:items.find(i=>i.id==='s1').material,row:/value="cupro"/.test(matRow('shirt','','x(')),other:/wmat-o/.test(matRow('shirt','cupro','x('))}));
      ok(e.empty&&e.kept==='cupro'&&!e.row&&e.other,T+'Remove: no longer offered; the item using it keeps it (shown as Other with its name)');
      await ev(()=>closeSettings&&closeSettings());
      // ---- the close-up reader
      const COL={kind:'colour',match:'existing',existing:'white',dE:1,name:'white',hex:'#f6f6f3',plansAs:'white',fitsType:true,confidence:'high',why:'',ask:null};
      const PAT={kind:'pattern',match:'existing',existing:'solid',name:'solid',description:'',plansAs:'solid',look:{layout:'none',tr:10},colourHint:null,confidence:'high',why:'',ask:null};
      const reply=m=>({colour:COL,pattern:{...PAT,...(m?{material:m}:{})},model:'stub',lookups:2});
      await ev(cu=>{items.push({id:'r1',type:'shirt',primaryColor:'white',pattern:'solid',texture:cu,added:6})},PH);
      const read=async()=>{S.sent=[];await ev(()=>rdRun('e','r1'));await p.waitForSelector('#rd-sheet.on #rd-both');await settle(p,200)};
      const sheet=()=>ev(()=>{const s=document.querySelector('#rd-sheet'),m=s.querySelector('#rd-mat');return {mat:m&&m.textContent.replace(/\s+/g,' '),both:s.querySelector('#rd-both').textContent}});
      S.reply=reply({key:'cupro',confidence:'medium',why:'Silky drape.',new:true});await read();e=await sheet();
      ok(e.mat&&/Claude calls it cupro/.test(e.mat)&&/Add cupro as a material/.test(e.mat)&&/Keep blank/.test(e.mat)&&e.both==='Keep as it is',T+`the reader offers a new material with Keep / Add; the bar leaves it (${e.both})`);
      await p.click('#rd-both');await p.waitForFunction(()=>!document.querySelector('#rd-sheet.on'));
      ok(await ev(()=>!ownMats('shirt').length&&!items.find(i=>i.id==='r1').material),T+'"Use all" / the bar never adds a new material');
      await read();await p.click('#rd-muse');await p.waitForFunction(()=>ownMats('shirt').includes('cupro')&&items.find(i=>i.id==='r1').material==='cupro');
      await p.waitForSelector('#rd-mat.done');ok(true,T+'its own tap adds it to the shirt materials and sets it');
      await ev(()=>rdClose());await ev(()=>rdUndoAll());await p.waitForFunction(()=>!items.find(i=>i.id==='r1').material);
      ok(await ev(()=>ownMats('shirt').includes('cupro')),T+'Undo takes it off the item; it stays in the list while another shirt still uses it');
      await ev(async()=>{items=items.filter(i=>i.id!=='s1');await removeOwnMaterial('shirt','cupro')});
      await ev(()=>addOwnMaterial('shirt','cupro'));
      S.reply=reply({key:'cupro',confidence:'high',why:''});await read();e=await sheet();
      ok(/Material: Cupro/.test(e.mat)&&S.sent[0]&&JSON.stringify(S.sent[0].ownMaterials)==='{"shirt":["cupro"]}',T+'once added, the reading sends it and a cupro answer is a normal material card');
      await ev(()=>rdClose());
      S.reply=reply({key:'ramie',confidence:'low',why:'',new:true});await read();e=await sheet();ok(!e.mat,T+'a low new material: no card');await ev(()=>rdClose());
      ok(!errs.length,T+'no page errors: '+errs.join(' | '));
      await ctx.close()}
  }finally{await b.close()}
};
