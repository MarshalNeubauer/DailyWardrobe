// W1-10-01: "Delete everything" while the server's daily writes are used up deletes only the invitation,
// keeps the tester's whole backup, and a retry then says it "had already been deleted". Own lab on 9700.
const V=require('./_verify10-lib.js');
(async()=>{let out='NOT REPRODUCED',ev={};const info=await V.startLab('W1-10-01');
  try{const ph=await V.buildTester('w1001',info);const token=info.inviteCode;const id=(await V.me(token)).j.id;
    ev.keysBefore=(await V.userKeys(id)).length;
    const lg=await V.M('log');await V.M('kv-limit',{perDay:lg.kvPutToday});
    await ph.page.evaluate(()=>openSettings('about'));await V.sleep(900);
    await V.tapC(ph,'#del-open');await V.sleep(600);await V.tapC(ph,'#del-all');await V.sleep(4000);
    ev.status1=await V.text(ph,'#del-status');ev.meAfter1=(await V.me(token)).status;ev.keysAfter1=(await V.userKeys(id)).length;ev.owner1=await V.ownerList();
    // the person taps Delete everything again, as the line says
    if(!await V.vis(ph,'#del-all')){await ph.page.evaluate(()=>openSettings('about'));await V.sleep(800);await V.tapC(ph,'#del-open');await V.sleep(500)}
    await V.tapC(ph,'#del-all');await V.sleep(5000);
    ev.page2=(await V.text(ph,'body')).match(/This device was cleared[^.]*\.[^.]*\./)?.[0]||'';ev.keysAfter2=(await V.userKeys(id)).length;
    await V.M('reset',{});await V.M('clock',{at:'2026-11-16T12:00:00Z'});ev.keysNextDay=(await V.userKeys(id)).length;
    const half=ev.meAfter1===403&&ev.keysAfter1>=ev.keysBefore-1&&ev.keysBefore>5&&ev.owner1.some(x=>x.id===id&&!x.off);
    const lie=/already been deleted/.test(ev.page2)&&ev.keysAfter2>5;
    if(half&&lie)out='REPRODUCED';
    await ph.kill();
  }catch(e){ev.err=String(e)}finally{await V.stopLab()}
  console.log(out,JSON.stringify(ev));process.exit(0)})();
