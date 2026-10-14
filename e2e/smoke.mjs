// Uçtan uca duman testi: derlenmiş oyunu (dist/index.html) Chromium'da açar, gerçek fare tıklamalarıyla oynar,
// test kancası (window.__neonKale) ile durumu doğrular ve ekran görüntüleri alır.
//
// Çalıştırma: npm run e2e   (önce derler)
// Ortam değişkenleri: SCREENS_DIR (görüntü klasörü), CHROMIUM_PATH (tarayıcı yolu)

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_URL = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const SCREENS = process.env.SCREENS_DIR || path.join(ROOT, 'e2e', 'screens');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// Oyunun mantıksal çözünürlüğü ve menüdeki "Oyna" düğmesinin merkezi (src/scenes/MenuScene.ts → MENU_LAYOUT).
const GAME_W = 1280;
const GAME_H = 720;
const PLAY_BUTTON = { x: 640, y: 300 };
// Sonuç penceresindeki "Tekrar oyna" düğmesinin merkezi (src/ui/ResultOverlay.ts).
const RESTART_BUTTON = { x: 372, y: 490 };

const checks = [];
const problems = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` (${detail})` : ''}`);
}

function watchErrors(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${label}] konsol hatası: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${label}] sayfa hatası: ${err.message}`));
}

/** Mantıksal oyun koordinatını sayfa koordinatına çevirir (tuvalin konumu ve ölçeği). */
async function toPage(page, x, y) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Tuval bulunamadı');
  return { x: box.x + (x * box.width) / GAME_W, y: box.y + (y * box.height) / GAME_H };
}

async function clickGame(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}

async function hoverGame(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y);
}

/** Tarayıcının `n` kare çizmesini bekler. */
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

