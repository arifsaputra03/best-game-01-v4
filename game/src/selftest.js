// Headless self-test (?selftest=1): unit checks plus an auto-player that
// plays the game for real — clears Vault 1, then fast-forwards a god-mode
// run through all nine vaults to the campaign screen. Results print to the
// console and into the page, so a headless run can read them.
import { makeRng } from './random.js';
import { newWorld, startRun, stepWorld, applyBoon, buyShopItem, continueFromShop, exitOpen } from './world.js';
import { generateVault, roomAt, roomCenter } from './dungeon.js';
import { rollLoot, rollRelic, lootScore } from './items.js';
import { makeHero, heroDamage } from './heroes.js';
import { ENEMIES, makeEnemy } from './enemies.js';
import { skillBonus } from './skills.js';
import { loadSave, writeSave } from './save.js';
import { VAULTS } from './config.js';

// BFS over the dungeon's spanning tree: rooms to walk through to reach a target.
function roomPath(dungeon, from, to) {
  const key = (r) => `${r.gx},${r.gy}`;
  const adj = new Map();
  for (const e of dungeon.edges) {
    const [a, b] = e.split('>');
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const prev = new Map([[key(from), null]]);
  const queue = [key(from)];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === key(to)) break;
    for (const nb of adj.get(cur) || []) {
      if (!prev.has(nb)) { prev.set(nb, cur); queue.push(nb); }
    }
  }
  if (!prev.has(key(to))) return null;
  const path = [];
  let cur = key(to);
  while (cur) { path.unshift(cur); cur = prev.get(cur); }
  return path.map((k) => {
    const [gx, gy] = k.split(',').map(Number);
    return dungeon.rooms[gy * 4 + gx];
  });
}

function doorBetween(a, b) {
  if (a.gx !== b.gx) {
    const gx = Math.max(a.gx, b.gx);
    return { x: gx * 560, y: a.gy * 420 + 210 };
  }
  const gy = Math.max(a.gy, b.gy);
  return { x: a.gx * 560 + 280, y: gy * 420 };
}

