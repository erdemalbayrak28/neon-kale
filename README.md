# Neon Kale

Tarayıcıda çalışan, neon görünümlü bir kule savunma oyunu.

## Oynamak

**`oyna/NeonKale.html`** dosyasına çift tıklayın, oyun tarayıcıda açılır. Kurulum ya da internet gerekmez.

(Kodu değiştirdikten sonra `npm run build` ile yeniden derlenir; çıktı `dist/index.html`. Oynanabilir kopyayı güncellemek için onu `oyna/NeonKale.html` üzerine kopyalayın.)

**Kontroller**
- **1 / 2 / 3** ya da paneldeki kule: yerleştirme modu. Haritaya tıklayınca kule kurulur.
- Kuleye tıklayınca seçilir: **U** yükseltir, **S** satar.
- **Boşluk:** dalgayı başlat · **F:** 1x/2x hız · **P:** duraklat · **Esc:** iptal

## Geliştirmek

Node.js 20 veya üstü gerekir.

```bash
npm install
npm run dev
```

Ayrıntılar: [docs/TASARIM.md](docs/TASARIM.md)
