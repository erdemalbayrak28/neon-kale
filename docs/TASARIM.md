# Neon Kale: Oyun Tasarım Belgesi

Neon görünümlü, tarayıcıda çalışan bir **kule savunma** oyunu. Düşmanlar yoldan geçerek çıkışa ulaşmaya çalışır; oyuncu yol kenarına kuleler kurar, yükseltir ve 10 dalga boyunca kaleyi korur.

Bu belge, oyunun neye benzemesi ve nasıl davranması gerektiğinin tek kaynağıdır. Sayısal denge değerleri `src/core/data/` altındadır.

## Yol haritası

| Sürüm | İçerik |
|---|---|
| **0.1 Oynanabilir çekirdek** ← şimdi | 1 harita, 3 kule (her biri 3 seviye), 3 düşman, 10 dalga, altın/can ekonomisi, kur/yükselt/sat, 1x/2x hız, duraklatma, zafer (yıldızlı) / yenilgi |
| 0.2 Derinlik | 6+ kule ve yükseltme dalları, hedef önceliği seçimi (ilk/son/en güçlü/en yakın), uçan düşmanlar, boss dalgaları, yeni düşman yetenekleri (kalkan, iyileştirme, bölünme) |
| 0.3 Kalıcı ilerleme | Bölüm haritası ve yıldızlar, araştırma ağacı (kalıcı güçlendirmeler), kayıt sistemi, başarımlar |
| 0.4 Cila | Ses efektleri ve müzik (kodla üretilen), daha zengin efektler, ayarlar, Türkçe/İngilizce |
| 0.5 Genişleme | Yeni haritalar, sonsuz mod, günlük meydan okuma, rekor tablosu |

## Teknik yapı

- **TypeScript + Phaser 3** (`phaser@3.90.0`), **Vite** ile paketlenir. `npm run build` her şeyi **tek bir `dist/index.html`** dosyasına koyar (internet olmadan açılır).
- **Çekirdek (`src/core/`) Phaser'ı bilmez.** Bütün oyun kuralları `Simulation` sınıfındadır ve Vitest ile test edilir. Böylece kurallar ekran olmadan denenebilir, denge testleri yazılabilir.
- **Çizim katmanı (`src/scenes/`, `src/render/`, `src/ui/`)** her karede `sim.update(dt)` çağırır, `sim.state`'i çizer, dönen olaylarla efekt üretir. Oyunu sadece `Simulation`'ın komut metotlarıyla değiştirir (`build`, `upgrade`, `sell`, `startNextWave`).
- **Duraklatma ve hız** çizim katmanındadır: duraklatılınca `update` çağrılmaz; 2x'te `update(dt * 2)` çağrılır.
- **Görseller tamamen kodla çizilir** (Phaser Graphics ve çalışma anında üretilen dokular). Resim/ses dosyası yok.
- Test kancası: `window.__neonKale = { game, sim() }`. Uçtan uca testler (Playwright) oyunun durumunu buradan okur.

## Ekran yerleşimi (1280 × 720 mantıksal, `Scale.FIT` ile ekrana sığar)

```
┌──────────────────────────────────────────────────────────────────────┐ 0
│ NEON KALE   ◆ 160   ♥ 20   Dalga 0/10              [1x] [⏸]         │ üst çubuk (64 px)
├───────────────────────────────────────────────┬──────────────────────┤ 64
│                                               │ KULELER              │
│                                               │ [1] Lazer      50 ◆  │
│              HARİTA 20 × 13 karo              │ [2] Top        80 ◆  │
│              (48 px karolar, 960 × 624)       │ [3] Buz        70 ◆  │
│                                               │──────────────────────│
│                                               │ seçili kule bilgisi  │
│                                               │ (seviye, hasar, ...) │
│                                               │ [Yükselt 40◆][Sat]   │
│                                               │──────────────────────│
│                                               │ Sıradaki dalga: ...  │
│                                               │ [ Dalgayı başlat ▶ ] │
├───────────────────────────────────────────────┤                      │ 688
│ ipucu satırı                                  │                      │
└───────────────────────────────────────────────┴──────────────────────┘ 720
```

Sabitler `src/config.ts` → `LAYOUT`. Çekirdek koordinatları harita sol üst köşesine göredir; çizerken `LAYOUT.mapX/mapY` eklenir.

## Oynanış

- **Kurma:** Paneldeki bir kuleye tıklanır (ya da 1/2/3 tuşu) → "yerleştirme modu": fare imlecinin altındaki karoda kulenin hayaleti ve menzil çemberi görünür; kurulabilir ve altın yetiyorsa yeşil, değilse kırmızı. Karoya tıklayınca kurulur ve mod kapanır (**Shift** basılıyken mod açık kalır). Sağ tık ya da **Esc** iptal eder.
- **Seçme:** Kurulu bir kuleye tıklamak onu seçer: menzil çemberi görünür, panelde bilgileri, **Yükselt** (bedeliyle) ve **Sat** (geri verilecek altınla) düğmeleri çıkar. **U** yükseltir, **S** satar, **Esc** seçimi kaldırır. Boş bir yere tıklamak seçimi kaldırır.
- **Dalga:** "Dalgayı başlat" düğmesi ya da **Boşluk** tuşu. Bir dalga sahadayken, bütün düşmanları çıktıysa sonraki dalga erken çağrılabilir (+10 altın). Düğmenin metni durumu anlatır: "Dalgayı başlat ▶", "Erken çağır (+10 ◆)", "Dalga sürüyor…".
- **Hız ve duraklatma:** **F** ya da [1x/2x] düğmesi hızı değiştirir; **P** ya da [⏸] duraklatır. Duraklatılınca haritanın üstünde yarı saydam "DURAKLATILDI" katmanı ve "Devam et" düğmesi görünür.
- **Ekonomi:** Başlangıç 160 altın, 20 can. Düşman öldürmek altın verir, dalga temizlemek ödül verir. Satış %70 geri verir.
- **Bitiş:** Son dalganın bütün düşmanları yok olunca **zafer**: 1–3 yıldız (kalan cana göre). Can 0 olunca **yenilgi**. İkisinde de haritanın üstünde bir sonuç penceresi: başlık, yıldızlar (zaferde), istatistik (dalga, kalan can), **Tekrar oyna** ve **Ana menü** düğmeleri.
- **Telefon:** Dokunma tıklama gibi çalışır (hayalet, dokunulan karoda görünür ve dokunuşta kurulur). Ekran dikey ise "Telefonu yan çevirin" uyarısı gösterilir.

