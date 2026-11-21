/* Headless gameplay bot for Castelo da Betina.
 * Plays whole levels with the same simulation modules the browser uses and
 * reports whether a sensible player can finish them in time.
 *   npm run simulate [-- <themeId> <maxLevel>]
 */
'use strict';

const path = require('path');
global.HCR = global.HCR || {};
for (const f of ['themeConfig', 'noise', 'terrain', 'world', 'castle', 'player', 'critters', 'pickups']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const HCR = global.HCR;

function playLevel(themeId, level, seed, opts) {
  const o = Object.assign({ careless: false }, opts);
  const theme = HCR.THEMES[themeId];
  const world = new HCR.BeachWorld(theme, level, seed);
  const castle = new HCR.Castle(world.p.buckets, world.p.castleScale, world.castleX);
  const player = new HCR.Betina(theme, world);
  const crabs = new HCR.CrabField(world);
  const stats = { buckets: 0, spilled: 0, crabHits: 0, pushes: 0, shells: 0, tired: 0, time: 0 };
  const pickups = new HCR.PickupField(world, theme, { onCoin: () => stats.shells++, onFuel: () => { player.energy = Math.min(theme.physics.energyMax, player.energy + theme.physics.energyPerPop); } });

  const dt = 1 / 60;
  let t = 0;
  let wasDumping = false;
  let sawFull = false;
  while (t < world.p.time && !castle.complete && t < 900) {
    world.update(t);
    crabs.update(dt);

    // Bot: fetch when empty, deliver when full; hop crabs; avoid big waves.
    const input = { left: false, right: false, jumpPressed: false };
    const wantSea = player.fill < 0.98 && !sawFull;
    if (player.fill >= 0.98) sawFull = true;
    if (player.fill < 0.03 && !player.inWater) sawFull = false;
    const target = wantSea ? world.edge + 8 : world.castleX;
    if (wantSea) {
      const waveNear = world.warn > 0.2 || world.wave > 0.05;
      if (player.x < target - 4 && !(waveNear && player.x > world.edge - 140)) input.right = true;
      else if (waveNear && player.x > world.edge - 150) input.left = true;
    } else {
      if (player.x > target + 20) input.left = true;
      else if (player.x < target - 20 && !player.dumping) input.right = true;
    }
    const ahead = crabs.nextAhead(player, o.careless ? 0 : 190);
    if (ahead && player.grounded) {
      // Jump so the crab passes under the middle of the arc.
      const rel = Math.abs(player.vx) + (ahead.dir === -player.facing ? ahead.speed : -ahead.speed) * 0.9;
      const dist = Math.abs(ahead.x - player.x);
      if (rel > 40 && dist < rel * 0.3 + 14 && dist > 20) input.jumpPressed = true;
    }

    player.step(dt, input, castle);
    const hit = crabs.collide(player);
    if (hit) { if (player.hitByCrab(Math.sign(hit.x - player.x) || 1)) { crabs.scare(hit); stats.crabHits++; } }
    if (world.wave > 0.5 && player.x >= world.edge - 30 && player.pushedByWave()) stats.pushes++;
    pickups.update(player);
    for (const e of player.events) {
      if (e.type === 'dump') castle.add(e.amount);
      if (e.type === 'spill') stats.spilled += e.amount;
      if (e.type === 'tired') stats.tired++;
    }
    player.events.length = 0;
    if (player.dumping && !wasDumping) { stats.buckets++; pickups.respawn(); }
    wasDumping = player.dumping;
    castle.update(dt);
    t += dt;
  }
  stats.time = t;
  return Object.assign({ done: castle.complete, limit: world.p.time, need: world.p.buckets, shore: world.p.shore, crabCount: crabs.crabs.length }, stats);
}

if (require.main === module) {
  const themeId = process.argv[2] || 'dia';
  const maxLevel = Number(process.argv[3] || 7);
  console.log(`[${themeId}] bot run`);
  for (let level = 1; level <= maxLevel; level++) {
    const r = playLevel(themeId, level, 1000 + level);
    console.log(
      `  fase ${level}: ${r.done ? 'OK    ' : 'FALHOU'} ${r.time.toFixed(0).padStart(3)}s de ${String(r.limit).padStart(3)}s · ` +
      `castelo de ${r.need} baldes (${r.buckets} entregas) · derramou ${r.spilled.toFixed(1)} · ` +
      `${r.crabCount} caranguejos, ${r.crabHits} tombos · ondas ${r.pushes} · cansou ${r.tired}x · conchas ${r.shells}`
    );
  }
}

module.exports = { playLevel };
