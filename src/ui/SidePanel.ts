import type Phaser from 'phaser';
import { COLORS, LAYOUT } from '../config';
import { TOWER_ORDER } from '../core/data/towers';
import type { Simulation } from '../core/simulation';
import type { EnemyKind, TowerKind, TowerLevelStats, TowerState } from '../core/types';
import { DEPTH } from '../render/depth';
import { glowLine, lighten } from '../render/neon';
import { drawEnemyIcon, towerColor } from '../render/shapes';
import { Button } from './Button';
import { GOLD, num } from './strings';
import { makeText, setTextColor } from './text';
import { levelStats, nextLevelStats } from './towerStats';
import { CARD_HEIGHT, TowerCard } from './TowerCard';

// Sağ panel: KULELER kartları, seçili kule bilgisi (Yükselt / Sat), sıradaki dalganın önizlemesi ve ana dalga düğmesi.

// Panel içi yerleşim: her bölüm bir öncekinin altından hesaplanır.
const PAD = 14;
const X0 = LAYOUT.panelX + PAD;
const W = LAYOUT.panelWidth - PAD * 2;
const STAT_ROW = 19;
const ENEMY_ROW = 24;
const CARD_GAP = 8;
const INFO_BUTTON_H = 40;
const WAVE_BUTTON_H = 52;
const towersHeaderY = LAYOUT.panelY + 14;
const cardsY = towersHeaderY + 24;
const infoDividerY = cardsY + 3 * CARD_HEIGHT + 2 * CARD_GAP + 12;
const infoHeaderY = infoDividerY + 12;
const infoNameY = infoHeaderY + 22;
const infoStatsY = infoNameY + 28;
const infoButtonsY = infoStatsY + 4 * STAT_ROW + 6;
const waveDividerY = infoButtonsY + INFO_BUTTON_H + 12;
const waveHeaderY = waveDividerY + 12;
const waveRowsY = waveHeaderY + 26;
const waveButtonY = LAYOUT.panelY + LAYOUT.panelHeight - PAD - WAVE_BUTTON_H;
const Y = {
  towersHeader: towersHeaderY,
  cards: cardsY,
  infoDivider: infoDividerY,
  infoHeader: infoHeaderY,
  infoName: infoNameY,
  infoStats: infoStatsY,
  infoButtons: infoButtonsY,
  waveDivider: waveDividerY,
  waveHeader: waveHeaderY,
  waveRows: waveRowsY,
  waveButton: waveButtonY,
} as const;

const ENEMY_ORDER: readonly EnemyKind[] = ['runner', 'scout', 'brute'];

export interface PanelModel {
  gold: number;
  placing: TowerKind | null;
  selected: TowerState | null;
  upgradeCost: number | null;
  sellValue: number;
  /** Duraklatılmış ya da oyun bitmiş: oyun eylemleri kapalı. */
  locked: boolean;
  preview: { wave: number; counts: Partial<Record<EnemyKind, number>> } | null;
  totalWaves: number;
  waveButton: { label: string; enabled: boolean };
}

export interface PanelHandlers {
  onPickTower: (kind: TowerKind) => void;
  onUpgrade: () => void;
  onSell: () => void;
  onWave: () => void;
}

interface StatRow {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  next: Phaser.GameObjects.Text;
}

interface EnemyRow {
  icon: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
}

export class SidePanel {
  private readonly cards = new Map<TowerKind, TowerCard>();
  private readonly infoHeader: Phaser.GameObjects.Text;
  private readonly infoName: Phaser.GameObjects.Text;
  private readonly infoLevel: Phaser.GameObjects.Text;
  private readonly infoEmpty: Phaser.GameObjects.Text;
  private readonly infoNote: Phaser.GameObjects.Text;
  private readonly stats: StatRow[] = [];
  private readonly upgradeButton: Button;
  private readonly sellButton: Button;
  private readonly waveHeader: Phaser.GameObjects.Text;
  private readonly waveCounter: Phaser.GameObjects.Text;
  private readonly waveEmpty: Phaser.GameObjects.Text;
  private readonly enemyRows: EnemyRow[] = [];
  private readonly waveButton: Button;
  private infoKey = '';
  private previewKey = '';

