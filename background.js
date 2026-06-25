const dl = chrome.downloads;
function ab2b64(buf) {
  const bytes = new Uint8Array(buf), chunk = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'wa:download') {
        const { base64, arrayBuffer, filename, mime } = msg.payload || {};
        if (!filename) { sendResponse({ ok: false, error: 'filename missing' }); return; }
        let b64 = base64 || (arrayBuffer ? ab2b64(arrayBuffer) : null);
        if (!b64) { sendResponse({ ok: false, error: 'no data' }); return; }
        await dl.download({ url: `data:${mime || 'application/octet-stream'};base64,${b64}`, filename, saveAs: false, conflictAction: 'uniquify' });
        sendResponse({ ok: true }); return;
      }
      if (msg?.type === 'wa:log') { console.log('[WAMD]', msg.message); sendResponse({ ok: true }); return; }
      sendResponse({ ok: false, error: 'unknown msg.type' });
    } catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); }
  })();
  return true;
});