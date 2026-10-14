import type { RulesConfig } from '../types';

export const RULES: RulesConfig = {
  startingGold: 160,
  startingLives: 20,
  sellRefund: 0.7,
  waveBonusBase: 15,
  waveBonusPerWave: 3,
  earlyCallBonus: 10,
  /** Geç dalgalar oyuncunun büyüyen kule gücüne yetişsin diye dik: 10. dalgada can ×5.95. */
  hpGrowthPerWave: 0.55,
  threeStarLives: 18,
  twoStarLives: 10,
};
