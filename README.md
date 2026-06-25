# WhatsApp Galeri

> WhatsApp Web sohbetlerinden ve gruplarından medya dosyalarını indiren Chrome/Firefox/Helium eklentisi. Sınırsız.

Tek tıkla sohbet seç → tarih aralığı belirle → görsel, video, ses, belge filtrele → tek ZIP olarak veya tek tek indir.

## ✨ Özellikler

- **Tüm medya türleri**: görsel, video, ses, belge
- **Tarih filtresi**: belirli bir tarih aralığındaki medyaları indir
- **ZIP modu**: tüm dosyaları tek arşivde paketle
- **Derin tarama**: WhatsApp'ın önbelleğinde olmayan eski mesajları yükler
- **Dosya adı özelleştirme**: tarih ekle, orijinal adı koru, açıklamayı sonek yap
- **Sohbet istatistikleri**: sohbette kaç görsel/video/ses/belge var, göster
- **Sayım**: istatistik sonrası her türün sayısı tür kartında görünür
- **Klavye dostu**, karanlık temaya özel tasarım

## 🛠 Kurulum (Geliştirici modu)

### Chrome / Helium / Brave / Edge / Arc

1. `chrome://extensions` adresine git
2. Sağ üstten **Geliştirici modu**'nu aç
3. **Paketlenmemiş öğe yükle** → bu klasörü seç
4. `https://web.whatsapp.com` aç, sohbet seç, **İndir**'e bas

### Firefox

1. `about:debugging#/runtime/this-firefox` adresine git
2. **Geçici eklenti yükle** → `manifest.json`'ı seç

## 📦 Chrome Web Store'a yükleme

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) → $5 kayıt ücreti
2. Bu klasörü ZIP'le: `zip -r whatsapp-galeri.zip . -x "*.git*" -x "*.DS_Store"`
3. Dashboard'da **Yeni öğe** → ZIP'i yükle
4. Mağaza ikonu (128×128), ekran görüntüleri (1280×800), açıklama ekle
5. **İnceleme için gönder** (1-7 gün sürer)

## 🏗 Mimari

```
manifest.json           MV3 manifest, host_permissions: web.whatsapp.com
background.js           chrome.downloads ile indirme tetikleyici
content.js              Popup ↔ Sayfa postMessage köprüsü
popup.{html,css,js}     UI: tarih seçici, tür kartları, ayarlar
inpage/app.js           Asıl iş mantığı (WPPConnect üzerinden sohbet tarama)
inpage/vendor/          wppconnect-wa-wrapped.js (vendor kütüphane)
icons/, assets/         Mağaza ikonları ve logo
```

### İletişim akışı

```
Popup → chrome.tabs.sendMessage → content.js → window.postMessage → inpage/app.js
inpage/app.js → fetch patch → blob → window.postMessage → content.js → chrome.downloads
```

### inpage/app.js sorumlulukları

- `listChats()` — sohbetleri çeker
- `getChatStats(chatId)` — medya sayımı
- `fetchMediaMessages()` — sayfalı medya tarama (`getMessages` ile `direction: 'before'`)
- `downloadAnyMedia()` — `message.downloadMedia()` veya `WPP.chat.downloadMedia*`
- `safeDownloadBlob()` — timeout + retry + skip unavailable
- `patchWppDownloadMedia()` — `msgChunks` hatası workaround
- `getBlobFromCaches()` — LruMediaStore → MediaBlobCache → mediaBlob fallback
- `makeZip()` — STORE modunda minimal ZIP writer (CRC32 + EOCD)

## 🔒 Gizlilik

- Hiçbir veri toplanmaz, hiçbir sunucuya gönderilmez
- Tüm işlem tarayıcı içinde yapılır
- Google OAuth, premium hesap, üçüncü taraf API yok
- Ayarlar yalnızca `chrome.storage.sync` ile cihazlar arası senkronize edilir

## 🐛 Bilinen sınırlamalar

- WhatsApp'ın iç API'sine bağlıdır; güncellemelerde bozulabilir
- Yüksek medya sayılı sohbetlerde (>10K mesaj) yavaş olabilir (Deep Scan modunda)
- Ekip görselleri için `image` türü seçili olmalı (avatar vs. dahil)

## 📝 Lisans

MIT — ayrıntılar için [LICENSE](./LICENSE).