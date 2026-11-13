// Read the master atlas written by tools/asm-atlas.js.
//
//   node tools/atlas.js <atlas folder> list                       what is in it
//   node tools/atlas.js <atlas folder> pixel <master> <x> <y>      every measured property of one pixel
//   node tools/atlas.js <atlas folder> part <master> <name>        one part's measurements (pixels, box, centre, colour, light, weave)
//   (master: suit, vest, or a colour-coded one: cm-suit, cm-vest, cm-shirt-tie, cm-shirt-open)
//
// From code: const A=require('./tools/atlas.js').open(folder); A.pixel('suit',812,430); A.layer('suit','shade') (the raw typed array,
// stored values: divide by the layer's scale); A.part('suit','cuffR').
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const ARR={u8:Uint8Array,i8:Int8Array,u16:Uint16Array,i16:Int16Array};
function open(dir){const man=JSON.parse(fs.readFileSync(path.join(dir,'atlas.json'),'utf8')),cache=new Map();
  const master=m=>{const M=man.masters[m];if(!M)throw new Error(`no "${m}" master in this atlas (${Object.keys(man.masters).join(', ')})`);return M};
  function layer(m,name){const k=m+'/'+name;if(cache.has(k))return cache.get(k);const L=master(m).layers[name];if(!L)throw new Error(`no layer "${name}"`);
    const b=zlib.gunzipSync(fs.readFileSync(path.join(dir,L.file))),ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),a=new ARR[L.type](ab);cache.set(k,a);return a}
  function pixel(m,x,y){const M=master(m),W=M.W;x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=W)throw new Error(`(${x}, ${y}) is outside the ${W}x${W} picture`);
    const k=y*W+x,out={x,y};
    for(const [n,L] of Object.entries(M.layers)){const a=layer(m,n),c=L.channels,v=[];for(let i=0;i<c;i++)v.push(a[k*c+i]);
      const dec=v.map(u=>n==='thread'&&u===32767?null:L.scale===1?u:+(u/L.scale).toFixed(5));out[n]=c===1?dec[0]:dec}
    out.partName=man.partNames[out.part];if(out.next)out.nextName=out.next[1]?man.partNames[out.next[0]]:null;return out}
  const part=(m,name)=>master(m).parts.find(p=>p.name===name)||null;
  return {manifest:man,layer,pixel,part,W:m=>master(m).W}}
module.exports={open};
if(require.main===module){const [dir,cmd,...a]=process.argv.slice(2);
  if(!dir||!cmd){console.log('node tools/atlas.js <atlas folder> list | pixel <master> <x> <y> | part <master> <name>   (master: suit, vest, cm-suit, cm-vest, cm-shirt-tie, cm-shirt-open)');process.exit(1)}
  const A=open(dir),man=A.manifest;
  if(cmd==='list'){console.log(`built ${man.built}; ${man.pxPerMm.note}`);for(const [m,M] of Object.entries(man.masters)){console.log(`\n${m} master, ${M.W}x${M.W}`);
      for(const [n,L] of Object.entries(M.layers))console.log(`  ${n.padEnd(7)} ${L.meaning}`);console.log('  parts: '+M.parts.map(p=>`${p.name} (${p.pixels})`).join(', '));
      if(M.geometry)console.log('  painter: '+JSON.stringify(M.geometry))}
    console.log(`\nphones: ${Object.values(man.phone.keys).join(', ')} (${man.phone.sig})`)}
  else if(cmd==='pixel')console.log(JSON.stringify(A.pixel(a[0],+a[1],+a[2]),null,1));
  else if(cmd==='part')console.log(JSON.stringify(A.part(a[0],a[1]),null,1));
  else{console.log('unknown command: '+cmd);process.exit(1)}}
