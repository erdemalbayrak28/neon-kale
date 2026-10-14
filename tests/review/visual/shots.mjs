// Görsel/UX incelemesi için ek ekran görüntüleri ve etkileşim denetimleri (Vitest testi değil; node ile çalışır).
// Çalıştırma: npm run build && node tests/review/visual/shots.mjs [bölüm...]
// Bölümler: desktop, busy, results, interact, sizes, mobile (boşsa hepsi).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PAGE_URL = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const SCREENS = process.env.SCREENS_DIR || path.join(HERE, 'screens');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const GAME_W = 1280;
const GAME_H = 720;

const results = [];
function note(name, value) {
  results.push({ name, value });
  console.log(`  • ${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

async function toPage(page, x, y) {
  const box = await page.locator('canvas').boundingBox();
  return { x: box.x + (x * box.width) / GAME_W, y: box.y + (y * box.height) / GAME_H };
}
async function clickGame(page, x, y, opts = {}) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y, opts);
}
async function hoverGame(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y);
}
async function frames(page, n = 2) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => (++i >= count ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}
async function shot(page, name, clip) {
  const file = path.join(SCREENS, `${name}.png`);
  if (clip) {
    const a = await toPage(page, clip.x, clip.y);
    const b = await toPage(page, clip.x + clip.w, clip.y + clip.h);
    await page.screenshot({ path: file, clip: { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y } });
  } else {
    await page.screenshot({ path: file });
  }
  console.log(`  görüntü: ${path.relative(ROOT, file)}`);
}
const st = (page) => page.evaluate(() => window.__neonKale.state());
const sceneInfo = (page) =>
  page.evaluate(() => {
    const s = window.__neonKale.game.scene.getScene('game');
    return { placing: s.placing, selectedId: s.selectedId, paused: s.paused, speed: s.speed, active: window.__neonKale.scene() };
  });

async function settle(page) {
  await page.waitForFunction(
    () => {
      const scene = window.__neonKale.game.scene.getScenes(true)[0];
      return Boolean(scene) && !scene.cameras.main.fadeEffect.isRunning;
    },
    null,
    { timeout: 15000 },
  );
  await frames(page, 3);
}
async function waitForResult(page) {
  await page.waitForFunction(
    () => {
      const r = window.__neonKale.game.scene.getScene('game').result;
      return r.visible && r.container.alpha >= 0.99 && Math.abs(r.window.scale - 1) < 0.01;
    },
    null,
    { timeout: 30000 },
  );
  await frames(page, 2);
}
async function openGame(browser, viewport, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  const page = await context.newPage();
  page.on('pageerror', (e) => note('SAYFA HATASI', e.message));
  page.on('console', (m) => m.type() === 'error' && note('KONSOL HATASI', m.text()));
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__neonKale && window.__neonKale.scene() === 'menu', null, { timeout: 15000 });
  await settle(page);
  return { context, page };
}
async function startGame(page) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__neonKale.scene() === 'game' && window.__neonKale.sim() !== null, null, { timeout: 8000 });
  await settle(page);
}
const tileScreen = (page, col, row) => page.evaluate(([c, r]) => window.__neonKale.tileToScreen(c, r), [col, row]);

/** Kanca ile altın verir (özel alan; sadece ekran görüntüsü kurmak için). */
const giveGold = (page, gold) => page.evaluate((g) => (window.__neonKale.sim().gold = g), gold);

/** Kanca ile güçlü bir savunma kurar: yolun kıvrımlarına karışık kuleler. */
function buildDefense(page, layout) {
  return page.evaluate((list) => {
    const sim = window.__neonKale.sim();
    for (const [kind, col, row, level] of list) {
      const r = sim.build(kind, { col, row });
      if (!r.ok) continue;
      const t = sim.towerAt({ col, row });
      for (let l = 1; l < level; l++) sim.upgrade(t.id);
    }
    window.__neonKale.fastForward(0.02);
    return sim.state.towers.length;
  }, layout);
}

const DEFENSE = [
  ['frost', 5, 5, 3],
  ['cannon', 3, 5, 3],
  ['laser', 5, 8, 3],
  ['cannon', 8, 6, 3],
  ['frost', 10, 6, 3],
  ['laser', 8, 4, 3],
  ['cannon', 13, 5, 3],
  ['laser', 15, 7, 3],
  ['frost', 13, 8, 2],
  ['cannon', 16, 9, 3],
  ['laser', 18, 7, 2],
  ['cannon', 6, 10, 2],
  ['laser', 10, 2, 2],
  ['laser', 3, 1, 1],
];

// ── bölümler ────────────────────────────────────────────────

async function desktop(browser) {
  console.log('\n[desktop] kart, hayalet, dalga düğmesi, seviye 3');
  const { context, page } = await openGame(browser, { width: 1280, height: 720 });
  await startGame(page);

  // Kart üstüne gelme.
  await hoverGame(page, 1110, 209);
  await frames(page, 3);
  await shot(page, 'v01-card-hover');
  await shot(page, 'v01b-card-hover-crop', { x: 960, y: 64, w: 320, h: 270 });

  // İki lazer kur (gerçek tıklama) → 60 altın: top (80) ve buz (70) alınamaz.
  for (const [c, r] of [
    [5, 5],
    [8, 6],
  ]) {
    await page.keyboard.press('1');
    const t = await tileScreen(page, c, r);
    await clickGame(page, t.x, t.y);
    await frames(page, 2);
  }
  await page.mouse.move(5, 5);
  await frames(page, 3);
  note('iki lazerden sonra altın', (await st(page)).gold);
  await shot(page, 'v02-unaffordable');
  await shot(page, 'v02b-unaffordable-crop', { x: 960, y: 64, w: 320, h: 270 });

  // Alınamayan karta gelme.
  await hoverGame(page, 1110, 209);
  await frames(page, 3);
  await shot(page, 'v02c-unaffordable-hover-crop', { x: 960, y: 64, w: 320, h: 270 });

  // Yol üstünde kırmızı hayalet.
  await page.keyboard.press('1');
  const p = await tileScreen(page, 4, 5);
  await hoverGame(page, p.x, p.y);
  await frames(page, 3);
  await shot(page, 'v03-ghost-on-path');
  await shot(page, 'v03b-ghost-on-path-crop', { x: 60, y: 200, w: 320, h: 260 });
  // Kristal karosu.
  const k = await tileScreen(page, 7, 5);
  await hoverGame(page, k.x, k.y);
  await frames(page, 3);
  await shot(page, 'v03c-ghost-on-crystal-crop', { x: 220, y: 200, w: 320, h: 260 });
  // Dolu karo (kurulu kule).
  const o = await tileScreen(page, 5, 5);
  await hoverGame(page, o.x, o.y);
  await frames(page, 3);
  await shot(page, 'v03d-ghost-on-tower-crop', { x: 100, y: 200, w: 320, h: 260 });
  // Altın yetmeyen top hayaleti, geçerli karo.
  await page.keyboard.press('2');
  const v = await tileScreen(page, 6, 7);
  await hoverGame(page, v.x, v.y);
  await frames(page, 3);
  await shot(page, 'v04-ghost-no-gold');
  await page.keyboard.press('Escape');

  // Dalga düğmesinin üç durumu.
  await page.mouse.move(5, 5);
  await frames(page, 2);
  const waveClip = { x: 960, y: 520, w: 320, h: 200 };
  await shot(page, 'v05a-wave-start-crop', waveClip);
  await page.keyboard.press('Space');
  await frames(page, 3);
  await shot(page, 'v05b-wave-running-crop', waveClip);
  await page.evaluate(() => {
    const h = window.__neonKale;
    for (let i = 0; i < 40 && !h.state().spawningDone; i++) h.fastForward(0.5);
  });
  await frames(page, 3);
  note('erken çağırma anında durum', await page.evaluate(() => ({ s: window.__neonKale.state().status, d: window.__neonKale.state().spawningDone })));
  await shot(page, 'v05c-wave-early-crop', waveClip);
  await shot(page, 'v05d-wave-early-full');
  // Son dalgada: başka dalga yok.
  await page.evaluate(() => {
    const h = window.__neonKale;
    for (let i = 0; i < 400 && h.state().status === 'wave'; i++) h.fastForward(0.5);
  });

  // Seviye 3 kule seçili.
  await giveGold(page, 5000);
  const s0 = await tileScreen(page, 5, 5);
  await clickGame(page, s0.x, s0.y);
  await page.keyboard.press('u');
  await frames(page, 2);
  await page.keyboard.press('u');
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__neonKale.fastForward(0.6));
  await frames(page, 3);
  note('seçili kule seviyesi', await page.evaluate(() => {
    const s = window.__neonKale.game.scene.getScene('game');
    return window.__neonKale.sim().towerById(s.selectedId)?.level;
  }));
  await shot(page, 'v06-level3-selected');
  await shot(page, 'v06b-level3-panel-crop', { x: 960, y: 320, w: 320, h: 220 });

  // Top 2. seviye ve buz 1. seviye bilgi satırları.
  await page.keyboard.press('2');
  const c1 = await tileScreen(page, 3, 5);
  await clickGame(page, c1.x, c1.y);
  await clickGame(page, c1.x, c1.y);
  await page.keyboard.press('u');
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__neonKale.fastForward(0.6));
  await frames(page, 3);
  await shot(page, 'v07-cannon-l2-panel-crop', { x: 960, y: 320, w: 320, h: 220 });
  await page.keyboard.press('3');
  const f1 = await tileScreen(page, 10, 6);
  await clickGame(page, f1.x, f1.y);
  await clickGame(page, f1.x, f1.y);
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__neonKale.fastForward(0.6));
  await frames(page, 3);
  await shot(page, 'v08-frost-l1-panel-crop', { x: 960, y: 320, w: 320, h: 220 });
  await page.keyboard.press('u');
  await page.keyboard.press('u');
  await page.evaluate(() => window.__neonKale.fastForward(0.6));
  await frames(page, 3);
  await shot(page, 'v08b-frost-l3-panel-crop', { x: 960, y: 320, w: 320, h: 220 });
  // Yükselt düğmesinin üstüne gel (en üst seviye) ve Sat'ın üstüne gel.
  await hoverGame(page, 1050, 492);
  await frames(page, 2);
  await shot(page, 'v08c-maxed-upgrade-hover-crop', { x: 960, y: 320, w: 320, h: 220 });

  // Hız düğmesi 2x ve üst çubuk.
  await clickGame(page, 1172, 32);
  await page.mouse.move(5, 5);
  await frames(page, 3);
  await shot(page, 'v09-topbar-2x-crop', { x: 0, y: 0, w: 1280, h: 64 });
  await context.close();
}

async function busy(browser) {
  console.log('\n[busy] geç dalga, 2x');
  const { context, page } = await openGame(browser, { width: 1280, height: 720 });
  await startGame(page);
  await giveGold(page, 4000);
  // Daha kalabalık bir sahne için orta güçte savunma: düşmanlar yolda birikir.
  const MID = DEFENSE.map(([k, c, r, l]) => [k, c, r, Math.min(l, 2)]).slice(0, 10);
  note('kurulan kule', await buildDefense(page, MID));
  // 8 dalgayı hızla geç.
  const reached = await page.evaluate(() => {
    const h = window.__neonKale;
    const sim = h.sim();
    for (let w = 0; w < 8; w++) {
      sim.startNextWave();
      for (let i = 0; i < 600 && h.state().status === 'wave'; i++) h.fastForward(0.5);
    }
    sim.gold = 0;
    return { wave: sim.state.wavesStarted, status: sim.state.status, lives: sim.state.lives };
  });
  note('8 dalga sonrası', reached);
  // 9. dalga: 2x.
  await page.keyboard.press('f');
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__neonKale.fastForward(6));
  await frames(page, 6);
  note('9. dalga 6 sn', await page.evaluate(() => ({ e: window.__neonKale.state().enemies.length, p: window.__neonKale.state().projectiles.length, fps: Math.round(window.__neonKale.game.loop.actualFps) })));
  await shot(page, 'v10-busy-wave9-2x');
  await page.evaluate(() => window.__neonKale.fastForward(4));
  await frames(page, 4);
  await shot(page, 'v10b-busy-wave9-2x-later');
  // Erken çağır: 10. dalga üst üste.
  await page.evaluate(() => {
    const h = window.__neonKale;
    for (let i = 0; i < 80 && !h.state().spawningDone; i++) h.fastForward(0.25);
  });
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__neonKale.fastForward(5));
  await frames(page, 4);
  note('10. dalga üst üste', await page.evaluate(() => ({ e: window.__neonKale.state().enemies.length, lives: window.__neonKale.state().lives })));
  await shot(page, 'v11-busy-wave10-overlap');
  // Seçili bir kule ile kalabalık sahne.
  const sel = await tileScreen(page, 8, 6);
  await clickGame(page, sel.x, sel.y);
  await page.mouse.move(5, 5);
  await page.evaluate(() => window.__neonKale.fastForward(1.5));
  await frames(page, 3);
  await shot(page, 'v11b-busy-selected');
  await context.close();
}

async function resultsSection(browser) {
  console.log('\n[results] zafer (3 ve 1 yıldız), yenilgi');
  // 3 yıldız.
  {
    const { context, page } = await openGame(browser, { width: 1280, height: 720 });
    await startGame(page);
    await giveGold(page, 6000);
    await buildDefense(page, DEFENSE);
    const end = await page.evaluate(() => {
      const h = window.__neonKale;
      const sim = h.sim();
      for (let i = 0; i < 3000; i++) {
        const s = sim.state;
        if (s.status === 'victory' || s.status === 'defeat') break;
        if (s.status === 'building') sim.startNextWave();
        h.fastForward(1);
      }
      return { status: sim.state.status, stars: sim.state.stars, lives: sim.state.lives };
    });
    note('zafer denemesi', end);
    await waitForResult(page);
    await shot(page, 'v12-victory-3stars');
    await context.close();
  }
  // 1 yıldız: son dalgadan önce can 5'e indirilir.
  {
    const { context, page } = await openGame(browser, { width: 1280, height: 720 });
    await startGame(page);
    await giveGold(page, 6000);
    await buildDefense(page, DEFENSE);
    const end = await page.evaluate(() => {
      const h = window.__neonKale;
      const sim = h.sim();
      for (let i = 0; i < 3000; i++) {
        const s = sim.state;
        if (s.status === 'victory' || s.status === 'defeat') break;
        if (s.status === 'building') {
          if (s.wavesStarted === 9) sim.lives = 3;
          sim.startNextWave();
        }
        h.fastForward(1);
      }
      return { status: sim.state.status, stars: sim.state.stars, lives: sim.state.lives };
    });
    note('1 yıldız denemesi', end);
    await waitForResult(page);
    await shot(page, 'v13-victory-1star');
    await context.close();
  }
  // Yenilgi.
  {
    const { context, page } = await openGame(browser, { width: 1280, height: 720 });
    await startGame(page);
    const lazer = await tileScreen(page, 5, 5);
    await page.keyboard.press('1');
    await clickGame(page, lazer.x, lazer.y);
    const end = await page.evaluate(() => {
      const h = window.__neonKale;
      const sim = h.sim();
      for (let i = 0; i < 3000; i++) {
        const s = sim.state;
        if (s.status === 'victory' || s.status === 'defeat') break;
        if (s.status === 'building' || s.spawningDone) sim.startNextWave();
        h.fastForward(0.5);
      }
      return { status: sim.state.status, waves: sim.state.wavesStarted, lives: sim.state.lives };
    });
    note('yenilgi denemesi', end);
    await waitForResult(page);
    await shot(page, 'v14-defeat');
    await shot(page, 'v14b-defeat-window-crop', { x: 220, y: 200, w: 520, h: 360 });
    // Yazının pencereye sığıp sığmadığı.
    note(
      'yenilgi alt yazısı genişliği / pencere',
      await page.evaluate(() => {
        const r = window.__neonKale.game.scene.getScene('game').result;
        return { subtitle: Math.round(r.subtitle.width), window: 480 };
      }),
    );
    await context.close();
  }
}

async function interact(browser) {
  console.log('\n[interact] düğmeler, sağ tık, Esc, kısayollar, yeniden başlatma, ana menü');
  const { context, page } = await openGame(browser, { width: 1280, height: 720 });
  await startGame(page);

  // Hız ve duraklatma düğmeleri.
  await clickGame(page, 1172, 32);
  note('hız düğmesi tıklandı → hız', (await sceneInfo(page)).speed);
  await clickGame(page, 1172, 32);
  note('hız düğmesi tekrar → hız', (await sceneInfo(page)).speed);
  await clickGame(page, 1242, 32);
  await frames(page, 2);
  note('duraklat düğmesi → paused', (await sceneInfo(page)).paused);
  await clickGame(page, 480, 439); // Devam et
  await frames(page, 2);
  note('"Devam et" → paused', (await sceneInfo(page)).paused);

  // Kart tıklaması, sağ tık iptali.
  await clickGame(page, 1110, 135);
  note('lazer kartı tıklandı → placing', (await sceneInfo(page)).placing);
  const tt = await tileScreen(page, 6, 7);
  await clickGame(page, tt.x, tt.y, { button: 'right' });
  note('sağ tık → placing', (await sceneInfo(page)).placing);
  await page.keyboard.press('2');
  await page.keyboard.press('Escape');
  note('2 + Esc → placing', (await sceneInfo(page)).placing);
  await page.keyboard.press('3');
  await page.keyboard.press('3');
  note('3 + 3 → placing (aç/kapa)', (await sceneInfo(page)).placing);

  // Shift ile art arda kurma.
  await page.keyboard.press('1');
  await page.keyboard.down('Shift');
  for (const [c, r] of [
    [5, 5],
    [8, 6],
  ]) {
    const t = await tileScreen(page, c, r);
    await clickGame(page, t.x, t.y);
  }
  await page.keyboard.up('Shift');
  note('Shift ile iki kurma → kule / placing', { towers: (await st(page)).towers.length, placing: (await sceneInfo(page)).placing });
  await page.keyboard.press('Escape');

  // Seçim, Esc, sağ tık, boş karo.
  const a = await tileScreen(page, 5, 5);
  await clickGame(page, a.x, a.y);
  note('kuleye tıklandı → selectedId', (await sceneInfo(page)).selectedId);
  await page.keyboard.press('Escape');
  note('Esc → selectedId', (await sceneInfo(page)).selectedId);
  await clickGame(page, a.x, a.y);
  await clickGame(page, tt.x, tt.y, { button: 'right' });
  note('seçiliyken sağ tık → selectedId', (await sceneInfo(page)).selectedId);
  await clickGame(page, a.x, a.y);
  await page.keyboard.press('p');
  await page.keyboard.press('Escape');
  const afterEsc1 = await sceneInfo(page);
  await page.keyboard.press('Escape');
  const afterEsc2 = await sceneInfo(page);
  note('seçili + P + Esc + Esc', { esc1: { sel: afterEsc1.selectedId, paused: afterEsc1.paused }, esc2: { sel: afterEsc2.selectedId, paused: afterEsc2.paused } });

  // Panel düğmeleri: Yükselt / Sat (gerçek tıklama).
  await clickGame(page, a.x, a.y);
  const g0 = (await st(page)).gold;
  await clickGame(page, 1050, 492);
  const afterUp = await st(page);
  note('Yükselt düğmesi', { gold: `${g0} → ${afterUp.gold}`, level: afterUp.towers.find((t) => t.tile.col === 5)?.level });

  // Kuyruk: yeniden başlatma sonrası çift dinleyici. Hızlı yenilgi → Tekrar oyna ×3.
  async function loseQuickly() {
    await page.evaluate(() => {
      const h = window.__neonKale;
      const sim = h.sim();
      for (let i = 0; i < 3000; i++) {
        const s = sim.state;
        if (s.status === 'defeat' || s.status === 'victory') break;
        if (s.status === 'building' || s.spawningDone) sim.startNextWave();
        h.fastForward(0.5);
      }
    });
    await waitForResult(page);
  }
  async function verifyFreshGame(label) {
    const listeners = await page.evaluate(() => {
      const g = window.__neonKale.game.scene.getScene('game');
      const m = window.__neonKale.game.scene.getScene('menu');
      return {
        keydown: g.input.keyboard.listenerCount('keydown'),
        pointermove: g.input.listenerCount('pointermove'),
        pointerdown: g.input.listenerCount('pointerdown'),
        shutdown: g.sys.events.listenerCount('shutdown'),
        menuKeydown: m.input?.keyboard?.listenerCount('keydown') ?? null,
      };
    });
    await page.keyboard.press('1');
    const t = await tileScreen(page, 6, 7);
    await clickGame(page, t.x, t.y);
    await frames(page, 2);
    const built = await st(page);
    await clickGame(page, t.x, t.y);
    await page.keyboard.press('u');
    await frames(page, 2);
    const up = await st(page);
    await page.keyboard.press('f');
    const sp = (await sceneInfo(page)).speed;
    await page.keyboard.press('p');
    const pa = (await sceneInfo(page)).paused;
    await page.keyboard.press('p');
    await page.keyboard.press('s');
    await frames(page, 2);
    const sold = await st(page);
    await page.keyboard.press('Space');
    await frames(page, 2);
    const wv = await st(page);
    note(`${label}`, {
      listeners,
      afterBuild: { towers: built.towers.length, gold: built.gold },
      afterU: { level: up.towers[0]?.level, gold: up.gold },
      speedAfterF: sp,
      pausedAfterP: pa,
      afterS: { towers: sold.towers.length, gold: sold.gold },
      wavesAfterSpace: wv.wavesStarted,
    });
  }

  for (let i = 1; i <= 3; i++) {
    await loseQuickly();
    await clickGame(page, 372, 490); // Tekrar oyna
    await page.waitForFunction(() => window.__neonKale.state()?.wavesStarted === 0, null, { timeout: 8000 });
    await settle(page);
    await verifyFreshGame(`Tekrar oyna #${i} sonrası`);
  }

  // Enter ile tekrar oyna.
  await loseQuickly();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__neonKale.state()?.wavesStarted === 0, null, { timeout: 8000 });
  await settle(page);
  await verifyFreshGame('Enter ile tekrar oyna sonrası');

  // Ana menü → Oyna (iki tur).
  for (let i = 1; i <= 2; i++) {
    await loseQuickly();
    await clickGame(page, 596, 490); // Ana menü
    await page.waitForFunction(() => window.__neonKale.scene() === 'menu', null, { timeout: 8000 });
    await settle(page);
    if (i === 1) await clickGame(page, 640, 300);
    else await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__neonKale.scene() === 'game' && window.__neonKale.sim() !== null, null, { timeout: 8000 });
    await settle(page);
    await verifyFreshGame(`Ana menü → Oyna #${i} sonrası`);
  }

  // Ana menü tıklayıp hemen Enter: hangi sahne?
  await loseQuickly();
  await clickGame(page, 596, 490);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await frames(page, 3);
  note('Ana menü + hemen Enter → etkin sahne', await page.evaluate(() => window.__neonKale.scene()));
  await context.close();
}

