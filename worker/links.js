/* Daily Wardrobe worker: GET /fetch: a photo (or a page's share image) the browser may not fetch itself.
   (An ES module of worker.js, the entry; split out of it on 2026-11-14.) */

/* GET /fetch?url=… downloads a photo for the app when the site won't let the browser fetch it directly (no CORS).
   A link to a web page (e.g. a shop's product page) returns the page's share image (og:image / twitter:image).
   Requires APP_TOKEN; only http(s); images only; 15 MB cap. Only public web addresses: an IP address, localhost or an internal
   name is refused, for the link itself, every redirect on the way and the page's share image. Nothing is read past the caps. */
const IMG_LIMIT = 15e6, HTML_LIMIT = 600000;
/* a host on the public web: a name with a dot, not an IP address (the URL parser has already turned 0x7f.1 or 2130706433 into
   dotted form), not localhost and not a name that only resolves inside a network */
function publicHost(h) {
  h = String(h || '').toLowerCase().replace(/\.$/, '');
  if (!h || h.startsWith('[') || h.includes(':') || /^[\d.]+$/.test(h) || !h.includes('.')) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|private|localdomain|home\.arpa|in-addr\.arpa|ip6\.arpa|onion)$/.test(h);
}
/* a body read up to `limit` bytes and no further -> {bytes, over}: over means there was more, and the rest was not read */
async function readCapped(stream, limit) {
  if (!stream) return { bytes: new Uint8Array(0), over: false };
  const rd = stream.getReader(), parts = []; let n = 0, over = false;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    if (n + value.byteLength > limit) { parts.push(value.subarray(0, limit - n)); n = limit; over = true; try { await rd.cancel(); } catch { } break; }
    parts.push(value); n += value.byteLength;
  }
  const bytes = new Uint8Array(n); let o = 0; for (const p of parts) { bytes.set(p, o); o += p.byteLength; }
  return { bytes, over };
}
async function handleFetchImage(req, env, json, cors) {
  let u;
  try { u = new URL(new URL(req.url).searchParams.get('url') || ''); } catch { return json({ error: 'That is not a valid link.' }, 400); }
  if (!/^https?:$/.test(u.protocol)) return json({ error: 'Only http and https links are supported.' }, 400);
  const NOT_PUBLIC = 'That link is not on the public web.';
  if (!publicHost(u.hostname)) return json({ error: NOT_PUBLIC }, 400);
  // redirects are followed by hand (5 at most), so each stop is checked too; null: one of them left the public web
  const get = async href => {
    for (let hop = 0; hop < 6; hop++) {
      const r = await fetch(href, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyWardrobe photo fetch)', accept: 'image/*,text/html;q=0.8,*/*;q=0.5' } });
      const to = r.status >= 300 && r.status < 400 && r.headers.get('location');
      if (!to) return r;
      let next; try { next = new URL(to, href); } catch { return r; }
      if (!/^https?:$/.test(next.protocol) || !publicHost(next.hostname)) return null;
      href = next.href;
    }
    return new Response('', { status: 508 });
  };
  try { return await fetchLinked(u, get, json, cors); }
  catch (e) { console.log('link fetch failed', u.hostname, e && e.message); return json({ error: 'That link could not be reached. Check it, or save the photo and add it from the phone.' }, 502); }   // a dead domain, a refused connection, a reset
}
async function fetchLinked(u, get, json, cors) {
  const NOT_PUBLIC = 'That link is not on the public web.';
  let r = await get(u.href);
  if (!r) return json({ error: NOT_PUBLIC }, 400);
  if (!r.ok) return json({ error: `The link returned an error (${r.status}).` }, 502);
  let type = r.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    const html = new TextDecoder().decode((await readCapped(r.body, HTML_LIMIT)).bytes);
    const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i);
    if (!meta) return json({ error: 'No photo found on that page. Try a direct link to the image.' }, 422);
    const img = new URL(meta[1].replace(/&amp;/g, '&'), u);
    if (!/^https?:$/.test(img.protocol) || !publicHost(img.hostname)) return json({ error: 'No usable photo found on that page.' }, 422);
    r = await get(img.href);
    if (!r) return json({ error: 'No usable photo found on that page.' }, 422);
    if (!r.ok) return json({ error: `The page's photo returned an error (${r.status}).` }, 502);
    type = r.headers.get('content-type') || '';
  }
  if (!type.startsWith('image/')) return json({ error: 'That link is not a photo.' }, 415);
  if (+(r.headers.get('content-length') || 0) > IMG_LIMIT) return json({ error: 'That photo is too large (over 15 MB).' }, 413);
  const got = await readCapped(r.body, IMG_LIMIT);
  if (got.over) return json({ error: 'That photo is too large (over 15 MB).' }, 413);
  return new Response(got.bytes, { headers: { ...cors, 'content-type': type, 'cache-control': 'no-store' } });
}

export { handleFetchImage, publicHost, readCapped };