  constructor(
    scene: Phaser.Scene,
    private readonly sim: Simulation,
    handlers: PanelHandlers,
  ) {
    const container = scene.add.container(0, 0).setDepth(DEPTH.ui);
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.panel, 1);
    bg.fillRect(LAYOUT.panelX, LAYOUT.panelY, LAYOUT.panelWidth, LAYOUT.panelHeight);
    glowLine(bg, LAYOUT.panelX + 0.5, LAYOUT.panelY, LAYOUT.panelX + 0.5, LAYOUT.panelY + LAYOUT.panelHeight, COLORS.pathEdge, {
      width: 1,
      alpha: 0.45,
      glow: 0.6,
    });
    for (const y of [Y.infoDivider, Y.waveDivider]) {
      bg.lineStyle(1, COLORS.panelBorder, 1);
      bg.lineBetween(X0, y + 0.5, X0 + W, y + 0.5);
    }
    container.add(bg);
    container.add(header(scene, Y.towersHeader, 'KULELER'));

    TOWER_ORDER.forEach((kind, i) => {
      const card = new TowerCard(scene, X0, Y.cards + i * (CARD_HEIGHT + CARD_GAP), W, sim.towerDefs[kind], () => handlers.onPickTower(kind));
      container.add(card.container);
      this.cards.set(kind, card);
    });

    // Seçili kule bilgisi.
    this.infoHeader = header(scene, Y.infoHeader, 'SEÇİLİ KULE');
    this.infoName = makeText(scene, X0, Y.infoName, '', { size: 18, bold: true });
    this.infoLevel = makeText(scene, X0 + W, Y.infoName + 3, '', { size: 13, bold: true, color: COLORS.textDim }).setOrigin(1, 0);
    this.infoEmpty = makeText(scene, X0, Y.infoName + 2, 'Bilgilerini görmek ve yükseltmek için haritada bir kuleye tıkla.', {
      size: 14,
      color: COLORS.textDim,
      wrap: W,
      lineSpacing: 4,
    });
    this.infoNote = makeText(scene, X0 + W / 2, Y.infoButtons + INFO_BUTTON_H / 2, '', { size: 13, color: COLORS.textDim, align: 'center', wrap: W }).setOrigin(0.5);
    container.add([this.infoHeader, this.infoName, this.infoLevel, this.infoEmpty, this.infoNote]);
    for (let i = 0; i < 4; i++) {
      const y = Y.infoStats + i * STAT_ROW;
      const row: StatRow = {
        label: makeText(scene, X0, y, '', { size: 14, color: COLORS.textDim }),
        value: makeText(scene, X0 + W, y, '', { size: 14, bold: true }).setOrigin(1, 0),
        next: makeText(scene, X0 + W, y, '', { size: 14, bold: true, color: COLORS.valid }).setOrigin(1, 0),
      };
      container.add([row.label, row.value, row.next]);
      this.stats.push(row);
    }
    const half = (W - 8) / 2;
    this.upgradeButton = new Button(scene, {
      x: X0,
      y: Y.infoButtons,
      width: half + 14,
      height: INFO_BUTTON_H,
      label: 'Yükselt',
      hotkey: 'U',
      fontSize: 15,
      color: COLORS.valid,
      onClick: handlers.onUpgrade,
    });
    this.sellButton = new Button(scene, {
      x: X0 + half + 22,
      y: Y.infoButtons,
      width: half - 14,
      height: INFO_BUTTON_H,
      label: 'Sat',
      hotkey: 'S',
      fontSize: 15,
      color: COLORS.gold,
      onClick: handlers.onSell,
    });
    container.add([this.upgradeButton.container, this.sellButton.container]);

