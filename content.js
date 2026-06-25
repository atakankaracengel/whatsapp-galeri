(function () {
  window.addEventListener('message', (ev) => {
    const { data } = ev;
    if (!data || data.__from !== 'wamd:inpage') return;
    if (data.type === 'wa:download') {
      try {
        chrome.runtime.sendMessage({ type: 'wa:download', payload: data.payload }, (res) => {
          try {
            window.postMessage({ __from: 'wamd:content', type: 'wa:download:ack', id: data.id, res: res || { ok: false, error: chrome.runtime.lastError?.message || 'no response' } }, '*');
          } catch {}
        });
      } catch (e) {
        window.postMessage({ __from: 'wamd:content', type: 'wa:download:ack', id: data.id, res: { ok: false, error: String(e) } }, '*');
      }
      return;
    }
    try { chrome.runtime.sendMessage({ __from: 'wamd:content', payload: data }); } catch {}
  });

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (!msg || msg.__to !== 'wamd:content') return;
    if (msg.payload && msg.payload.type === 'ping') { sendResponse({ ok: true, pong: true }); return; }
    try { window.postMessage(msg.payload, '*'); sendResponse({ ok: true }); }
    catch (e) { sendResponse({ ok: false, error: String(e) }); }
  });
})();