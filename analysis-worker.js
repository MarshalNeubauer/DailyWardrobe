/* Background thread for the "what to buy" analysis, so the app stays responsive while it runs.
   Posts {progress:[i,n,label]} as it works, {cat} as each section is ready, then {done} (or {error}).
   It also ranks a day's outfits for the score card (a message with `rank`, history.js rankFor: kept alive between asks): the items in the
   day's pools and the outfit (by id), the settings and the day ({suitDay, clim, formal, occasion}); answers {rank: id, res} (planner.js
   rankLooks) or {rank: id, error}. */
importScripts('merge.js','core.js','planner.js','analysis.js');
onmessage=e=>{
  const d=e.data;
  if(d.rank){const q=d.rank;try{settings={...settings,...q.settings};applyCustom(settings.custom);items=q.list;const by=id=>id&&items.find(i=>i.id===id)||null;
      const pools={};for(const [s,ids] of Object.entries(q.pools))pools[s]=ids.map(by).filter(Boolean);
      const cur={...q.day};for(const [s,id] of Object.entries(q.ids))cur[s]=by(id);
      postMessage({rank:q.id,res:rankLooks(pools,cur)})}catch(err){postMessage({rank:q.id,error:String(err&&err.message||err)})}
    return}
  settings={...settings,...d.settings};applyCustom(settings.custom);weather=d.weather||{};climate=d.climate||null;TODAY_OVERRIDE=d.today||null;
  dayRecs=Object.fromEntries((d.days||[]).map(r=>[r.date,r]));
  try{postMessage({done:runAnalysis(d.list,todayDate(),d.weeks,(i,n,label)=>postMessage({progress:[i,n,label]}),cat=>postMessage({cat}))})}
  catch(err){postMessage({error:String(err&&err.message||err)})}
};
