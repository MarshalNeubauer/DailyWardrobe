/* Background thread for the "what to buy" analysis, so the app stays responsive while it runs.
   Posts {progress:[i,n,label]} as it works, {cat} as each section is ready, then {done} (or {error}).
   It also ranks a day's outfits for the score card (a message with `rank`, history.js rankFor: kept alive between asks): the items in the
   day's pools and the outfit (by id), the settings and the day ({suitDay, clim, formal, occasion}); answers {rank: id, res} (planner.js
   rankLooks) or {rank: id, error}.
   A module worker (scorecard.js and shop.js start it with {type: 'module'}; 2026-11-24): core.js, planner.js and analysis.js are ES modules,
   which importScripts can't load. The imports run the four files in this order, as importScripts did; since the restructure S6f
   (2026-11-27) no module hands its names to globalThis: the lines below import what they read and set the state through core.js's
   setters (setWardrobe, setWeather, setClimate, setTodayOverride).
   merge.js stays a plain script (the page and the server load it): run as a module here, as worker/backup.js does, its names are only
   in globalThis.DW_MERGE, and they are made the worker's globals again before any message, as importScripts left them (core.js reads them
   as globals). */
import './merge.js';
import {applyCustom,items,setClimate,setTodayOverride,setWardrobe,setWeather,settings,todayDate} from './core.js';
import {rankLooks} from './planner.js';
import {runAnalysis} from './analysis.js';
Object.assign(globalThis,globalThis.DW_MERGE);
onmessage=e=>{
  const d=e.data;
  if(d.rank){const q=d.rank;try{setWardrobe({settings:{...settings,...q.settings}});applyCustom(settings.custom);setWardrobe({items:q.list});const by=id=>id&&items.find(i=>i.id===id)||null;
      const pools={};for(const [s,ids] of Object.entries(q.pools))pools[s]=ids.map(by).filter(Boolean);
      const cur={...q.day};for(const [s,id] of Object.entries(q.ids))cur[s]=by(id);
      postMessage({rank:q.id,res:rankLooks(pools,cur)})}catch(err){postMessage({rank:q.id,error:String(err&&err.message||err)})}
    return}
  setWardrobe({settings:{...settings,...d.settings}});applyCustom(settings.custom);setWeather(d.weather||{});setClimate(d.climate||null);setTodayOverride(d.today||null);
  setWardrobe({days:Object.fromEntries((d.days||[]).map(r=>[r.date,r]))});
  try{postMessage({done:runAnalysis(d.list,todayDate(),d.weeks,(i,n,label)=>postMessage({progress:[i,n,label]}),cat=>postMessage({cat}))})}
  catch(err){postMessage({error:String(err&&err.message||err)})}
};
