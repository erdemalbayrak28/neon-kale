import type Phaser from 'phaser';

// Neon çizim yardımcıları. Parıltı = önce geniş ve soluk, sonra ince ve parlak çizgi.
// Bütün yardımcılar verilen Graphics nesnesine çizer; nesne yaratmaz.

type Gfx = Phaser.GameObjects.Graphics;

export interface GlowStyle {
  /** Parlak çizginin kalınlığı (piksel). */
  width?: number;
  /** Genel saydamlık çarpanı (0–1). */
  alpha?: number;
  /** Parıltının genişlik çarpanı; 0 parıltısız çizer. */
  glow?: number;
}

/** Rengi beyaza doğru karıştırır (t = 0 aynı renk, 1 beyaz). */
export function lighten(color: number, t: number): number {
  return mix(color, 0xffffff, t);
}

/** Rengi siyaha doğru karartır (t = 0 aynı renk, 1 siyah). */
export function darken(color: number, t: number): number {
  return mix(color, 0x000000, t);
}

/** İki rengi doğrusal karıştırır. */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Bir çizim işlemini parıltılı olarak üç kat çizer: geniş-soluk, orta, ince-parlak. */
export function withGlow(g: Gfx, color: number, style: GlowStyle, draw: () => void): void {
  const width = style.width ?? 2;
  const alpha = style.alpha ?? 1;
  const glow = style.glow ?? 1;
  if (glow > 0) {
    g.lineStyle(width + 9 * glow, color, 0.07 * alpha);
    draw();
    g.lineStyle(width + 4 * glow, color, 0.16 * alpha);
    draw();
  }
  g.lineStyle(width, lighten(color, 0.25), alpha);
  draw();
}

export function glowCircle(g: Gfx, x: number, y: number, r: number, color: number, style: GlowStyle = {}): void {
  withGlow(g, color, style, () => g.strokeCircle(x, y, r));
}

export function glowLine(
  g: Gfx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  style: GlowStyle = {},
): void {
  withGlow(g, color, style, () => g.lineBetween(x1, y1, x2, y2));
}

export function glowRoundRect(
  g: Gfx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: number,
  style: GlowStyle = {},
): void {
  withGlow(g, color, style, () => g.strokeRoundedRect(x, y, w, h, radius));
}

export function glowPolygon(g: Gfx, points: readonly Phaser.Types.Math.Vector2Like[], color: number, style: GlowStyle = {}): void {
  withGlow(g, color, style, () => strokeClosed(g, points));
}

/** Kapalı çokgeni çizer (strokePoints'in köşe birleşimleri kalın çizgide boşluk bırakmasın diye kenar kenar). */
export function strokeClosed(g: Gfx, points: readonly Phaser.Types.Math.Vector2Like[]): void {
  g.beginPath();
  const first = points[0];
  if (!first) return;
  g.moveTo(first.x ?? 0, first.y ?? 0);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    g.lineTo(p.x ?? 0, p.y ?? 0);
  }
  g.closePath();
  g.strokePath();
}

export function fillPolygon(g: Gfx, points: readonly Phaser.Types.Math.Vector2Like[], color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  const first = points[0];
  if (!first) return;
  g.moveTo(first.x ?? 0, first.y ?? 0);
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    g.lineTo(p.x ?? 0, p.y ?? 0);
  }
  g.closePath();
  g.fillPath();
}

/** Düzgün çokgenin köşe noktaları (paylaşılan diziye yazar, her karede yeni dizi yaratmamak için). */
export function regularPolygon(
  out: { x: number; y: number }[],
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number,
): { x: number; y: number }[] {
  while (out.length < sides) out.push({ x: 0, y: 0 });
  out.length = sides;
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const p = out[i]!;
    p.x = cx + Math.cos(a) * r;
    p.y = cy + Math.sin(a) * r;
  }
  return out;
}

/** Beş köşeli yıldızın noktaları. */
export function starPoints(cx: number, cy: number, outer: number, inner: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return points;
}

/** 0–1 arası yumuşak çıkış eğrisi. */
export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}
