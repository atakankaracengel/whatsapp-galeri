(function () {
  const APP_VERSION = '1.0.0';
  if (window.__WAMD_APP_LOADED__) return;
  window.__WAMD_APP_LOADED__ = true;
  window.__WAMD_APP_VERSION__ = APP_VERSION;

  const log = (m) => window.postMessage({ __from: 'wamd:inpage', type: 'wa:log', message: String(m) }, '*');

  function withTimeout(p, ms, label) {
    let t;
    const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms); });
    return Promise.race([p, timeout]).finally(() => clearTimeout(t));
  }
  function getTimeoutForMedia(m) {
    const k = (m.type || m.mediaType || '').toLowerCase();
    if (k === 'video') return 20000; if (k === 'document') return 12000; return 8000;
  }
  function sanitize(s) { return (s || '').replace(/\s+/g, ' ').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 120); }
  function baseNameNoExt(n) { if (!n) return ''; return String(n).split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,10}$/i, ''); }
  function extFromFilename(n) { if (!n) return ''; const m = String(n).match(/\.([a-z0-9]{1,10})$/i); return m ? m[1].toLowerCase() : ''; }
  function extFromMime(m) {
    m = (m || '').toLowerCase(); if (!m) return '';
    if (m.includes('jpeg')) return 'jpg'; if (m.includes('png')) return 'png'; if (m.includes('gif')) return 'gif';
    if (m.includes('webp')) return 'webp'; if (m.includes('mp4')) return 'mp4'; if (m.includes('ogg') || m.includes('opus')) return 'ogg';
    if (m.includes('mpeg') && m.includes('audio')) return 'mp3'; if (m.includes('pdf')) return 'pdf';
    if (m.includes('zip')) return 'zip'; if (m.includes('rar')) return 'rar'; if (m.includes('7z')) return '7z';
    if (m.includes('csv')) return 'csv'; if (m.includes('plain')) return 'txt'; if (m.includes('json')) return 'json';
    if (m.includes('msword')) return 'doc'; if (m.includes('vnd.openxmlformats-officedocument.wordprocessingml')) return 'docx';
    if (m.includes('vnd.ms-excel')) return 'xls'; if (m.includes('vnd.openxmlformats-officedocument.spreadsheetml')) return 'xlsx';
    if (m.includes('vnd.ms-powerpoint')) return 'ppt'; if (m.includes('vnd.openxmlformats-officedocument.presentationml')) return 'pptx';
    return '';
  }
  function resolveExt({ message, mime, kind }) {
    const orig = message?.filename || message?.fileName || message?.title || message?.name || '';
    let e = extFromFilename(orig); if (e) return e;
    e = extFromMime(mime); if (e) return e;
    if ((kind === 'ptt' || kind === 'audio') && (!mime || /opus|ogg/.test(mime || ''))) return 'ogg';
    if (kind === 'document') return 'bin'; return '';
  }
  function makeFilename({ chatName, ts, index, mime, caption, naming, message, kind }) {
    const pad = n => String(n).padStart(2, '0');
    let datePart = '';
    if (naming?.useDate) {
      const d = new Date((ts || Math.floor(Date.now() / 1000)) * 1000);
      datePart = `_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    }
    let suffix = '';
    if (naming?.captionSuffix && caption) { const c = sanitize(caption); if (c) suffix += `_${c}`; }
    if (naming?.appendOrigNameAll) {
      const orig = message?.filename || message?.fileName || message?.title || message?.name || '';
      const b = sanitize(baseNameNoExt(orig)).slice(0, 80);
      if (b && !suffix.includes(b)) suffix += `_${b}`;
    }
    const base = `${sanitize(chatName || 'Chat')}${datePart}_${String(index).padStart(4, '0')}${suffix}`;
    return base + (resolveExt({ message, mime, kind }) ? '.' + resolveExt({ message, mime, kind }) : '');
  }

  async function ensureReady() {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      try {
        const W = window.WPP;
        if (W?.isReady && typeof W.isReady === 'function' && await W.isReady()) return true;
        if (W?.isready && (typeof W.isready === 'boolean' ? W.isready : (typeof W.isready === 'function' ? await W.isready() : false))) return true;
        if (W?.webpack?.isReady && (typeof W.webpack.isReady === 'function' ? await W.webpack.isReady() : W.webpack.isReady === true)) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }
    return true;
  }
  function getMediaStage(m) {
    const md = m?.mediaData || m?._mediaData;
    return md?.__x_mediaStage ?? md?.mediaStage ?? md?.stage ?? m?.__x_mediaStage ?? m?.mediaStage ?? m?.stage ?? null;
  }
  function isProbablyUnavailable(m) {
    const k = (m.type || m.mediaType || '').toLowerCase();
    const md = m?.mediaData || m?._mediaData || null;
    const stage = getMediaStage(m);
    if (stage && ['REUPLOADING','ERROR','WAITING','PROCESSING'].includes(String(stage).toUpperCase())) return true;
    const hasKey = !!(m.mediaKey || md?.mediaKey || md?.key || md?.__x_mediaKey);
    const hasPath = !!(m.directPath || md?.directPath || md?.__x_directPath || m.clientUrl || md?.clientUrl || md?.url || md?.__x_clientUrl || m.deprecatedMms3Url || md?.deprecatedMms3Url);
    if ((k === 'image' || k === 'video' || k === 'document') && (!hasKey || !hasPath)) return true;
    return false;
  }

  async function listChats() {
    await ensureReady();
    try {
      const list = await window.WPP.chat.list();
      return (list || []).map(c => ({
        id: c?.id?._serialized || c?.id || '',
        name: c?.formattedTitle || c?.contact?.pushname || c?.contact?.name || c?.name || c?.id?.user || 'Chat'
      }));
    } catch (e) { log('listChats() ERROR: ' + (e?.message || e)); return []; }
  }

  async function getChatStats(chatId) {
    await ensureReady();
    try {
      const msgChatSer = m => (m?.id?.remote || m?.id?._remote)?._serialized || m?.chatId || m?.chat?.id?._serialized || '';
      let msgs = null;
      try { msgs = await window.WPP.chat.getMessages(chatId, { count: 10000 }); }
      catch { try { msgs = await window.WPP.chat.getMessages(chatId, { count: 3000 }); } catch { msgs = await window.WPP.chat.getMessages(chatId); } }
      if (msgs && msgs.length) {
        msgs = msgs.filter(m => { const c = msgChatSer(m); return !c || c === chatId; });
      }
      if (!msgs || !msgs.length) return { dateRange: 'No messages', totalMedia: 0, images: 0, videos: 0, audio: 0, documents: 0 };
      const media = msgs.filter(m => {
        const k = (m.type || m.mediaType || '').toLowerCase();
        return m.isMedia || m.isMMS || !!m.mediaKey || !!m.mediaData || ['image','video','ptt','audio','document','sticker'].includes(k);
      });
      let images = 0, videos = 0, audio = 0, documents = 0;
      media.forEach(m => {
        const k = (m.type || m.mediaType || '').toLowerCase();
        if (k === 'image') images++; else if (k === 'video') videos++; else if (k === 'ptt' || k === 'audio') audio++; else if (k === 'document') documents++;
      });
      let oldest = null, newest = null;
      msgs.forEach(m => { const t = m.t || m.timestamp || 0; if (t > 0) { if (!oldest || t < oldest) oldest = t; if (!newest || t > newest) newest = t; } });
      const f = ts => { const d = new Date(ts * 1000); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; };
      return { dateRange: oldest && newest ? `${f(oldest)} - ${f(newest)}` : 'Unknown', totalMedia: media.length, images, videos, audio, documents };
    } catch (e) { log('getChatStats() ERROR: ' + (e?.message || e)); return { dateRange: 'Error', totalMedia: 0, images: 0, videos: 0, audio: 0, documents: 0 }; }
  }

  async function loadMoreMessages(chatId) {
    await ensureReady();
    try {
      try { await window.WPP.chat.openChatBottom(chatId); } catch { await window.WPP.chat.openChatAt(chatId); }
      await new Promise(r => setTimeout(r, 500));
      let sc = document.querySelector('.x10l6tqk.x13vifvy.x1o0tod.xupqr0c.x9f619.x78zum5.xdt5ytf.xh8yej3.x5yr21d.x6ikm8r.x1rife3k.xjbqb8w.x1ewm37j');
      if (!sc || sc.scrollHeight <= sc.clientHeight) {
        for (const s of ['.x10l6tqk.x13vifvy', '[role="application"]', '._aiwn._aiwm']) {
          for (const el of document.querySelectorAll(s)) { if (el.scrollHeight > el.clientHeight) { sc = el; break; } }
          if (sc) break;
        }
      }
      if (!sc) {
        const all = Array.from(document.querySelectorAll('*')).filter(e => e.scrollHeight > e.clientHeight && e.clientHeight > 200);
        all.sort((a, b) => b.scrollHeight - a.scrollHeight);
        sc = all[Math.min(4, all.length - 1)];
      }
      if (!sc) return { ok: false };
      for (let i = 0; i < 10; i++) { sc.scrollTop = Math.max(0, sc.scrollTop - 500); await new Promise(r => setTimeout(r, 200)); }
      sc.scrollTop = 0;
      let locked = true; const lock = () => { if (locked) sc.scrollTop = 0; }; sc.addEventListener('scroll', lock);
      await new Promise(r => setTimeout(r, 1500)); sc.scrollTop = 0; await new Promise(r => setTimeout(r, 500));
      let btn = null;
      for (const b of document.querySelectorAll('button.x1bvqhpb.x6f6fmj.x1b9z3ur')) {
        const inner = b.querySelector('div.x78zum5.x6s0dn4.x1r0jzty.x17zd0t2');
        if (inner && inner.querySelector('div')?.textContent.trim().length > 0) { btn = b; break; }
      }
      if (!btn) {
        for (const b of document.querySelectorAll('button')) {
          const inner = b.querySelector('div.x78zum5.x6s0dn4');
          if (inner && inner.querySelector('div')?.textContent.trim().length > 30) { btn = b; break; }
        }
      }
      if (btn) {
        if (btn.getBoundingClientRect().top < 0) { sc.scrollTop = 0; await new Promise(r => setTimeout(r, 300)); }
        try { btn.click(); } catch { try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {} }
        await new Promise(r => setTimeout(r, 1000));
      }
      locked = false; sc.removeEventListener('scroll', lock);
      await new Promise(r => setTimeout(r, 3000));
      return { ok: true };
    } catch (e) { log('loadMore ERROR: ' + (e?.message || e)); return { ok: false, error: e.message }; }
  }

  function withinRange(ts, from, to) { if (from != null && ts < from) return false; if (to != null && ts > to) return false; return true; }
  function dayRangeToEpochSeconds(s) {
    if (!s) return { start: undefined, end: undefined };
    const [y, m, d] = s.split('-').map(Number);
    return { start: Math.floor(new Date(y, m-1, d, 0, 0, 0, 0).getTime() / 1000), end: Math.floor(new Date(y, m-1, d, 23, 59, 59, 999).getTime() / 1000) };
  }

  async function fetchMediaMessages({ chatId, types, from, to, estimatedBatch = 700, maxBatches = 80 }) {
    const out = [], seen = new Set();
    let anchorId = '';
    const wanted = new Set(types || []);
    let batchNo = 0, noNew = 0, sameAnchor = 0, didOpen = false;
    const msgId = m => { if (typeof m === 'string') return m; const v = m?.id?._serialized ?? m?.id; return typeof v === 'string' ? v : ''; };
    const msgTs = m => m?.t || m?.timestamp || 0;
    const msgChatSer = m => (m?.id?.remote || m?.id?._remote)?._serialized || m?.chatId || m?.chat?.id?._serialized || '';

    while (batchNo < maxBatches) {
      batchNo++;
      const anchorSerPrev = typeof anchorId === 'string' ? anchorId : (anchorId?._serialized || '');
      let batch = [];
      try { batch = await window.WPP.chat.getMessages(chatId, { count: estimatedBatch, direction: anchorSerPrev ? 'before' : undefined, id: anchorSerPrev || undefined }); }
      catch (e) { log('getMessages ERROR: ' + (e?.message || e)); break; }
      if (!batch.length) break;

      const filtered = batch.filter(m => { const c = msgChatSer(m); return !c || c === chatId; });
      if (batchNo === 1 && filtered.length < batch.length * 0.2 && !didOpen) {
        didOpen = true;
        try { await (window.WPP?.chat?.openChatBottom || window.WPP?.chat?.openChatAt)(chatId); await new Promise(r => setTimeout(r, 250));
          anchorId = ''; batchNo = 0; out.length = 0; seen.clear(); noNew = 0; sameAnchor = 0; continue; } catch {}
      }
      batch = filtered;

      if (anchorSerPrev) batch = batch.filter(m => msgId(m) !== anchorSerPrev);
      if (!batch.length) break;

      let newIds = 0;
      for (const m of batch) {
        const id = msgId(m); if (!id || seen.has(id)) continue;
        newIds++;
        const ts = msgTs(m), kind = (m.type || m.mediaType || '').toLowerCase();
        const isMedia = m.isMedia || m.isMMS || !!m.mediaKey || !!m.mediaData || ['image','video','ptt','audio','document','sticker'].includes(kind);
        if (!isMedia) { seen.add(id); continue; }
        if (!withinRange(ts, from, to)) { seen.add(id); continue; }
        const norm = kind === 'ptt' ? 'audio' : kind;
        if (wanted.size && !wanted.has(norm)) { seen.add(id); continue; }
        out.push(m); seen.add(id);
      }
      let cursorMsg = batch[0], cursorTs = msgTs(cursorMsg);
      for (const x of batch) { const t = msgTs(x); if (t && (!cursorTs || t < cursorTs)) { cursorMsg = x; cursorTs = t; } }
      if (!cursorTs) cursorMsg = batch[batch.length - 1];
      const cursorSer = msgId(cursorMsg); if (!cursorSer) break;
      anchorId = cursorSer;
      const maxTs = Math.max(...batch.map(x => msgTs(x) || 0));
      if (from && maxTs < from) break;
      if (!newIds) { noNew++; if (noNew >= 2) break; } else noNew = 0;
      if (anchorSerPrev && anchorSerPrev === anchorId) { sameAnchor++; if (sameAnchor >= 2) break; } else sameAnchor = 0;
    }
    return out;
  }

  function patchWppDownloadMedia() {
    const W = window.WPP?.chat; if (!W || W.__wamdDownloadPatched) return; W.__wamdDownloadPatched = true;
    function neutralize(msg, label) {
      const md = msg?.mediaData || msg?._mediaData; if (!md) return;
      if (md.mediaBlob && !md.mediaBlob.__wamdSafePatched) {
        const orig = md.mediaBlob.forceToBlob?.bind(md.mediaBlob);
        md.mediaBlob.forceToBlob = function () {
          try { return orig ? orig() : null; } catch (e) {
            if (/msgChunks|forceToBlob|Cannot read properties of undefined/i.test(String(e?.message || e))) return null;
            throw e;
          }
        };
        md.mediaBlob.__wamdSafePatched = true;
      }
      try { if (md.mediaBlob) md.mediaBlob = null; } catch {}
    }
    if (typeof W.downloadMediaMessage === 'function') {
      const orig = W.downloadMediaMessage.bind(W);
      W.downloadMediaMessage = async function (msg) {
        const id = msg?.id?._serialized || msg?.id || msg;
        neutralize(msg, id);
        try { return await orig(msg); } catch (e) {
          if (/msgChunks|forceToBlob|Cannot read properties of undefined/i.test(String(e?.message || e))) { neutralize(msg, id); return await orig(msg); }
          throw e;
        }
      };
    }
  }

  async function getBlobFromCaches(message, idForLog) {
    const md = message?.mediaData || message?._mediaData || null; if (!md) return null;
    const mime = md.mimetype || message?.mimetype || 'application/octet-stream';
    const hash = md.filehash || message?.filehash || null;
    try {
      const L = window.LruMediaStore || window.Store?.LruMediaStore || window.WPP?.whatsapp?.LruMediaStore;
      if (hash && L?.get) { const c = await L.get(hash).catch(() => null); if (c) { const ab = c instanceof ArrayBuffer ? c : (c?.buffer instanceof ArrayBuffer ? c.buffer : null); if (ab) return new Blob([ab], { type: mime }); } }
    } catch {}
    try {
      const C = window.MediaBlobCache || window.Store?.MediaBlobCache || window.WPP?.whatsapp?.MediaBlobCache;
      if (hash && C?.has?.(hash)) { const b = C.get(hash); if (b) return b; }
    } catch {}
    try {
      if (md.mediaBlob?.forceToBlob) {
        try { const b = md.mediaBlob.forceToBlob(); if (b) return b; }
        catch (e) {
          if (/msgChunks|forceToBlob|Cannot read properties of undefined/i.test(String(e?.message || e))) { try { md.mediaBlob = null; } catch {} return null; }
          throw e;
        }
      }
    } catch {}
    return null;
  }

  async function downloadAnyMedia(message) {
    patchWppDownloadMedia();
    const id = message?.id?._serialized || message?.id || message;
    if (message && typeof message === 'object' && typeof message.downloadMedia === 'function') {
      let blob = await getBlobFromCaches(message, id); if (blob) return blob;
      await message.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true });
      await new Promise(r => setTimeout(r, 250));
      blob = await getBlobFromCaches(message, id); if (blob) return blob;
      await new Promise(r => setTimeout(r, 400));
      blob = await getBlobFromCaches(message, id); if (blob) return blob;
      throw new Error(`no blob for ${id}`);
    }
    const W = window.WPP?.chat || {};
    if (typeof W.downloadMediaMessage === 'function') return await W.downloadMediaMessage(message);
    if (typeof W.downloadMedia === 'function') return await W.downloadMedia(id);
    if (typeof W.downloadMessage === 'function') return await W.downloadMessage(id);
    throw new Error('No downloadMedia API');
  }

  async function safeDownloadBlob(m, { timeoutMs = 45000, retries = 1 } = {}) {
    const mid = m?.id?._serialized || m?.id || '';
    const kind = (m.type || m.mediaType || '').toLowerCase();
    for (let i = 1; i <= retries + 1; i++) {
      try {
        const blob = await withTimeout(downloadAnyMedia(m), timeoutMs, `${kind} ${mid} attempt=${i}`);
        if (!blob || typeof blob.arrayBuffer !== 'function') throw new Error('invalid blob');
        if (blob.size === 0) throw new Error('empty blob');
        return blob;
      } catch (e) { if (i <= retries) await new Promise(r => setTimeout(r, 400)); }
    }
    return null;
  }

  async function postDownload({ arrayBuffer, filename, mime }) {
    try {
      const blob = new Blob([arrayBuffer], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e?.message || e) }; }
  }

  function crc32(buf) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    let crc = -1;
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (let i = 0; i < b.length; i++) crc = (crc >>> 8) ^ t[(crc ^ b[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
  }
  const enc = new TextEncoder();
  const u32 = n => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n >>> 0, true); return a; };
  const u16 = n => { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n & 0xFFFF, true); return a; };
  function concat(parts) {
    let len = 0; for (const p of parts) len += p.length || p.byteLength || 0;
    const out = new Uint8Array(len); let off = 0;
    for (const p of parts) { const u = p instanceof Uint8Array ? p : new Uint8Array(p); out.set(u, off); off += u.length; }
    return out;
  }
  function localHeader(n, c, s) { return concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(c),u32(s),u32(s),u16(n.length),u16(0),n]); }
  function centralHeader(n, c, s, o) { return concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(c),u32(s),u32(s),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(o),n]); }
  function eocd(count, cdSize, cdOff) { return concat([u32(0x06054b50),u16(0),u16(0),u16(count),u16(count),u32(cdSize),u32(cdOff),u16(0)]); }
  function makeZip(entries) {
    const locals = [], centrals = []; let off = 0;
    for (const e of entries) {
      const n = enc.encode(e.name), d = e.bytes instanceof Uint8Array ? e.bytes : new Uint8Array(e.bytes), c = crc32(d);
      const lh = localHeader(n, c, d.length), rec = concat([lh, d]); locals.push(rec);
      centrals.push(centralHeader(n, c, d.length, off)); off += rec.length;
    }
    return concat([...locals, concat(centrals), eocd(entries.length, concat(centrals).length, off)]);
  }

  async function downloadMessages({ chatId, chatsFriendlyMap, types, from, to, naming, pack }) {
    await ensureReady();
    if (!chatId) return { count: 0 };
    const msgs = await fetchMediaMessages({ chatId, types, from, to, estimatedBatch: pack?.deepScan ? 1000 : 700, maxBatches: pack?.deepScan ? 200 : 80 });
    if (!msgs.length) return { count: 0 };
    const chatName = chatsFriendlyMap.get(chatId) || 'Chat';
    let idx = 0, saved = 0;
    const work = async (m) => {
      idx++;
      const mid = m?.id?._serialized || m?.id || '';
      const kind = (m.type || m.mediaType || '').toLowerCase();
      const ts = m.t || m.timestamp || Math.floor(Date.now() / 1000);
      if (isProbablyUnavailable(m)) return;
      try {
        const blob = await safeDownloadBlob(m, { timeoutMs: getTimeoutForMedia(m), retries: 0 });
        if (!blob) return;
        const buf = await blob.arrayBuffer(), bytes = new Uint8Array(buf);
        const mime = blob.type || m.mimetype || 'application/octet-stream';
        return { bytes, filename: makeFilename({ chatName, ts, index: idx, mime, caption: m.caption || m.body || '', naming, message: m, kind }) };
      } catch {}
    };
    if (pack?.saveAsZip) {
      const entries = [];
      for (const m of msgs) { const r = await work(m); if (r) { entries.push({ name: r.filename, bytes: r.bytes }); saved++; } }
      if (!entries.length) return { count: 0 };
      const zip = makeZip(entries);
      await postDownload({ arrayBuffer: zip.buffer, filename: `${sanitize(chatName)}_media.zip`, mime: 'application/zip' });
      return { count: saved };
    }
    for (const m of msgs) {
      const r = await work(m);
      if (r) {
        const mime = blob?.type || m.mimetype || 'application/octet-stream';
        const a = await postDownload({ arrayBuffer: r.bytes.buffer, filename: r.filename, mime });
        if (a?.ok) saved++;
      }
    }
    return { count: saved };
  }

  window.addEventListener('message', async (ev) => {
    const { data } = ev;
    if (!data || data.__from !== 'wamd:inpage' || data.type !== 'popup:cmd') return;
    const { cmd, payload } = data;
    try {
      if (cmd === 'listChats') {
        const list = await listChats();
        window.postMessage({ __from: 'wamd:inpage', type: 'inpage:resp', cmd, payload: list }, '*'); return;
      }
      if (cmd === 'getStats') {
        const id = payload?.selectedChatId;
        if (!id) return window.postMessage({ __from: 'wamd:inpage', type: 'inpage:error', cmd, error: 'Missing chatId' }, '*');
        window.postMessage({ __from: 'wamd:inpage', type: 'inpage:resp', cmd, payload: await getChatStats(id) }, '*'); return;
      }
      if (cmd === 'loadMore') {
        const id = payload?.selectedChatId;
        if (!id) return window.postMessage({ __from: 'wamd:inpage', type: 'inpage:error', cmd, error: 'Missing chatId' }, '*');
        window.postMessage({ __from: 'wamd:inpage', type: 'inpage:resp', cmd, payload: await loadMoreMessages(id) }, '*'); return;
      }
      if (cmd === 'download') {
        const { selectedChatId, types, dateFrom, dateTo, naming, pack } = payload || {};
        const chats = await listChats();
        const map = new Map(chats.map(c => [c.id, c.name]));
        const { start: f, end: t } = (dateFrom || dateTo) ? { start: dateFrom ? dayRangeToEpochSeconds(dateFrom).start : undefined, end: dateTo ? dayRangeToEpochSeconds(dateTo).end : undefined } : { start: undefined, end: undefined };
        const res = await downloadMessages({ chatId: selectedChatId, chatsFriendlyMap: map, types, from: f, to: t, naming, pack });
        window.postMessage({ __from: 'wamd:inpage', type: 'inpage:resp', cmd, payload: res }, '*'); return;
      }
    } catch (e) {
      window.postMessage({ __from: 'wamd:inpage', type: 'inpage:error', cmd, error: String(e?.message || e) }, '*');
    }
  });
})();