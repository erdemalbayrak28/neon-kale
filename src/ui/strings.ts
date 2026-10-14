import type { CommandFailure, TileCoord, TowerKind } from '../core/types';

// Oyuncuya görünen metinler (Türkçe) ve küçük biçimlendirme yardımcıları.

export const GOLD = '◆';

export const FAILURE_TEXT: Record<CommandFailure, string> = {
  notEnoughGold: 'Yeterli altın yok',
  outOfBounds: 'Harita dışına kule kurulamaz',
  onPath: 'Yolun üzerine kule kurulamaz',
  blocked: 'Bu karoda kristal var, kule kurulamaz',
  occupied: 'Bu karoda zaten bir kule var',
  noTower: 'Kule bulunamadı',
  maxLevel: 'Kule zaten en üst seviyede',
  gameOver: 'Oyun bitti',
  waveInProgress: 'Dalga sürüyor; bütün düşmanlar çıkınca erken çağırabilirsin',
  noMoreWaves: 'Başka dalga kalmadı',
};

export const WAVE_BUTTON = {
  start: 'Dalgayı başlat ▶',
  early: (bonus: number): string => `Erken çağır (+${bonus} ${GOLD})`,
  running: 'Dalga sürüyor…',
  over: 'Oyun bitti',
} as const;

/** Sayıyı kısa ondalıkla yazar: 2.50 → "2,5", 3 → "3". */
export function num(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed.replace('.', ',');
}

export interface HintContext {
  status: 'building' | 'wave' | 'victory' | 'defeat';
  paused: boolean;
  placing: TowerKind | null;
  placingName: string | null;
  hoverTile: TileCoord | null;
  /** Hayaletin altındaki karo için kurma engeli (yoksa null). */
  placeProblem: string | null;
  selectedName: string | null;
  selectedMaxed: boolean;
  wavesStarted: number;
  totalWaves: number;
  canCallEarly: boolean;
  earlyBonus: number;
}

/** İpucu satırının metni: o anki modu anlatır. */
export function hintFor(c: HintContext): string {
  if (c.status === 'victory') return 'Zafer! Kale ayakta kaldı.';
  if (c.status === 'defeat') return 'Kale düştü. Tekrar dene!';
  if (c.paused) return 'Oyun duraklatıldı · P ya da "Devam et" ile sürdür';
  if (c.placing) {
    if (c.hoverTile && c.placeProblem) return `${c.placingName}: ${c.placeProblem}`;
    return `${c.placingName}: kurmak için yolun yanında boş bir karoya tıkla · Shift: art arda kur · Sağ tık / Esc: iptal`;
  }
  if (c.selectedName) {
    const upgrade = c.selectedMaxed ? 'en üst seviyede' : 'U: yükselt';
    return `${c.selectedName} seçili · ${upgrade} · S: sat · Esc: seçimi kaldır`;
  }
  if (c.status === 'wave') {
    if (c.canCallEarly) return `Sıradaki dalgayı erken çağırabilirsin: Boşluk (+${c.earlyBonus} ${GOLD})`;
    return 'Düşmanlar yolda! Kuleleri yükseltmek için üstlerine tıkla.';
  }
  if (c.wavesStarted === 0) return 'Sağdaki panelden bir kule seç (1/2/3) ve yolun yanına kur. Hazır olunca Boşluk ile dalgayı başlat.';
  return 'Dalga temizlendi. Savunmanı güçlendir, hazır olunca Boşluk ile sıradaki dalgayı başlat.';
}
