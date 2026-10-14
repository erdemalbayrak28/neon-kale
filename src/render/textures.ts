import type Phaser from 'phaser';

// Çalışma anında kodla üretilen dokular (resim dosyası yok). Dokular oyun genelinde paylaşılır; bir kez üretilir.

export const TEX = {
  /** Yumuşak kenarlı küçük nokta: parçacıklar ve mermiler. */
  spark: 'neon-spark',
  /** Büyük, çok yumuşak ışık lekesi: arka plan parıltıları. */
  glow: 'neon-glow',
} as const;

export function ensureTextures(scene: Phaser.Scene): void {
  radial(scene, TEX.spark, 32, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.85)'],
    [0.55, 'rgba(255,255,255,0.25)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  radial(scene, TEX.glow, 256, [
    [0, 'rgba(255,255,255,0.9)'],
    [0.35, 'rgba(255,255,255,0.35)'],
    [0.7, 'rgba(255,255,255,0.08)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
}

function radial(scene: Phaser.Scene, key: string, size: number, stops: readonly [number, string][]): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}
