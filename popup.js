(() => {
  const APP_VERSION = '1.0.0';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  function log(m) {
    const line = `[${new Date().toLocaleTimeString('tr-TR')}] ${m}`;
    const logEl = $('#log');
    logEl.textContent = (logEl.textContent + '\n' + line).trim();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setStatus(text, state) {
    const dot = $('#statusDot');
    const t = text || { ok: 'Hazır', wait: 'Yükleniyor', idle: 'Hata', off: 'Pasif' }[state] || '';
    dot.className = 'strip-dot' + (state ? ' strip-dot--' + state : '');
    $('#statusText').textContent = t;
  }

  function getTypes() {
    return $$('.t:checked').map(x => x.value);
  }

  function updateTypeCount() {
    const total = $$('.t').length;
    const checked = $$('.t:checked').length;
    const el = $('#typeCountMeta');
    if (!el) return;
    if (checked === total) el.textContent = '/02 · tümü';
    else if (checked === 0) el.textContent = '/02 · boş';
    else el.textContent = `/02 · ${checked}/${total}`;
  }

  async function getActiveTab() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) throw new Error('Aktif sekme yok');
    const waTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (waTabs && waTabs.length > 0) return waTabs.find(t => t.status === 'complete') || waTabs[0];
    await chrome.tabs.update(activeTab.id, { url: 'https://web.whatsapp.com' });
    setTimeout(() => { try { window.close(); } catch {} }, 50);
    throw new Error('WhatsApp Web açılıyor. Yüklendikten sonra tekrar deneyin.');
  }

  async function runInMain(tabId, func, ...args) {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args, world: 'MAIN' });
    return result;
  }
  async function injectFile(tabId, file) {
    await chrome.scripting.executeScript({ target: { tabId }, files: [file], world: 'MAIN' });
  }
  async function ensureInjected(tabId) {
    const hasWpp = await runInMain(tabId, () => !!window.WPP);
    if (!hasWpp) await injectFile(tabId, 'inpage/vendor/wppconnect-wa-wrapped.js').catch(e => log('Vendor hatası: ' + e.message));
    const info = await runInMain(tabId, () => ({ loaded: !!window.__WAMD_APP_LOADED__, version: window.__WAMD_APP_VERSION__ || '' }));
    if (!info.loaded) {
      log('Uygulama yükleniyor…');
      await injectFile(tabId, 'inpage/app.js').catch(e => log('Uygulama hatası: ' + e.message));
    } else if (info.version !== APP_VERSION) {
      log('Eski sürüm algılandı, yenileniyor…');
      await chrome.tabs.reload(tabId);
      throw new Error('Yenilendi. Eklentiyi tekrar açın.');
    }
  }
  async function ensureContentScript(tabId) {
    const ping = () => chrome.tabs.sendMessage(tabId, { __to: 'wamd:content', payload: { type: 'ping' } });
    try { await ping(); return true; } catch {
      try { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); } catch {}
      await new Promise(r => setTimeout(r, 150));
      try { await ping(); return true; } catch { return false; }
    }
  }
  async function sendToPage(message) {
    const tab = await getActiveTab();
    await ensureInjected(tab.id);
    if (!await ensureContentScript(tab.id)) { log('İçerik betiği hazır değil'); return; }
    try { await chrome.tabs.sendMessage(tab.id, { __to: 'wamd:content', payload: message }); }
    catch (err) { log('Mesaj hatası: ' + (err?.message || err)); }
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (!msg || msg.__from !== 'wamd:content') return;
    const d = msg.payload;
    if (d.type === 'wa:log') log(d.message);
    else if (d.type === 'inpage:resp' && d.cmd === 'listChats') {
      const chats = d.payload || [];
      const sel = $('#chatSelect');
      sel.innerHTML = '';
      const ph = document.createElement('option');
      ph.value = ''; ph.textContent = 'Sohbet / Grup Seçin'; ph.disabled = true; ph.selected = true;
      sel.appendChild(ph);
      for (const c of chats) {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.name} — ${c.id}`;
        sel.appendChild(o);
      }
      sel.disabled = false;
      sel.value = '';
      $('#chatCount').textContent = `${chats.length} chat`;
      setStatus('Hazır', 'ok');
      log(`${chats.length} sohbet yüklendi.`);
    } else if (d.type === 'inpage:resp' && d.cmd === 'getStats') displayStats(d.payload || {});
    else if (d.type === 'inpage:error') { log('Hata: ' + d.error); setStatus(null, 'idle'); }
    else if (d.type === 'inpage:resp' && d.cmd === 'download') {
      const c = d.payload?.count || 0;
      log(`Tamamlandı. ${c} dosya indi.`);
      $('#bar').style.width = '100%';
      setStatus(`${c} dosya`, 'ok');
      setTimeout(() => { $('#bar').style.width = '0%'; }, 700);
    }
    sendResponse?.({ ok: true });
  });

  function displayStats(s) {
    if (!s || !s.totalMedia) { $('#statsPanel').classList.add('hidden'); return; }
    $('#statsPanel').classList.remove('hidden');
    $('#statTotal').textContent = s.totalMedia || 0;
    $('#statImages').textContent = s.images || 0;
    $('#statVideos').textContent = s.videos || 0;
    $('#statAudio').textContent = s.audio || 0;
    $('#statDocuments').textContent = s.documents || 0;
    $$('.type-count').forEach(el => {
      const k = el.dataset.stat;
      if (k && s[k] != null) el.textContent = s[k] || '—';
    });
    log(`İstatistik: ${s.totalMedia} medya`);
  }

  $('#chatSelect').addEventListener('change', async () => {
    const id = $('#chatSelect').value;
    if (!id) { $('#statsPanel').classList.add('hidden'); return; }
    setStatus(null, 'wait');
    await sendToPage({ __from: 'wamd:inpage', type: 'popup:cmd', cmd: 'getStats', payload: { selectedChatId: id } });
    setStatus('Hazır', 'ok');
  });

  $('#loadMoreBtn')?.addEventListener('click', async () => {
    const id = $('#chatSelect').value;
    if (!id) { log('Önce bir sohbet seçin'); return; }
    $('#loadMoreBtn').disabled = true;
    setStatus(null, 'wait');
    log('Eski mesajlar yükleniyor…');
    await sendToPage({ __from: 'wamd:inpage', type: 'popup:cmd', cmd: 'loadMore', payload: { selectedChatId: id } });
    await new Promise(r => setTimeout(r, 3000));
    await sendToPage({ __from: 'wamd:inpage', type: 'popup:cmd', cmd: 'getStats', payload: { selectedChatId: id } });
    $('#loadMoreBtn').disabled = false;
    setStatus('Hazır', 'ok');
  });

  async function refreshChats() {
    const sel = $('#chatSelect');
    sel.disabled = true;
    sel.innerHTML = '<option value="">Yükleniyor…</option>';
    sel.value = '';
    $('#statsPanel').classList.add('hidden');
    setStatus(null, 'wait');
    await sendToPage({ __from: 'wamd:inpage', type: 'popup:ready?' });
    await sendToPage({ __from: 'wamd:inpage', type: 'popup:cmd', cmd: 'listChats', payload: {} });
  }
  $('#refresh').addEventListener('click', refreshChats);

  $('#start').addEventListener('click', async () => {
    const selectedChatId = $('#chatSelect').value;
    if (!selectedChatId) { log('Önce bir sohbet seçin'); return; }
    const types = getTypes();
    if (!types.length) { log('En az bir medya türü seçin'); return; }
    const naming = {
      useDate:           $('#useDate').checked,
      captionSuffix:     $('#useCaptionSuffix').checked,
      appendOrigNameAll: $('#appendOrigNameAll').checked
    };
    const pack = {
      saveAsZip: $('#saveAsZip').checked,
      deepScan:  $('#deepScan').checked
    };
    const dateFrom = $('#dateFrom').value || '';
    const dateTo   = $('#dateTo').value   || '';

    log(`Seçenekler: zip=${pack.saveAsZip}, derin=${pack.deepScan}, türler=[${types.join(',')}]`);
    if (dateFrom || dateTo) log(`Tarih: ${dateFrom || '∞'} → ${dateTo || '∞'}`);
    $('#bar').style.width = '12%';
    setStatus(null, 'wait');
    log('İndirme başladı…');
    await sendToPage({
      __from: 'wamd:inpage',
      type: 'popup:cmd',
      cmd: 'download',
      payload: { selectedChatId, types, dateFrom, dateTo, naming, pack }
    });
    let p = 12;
    const timer = setInterval(() => {
      p = Math.min(95, p + Math.random() * 10);
      $('#bar').style.width = p.toFixed(0) + '%';
      if (p >= 94) clearInterval(timer);
    }, 400);
  });

  // Type card change counter
  $$('.t').forEach(cb => cb.addEventListener('change', updateTypeCount));

  (async () => {
    try {
      setStatus(null, 'wait');
      const tab = await getActiveTab();
      await ensureInjected(tab.id);
      await refreshChats();
    } catch (e) {
      log('Başlatma: ' + e.message);
      setStatus(null, 'idle');
    }
  })();
})();