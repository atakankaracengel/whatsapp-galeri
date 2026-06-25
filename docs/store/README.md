# Chrome Web Store Listing Materials

Bu klasör Chrome Web Store'a yükleme için gereken tüm görselleri içerir.

## Görseller

| Dosya | Boyut | Kullanım |
|---|---|---|
| `screenshot-1280x800.png` | 1280×800 | Mağaza listesi screenshot'ı (zorunlu, 1-5 adet) |
| `tile-440x280.png` | 440×280 | Küçük tanıtım tile'ı (Mağaza arama sonuçları) |
| `marquee-1400x560.png` | 1400×560 | Marquee tanıtım (opsiyonel, öne çıkan vitrin) |

## Kullanım

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) → **Yeni öğe**
2. ZIP'lenmiş eklentiyi yükle (kök klasörden, `.git` hariç)
3. **Mağaza listesi** sekmesinde:
   - **Açıklama** → `listing-en.md` veya `listing-tr.md` kullan
   - **Screenshot** → `screenshot-1280x800.png`
   - **Küçük tanıtım tile** → `tile-440x280.png`
   - **Marquee** → `marquee-1400x560.png`
4. **Gizlilik uygulamaları** sekmesinde izinleri beyan et
5. **İnceleme için gönder**