async function sizes(browser) {
  console.log('\n[sizes] 1366×768, 1920×1080');
  for (const [w, h] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    const { context, page } = await openGame(browser, { width: w, height: h });
    await shot(page, `v20-${w}-menu`);
    await startGame(page);
    await giveGold(page, 4000);
    await buildDefense(page, DEFENSE.slice(0, 9));
    await page.evaluate(() => {
      const h = window.__neonKale;
      const sim = h.sim();
      for (let wv = 0; wv < 6; wv++) {
        sim.startNextWave();
        for (let i = 0; i < 600 && h.state().status === 'wave'; i++) h.fastForward(0.5);
      }
      sim.gold = 40;
      sim.startNextWave();
      h.fastForward(5);
    });
    const sel = await tileScreen(page, 5, 5);
    await clickGame(page, sel.x, sel.y);
    await page.mouse.move(3, 3);
    await page.evaluate(() => window.__neonKale.fastForward(0.4));
    await frames(page, 4);
    await shot(page, `v21-${w}-midwave-selected`);
    note(`${w}×${h} tuval`, await page.locator('canvas').boundingBox());
    await context.close();
  }
}

async function mobile(browser) {
  console.log('\n[mobile] 844×390 dokunma');
  const { context, page } = await openGame(
    browser,
    { width: 844, height: 390 },
    { deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  );
  await shot(page, 'v30-mobile-menu');
  const play = await toPage(page, 640, 300);
  await page.touchscreen.tap(play.x, play.y);
  await page.waitForFunction(() => window.__neonKale.scene() === 'game' && window.__neonKale.sim() !== null, null, { timeout: 8000 });
  await settle(page);
  const box = await page.locator('canvas').boundingBox();
  const scale = box.width / GAME_W;
  const css = (w, h) => `${(w * scale).toFixed(1)}×${(h * scale).toFixed(1)} CSS px`;
  note('telefon ölçeği', scale.toFixed(3));
  note('dokunma hedefleri', {
    karo: css(48, 48),
    kuleKarti: css(292, 66),
    yukselt: css(156, 40),
    sat: css(128, 40),
    hiz: css(64, 40),
    duraklat: css(52, 40),
    dalga: css(292, 52),
    ipucuYazisi: `${(14 * scale).toFixed(1)} px`,
    kartAciklama: `${(12 * scale).toFixed(1)} px`,
    istatistik: `${(14 * scale).toFixed(1)} px`,
  });
  // Lazer kartına dokun, yol karosuna dokun (geçersiz) → ipucu.
  const card = await toPage(page, 1110, 135);
  await page.touchscreen.tap(card.x, card.y);
  await frames(page, 2);
  await shot(page, 'v31-mobile-placing-hint');
  const pathTile = await tileScreen(page, 4, 5);
  const pp = await toPage(page, pathTile.x, pathTile.y);
  await page.touchscreen.tap(pp.x, pp.y);
  await frames(page, 2);
  await shot(page, 'v32-mobile-tap-on-path');
  note('yol karosuna dokunduktan sonra placing', (await sceneInfo(page)).placing);
  // Geçerli karoya dokun → kurulur.
  const ok = await tileScreen(page, 5, 5);
  const op = await toPage(page, ok.x, ok.y);
  await page.touchscreen.tap(op.x, op.y);
  await frames(page, 3);
  await shot(page, 'v33-mobile-after-build');
  // Karta yeniden dokun: haritaya henüz dokunulmadan hayalet görünüyor mu (eski dokunuşun karosunda)?
  await page.touchscreen.tap(card.x, card.y);
  await frames(page, 3);
  note('karta yeniden dokununca', await page.evaluate(() => {
    const s = window.__neonKale.game.scene.getScene('game');
    return { placing: s.placing, hoverTile: s.hoverTile, hint: s.hint.text.text };
  }));
  await shot(page, 'v33b-mobile-stale-ghost');
  // Dokunmatikte yerleştirmeden çıkmanın tek yolu karta yeniden dokunmak.
  await page.touchscreen.tap(card.x, card.y);
  await frames(page, 2);
  // Kuleye dokun → seçili; panel düğmeleri.
  await page.touchscreen.tap(op.x, op.y);
  await frames(page, 3);
  await shot(page, 'v34-mobile-selected');
  // Yükselt'e dokun (altın yetmiyor) ve Sat'a dokun.
  const sell = await toPage(page, 1180, 492);
  await page.touchscreen.tap(sell.x, sell.y);
  await frames(page, 3);
  note('Sat dokunuşu sonrası kule sayısı', (await st(page)).towers.length);
  await shot(page, 'v35-mobile-after-sell');
  await context.close();
}

/** Klavye olayları Phaser'da bir sonraki karede işlenir: her tuştan sonra kare bekleyerek okunur. */
async function keys(browser) {
  console.log('\n[keys] tuş başına kare bekleyerek kısayollar; erken çağrıda "DALGA TEMİZLENDİ"');
  const { context, page } = await openGame(browser, { width: 1280, height: 720 });
  await startGame(page);
  const press = async (k) => {
    await page.keyboard.press(k);
    await frames(page, 3);
    return sceneInfo(page);
  };
  const a = await tileScreen(page, 5, 5);
  await press('1');
  await clickGame(page, a.x, a.y);
  await frames(page, 2);
  await clickGame(page, a.x, a.y);
  await frames(page, 2);
  note('kuleye tıklandı → seçili', (await sceneInfo(page)).selectedId);
  const p1 = await press('p');
  const e1 = await press('Escape');
  const e2 = await press('Escape');
  note('seçili + P + Esc + Esc', {
    afterP: { sel: p1.selectedId, paused: p1.paused },
    esc1: { sel: e1.selectedId, paused: e1.paused },
    esc2: { sel: e2.selectedId, paused: e2.paused },
  });
  note('F → hız', (await press('f')).speed);
  note('F → hız', (await press('f')).speed);
  note('P → paused', (await press('p')).paused);
  note('P → paused', (await press('p')).paused);
  // Basılı tutma (tekrar) tek eylem yapmalı.
  await clickGame(page, a.x, a.y);
  await frames(page, 2);
  const g0 = (await st(page)).gold;
  await page.keyboard.down('u');
  for (let i = 0; i < 6; i++) await page.keyboard.down('u', { repeat: true }).catch(() => page.keyboard.down('u'));
  await page.keyboard.up('u');
  await frames(page, 3);
  const s1 = await st(page);
  note('U basılı tutuldu', { gold: `${g0} → ${s1.gold}`, level: s1.towers[0]?.level });

  // Erken çağrı: 1. dalganın düşmanları sahadayken 2. dalga çağrılır; 1. dalga temizlenince duyuru.
  await giveGold(page, 500);
  await page.evaluate(() => {
    const sim = window.__neonKale.sim();
    sim.build('laser', { col: 3, row: 3 });
    sim.build('laser', { col: 5, row: 7 });
  });
  await press('Space');
  await page.evaluate(() => {
    const h = window.__neonKale;
    for (let i = 0; i < 80 && !h.state().spawningDone; i++) h.fastForward(0.25);
  });
  await press('Space');
  // 1. dalganın temizlendiği adımı bul ve tam o anda dur.
  const cleared = await page.evaluate(() => {
    const h = window.__neonKale;
    const scene = h.game.scene.getScene('game');
    for (let i = 0; i < 2000; i++) {
      h.fastForward(1 / 60);
      if (scene.banner.title.visible && scene.banner.title.text === 'DALGA TEMİZLENDİ') {
        const s = h.state();
        return { enemiesOnField: s.enemies.length, status: s.status, wavesStarted: s.wavesStarted, banner: scene.banner.title.text };
      }
    }
    return null;
  });
  await frames(page, 2);
  note('erken çağrıdan sonra 1. dalga temizlenince', cleared);
  await shot(page, 'v16-cleared-banner-while-wave2-on-field');
  await context.close();
}

const SECTIONS = { desktop, busy, results: resultsSection, interact, sizes, mobile, keys };

async function main() {
  await mkdir(SCREENS, { recursive: true });
  const wanted = process.argv.slice(2);
  const list = wanted.length ? wanted : Object.keys(SECTIONS);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ARGS });
  try {
    for (const name of list) {
      try {
        await SECTIONS[name](browser);
      } catch (err) {
        note(`BÖLÜM HATASI (${name})`, err instanceof Error ? err.stack : String(err));
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(SCREENS, `notes-${list.join('-')}.json`), JSON.stringify(results, null, 2));
}

await main();
