// Oyunun sabitleri: ekran yerleşimi ve renkler. Hem çekirdek (core) hem çizim katmanı buradan okur.

/** Bir karonun piksel boyu. Çekirdekteki tüm "karo" birimleri bununla piksele çevrilir. */
export const TILE = 48;

/** Oyunun mantıksal çözünürlüğü. Phaser bunu ekrana sığacak şekilde ölçekler. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Ekran yerleşimi (piksel). Harita sol üstte, üst çubuğun altında; yan panel sağda. */
export const LAYOUT = {
  topBarHeight: 64,
  mapX: 0,
  mapY: 64,
  /** Harita alanının genişliği: 20 karo × 48 = 960. */
  mapWidth: 960,
  /** Harita alanının yüksekliği: 13 karo × 48 = 624. */
  mapHeight: 624,
  panelX: 960,
  panelY: 64,
  panelWidth: 320,
  panelHeight: GAME_HEIGHT - 64,
  /** Haritanın altındaki ipucu satırı. */
  hintY: 64 + 624,
  hintHeight: GAME_HEIGHT - 64 - 624,
} as const;

/** Çekirdek simülasyonun sabit adım süresi (saniye). */
export const FIXED_STEP = 1 / 60;

/** Neon renk paleti (Phaser renkleri 0xRRGGBB biçiminde). */
export const COLORS = {
  background: 0x0a0d14,
  panel: 0x111827,
  panelBorder: 0x1f2a3d,
  grid: 0x16203a,
  path: 0x0f1a2e,
  pathEdge: 0x2de2e6,
  text: 0xe6edf7,
  textDim: 0x8b97ad,
  accent: 0xc8f031,
  gold: 0xffd166,
  lives: 0xff4d6d,
  valid: 0x5cff8a,
  invalid: 0xff4d5e,
  laser: 0xc8f031,
  cannon: 0xff8a3d,
  frost: 0x4de1ff,
  runner: 0xff3df0,
  scout: 0xffe14d,
  brute: 0xff4d5e,
  /** Haritadaki engel karoları (soluk kristaller). */
  rock: 0x6c5ce7,
  /** Düşmanların girdiği kapı. */
  entry: 0xb84dff,
  /** Korunan kale (çıkış). */
  exit: 0xff4d6d,
  /** Panel kartlarının iç zemini. */
  card: 0x0d1424,
  /** Ana menüdeki ızgara. */
  menuGrid: 0xff3df0,
} as const;

/** Phaser renk sayısını CSS metnine çevirir (Text nesneleri için). */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export const FONT_FAMILY = '"Segoe UI", "Inter", system-ui, -apple-system, Roboto, sans-serif';