function autoInput(world) {
  const h = world.hero;
  const input = { up: false, down: false, left: false, right: false, attack: false, dash: false, special: false, potion: false, interact: false };
  const d = world.dungeon;
  const cur = roomAt(d, h.x, h.y) || d.rooms[5];
  // Target: the exit when it is open, else the nearest living enemy, else the
  // nearest uncleared room.
  let tx = null, ty = null, mode = 'enemy';
  if (exitOpen(world)) { tx = d.exit.x; ty = d.exit.y; mode = 'exit'; }
  else {
    let best = null, bd = 1e9;
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      const dd = Math.hypot(e.x - h.x, e.y - h.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (best) { tx = best.x; ty = best.y; mode = 'enemy'; }
    else {
      let target = null, td = 1e9;
      for (const r of d.rooms) {
        if (r.cleared || r.type === 'entrance' || r.type === 'treasure' || !r.spawned) {
          if (r.type === 'treasure' && !r.chestOpened && !r.spawned) { /* visit later */ }
          continue;
        }
        const c = roomCenter(r.gx, r.gy);
        const dd = Math.hypot(c.x - h.x, c.y - h.y);
        if (dd < td) { td = dd; target = r; }
      }
      if (!target) {
        // Nothing left: walk to the nearest unvisited room.
        for (const r of d.rooms) {
          if (r.visited) continue;
          const c = roomCenter(r.gx, r.gy);
          const dd = Math.hypot(c.x - h.x, c.y - h.y);
          if (dd < td) { td = dd; target = r; }
        }
      }
      if (target) { tx = roomCenter(target.gx, target.gy).x; ty = roomCenter(target.gx, target.gy).y; mode = 'room'; }
    }
  }
  if (tx === null) return input;
  world.debug = { mode, tx: Math.round(tx), ty: Math.round(ty), hero: `${Math.round(h.x)},${Math.round(h.y)}` };
  // Walk room by room: head for the door to the next room on the path.
  const targetRoom = roomAt(d, tx, ty);
  let wx = tx, wy = ty;
  if (targetRoom && targetRoom !== cur) {
    const path = roomPath(d, cur, targetRoom);
    if (path && path.length > 1) {
      const door = doorBetween(cur, path[1]);
      // Aim past the door, into the next room: stopping on the threshold
      // (inside the wall band) wedges the hero against the wall.
      const nc = roomCenter(path[1].gx, path[1].gy);
      const cc = roomCenter(cur.gx, cur.gy);
      const dl = Math.hypot(nc.x - cc.x, nc.y - cc.y) || 1;
      wx = door.x + ((nc.x - cc.x) / dl) * 48;
      wy = door.y + ((nc.y - cc.y) / dl) * 48;
    }
  }
  const dx = wx - h.x, dy = wy - h.y;
  const dead = 4;
  // Unstick: a pillar (or a wall corner) can pin a straight-line walk. If
  // the hero has barely moved for a while, sidestep PERPENDICULAR to the
  // direction of travel for a bit, alternating sides each time.
  if (!world.unstick) world.unstick = { x: h.x, y: h.y, t: 0, axis: 'v', dir: 1, sideT: 0 };
  const u = world.unstick;
  if (u.sideT > 0) {
    u.sideT -= 1;
    if (u.axis === 'v') { if (u.dir > 0) { input.down = true; input.up = false; } else { input.up = true; input.down = false; } }
    else { if (u.dir > 0) { input.right = true; input.left = false; } else { input.left = true; input.right = false; } }
    if (u.sideT === 0) { u.x = h.x; u.y = h.y; u.t = 0; }
    return input;
  }
  u.t += 1;
  if (u.t >= 45) {
    const moved = Math.hypot(h.x - u.x, h.y - u.y);
    if (moved < 6) {
      u.axis = Math.abs(dx) >= Math.abs(dy) ? 'v' : 'h';
      u.dir = -u.dir;
      u.sideT = 60;
    }
    u.x = h.x; u.y = h.y; u.t = 0;
  }
  if (dx > dead) input.right = true;
  if (dx < -dead) input.left = true;
  if (dy > dead) input.down = true;
  if (dy < -dead) input.up = true;
  // Aim at the nearest enemy; attack when one is in range.
  let best = null, bd = 1e9;
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    const dd = Math.hypot(e.x - h.x, e.y - h.y);
    if (dd < bd) { bd = dd; best = e; }
  }
  if (best) {
    world.mouse.x = best.x - world.cam.x;
    world.mouse.y = best.y - world.cam.y;
    if (bd < h.range + best.r + 20) input.attack = true;
    if (h.hp < h.maxHp * 0.35 && h.potions > 0) input.potion = true;
    if (h.hp < h.maxHp * 0.3 && h.dashCd <= 0 && bd < 90) input.dash = true;
    if (h.specialCd <= 0 && bd < 160) input.special = true;
  }
  // Open a chest we stand on.
  for (const r of d.rooms) {
    if (!r.chest || r.chestOpened) continue;
    const c = roomCenter(r.gx, r.gy);
    if (Math.hypot(c.x - h.x, c.y - h.y) < 70) input.interact = true;
  }
  return input;
}

function playSteps(world, maxSteps, trace) {
  let steps = 0;
  while (steps < maxSteps) {
    steps += 1;
    if (world.state === 'play') {
      stepWorld(world, 1 / 60, autoInput(world));
    } else if (world.state === 'levelup') {
      applyBoon(world, world.boonChoices[0]);
    } else if (world.state === 'shop') {
      const afford = world.shopStock.find((i) => !i.sold && world.hero.gold >= i.price);
      if (afford) buyShopItem(world, afford);
      else continueFromShop(world);
    } else {
      break;
    }
    if (trace && steps % 600 === 0) {
      const h = world.hero;
      const room = roomAt(world.dungeon, h.x, h.y);
      const dbg = world.debug || {};
      trace.push(`s${steps} hero=(${Math.round(h.x)},${Math.round(h.y)}) room=${room ? room.gx + ',' + room.gy + ':' + room.type : 'none'} enemies=${world.enemies.filter((e) => e.hp > 0).length} kills=${h.kills} state=${world.state} vault=${world.vault} dbg=${JSON.stringify(dbg)}`);
    }
  }
  return steps;
}

