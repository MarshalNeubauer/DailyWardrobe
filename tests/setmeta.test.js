// The settings' stamps, two copies (the restructure S6i, 2026-11-27): bus.js has merge.js's SET_META (S6h) so start-up applies the
// stored settings when merge.js didn't load; merge.js keeps its own (classic, and worker/backup.js imports it). Node only. Each file
// runs in its own context, and the two tables are compared value by value (not by their text): the same keys in the same order,
// nothing more or less. A change to one copy without the other fails here.
const fs=require('fs'),path=require('path'),vm=require('vm'),{isDeepStrictEqual}=require('util');
const {appSrc}=require('./appsrc');
module.exports=async({ok,ROOT})=>{
  const R=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
  const m={};vm.createContext(m);vm.runInContext(R('merge.js'),m);
  const b={};vm.createContext(b);vm.runInContext(appSrc(ROOT,'bus.js')+';this.__SET_META=SET_META',b);
  // (another realm's array: structuredClone brings it into this one with every value, so the deep comparison sees values only)
  const fromMerge=structuredClone(m.DW_MERGE&&m.DW_MERGE.SET_META),fromBus=structuredClone(b.__SET_META);
  ok(Array.isArray(fromMerge)&&fromMerge.length>0,`merge.js hands over its SET_META (DW_MERGE.SET_META): ${JSON.stringify(fromMerge)}`);
  ok(Array.isArray(fromBus)&&fromBus.length>0,`bus.js has a SET_META: ${JSON.stringify(fromBus)}`);
  const only=(a,c)=>(a||[]).filter(k=>!(c||[]).includes(k));
  ok(isDeepStrictEqual(fromBus,fromMerge),`bus.js's SET_META is merge.js's, key for key and in order: bus.js ${JSON.stringify(fromBus)}, merge.js ${JSON.stringify(fromMerge)}`+
    `; only in bus.js ${JSON.stringify(only(fromBus,fromMerge))}, only in merge.js ${JSON.stringify(only(fromMerge,fromBus))}`);
};
