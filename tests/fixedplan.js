/* The fixed plan for tests (tests/run.js installs it in every test page unless the test file says `realPlanner`).

   Today, the month, the pieces list and the score card normally get their outfits from the planner (planner.js: planSim,
   outfit, rateOutfit, scoreAdvice). A test of a swipe, a sheet or a layout doesn't need the planner's choices, only outfits
   to show; but running the planner at start-up tied every such test to planner.js, so any planner change selected almost
   the whole suite. With this, those tests get simple outfits made here, and app.js's seams (planMonth, scoreCard,
   adviceFor, checkPlanRules) don't call the planner at all.

   The outfits: every workday gets a jacket, trousers, shirt, tie, shoes, belt, socks and watch, taken in turn from the
   pieces in rotation (sorted by id, the day number picking the piece), so the days differ. A day's record is honoured the
   way the planner honours it: past days (and days marked worn) are what was recorded (ids), pinned pieces (force) win,
   skipped pieces are passed over, locked pieces (lock) are kept, the jacket kind (kind) and occasions (no jacket or tie on
   a casual day) are kept, and the waistcoat follows the day's choice (vest) or the setting. The score is always the same 94.

   It runs before the app's scripts, so it only defines functions; they use the app's globals when called. */
window.TEST_PLAN={
  plan(y,m){
    const T=todayDate(),out={},start=new Date(y,m-2,1),end=new Date(y,m+1,0);
    const pool=(type,n)=>items.filter(i=>i.type===type&&inRotation(i,n)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    const byId=id=>id&&items.find(i=>i.id===id)||null;
    for(const d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      if(!isWorkday(d))continue;
      const k=key(d),rec=dayRecs[k],n=di(d),occ=occOf(rec);
      if(rec&&rec.ids&&(d<T||rec.worn===true)){
        const o={suitDay:!!rec.suitDay,frozen:true,worn:rec.worn,formal:!!rec.formal,occasion:occ,notes:[],ctx:{prev:[],n}};
        for(const s of SLOTS)o[s]=byId(rec.ids[s]);
        o.vest=!!(rec.vestOn&&o.suitDay&&o.top&&hasVest(o.top));out[k]=o;continue}
      const casual=occ==='casual',force=rec&&rec.force||{},skip=rec&&rec.skip||{},lock=rec&&rec.lock||{};
      const suitDay=rec&&rec.kind?rec.kind==='suit':!!(occ&&!casual)||!settings.blazerDays.includes(d.getDay());
      const pick=(slot,type,off)=>{
        if(force[slot]){const x=byId(force[slot]);if(x)return x}
        const all=pool(type,n),s=skip[slot]||[],l=lock[slot];
        if(l&&!s.includes(l)){const x=all.find(i=>i.id===l);if(x)return x}
        const ok=all.filter(i=>!s.includes(i.id));return ok.length?ok[(n+off)%ok.length]:null};
      let top=casual?null:pick('top',suitDay?'suit':'blazer',0);
      if(!top&&!casual)top=pick('top',suitDay?'blazer':'suit',0);
      const sd=top?top.type==='suit':suitDay;
      const tie=casual?null:pick('tie','tie',2);
      const vov=rec&&typeof rec.vest==='boolean'?rec.vest:null;
      const vest=!!(sd&&top&&hasVest(top)&&(vov!==null?vov:settings.vestMode==='always'));
      out[k]={suitDay:sd,top,bot:sd&&top?top:pick('bot','pants',3),shirt:pick('shirt','shirt',1),tie,
        shoes:pick('shoes','shoes',4),belt:pick('belt','belt',5),socks:pick('socks','socks',6),watch:pick('watch','watch',7),
        clip:vest||!tie?null:pick('clip','tieclip',8),links:null,coat:null,vest,vestOverride:vov!==null,notes:[],
        clim:dayClimate(d),formal:occ==='formal',occasion:occ&&occ!=='formal'?occ:occ==='formal'?'formal':null,
        overrides:!!(rec&&(rec.force||rec.skip)),worn:rec&&rec.worn,ctx:{prev:[],n}}}
    return out},
  // a score with a few checks, so the score card can be opened, tapped and folded like a real one (one check not at full marks)
  rate(){return {score:94,label:'Excellent',raw:94,hard:[],checks:[{label:'Colours',pts:10,max:10,why:'The colours work together.'},
    {label:'Patterns',pts:10,max:10,why:'One bold pattern at most.'},{label:'Shoes',pts:9,max:10,why:'These shoes suit the outfit.'},{label:'Belt',pts:5,max:5,why:'The belt matches the shoes.'}]}},
  advice(){return {score:94,fixes:[],best:94,stuck:['Shoes']}}
};
