import type Phaser from 'phaser';

// Tıklanabilir dikdörtgen alan: üstüne gelme / basılı / devre dışı durumlarını izler ve değişince haber verir.
// Düğme ve kule kartı bunu kullanır. Tıklama, alanın içinde basılıp bırakılınca sayılır.

export class Hotspot {
  readonly zone: Phaser.GameObjects.Zone;
  hover = false;
  pressed = false;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    private readonly onChange: () => void,
    private readonly onClick: () => void,
  ) {
    this.zone = scene.add.zone(x, y, width, height).setOrigin(0, 0);
    this.zone.setInteractive({ useHandCursor: true });
    parent.add(this.zone);
    this.zone.on('pointerover', () => this.set(true, this.pressed));
    this.zone.on('pointerout', () => this.set(false, false));
    this.zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || !this.enabled) return;
      this.set(true, true);
    });
    this.zone.on('pointerup', () => {
      const fire = this.pressed && this.enabled;
      this.set(this.hover, false);
      if (fire) this.onClick();
    });
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (this.zone.input) this.zone.input.cursor = enabled ? 'pointer' : 'default';
    if (!enabled) this.pressed = false;
    this.onChange();
  }

  private set(hover: boolean, pressed: boolean): void {
    if (hover === this.hover && pressed === this.pressed) return;
    this.hover = hover;
    this.pressed = pressed;
    this.onChange();
  }
}
