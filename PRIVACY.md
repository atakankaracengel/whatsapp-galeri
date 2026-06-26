# Gizlilik Politikası — WhatsApp Galeri

**Son güncelleme**: 2026

Bu eklenti gizliliğinize önem verir. Bu belge, eklentinin verilerinizi nasıl işlediğini açıklar.

## Toplanan Veri: YOK

WhatsApp Galeri **hiçbir kullanıcı verisi toplamaz, saklamaz veya aktarmaz**. Tüm işlem kullanıcının kendi tarayıcısında gerçekleşir.

Spesifik olarak:

- ❌ Analitik / telemetry
- ❌ Kullanım istatistikleri
- ❌ Konum bilgisi
- ❌ Cihaz bilgisi
- ❌ Sohbet içeriği kaydı
- ❌ Hesap bilgisi
- ❌ Çerez (cookie) okuma/yazma

## Sunucu Bağlantısı: YOK

Eklenti **hiçbir dış sunucuya bağlanmaz**. Hiçbir API çağrısı yapılmaz. Hiçbir veri ağ üzerinden gönderilmez.

Eklenti sadece:
- `web.whatsapp.com` sitesinin kendi iç API'siyle iletişim kurar (kullanıcının tarayıcısı içinde)
- `chrome.downloads` API'si ile dosyaları kullanıcının bilgisayarına kaydeder
- `chrome.storage.sync` ile ayarları cihazlar arası senkronize eder (Google'ın kendi altyapısı)

## Erişilen Veriler

Eklenti, kullanıcının **kendisinin seçtiği WhatsApp sohbetinin** mesajlarına erişir. Bu erişim:

- **Yalnızca kullanıcının etkin sekmesinde**, kullanıcının eklenti simgesine tıklayıp sohbet seçmesiyle tetiklenir
- **Yalnızca görsel/video/ses/belge indirme** amacıyla kullanılır
- **Hiçbir yere kaydedilmez veya gönderilmez**
- **Sekme kapatıldığında tüm bellek temizlenir**

## İzinler

| İzin | Neden |
|---|---|
| `downloads` | Seçilen medyayı kullanıcının bilgisayarına indirmek |
| `activeTab` | Popup'tan WhatsApp Web sekmesiyle iletişim kurmak |
| `scripting` | İçerik betiği (content script) çalıştırmak |
| `web.whatsapp.com` host | Sadece WhatsApp Web sitesinde çalışmak |

## Üçüncü Taraflar

Eklenti:
- **Google OAuth kullanmaz**
- **Hiçbir analytics servisine** veri göndermez
- **Hiçbir reklam ağına** bağlı değildir
- **Ücretli abonelik veya ödeme** bilgisi toplamaz

## Açık Kaynak

Eklenti MIT lisansıyla açık kaynak kodludur. Kodu istediğiniz zaman inceleyebilirsiniz:
https://github.com/atakankaracengel/whatsapp-galeri

## Çocukların Gizliliği

Eklenti 13 yaş altı çocuklara yönelik değildir ve bilerek çocuklardan veri toplamaz.

## Değişiklikler

Bu politika zaman zaman güncellenebilir. Önemli değişiklikler GitHub commit geçmişinde görülecektir.

## İletişim

Gizlilik ile ilgili sorularınız için GitHub Issues açabilirsiniz:
https://github.com/atakankaracengel/whatsapp-galeri/issues

---

**Özet**: Bu eklenti veri toplamaz. Tek yaptığı, sizin seçtiğiniz sohbetten medya indirmenizi sağlamak. Başka hiçbir şey.