async function screenshot(page, name) {
  const file = path.join(SCREENS, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  görüntü: ${path.relative(ROOT, file)}`);
}

const state = (page) => page.evaluate(() => window.__neonKale.state());

/** Etkin sahnenin kamera geçişi (fade) bitene kadar bekler, sonra birkaç kare çizdirir. */
async function settle(page) {
  await page.waitForFunction(
    () => {
      const scene = window.__neonKale.game.scene.getScenes(true)[0];
      return Boolean(scene) && !scene.cameras.main.fadeEffect.isRunning;
    },
    null,
    { timeout: 10000 },
  );
  await frames(page, 3);
}

/** Sonuç penceresi açılıp açılış animasyonu bitene kadar bekler. */
async function waitForResult(page) {
  await page.waitForFunction(
    () => {
      const r = window.__neonKale.game.scene.getScene('game').result;
      return r.visible && r.container.alpha >= 0.99 && Math.abs(r.window.scale - 1) < 0.01;
    },
    null,
    { timeout: 20000 },
  );
  await frames(page, 2);
}

const fps = (page) => page.evaluate(() => Math.round(window.__neonKale.game.loop.actualFps));

/** Kule kurulabilir karoları, yol kapsamasına göre (menzil içindeki yol karosu sayısı) sıralı döner. */
function rankTiles(page) {
  return page.evaluate(() => {
    const sim = window.__neonKale.sim();
    const { cols, rows } = sim.map;
    const pathTiles = [];
    for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) if (sim.isPathTile({ col, row })) pathTiles.push({ col, row });
    const out = [];
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (!sim.canPlace({ col, row }).ok) continue;
        const score = pathTiles.filter((p) => Math.hypot(p.col - col, p.row - row) <= 2.5).length;
        out.push({ col, row, score });
      }
    }
    out.sort((a, b) => b.score - a.score || a.col - b.col || a.row - b.row);
    return out;
  });
}

/** Kancadan kuleleri kurup yükselterek oyunu sonuna kadar oynatır (zafer ya da yenilgi). */
function playToEnd(page) {
  return page.evaluate(() => {
    const hook = window.__neonKale;
    const sim = hook.sim();
    const { cols, rows } = sim.map;
    const pathTiles = [];
    for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) if (sim.isPathTile({ col, row })) pathTiles.push({ col, row });
    const score = (t) => pathTiles.filter((p) => Math.hypot(p.col - t.col, p.row - t.row) <= 2.5).length;
    // Az ama yükseltilmiş kule: önce 4 kule, sonra seviye toplamı kule sayısının 3 katına ulaştıkça yenisi (en fazla 8).
    const plan = ['laser', 'cannon', 'laser', 'frost', 'cannon', 'laser', 'cannon', 'frost'];
    const freeTiles = () => {
      const out = [];
      for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) if (sim.canPlace({ col, row }).ok) out.push({ col, row });
      return out.sort((a, b) => score(b) - score(a));
    };
    const spend = () => {
      for (let guard = 0; guard < 50; guard++) {
        const s = sim.state;
        const towers = s.towers;
        const nextKind = plan[towers.length];
        const cheapest = towers
          .map((t) => ({ t, cost: sim.upgradeCost(t.id) }))
          .filter((x) => x.cost !== null)
          .sort((a, b) => a.t.level - b.t.level || a.cost - b.cost)[0];
        const preferBuild = nextKind && (towers.length < 4 || towers.length <= towers.reduce((n, t) => n + t.level, 0) / 3);
        if (preferBuild) {
          const tile = freeTiles()[0];
          if (tile && sim.build(nextKind, tile).ok) continue;
        }
        if (cheapest && sim.upgrade(cheapest.t.id).ok) continue;
        if (!preferBuild && nextKind) {
          const tile = freeTiles()[0];
          if (tile && sim.build(nextKind, tile).ok) continue;
        }
        break;
      }
    };
    for (let i = 0; i < 2000; i++) {
      const s = sim.state;
      if (s.status === 'victory' || s.status === 'defeat') break;
      spend();
      if (s.status === 'building') sim.startNextWave();
      hook.fastForward(2);
    }
    const s = sim.state;
    return { status: s.status, stars: s.stars, lives: s.lives, waves: s.wavesStarted, towers: s.towers.length };
  });
}

async function desktopRun(browser) {
  console.log('\nMasaüstü (1280×720)');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  watchErrors(page, 'masaüstü');
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__neonKale && window.__neonKale.scene() === 'menu', null, { timeout: 15000 });
  check('Oyun açıldı, ana menü etkin', true);
  await settle(page);
  await screenshot(page, '01-menu');

  // Menü → oyun (gerçek tıklama).
  await clickGame(page, PLAY_BUTTON.x, PLAY_BUTTON.y);
  await page.waitForFunction(() => window.__neonKale.scene() === 'game' && window.__neonKale.sim() !== null, null, { timeout: 5000 });
  const start = await state(page);
  check('"Oyna" ile oyun sahnesine geçildi', start && start.status === 'building', `altın ${start?.gold}, can ${start?.lives}`);
  await settle(page);
  await screenshot(page, '02-game-start');

  const tiles = await rankTiles(page);
  check('Kurulabilir karolar bulundu', tiles.length >= 6, `${tiles.length} karo`);
  const tileScreen = (t) => page.evaluate(([c, r]) => window.__neonKale.tileToScreen(c, r), [t.col, t.row]);
  const spots = tiles.slice(0, 6);

  // Yerleştirme hayaleti: "1" + yolun yanındaki karonun üstüne gel.
  await page.keyboard.press('1');
  const s0 = await tileScreen(spots[0]);
  await hoverGame(page, s0.x, s0.y);
  await frames(page, 3);
  await screenshot(page, '03-placing-ghost');

  // Gerçek tıklamalarla kur: lazer, buz; dalga sonrası top.
  const goldBefore = (await state(page)).gold;
  await clickGame(page, s0.x, s0.y);
  await frames(page, 2);
  const afterLaser = await state(page);
  check('Kule kurulunca altın azaldı', afterLaser.gold < goldBefore, `${goldBefore} → ${afterLaser.gold}`);
  check('Haritada 1 kule var', afterLaser.towers.length === 1 && afterLaser.towers[0].kind === 'laser');

  await page.keyboard.press('3');
  const s1 = await tileScreen(spots[1]);
  await clickGame(page, s1.x, s1.y);
  await frames(page, 2);
  const afterFrost = await state(page);
  check('Buz kulesi kuruldu', afterFrost.towers.some((t) => t.kind === 'frost'), `altın ${afterFrost.gold}`);

  // Top kulesi için altın biriktir: dalgaları Boşluk ile başlat, sonuna kadar sar.
  const cannonCost = await page.evaluate(() => window.__neonKale.sim().towerDefs.cannon.levels[0].cost);
  for (let i = 0; i < 4; i++) {
    const s = await state(page);
    if (s.gold >= cannonCost || s.status === 'defeat') break;
    await page.keyboard.press('Space');
    await frames(page, 1);
    const started = await state(page);
    if (i === 0) {
      check('Boşluk ile dalga başladı', started.wavesStarted === 1 && started.status === 'wave');
      await page.evaluate(() => window.__neonKale.fastForward(3));
      const spawned = await state(page);
      check('Dalga başlayınca düşmanlar çıktı', spawned.enemies.length > 0, `${spawned.enemies.length} düşman`);
    }
    await page.evaluate(() => {
      for (let k = 0; k < 120 && window.__neonKale.state().status === 'wave'; k++) window.__neonKale.fastForward(1);
    });
  }
  await page.keyboard.press('2');
  const s2 = await tileScreen(spots[2]);
  await clickGame(page, s2.x, s2.y);
  await frames(page, 2);
  const afterCannon = await state(page);
  const kinds = new Set(afterCannon.towers.map((t) => t.kind));
  check('Üç kule türü de gerçek tıklamayla kuruldu', kinds.size === 3, [...kinds].join(', '));

  // Kuleyi seç (tıkla).
  await clickGame(page, s0.x, s0.y);
  await page.mouse.move(10, 10);
  await frames(page, 3);
  await screenshot(page, '04-built-and-selected');

  // Dalga ortası.
  const before = await state(page);
  await page.keyboard.press('Space');
  await frames(page, 1);
  // Düşmanlar kulelere varana kadar sar, sonra havada bir top mermisi olan ana kadar küçük adımlarla ilerle:
  // ışınlar, patlamalar, buz dalgaları görünsün.
  await page.evaluate(() => {
    const hook = window.__neonKale;
    for (let i = 0; i < 80 && !hook.state().towers.some((t) => t.targetId !== null); i++) hook.fastForward(0.5);
    hook.fastForward(1.5);
    for (let i = 0; i < 80 && hook.state().projectiles.length === 0; i++) hook.fastForward(0.05);
    hook.fastForward(0.12); // mermi namludan çıkıp yolun yarısına gelsin
  });
  await frames(page, 2);
  const mid = await state(page);
  check('Sıradaki dalga Boşluk ile başladı', mid.wavesStarted === before.wavesStarted + 1, `dalga ${mid.wavesStarted}`);
  check('Dalga ortasında düşmanlar sahada', mid.enemies.length > 0, `${mid.enemies.length} düşman, ${mid.projectiles.length} mermi, ${await fps(page)} FPS`);
  await screenshot(page, '05-mid-wave');

  // Duraklatma: zaman ilerlememeli.
  await page.keyboard.press('p');
  await frames(page, 2);
  const t1 = (await state(page)).time;
  await page.waitForTimeout(400);
  const t2 = (await state(page)).time;
  check('P ile duraklatınca zaman durdu', t1 === t2, `${t1.toFixed(2)} sn`);
  await screenshot(page, '06-paused');
  await page.keyboard.press('p');
  const resumed = await page
    .waitForFunction((t) => window.__neonKale.state().time > t, t2, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  check('P ile devam edince zaman ilerledi', resumed);

  // Oyunu sona kadar oynat (kanca ile kur/yükselt + ileri sar).
  const end = await playToEnd(page);
  check('Oyun sona erdi', end.status === 'victory' || end.status === 'defeat', JSON.stringify(end));
  await waitForResult(page);
  check('Sonuç penceresi açıldı', true, `${end.status === 'victory' ? `zafer, ${end.stars} yıldız` : 'yenilgi'}, ${await fps(page)} FPS`);
  await screenshot(page, '07-result');

  // Tekrar oyna (gerçek tıklama): temiz bir oyun başlamalı.
  await clickGame(page, RESTART_BUTTON.x, RESTART_BUTTON.y);
  await page.waitForFunction(() => {
    const s = window.__neonKale.state();
    return window.__neonKale.scene() === 'game' && s && s.wavesStarted === 0 && s.towers.length === 0;
  }, null, { timeout: 5000 }).catch(() => null);
  const fresh = await state(page);
  check('"Tekrar oyna" yeni oyun başlattı', fresh && fresh.wavesStarted === 0 && fresh.towers.length === 0, `altın ${fresh?.gold}`);

  // Yeniden başlatmadan sonra bir tuş tek bir eylem yapmalı (çift dinleyici yok).
  await page.keyboard.press('Space');
  await frames(page, 2);
  const afterSpace = await state(page);
  check('Yeniden başlatmadan sonra Boşluk tek dalga başlattı', afterSpace.wavesStarted === 1);
  await context.close();
}

async function mobileRun(browser) {
  console.log('\nTelefon (844×390 yatay, 390×844 dikey)');
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  watchErrors(page, 'telefon');
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__neonKale && window.__neonKale.scene() === 'menu', null, { timeout: 15000 });
  await settle(page);
  const play = await toPage(page, PLAY_BUTTON.x, PLAY_BUTTON.y);
  await page.touchscreen.tap(play.x, play.y);
  await page.waitForFunction(() => window.__neonKale.scene() === 'game' && window.__neonKale.sim() !== null, null, { timeout: 5000 });
  check('Dokunarak oyun başladı', true);
  await settle(page);

  // Dokunarak kur: "1" kartına dokun, sonra karoya dokun.
  const tiles = await rankTiles(page);
  const card = await toPage(page, 1100, 135);
  await page.touchscreen.tap(card.x, card.y);
  const t = await page.evaluate(([c, r]) => window.__neonKale.tileToScreen(c, r), [tiles[0].col, tiles[0].row]);
  const tp = await toPage(page, t.x, t.y);
  await page.touchscreen.tap(tp.x, tp.y);
  await frames(page, 2);
  const built = await state(page);
  check('Dokunarak kule kuruldu', built.towers.length === 1, `altın ${built.gold}`);

  await page.evaluate(() => {
    const sim = window.__neonKale.sim();
    sim.startNextWave();
    window.__neonKale.fastForward(5);
  });
  await frames(page, 2);
  check('Yatay telefonda uyarı yok', !(await page.locator('#rotate-warning').isVisible()));
  await screenshot(page, '08-mobile-landscape');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  check('Dikey telefonda "Telefonu yan çevirin" uyarısı', await page.locator('#rotate-warning').isVisible());
  await screenshot(page, '09-mobile-portrait');
  await context.close();
}

async function main() {
  await mkdir(SCREENS, { recursive: true });
  console.log(`Neon Kale duman testi → ${PAGE_URL}`);
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ARGS });
  try {
    await desktopRun(browser);
    await mobileRun(browser);
  } catch (err) {
    check('Test akışı hatasız tamamlandı', false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  check('Konsol/sayfa hatası yok', problems.length === 0, problems.length ? `${problems.length} hata` : '');
  const failed = checks.filter((c) => !c.ok);
  console.log('\n── Özet ──');
  for (const p of problems) console.log(`  ! ${p}`);
  console.log(`${checks.length - failed.length}/${checks.length} kontrol geçti. Ekran görüntüleri: ${SCREENS}`);
  if (failed.length) {
    console.log('Başarısız:');
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exit(1);
  }
}

await main();