    // Sıradaki dalga.
    this.waveHeader = header(scene, Y.waveHeader, 'SIRADAKİ DALGA');
    this.waveCounter = makeText(scene, X0 + W, Y.waveHeader, '', { size: 13, bold: true, color: COLORS.textDim }).setOrigin(1, 0);
    this.waveEmpty = makeText(scene, X0, Y.waveRows, 'Bütün dalgalar yola çıktı. Kaleyi son düşmana kadar koru!', {
      size: 14,
      color: COLORS.textDim,
      wrap: W,
      lineSpacing: 4,
    });
    container.add([this.waveHeader, this.waveCounter, this.waveEmpty]);
    for (let i = 0; i < ENEMY_ORDER.length; i++) {
      const y = Y.waveRows + i * ENEMY_ROW;
      const row: EnemyRow = {
        icon: scene.add.graphics(),
        name: makeText(scene, X0 + 28, y, '', { size: 15 }).setOrigin(0, 0.5),
        hp: makeText(scene, X0 + W - 64, y, '', { size: 13, color: COLORS.textDim }).setOrigin(1, 0.5),
        count: makeText(scene, X0 + W, y, '', { size: 15, bold: true }).setOrigin(1, 0.5),
      };
      container.add([row.icon, row.name, row.hp, row.count]);
      this.enemyRows.push(row);
    }

