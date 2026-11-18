// Local test servers on a port the browsers will open. `listen(0)` lets the system pick any free port, and now and then it
// picks one Chromium refuses (net::ERR_UNSAFE_PORT: 1719 and 6665 each failed a whole run's page loads on the owner's PC,
// 2026-11-17/18). The list is the Fetch standard's "bad ports", which WebKit and Node's own fetch refuse; Chromium
// (net/base/port_util.cc kRestrictedPorts) refuses all of them but 4190 and 6679; tests/safeport.test.js checks it against both.
const UNSAFE_PORTS=new Set([1,7,9,11,13,15,17,19,20,21,22,23,25,37,42,43,53,69,77,79,87,95,101,102,103,104,109,110,111,113,115,117,
  119,123,135,137,139,143,161,179,389,427,465,512,513,514,515,526,530,531,532,540,548,554,556,563,587,601,636,989,990,993,995,1719,1720,
  1723,2049,3659,4045,4190,5060,5061,6000,6566,6665,6666,6667,6668,6669,6679,6697,10080]);
const unsafePort=p=>UNSAFE_PORTS.has(+p);
/* server.listen(0, host) until the port it gets is not on the list (closed and asked again; the system hands out another) -> the port */
async function listenSafe(server,host,tries=40){
  for(let i=0;i<tries;i++){
    await new Promise((res,rej)=>{const err=e=>rej(e);server.once('error',err);server.listen(0,...(host?[host]:[]),()=>{server.removeListener('error',err);res()})});
    const port=server.address().port;if(!unsafePort(port))return port;
    await new Promise(res=>server.close(()=>res()))}
  throw new Error('no safe port after '+tries+' tries')}
module.exports={UNSAFE_PORTS,unsafePort,listenSafe};
