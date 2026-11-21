/* Static + gameplay sanity checks for Castelo da Betina.  npm run check */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sim = ['themeConfig', 'noise', 'terrain', 'world', 'castle', 'player', 'critters', 'pickups', 'camera', 'audio']
  .map((f) => `js/${f}.js`);
const render = ['kit', 'scenes', 'terrainRenderer', 'seaRenderer', 'characters', 'camp', 'castleRenderer', 'pickupRenderer', 'effects']
  .map((f) => `js/render/${f}.js`);
const required = ['index.html', 'css/style.css', ...sim, ...render, 'js/game.js', 'js/main.js'];

for (const file of required) {
  assert.ok(fs.existsSync(path.join(root, file)), `missing file: ${file}`);
}

/* ------------------------------------------------------------------- html */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [
  'game', 'themeSelect', 'soundBtn', 'qualityBtn', 'pauseBtn', 'startBtn', 'retryBtn',
  'menuBtn', 'resumeBtn', 'restartBtn', 'startOverlay', 'overOverlay', 'pauseOverlay',
  'startTheme', 'startTagline', 'startBest', 'startBestLabel', 'startBtnLabel',
  'startCoinLabel', 'startFuelContainer', 'overTitle', 'overReason', 'overEyebrow',
  'overDistance', 'overCoins', 'overBest', 'newRecord', 'overLabelA', 'overLabelB',
  'overLabelC', 'retryLabel', 'overHint', 'distanceValue', 'bestValue', 'coinValue',
  'coinLabel', 'fuelLabel', 'fuelFill', 'fuelPct', 'fuelWrap', 'toast', 'flash',
  'distanceLabel', 'bestLabel', 'clockValue', 'clockLabel', 'bucketLabel', 'bucketFill',
  'hint', 'banner', 'bannerLabel', 'bannerText'
];
for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
for (const pedal of ['left', 'right', 'jump']) {
  assert.ok(html.includes(`data-pedal="${pedal}"`), `index.html missing the ${pedal} touch button`);
}

// Every script must be loaded, in dependency order, with main last.
let last = -1;
for (const file of [...sim, ...render, 'js/game.js', 'js/main.js']) {
  const at = html.indexOf(`src="${file}"`);
  assert.ok(at >= 0, `index.html does not load ${file}`);
  assert.ok(at > last, `${file} is loaded out of order`);
  last = at;
}
assert.ok(!/matter/i.test(html), 'index.html should not depend on a physics engine');

/* ------------------------------------------------------------ load modules */
global.HCR = {};
for (const file of [...sim.filter((f) => !/camera|audio/.test(f)), ...render]) {
  require(path.join(root, file));
}
const HCR = global.HCR;
const R = HCR.render;
const themeIds = Object.keys(HCR.THEMES);
assert.ok(themeIds.includes('dia') && themeIds.includes('tarde'), 'the two example themes must exist');

/* --------------------------------------------------------- theme contract */
// Every theme (including ones you add) must be complete and point at painters
// that exist — this is what a new look or difficulty has to satisfy.
const PHYSICS_KEYS = [
  'runSpeed', 'accel', 'decel', 'airControl', 'gravity', 'jumpSpeed', 'loadSlow', 'wadeSlow',
  'wadeFull', 'slopeGain', 'tiredSlow', 'scoopRate', 'dumpRate', 'sloshK', 'sloshC',
  'sloshGain', 'landKick', 'spillThreshold', 'spillRate', 'energyMax', 'energyRun',
  'energyIdle', 'energyShade', 'energyJump', 'tiredRecover', 'pickupRadius',
  'energyPerPop', 'crabSpill', 'crabStun', 'waveSpill'
];

function validateTheme(id) {
  const t = HCR.THEMES[id];
  for (const section of ['labels', 'physics', 'rules', 'levels', 'player', 'colors', 'camp', 'castle', 'pickups', 'terrain', 'background', 'ui']) {
    assert.ok(t[section] && typeof t[section] === 'object', `${id}: missing section "${section}"`);
  }
  for (const key of PHYSICS_KEYS) assert.ok(typeof t.physics[key] === 'number', `${id}: physics.${key} missing`);
  assert.ok(Array.isArray(t.levels.list) && t.levels.list.length > 0, `${id}: levels.list is empty`);
  for (const [i, lv] of t.levels.list.entries()) {
    for (const key of ['shore', 'buckets', 'crabs', 'waveEvery']) {
      assert.ok(typeof lv[key] === 'number', `${id}: levels.list[${i}].${key} missing`);
    }
  }
  assert.ok(R.scenes.has(t.background.scene), `${id}: unknown background.scene "${t.background.scene}" (have: ${R.scenes.ids()})`);
  assert.ok(R.decor.has(t.terrain.decorSet), `${id}: unknown terrain.decorSet "${t.terrain.decorSet}" (have: ${R.decor.ids()})`);
  assert.ok(R.pickups.has(t.pickups.coinSprite), `${id}: unknown pickups.coinSprite "${t.pickups.coinSprite}"`);
  assert.ok(R.pickups.has(t.pickups.fuelSprite), `${id}: unknown pickups.fuelSprite "${t.pickups.fuelSprite}"`);
  assert.ok(Array.isArray(t.background.sky) && t.background.sky.length === 3, `${id}: background.sky needs 3 stops`);
  assert.ok(Array.isArray(t.background.dusk) && t.background.dusk.length === 2, `${id}: background.dusk needs 2 colours`);
  assert.ok(t.terrain.water && t.terrain.water.top, `${id}: terrain.water missing`);
  assert.ok(Array.isArray(t.labels.cheers) && t.labels.cheers.length > 0, `${id}: labels.cheers is empty`);
}
themeIds.forEach(validateTheme);