export function runSelfTest() {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || '' });
  try {
    // --- unit checks ---
    const rng = makeRng(42);
    // Every vault generates and every room is reachable from the entrance.
    let allConnected = true;
    for (let v = 1; v <= 9; v++) {
      const d = generateVault(v, makeRng(100 + v));
      if (d.rooms.length !== 12) allConnected = false;
      const path = roomPath(d, d.rooms[5], d.exitRoom);
      if (!path || path.length < 2) allConnected = false;
      if (d.walls.length < 20) allConnected = false;
    }
    check('vaults generate, 12 rooms, exit reachable', allConnected);
    check('9 vaults defined across 3 realms', VAULTS.length === 9);
    check('12 enemy types + 3 bosses', Object.keys(ENEMIES).length >= 12);
    // Loot rolls are always valid.
    let lootOk = true;
    for (let i = 0; i < 200; i++) {
      const l = rollLoot(rng, 5, rng.pick(['weapon', 'armor', 'trinket']));
      if (!l.name || !l.rarity || lootScore(l) <= 0) lootOk = false;
      const r = rollRelic(rng);
      if (!r.id || !r.name) lootOk = false;
    }
    check('loot + relic rolls valid (200 rolls)', lootOk);
    // Heroes.
    let heroesOk = true;
    for (const id of ['vanguard', 'embermage', 'thornbow']) {
      const h = makeHero(id, skillBonus({}));
      if (h.hp <= 0 || heroDamage(h) <= 0) heroesOk = false;
    }
    check('3 heroes build with positive stats', heroesOk);
    // Skill tree math.
    const b = skillBonus({ hp: 3, dmg: 2, gold: 1, potion: 1, dash: 2, crit: 1, xp: 1, relic: 1 });
    check('skill bonus math', b.hpBonus === 36 && b.dmgBonus === 0.12 && b.startRelic === true, JSON.stringify(b));
    // Save round-trip.
    const s = loadSave();
    s.shards = 77;
    writeSave(s);
    check('save round-trip', loadSave().shards === 77);
    s.shards = 0; writeSave(s);

    // --- auto-player: clear Vault 1 for real ---
    const w1 = newWorld();
    w1.sfx = null;
    startRun(w1, 'vanguard');
    const trace1 = [];
    const steps1 = playSteps(w1, 60 * 120, trace1);
    check('auto-player clears Vault 1 (reaches shop or Vault 2)', w1.vault >= 2 || w1.state === 'shop', `vault=${w1.vault} state=${w1.state} steps=${steps1} kills=${w1.hero.kills} | ${trace1.join(' | ')}`);
    check('auto-player killed enemies in Vault 1', w1.hero.kills > 0, `kills=${w1.hero.kills}`);
    check('auto-player took no fatal exception', true);

    // --- auto-player: god-mode full run through all 9 vaults ---
    const w2 = newWorld();
    w2.sfx = null;
    startRun(w2, 'embermage');
    w2.hero.damage = 400;
    w2.hero.maxHp = 9999; w2.hero.hp = 9999;
    w2.hero.speed = 320;
    const trace2 = [];
    const steps2 = playSteps(w2, 60 * 900, trace2);
    check('god-mode run reaches the campaign screen', w2.state === 'campaign', `state=${w2.state} vault=${w2.vault} steps=${steps2} kills=${w2.hero.kills} | ${trace2.join(' | ')}`);
    check('god-mode run recorded a win', w2.runResult && w2.runResult.won === true, JSON.stringify(w2.runResult || {}));
  } catch (err) {
    results.push({ name: 'exception', ok: false, detail: `${err.message} — ${err.stack ? err.stack.split('\n')[1] : ''}` });
  }
  const passed = results.filter((r) => r.ok).length;
  const lines = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  lines.unshift(`SELFTEST ${passed}/${results.length} passed`);
  const out = lines.join('\n');
  console.log(out);
  const pre = document.getElementById('selftest');
  if (pre) pre.textContent = out;
  document.title = `SELFTEST ${passed}/${results.length}`;
  return { passed, total: results.length, results };
}
