/* Background thread for the "what to buy" analysis, so the app stays responsive while it runs.
   Posts {progress:[i,n,label]} as it works, {cat} as each section is ready, then {done} (or {error}). */
importScripts('core.js','planner.js','analysis.js');
onmessage=e=>{
  const d=e.data;settings={...settings,...d.settings};applyCustom(settings.custom);weather=d.weather||{};climate=d.climate||null;TODAY_OVERRIDE=d.today||null;
  dayRecs=Object.fromEntries((d.days||[]).map(r=>[r.date,r]));
  try{postMessage({done:runAnalysis(d.list,todayDate(),d.weeks,(i,n,label)=>postMessage({progress:[i,n,label]}),cat=>postMessage({cat}))})}
  catch(err){postMessage({error:String(err&&err.message||err)})}
};
