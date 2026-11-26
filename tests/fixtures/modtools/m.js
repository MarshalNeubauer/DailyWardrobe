// a module: imports px, reads the classic a.js's bump and LIMIT, bridges label (a function) and cache (a `let` others write)
import {px} from './lib/n.js';
let cache={n:0};
const SECRET=7;
export function label(n){cache.n++;return px(bump()+n)+'/'+LIMIT}
function hidden(){return SECRET}
export {hidden,cache};
count=0;                                  // a write to a.js's `let`: counted by the cross-file write check
// three mistakes on purpose, each to be reported:
undeclared=1;                             // 1: an assignment to a name nothing declares (throws in a module)
if(typeof gone==='function')gone();       // 2: a guard on a name that isn't global (silently false)
this.late=true;                           // 3: `this` outside a function (undefined in a module)
Object.assign(globalThis,{label});
Object.defineProperty(globalThis,'cache',{get:()=>cache,set:v=>{cache=v},configurable:true});
