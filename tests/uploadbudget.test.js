// This computer's daily upload cap (tools/upload-budget.js, the owner's ask 2026-11-14: 300 a day for every PC tool together): a
// batch is taken whole or not at all, writes given back return, a ledger from another day starts again at 0, and four processes
// taking at once never go over the limit (the lock)
module.exports=async({ok})=>{
  const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
  const mod=path.join(__dirname,'..','tools','upload-budget.js');
  const L=path.join(os.tmpdir(),'dw-ledger-unit-'+process.pid+'.json');
  const fresh=(limit)=>{fs.rmSync(L,{force:true});process.env.DW_UPLOAD_LEDGER=L;process.env.DW_UPLOAD_LIMIT=String(limit);delete require.cache[require.resolve(mod)];return require(mod)};
  const keep={ledger:process.env.DW_UPLOAD_LEDGER,limit:process.env.DW_UPLOAD_LIMIT};
  try{
    let b=fresh(10);
    ok(b.LIMIT===10&&b.left()===10&&b.take(4)&&b.used()===4,`a take counts (used ${b.used()} of ${b.LIMIT})`);
    ok(!b.take(7)&&b.used()===4,`a batch bigger than what is left is refused whole (used still ${b.used()})`);
    ok(b.take(6)&&b.left()===0&&!b.take(1),'the last writes can be taken, then nothing more');
    b.give(3);ok(b.left()===3,`writes given back can be taken again (${b.left()} left)`);
    fs.writeFileSync(L,JSON.stringify({day:'2000-01-01',used:999}));
    ok(b.left()===10&&b.take(1)&&JSON.parse(fs.readFileSync(L,'utf8')).day===b.day(),'a ledger from another day starts the new day at 0');
    b=fresh(300);ok(/upload limit \(300\)/.test(b.why()),`the refusal names the limit ("${b.why()}")`);
    delete process.env.DW_UPLOAD_LIMIT;delete require.cache[require.resolve(mod)];ok(require(mod).LIMIT===300,'with no DW_UPLOAD_LIMIT the limit is 300');
    // four processes, 25 single takes each, against a limit of 60: exactly 60 granted
    fresh(60);
    const code=`const b=require(${JSON.stringify(mod)});let n=0;for(let i=0;i<25;i++)if(b.take(1))n++;console.log(n)`;
    const one=()=>new Promise(r=>{const c=spawn(process.execPath,['-e',code],{env:{...process.env,DW_UPLOAD_LEDGER:L,DW_UPLOAD_LIMIT:'60'}});let o='';c.stdout.on('data',d=>o+=d);c.on('close',()=>r(+o.trim()||0))});
    const got=await Promise.all([one(),one(),one(),one()]),sum=got.reduce((a,c)=>a+c,0);
    ok(sum===60&&JSON.parse(fs.readFileSync(L,'utf8')).used===60&&!fs.existsSync(L+'.lock'),`four processes at once are granted exactly the limit (${got.join('+')} = ${sum} of 60), and the lock is gone`);
  }finally{
    fs.rmSync(L,{force:true});
    if(keep.ledger===undefined)delete process.env.DW_UPLOAD_LEDGER;else process.env.DW_UPLOAD_LEDGER=keep.ledger;
    if(keep.limit===undefined)delete process.env.DW_UPLOAD_LIMIT;else process.env.DW_UPLOAD_LIMIT=keep.limit;
    delete require.cache[require.resolve(mod)]}
};