// defineTheme: inherit, override deeply, leave the parent untouched.
const derived = HCR.defineTheme('__check', {
  extends: 'dia',
  name: 'Check',
  physics: { runSpeed: 200 },
  levels: { timeSlack: 3 },
  rules: { sunset: false }
});
assert.strictEqual(derived.physics.runSpeed, 200);
assert.strictEqual(derived.physics.jumpSpeed, HCR.THEMES.dia.physics.jumpSpeed, 'defineTheme must inherit');
assert.strictEqual(derived.levels.list.length, HCR.THEMES.dia.levels.list.length, 'nested keys must inherit');
assert.strictEqual(HCR.THEMES.dia.physics.runSpeed, 285, 'parent theme must not be mutated');
assert.strictEqual(derived.bestKey, 'betina.best.__check');
validateTheme('__check');
delete HCR.THEMES.__check;

/* ------------------------------------------------------ architecture rules */
// Simulation modules must stay free of drawing code (render lives in js/render).
for (const file of ['js/terrain.js', 'js/world.js', 'js/castle.js', 'js/player.js', 'js/critters.js', 'js/pickups.js']) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/\bctx\./.test(src), `${file}: simulation module should not draw`);
  assert.ok(!/document\.|window\./.test(src.replace(/typeof window !== 'undefined'/g, '')), `${file}: simulation module must not touch the DOM`);
}

/* --------------------------------------------------------------- the world */
for (const id of themeIds) {
  const theme = HCR.THEMES[id];
  for (const level of [1, 2, 6, 12]) {
    const world = new HCR.BeachWorld(theme, level, 7 + level);
    assert.ok(world.shore > world.castleX + 400, `${id} L${level}: the sea must be far from the castle`);
    assert.ok(Math.abs(world.heightAt(world.campX)) < 1 && Math.abs(world.heightAt(world.castleX)) < 1, `${id} L${level}: camp and castle site must be flat`);
    // The waterline must stay on the beach through the whole tide cycle.
    for (let t = 0; t < 120; t += 0.37) {
      world.update(t);
      assert.ok(world.edge > world.castleX + 300 && world.edge < world.limitX, `${id} L${level} t=${t}: waterline left the beach (${world.edge})`);
    }
    assert.ok(world.p.time > 30, `${id} L${level}: level time too short`);
    assert.ok(world.p.buckets >= 5, `${id} L${level}: castle too small`);
  }
}

// The cached render heights must track the exact height field.
{
  const world = new HCR.BeachWorld(HCR.THEMES.dia, 3, 99);
  let worst = 0;
  for (let x = -800; x < world.shore + 500; x += 3.7) worst = Math.max(worst, Math.abs(world.heightFast(x) - world.heightAt(x)));
  assert.ok(worst < 0.8, `heightFast drifts ${worst.toFixed(2)}px from heightAt`);
}

/* ------------------------------------------------ gameplay: a bot must win */
const { playLevel } = require('./simulate.js');
const results = {};
for (const id of themeIds) {
  results[id] = [];
  for (let level = 1; level <= 3; level++) {
    const r = playLevel(id, level, 1000 + level);
    assert.ok(r.done, `${id}: a sensible bot could not finish level ${level} in ${r.limit}s (reached ${r.time.toFixed(0)}s)`);
    results[id].push(r);
  }
}

// Spilling must matter: a bucket that sloshes loses sand, a gentle one does not.
{
  const theme = HCR.THEMES.dia;
  const world = new HCR.BeachWorld(theme, 1, 5);
  const castle = new HCR.Castle(5, 1, world.castleX);
  const calm = new HCR.Betina(theme, world);
  const rough = new HCR.Betina(theme, world);
  calm.fill = rough.fill = 1;
  for (let i = 0; i < 360; i++) {
    calm.step(1 / 60, { right: true, left: false, jumpPressed: false }, null);
    // The rough player zig-zags and jumps constantly.
    rough.step(1 / 60, { right: Math.floor(i / 20) % 2 === 0, left: Math.floor(i / 20) % 2 === 1, jumpPressed: i % 24 === 0 }, null);
    calm.events.length = rough.events.length = 0;
  }
  assert.ok(rough.fill < calm.fill - 0.05, `rough running should spill more (${rough.fill.toFixed(2)} vs ${calm.fill.toFixed(2)})`);
}

console.log('Castelo da Betina checks passed.');
for (const id of themeIds) {
  console.log(`  ${id}: ` + results[id].map((r, i) => `fase ${i + 1} em ${r.time.toFixed(0)}s/${r.limit}s`).join(' · '));
}
