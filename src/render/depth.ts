// Çizim katmanlarının sırası (büyük olan üstte).
export const DEPTH = {
  mapBase: 0,
  mapFlow: 1,
  mapMarkers: 2,
  underlay: 5,
  towers: 10,
  enemies: 11,
  projectiles: 12,
  effects: 13,
  particles: 14,
  floatText: 15,
  ghost: 16,
  banner: 17,
  edgeFlash: 18,
  ui: 100,
  overlay: 200,
} as const;
