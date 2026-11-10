/* Background thread for the "what to buy" analysis, so the app stays responsive while it runs. */
importScripts('core.js','planner.js','analysis.js');
onmessage=e=>{
  const d=e.data;settings={...settings,...d.settings};weather=d.weather||{};climate=d.climate||null;TODAY_OVERRIDE=d.today||null;
  try{postMessage({done:runAnalysis(d.list,todayDate(),d.weeks||8,(i,n)=>postMessage({progress:[i,n]}))})}
  catch(err){postMessage({error:String(err&&err.message||err)})}
};