## Kurallar (çekirdek)

- **Yol:** `MapDef.waypoints` köşe noktalarından piksel çoklu çizgi (karo merkezleri) üretilir. Düşman, yol üzerindeki mesafesi (`distance`, piksel) ile ilerler; konumu bu mesafeden hesaplanır. Yolun kapsadığı harita içi karolar "yol karosu"dur, kule kurulamaz.
- **Düşman hızı:** `speed × TILE × speedMultiplier` piksel/sn. Yavaşlatma: aynı anda birden fazla buz etkisi varsa **en güçlü** (en küçük çarpan) geçerlidir ve süre en uzun olana uzar; üst üste çarpılmaz.
- **Can artışı:** dalga `w` için `maxHp × (1 + hpGrowthPerWave × (w − 1))`, en yakın tam sayıya yuvarlanır.
- **Zırh:** isabet başına `max(1, hasar − zırh)`.
- **Hedef seçimi (0.1):** menzildeki düşmanlardan **yolda en ileride olan** (`distance` en büyük). Hedef menzilden çıkar ya da ölürse yeniden seçilir.
- **Lazer (hitscan):** atış anında hedefe hasar verir.
- **Top (projectile):** mermi hedefe doğru `projectileSpeed` ile uçar ve her adımda hedefin güncel konumuna yönelir; hedef ölürse son bilinen konuma gider. Vardığında `splashRadius` içindeki **bütün** düşmanlara tam hasar verir (zırh her birine ayrı uygulanır).
- **Buz (pulse):** atışta menzildeki **bütün** düşmanlara hasar verir ve yavaşlatır. Menzilde düşman yoksa ateş etmez (bekleme süresi dolu kalır).
- **Bekleme süresi:** kule kurulunca hemen ateş edebilir; her atıştan sonra `fireInterval` bekler.
- **Altın ödülü:** öldürülen düşmanın `reward` değeri. Sızan düşman ödül vermez, `leakDamage` kadar can götürür.
- **Dalga ödülü:** bir dalganın bütün düşmanları çıkmış ve hepsi ölmüş/sızmışsa `waveBonusBase + waveBonusPerWave × w` altın (`waveCleared` olayı). Her dalga için bir kez.
- **Durum:** sahada başlatılmış ve henüz temizlenmemiş dalga varsa `'wave'`, yoksa `'building'`. Son dalga temizlenince ve can > 0 ise `'victory'`; can 0'a inince hemen `'defeat'` (sonraki olaylar üretilmez, zaman durur).
- **Yıldız:** kalan can ≥ `threeStarLives` → 3, ≥ `twoStarLives` → 2, değilse 1.
- **Kimlikler:** kule, düşman ve mermi kimlikleri artan tam sayılardır, asla tekrar kullanılmaz.
- **Belirlenimci:** rastgelelik yok. Aynı komutlar ve aynı `dt` dizisi her zaman aynı sonucu verir.

## Görsel dil

- Koyu lacivert zemin (`#0a0d14`), çok soluk ızgara çizgileri. Yol karoları biraz daha açık, kenarları camgöbeği neon (`pathEdge`). Giriş ve çıkışta parlayan ok/kapı işareti.
- **Neon parıltı:** her şekil iki kez çizilir: önce kalın ve düşük saydamlıkta (parıltı), sonra ince ve parlak. Mermi ve parçacıklar `ADD` karışım modunda.
- **Kuleler:** karo içinde yuvarlatılmış kare taban + renkli çekirdek + hedefe dönen namlu çizgisi. Seviye, tabanın altında 1–3 küçük nokta. Lazer yeşil-sarı (`laser`), top turuncu (`cannon`), buz camgöbeği (`frost`).
- **Düşmanlar:** koşucu = pembe daire, çevik = sarı üçgen (gittiği yöne bakar), zırhlı = kırmızı altıgen (kalın çerçeve). Hasar almışsa üstünde ince can çubuğu. Yavaşlatılmışsa camgöbeği halka.
- **Efektler:** lazer = 80 ms'de sönen ışın; top mermisi = parlayan küre, patlama = büyüyen ve sönen halka + kıvılcım; buz = genişleyen halka; ölüm = renkli parçacık patlaması + yukarı süzülen "+6" altın yazısı; sızma = ekran kenarında kırmızı parlama + hafif kamera sarsıntısı; kule kurma/yükseltme = kısa parlama halkası.
- **Yazı:** sistem yazı tipi (`FONT_FAMILY`), açık renk metin (`text`), ikincil metin `textDim`. Bütün metinler Türkçe.
- **Ana menü:** büyük "NEON KALE" başlığı (parıltılı), arkada yavaşça kayan neon ızgara, **Oyna** düğmesi, kısa "Nasıl oynanır" metni.