    this.waveButton = new Button(scene, {
      x: X0,
      y: Y.waveButton,
      width: W,
      height: WAVE_BUTTON_H,
      label: '',
      fontSize: 18,
      variant: 'primary',
      color: COLORS.accent,
      onClick: handlers.onWave,
    });
    container.add(this.waveButton.container);
  }

  update(m: PanelModel): void {
    for (const kind of TOWER_ORDER) {
      this.cards.get(kind)?.update({
        affordable: m.gold >= this.sim.towerDefs[kind].levels[0].cost,
        active: m.placing === kind,
        enabled: !m.locked,
      });
    }
    this.updateInfo(m);
    this.updatePreview(m);
    this.waveButton.setLabel(m.waveButton.label).setEnabled(m.waveButton.enabled && !m.locked);
  }

  private updateInfo(m: PanelModel): void {
    const t = m.selected;
    if (t) {
      const def = this.sim.towerDefs[t.kind];
      const cur = levelStats(def, t.level);
      const next = nextLevelStats(def, t.level);
      const key = `sel:${t.id}:${t.level}`;
      if (key !== this.infoKey) {
        this.infoKey = key;
        this.showInfo('SEÇİLİ KULE', def.name, towerColor(t.kind), `Seviye ${t.level}/3`);
        this.fillStats(t.kind, cur, next);
      }
      this.infoNote.setVisible(false);
      this.upgradeButton.setVisible(true);
      this.sellButton.setVisible(true);
      if (m.upgradeCost === null) {
        this.upgradeButton.setLabel('En üst seviye').setCost(null).setEnabled(false);
      } else {
        this.upgradeButton
          .setLabel('Yükselt')
          .setCost(m.upgradeCost, m.gold >= m.upgradeCost)
          .setEnabled(!m.locked && m.gold >= m.upgradeCost);
      }
      this.sellButton.setCost(m.sellValue, true, '+').setEnabled(!m.locked);
      return;
    }

    this.upgradeButton.setVisible(false);
    this.sellButton.setVisible(false);
    if (m.placing) {
      const def = this.sim.towerDefs[m.placing];
      const key = `place:${m.placing}`;
      if (key !== this.infoKey) {
        this.infoKey = key;
        this.showInfo('YERLEŞTİRİLİYOR', def.name, def.color, `${def.levels[0].cost} ${GOLD}`);
        this.fillStats(m.placing, def.levels[0], undefined);
        this.infoNote.setText('Haritada yolun yanındaki boş bir karoya tıkla.');
      }
      this.infoNote.setVisible(true);
      return;
    }

    if (this.infoKey !== 'empty') {
      this.infoKey = 'empty';
      this.infoHeader.setText('SEÇİLİ KULE');
      this.infoName.setVisible(false);
      this.infoLevel.setVisible(false);
      this.infoEmpty.setVisible(true);
      for (const row of this.stats) setRowVisible(row, false);
    }
    this.infoNote.setVisible(false);
  }

  private showInfo(headerText: string, name: string, color: number, level: string): void {
    this.infoHeader.setText(headerText);
    this.infoName.setText(name).setVisible(true);
    setTextColor(this.infoName, lighten(color, 0.25));
    this.infoName.setShadow(0, 0, `#${color.toString(16).padStart(6, '0')}`, 8, false, true);
    this.infoLevel.setText(level).setVisible(true);
    this.infoEmpty.setVisible(false);
  }

  private fillStats(kind: TowerKind, cur: TowerLevelStats, next: TowerLevelStats | undefined): void {
    const rows: [string, string, string | null][] = [
      ['Hasar', num(cur.damage), next && next.damage !== cur.damage ? num(next.damage) : null],
      ['Menzil', `${num(cur.range)} karo`, next && next.range !== cur.range ? num(next.range) : null],
      [
        'Atış hızı',
        `${num(1 / cur.fireInterval)}/sn`,
        next && next.fireInterval !== cur.fireInterval ? `${num(1 / next.fireInterval)}/sn` : null,
      ],
    ];
    if (kind === 'cannon' && cur.splashRadius !== undefined) {
      rows.push(['Patlama alanı', `${num(cur.splashRadius, 2)} karo`, next?.splashRadius !== undefined && next.splashRadius !== cur.splashRadius ? num(next.splashRadius, 2) : null]);
    } else if (kind === 'frost' && cur.slowFactor !== undefined) {
      const slow = (f: number, d: number | undefined): string => `%${Math.round((1 - f) * 100)} · ${num(d ?? 0)} sn`;
      rows.push(['Yavaşlatma', slow(cur.slowFactor, cur.slowDuration), next?.slowFactor !== undefined ? `%${Math.round((1 - next.slowFactor) * 100)}` : null]);
    } else {
      rows.push(['Saldırı', 'Anında ışın, tek hedef', null]);
    }
    rows.forEach(([label, value, nextValue], i) => {
      const row = this.stats[i];
      if (!row) return;
      setRowVisible(row, true);
      row.label.setText(label);
      row.next.setText(nextValue ? `→ ${nextValue}` : '');
      row.value.setText(value);
      row.value.setX(nextValue ? X0 + W - row.next.width - 8 : X0 + W);
    });
  }

  private updatePreview(m: PanelModel): void {
    const p = m.preview;
    const key = p ? `${p.wave}` : 'none';
    if (key === this.previewKey) return;
    this.previewKey = key;
    if (!p) {
      this.waveCounter.setText(`${m.totalWaves}/${m.totalWaves}`);
      this.waveEmpty.setVisible(true);
      for (const row of this.enemyRows) setEnemyRowVisible(row, false);
      return;
    }
    this.waveEmpty.setVisible(false);
    this.waveCounter.setText(`Dalga ${p.wave}/${m.totalWaves}`);
    let i = 0;
    for (const kind of ENEMY_ORDER) {
      const count = p.counts[kind];
      if (!count) continue;
      const row = this.enemyRows[i++];
      if (!row) break;
      const def = this.sim.enemyDefs[kind];
      const y = Y.waveRows + (i - 1) * ENEMY_ROW;
      setEnemyRowVisible(row, true);
      row.icon.clear();
      drawEnemyIcon(row.icon, kind, X0 + 10, y, Math.max(6, def.radius * 26));
      row.name.setText(def.name);
      row.hp.setText(`can ${this.sim.enemyMaxHp(kind, p.wave)}${def.armor ? ` · zırh ${def.armor}` : ''}`);
      row.count.setText(`× ${count}`);
      setTextColor(row.count, lighten(def.color, 0.3));
    }
    for (; i < this.enemyRows.length; i++) setEnemyRowVisible(this.enemyRows[i]!, false);
  }
}

function header(scene: Phaser.Scene, y: number, label: string): Phaser.GameObjects.Text {
  return makeText(scene, X0, y, label, { size: 13, bold: true, color: COLORS.textDim, letterSpacing: 2 });
}

function setRowVisible(row: StatRow, visible: boolean): void {
  row.label.setVisible(visible);
  row.value.setVisible(visible);
  row.next.setVisible(visible);
}

function setEnemyRowVisible(row: EnemyRow, visible: boolean): void {
  row.icon.setVisible(visible);
  row.name.setVisible(visible);
  row.hp.setVisible(visible);
  row.count.setVisible(visible);
}
