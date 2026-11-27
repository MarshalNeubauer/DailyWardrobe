/* Daily Wardrobe: the field rows the Add card and the item sheet share (the restructure S3c, 2026-11-26: moved here from wardrobe.js and
   itemsheet.js, which load after the Add files that draw them): an item's own name, brand, material and notes, their sizes, the Material
   dropdown, a choice's label, and a material its type can't have. Drawing only: what a change does is the caller's (the Add card's
   setQField, add-card.js; the item sheet's setItemField, wardrobe.js). */
/* ---- an item's own name, brand, material and notes ---- */
import {cap1} from './app.js';
import {MATERIALS_BY,matsFor,noBidi,esc} from './core.js';
const WARD_FIELDS=['name','brand','material','notes'];
const WARD_MAX={name:60,brand:40,material:40,notes:500};
const matLabel=m=>m==='other'?'Other':cap1(m);
/* the Material dropdown for a type (none for types without a list): its own materials, then Other (with a field to say which) and None */
/* ai: Claude's suggestion on an Add card (tagging.js takeMaterial: {key, conf, why}), said under the field while the field still holds it */
// (2026-11-16) the list is the type's own plus the person's own materials (core.js matsFor); one removed from those shows as Other with its name
// on: the control's own attributes (the Add card's matOn(q), the item sheet's matOnItem(id)); its change is matCardPick or matItemPick
function matRow(type,cur,on,ai){
  const l=matsFor(type);if(!l)return '';const m=String(cur||'').trim(),other=!!m&&!l.includes(m),sug=ai&&ai.key&&ai.key===m;
  return `<label>Material <select class="wmat" ${on}>${[['','None'],...l.map(x=>[x,x]),['other','Other']].map(([v,t])=>`<option value="${v}"${v===(other?'other':m)?' selected':''}>${cap1(t)}</option>`).join('')}</select></label>`+
    (sug?`<p class="tagnote matai"><small>Material suggested by Claude (${esc(ai.conf||'medium')} confidence)${ai.why?`: ${esc(String(ai.why).replace(/[.\s]+$/,''))}`:''}. Change it if it’s wrong.</small></p>`:'')+
    (other?`<label class="wmat-o">Which material? <input type="text" class="wfld wmat-t" dir="auto" maxlength="${WARD_MAX.material}" value="${esc(m==='other'?'':m)}" placeholder="e.g. alpaca" ${on}></label>`:'')}
const fldRow=(k,lab,v,on,ph)=>`<label>${lab} <input type="text" class="wfld wf-${k}" dir="auto" maxlength="${WARD_MAX[k]}" value="${esc(v||'')}" placeholder="${ph}" autocomplete="off" ${on(k)}></label>`;
const notesRow=(v,on)=>`<label class="wnotes">Notes <textarea class="wf-notes" dir="auto" rows="2" maxlength="${WARD_MAX.notes}" placeholder="Size, where it came from, how it fits…" ${on('notes')}>${esc(v||'').replace(/>/g,'&gt;')}</textarea></label>`;
/* what the dropdown or its "Which material?" field says: the choice, or what was typed (nothing typed stays Other) */
const matPicked=el=>el.matches('select')?el.value:el.value.trim()||'other';
/* copies them from the Add card onto the item being saved */
function wardSaveFields(q,it){for(const k of WARD_FIELDS){const v=noBidi(q[k]).trim().slice(0,WARD_MAX[k]);if(v&&(k!=='material'||MATERIALS_BY[it.type]))it[k]=v}}
/* a choice's label from its list ([value, label] pairs): the item sheet's summary lines, the Add card's */
const optLab=(list,v)=>{const o=list.find(x=>x[0]===v);return o?cap1(o[1]):''};
/* a material its type can't have goes; a typed "Other" material stays where the type has a list (an own material of another type goes, like a
   listed one). Also the Add card's type change and save (CR-1-06: a jacket read as tweed and changed to a tie was saved "Other · tweed") */
function matTidy(it){const ml=matsFor(it.type);if(it.material&&!(ml&&(ml.includes(it.material)||!Object.keys(MATERIALS_BY).some(x=>matsFor(x).includes(it.material)))))delete it.material;return it}
globalThis.HOOK={__proto__:globalThis.HOOK||null,matRow};
export {WARD_FIELDS,WARD_MAX,matLabel,matRow,fldRow,notesRow,matPicked,wardSaveFields,optLab,matTidy};
