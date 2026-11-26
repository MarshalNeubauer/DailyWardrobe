/* Daily Wardrobe: the theme (Auto, Light, Dark), applied at load
   (An ES module since 2026-11-23, loaded in index.html's order like the other scripts; split out of settings.js on 2026-11-17.) */
/* ---- theme: Auto (follow the device) → Light → Dark; saved per device ---- */
import {$} from './core.js';
import {toast} from './toast.js';
import {cap1} from './app.js';
const THEMES={auto:['◐','automatic'],light:['☀︎','light'],dark:['☾','dark']};
function applyTheme(t){
  if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else{delete document.documentElement.dataset.theme;t='auto'}
  const b=$('#theme-btn');if(b){b.textContent=THEMES[t][0];b.setAttribute('aria-label','Theme: '+THEMES[t][1]);b.title='Theme: '+THEMES[t][1]+' (tap to change)'}
  if(window.appReady&&$('#today')&&!$('#today').hidden&&$('.fig'))renderToday();   // the figure fades into the page colour
}
/* the first tap always changes what is on screen: from automatic to the theme the phone is not showing, then the other, then automatic again;
   each tap says where it is (fix round 3, W2-14-13: on a light phone the first tap chose "light", nothing changed and nothing said so) */
function cycleTheme(){
  let cur='auto';try{cur=localStorage.getItem('theme')||'auto'}catch{}
  let dev='light';try{if(matchMedia('(prefers-color-scheme: dark)').matches)dev='dark'}catch{}
  const opp=dev==='dark'?'light':'dark',next=cur==='auto'?opp:cur===opp?dev:'auto';
  try{next==='auto'?localStorage.removeItem('theme'):localStorage.setItem('theme',next)}catch{}
  applyTheme(next);
  toast(next==='auto'?`The theme follows the phone again (${dev} now).`:`${cap1(next)} theme. Tap again for ${next===opp?dev:'the phone’s own'}.`,3500)
}
try{applyTheme(localStorage.getItem('theme')||'auto')}catch{applyTheme('auto')}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(window.appReady&&!$('#today').hidden&&$('.fig'))renderToday()})}catch{}
/* the markup's handler (act.js): the header's theme button */
function themeTap(){cycleTheme()}
/* no bridge since T2 phase 3 (2026-11-25): only the tests call these (a11y, actsindex, modload, through HOOK); a module imports them */
/* the tests' access point (tests/hook.js): the names only the tests use; the app never reads HOOK */
globalThis.HOOK={__proto__:globalThis.HOOK||null,applyTheme,cycleTheme,themeTap};
export {applyTheme,cycleTheme,themeTap};
acts({themeTap});
