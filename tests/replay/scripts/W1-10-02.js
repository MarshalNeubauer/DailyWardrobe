// W1-10-02: the owner's Revoke (DELETE /invites?id=) while the day's writes are used up half switches the invitation off
// (readings refused, backups and /me still work, owner's list still active) and promises "saved after the daily reset"; the next day nothing changed.
const V=require('./_verify10-lib.js');
(async()=>{let out='NOT REPRODUCED',ev={};const info=await V.startLab('W1-10-02');
  try{const ph=await V.buildTester('w1002',info);const token=info.inviteCode;const id=(await V.me(token)).j.id;await ph.kill();
    const T={'x-app-token':token,'content-type':'application/json'};
    const probe=async()=>({sync:(await fetch(V.W+'sync?lite=1',{headers:T})).status,me:(await V.me(token)).status,
      tag:(await fetch(V.W,{method:'POST',headers:T,body:JSON.stringify({image:'data:image/jpeg;base64,/9j/4AAQ'})})).status,list:await V.ownerList()});
    const lg=await V.M('log');await V.M('kv-limit',{perDay:lg.kvPutToday});
    const r=await fetch(V.W+'invites?id='+id,{method:'DELETE',headers:V.OWNER});ev.revoke=[r.status,await r.text()];
    ev.after=await probe();
    await V.M('reset',{});await V.M('clock',{at:'2026-11-16T09:00:00Z'});ev.nextDay=await probe();
    const half=s=>s.tag===403&&s.sync===200&&s.me===200&&s.list.some(x=>x.id===id&&!x.off);
    if(ev.revoke[0]===429&&/saved after the daily reset/.test(ev.revoke[1])&&half(ev.after)&&half(ev.nextDay))out='REPRODUCED';
  }catch(e){ev.err=String(e)}finally{await V.stopLab()}
  console.log(out,JSON.stringify(ev));process.exit(0)})();
