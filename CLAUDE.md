# Neon Kale

Tarayıcıda çalışan neon kule savunma oyunu. TypeScript + Phaser 3 + Vite; testler Vitest, uçtan uca Playwright.
Tasarımın tek kaynağı: `docs/TASARIM.md`. Denge değerleri: `src/core/data/`.

## Komutlar

```bash
npm install
npm run dev        # geliştirme sunucusu
npm run typecheck
npm test           # çekirdek birim + denge testleri
npm run build      # tek dosya: dist/index.html
npm run e2e        # derlenmiş oyunu Playwright ile oynar, e2e/screens/ altına ekran görüntüsü alır
```

## Kurallar

- Kod (sınıf, metot, değişken) İngilizce; oyuncuya görünen metinler, yorumlar ve belgeler Türkçe.
- `src/core/` Phaser'ı **import etmez**, DOM'a dokunmaz. Bütün kurallar `Simulation`'da; çizim katmanı oyunu sadece komut metotlarıyla değiştirir.
- `src/core/types.ts` çekirdek ile çizim katmanı arasındaki sözleşmedir. Değiştirirken iki tarafı da güncelle.
- Belirlenimci çekirdek: `Math.random()` ve `Date.now()` çekirdekte yasak. Zaman sadece `update(dt)` ile ilerler.
- Birimler: veri dosyalarında karo, çalışma anında piksel (harita sol üstüne göre), süreler saniye.
- Görseller ve sesler kodla üretilir; dışarıdan dosya ya da CDN yok (oyun tek HTML dosyasında çalışmalı).
- Sabit sayıları (yerleşim, renk) `src/config.ts`'ten al; dağınık sihirli sayı yazma.
- Bir değişiklikten sonra `npm run typecheck`, `npm test`, `npm run build` temiz geçmeli; görsel değişiklikte `npm run e2e` ile ekran görüntüsüne bak.
