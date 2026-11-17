// The run itself: vaults, rooms, enemy AI, hero actions, shop, level-ups,
// and the win/lose arc. Everything the player does flows through here.
import { VIEW_W, VIEW_H, ROOM_W, ROOM_H, WALL, VAULTS, REALMS, SHOP_STOCK, BOONS, shardsForRun, xpForLevel } from './config.js';
import { makeRng, clamp, dist, angleTo } from './random.js';
import { makeHero, heroDamage, heroHasRelic } from './heroes.js';
import { ENEMIES, BOSSES, makeEnemy, makeBoss, vaultEnemyCount } from './enemies.js';
import { generateVault, roomAt, roomCenter, spawnRoomEnemies } from './dungeon.js';
import { pushOutOfWalls, stepProjectiles, damageEnemy, damageHero, explode, burst, stepParticles, makeProjectile, checkLevelUp, killEnemy } from './combat.js';
import { rollLoot, rollRelic, lootScore, applyArmorItem, removeArmorItem } from './items.js';
import { skillBonus } from './skills.js';
import { loadSave, writeSave, recordRun } from './save.js';

export function newWorld() {
  const save = loadSave();
  return {
    state: 'title', save, seed: 1, rng: makeRng(1),
    hero: null, dungeon: null, enemies: [], projectiles: [], particles: [],
    floaters: [], pickups: [], slams: [],
    time: 0, vault: 0, pendingLevels: 0, boonChoices: [], shopStock: [],
    cam: { x: 0, y: 0 }, shake: 0, bossDown: false, secondWindUsed: false,
    xpMul: 1, enemyDefs: ENEMIES, runStart: 0, runId: '',
    mouse: { x: VIEW_W / 2, y: VIEW_H / 2, down: false },
    keys: {}, muted: false, sfx: null,
    titleSel: 0, skillSel: 0, hover: null, toast: [], kills: 0,
    objective: '', roomsCleared: 0, roomsTotal: 0, volley: null,
    stats: { damageDealt: 0, chests: 0, relics: 0 },
  };
}

export function startRun(world, heroId) {
  const bonus = skillBonus(world.save.skills);
  world.hero = makeHero(heroId, bonus);
  world.xpMul = bonus.xpMul;
  world.hero.dashCdMax *= bonus.dashMul;
  world.hero.crit += bonus.critBonus;
  if (bonus.startRelic) {
    const r = rollRelic(world.rng);
    world.hero.relics.push(r);
  }
  world.seed = Math.floor(Math.random() * 1e9) + 1;
  world.rng = makeRng(world.seed);
  world.runId = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  world.runStart = Date.now();
  world.time = 0;
  world.vault = 0;
  world.kills = 0;
  world.stats = { damageDealt: 0, chests: 0, relics: 0 };
  world.secondWindUsed = false;
  loadVault(world, 1);
  world.state = 'play';
}

export function loadVault(world, n) {
  world.vault = n;
  world.dungeon = generateVault(n, world.rng);
  world.enemies = [];
  world.projectiles = [];
  world.pickups = [];
  world.slams = [];
  world.bossDown = false;
  world.secondWindUsed = false;
  world.volley = null;
  const h = world.hero;
  h.x = world.dungeon.start.x; h.y = world.dungeon.start.y;
  h.hp = Math.min(h.maxHp, h.hp + 10);
  const entrance = roomAt(world.dungeon, h.x, h.y);
  if (entrance) enterRoom(world, entrance);
  world.roomsTotal = world.dungeon.rooms.filter((r) => r.type !== 'entrance' && r.type !== 'treasure').length;
  world.roomsCleared = 0;
  world.objective = world.dungeon.def.boss
    ? `Slay ${BOSSES[world.dungeon.def.boss].name}`
    : `Clear every room (${world.roomsTotal} to go)`;
  updateCamera(world);
}

export function enterRoom(world, room) {
  if (room.spawned) { room.visited = true; return; }
  room.spawned = true;
  room.visited = true;
  const spawns = spawnRoomEnemies(world.dungeon, room, world.rng);
  for (const s of spawns) {
    const e = s.boss ? makeBoss(s.type, s.x, s.y, world.vault) : makeEnemy(s.type, s.x, s.y, world.vault, s.elite);
    world.enemies.push(e);
  }
  if (room.type === 'boss') {
    world.toast.push({ text: `${BOSSES[world.dungeon.def.boss].name} — ${BOSSES[world.dungeon.def.boss].title}`, t: 3 });
  }
}

function roomCleared(world, room) {
  if (room.type === 'entrance' || room.type === 'treasure') return;
  room.cleared = true;
  world.roomsCleared += 1;
  if (world.dungeon.def.boss) {
    world.objective = `Slay ${BOSSES[world.dungeon.def.boss].name}`;
  } else {
    const left = world.roomsTotal - world.roomsCleared;
    world.objective = left > 0 ? `Clear every room (${left} to go)` : 'The portal is open — go!';
  }
  // Reward the room: a little gold, sometimes a potion.
  const h = world.hero;
  const g = 6 + world.vault * 2;
  h.gold += Math.round(g * h.goldMul);
  if (world.rng.chance(0.35)) world.pickups.push({ kind: 'potion', x: h.x + 30, y: h.y, v: 1, t: 0 });
}

export function exitOpen(world) {
  const d = world.dungeon;
  if (d.def.boss) return world.bossDown;
  return d.rooms.every((r) => r.type === 'entrance' || r.type === 'treasure' || r.cleared);
}

export function stepWorld(world, dt, input) {
  if (world.state !== 'play') return;
  world.time += dt;
  const h = world.hero;
  if (h.dead) { endRun(world, false); return; }

  // Timers.
  h.attackCd = Math.max(0, h.attackCd - dt);
  h.dashCd = Math.max(0, h.dashCd - dt);
  h.specialCd = Math.max(0, h.specialCd - dt);
  h.iframes = Math.max(0, h.iframes - dt);
  h.slowT = Math.max(0, (h.slowT || 0) - dt);
  if (h.dashTime > 0) h.dashTime -= dt;
  if (h.regen) h.hp = Math.min(h.maxHp, h.hp + h.regen * dt);

  // Movement (WASD / arrows), dash on Space.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const mag = Math.hypot(mx, my);
  if (mag > 0) { mx /= mag; my /= mag; h.angle = Math.atan2(my, mx); }
  const slowMul = h.slowT > 0 ? 0.55 : 1;
  const spd = h.speed * h.speedMul * slowMul;
  if (input.dash && h.dashCd <= 0 && mag > 0) {
    h.dashCd = h.dashCdMax; h.dashTime = 0.22; h.iframes = Math.max(h.iframes, 0.25);
    h.dx = mx; h.dy = my;
    burst(world, h.x, h.y, h.def.color, 8, 120);
    world.sfx && world.sfx('dash');
  }
  if (h.dashTime > 0) {
    h.x += h.dx * spd * 2.6 * dt;
    h.y += h.dy * spd * 2.6 * dt;
  } else if (mag > 0) {
    h.x += mx * spd * dt;
    h.y += my * spd * dt;
  }
  // Aim follows the mouse.
  const wx = world.cam.x + world.mouse.x;
  const wy = world.cam.y + world.mouse.y;
  h.aimAngle = Math.atan2(wy - h.y, wx - h.x);

  pushOutOfWalls(h, world.dungeon.walls);
  for (const room of world.dungeon.rooms) {
    for (const p of room.pillars) pushOutOfWalls(h, [p]);
  }
  h.x = clamp(h.x, WALL + h.r, world.dungeon.w - WALL - h.r);
  h.y = clamp(h.y, WALL + h.r, world.dungeon.h - WALL - h.r);

  // Room entry: spawn its enemies the first time we walk in.
  const room = roomAt(world.dungeon, h.x, h.y);
  if (room && !room.spawned) enterRoom(world, room);
  if (room) room.visited = true;

  // Attack (hold mouse or J).
  if ((input.attack || world.mouse.down) && h.attackCd <= 0) heroAttack(world);
  if (input.special && h.specialCd <= 0) heroSpecial(world);
  if (input.potion) usePotion(world);
  if (input.interact) tryInteract(world);

  // Volley rain (Thornbow special).
  if (world.volley) {
    world.volley.t -= dt;
    world.volley.next -= dt;
    if (world.volley.next <= 0 && world.volley.left > 0) {
      world.volley.left -= 1;
      world.volley.next = 0.09;
      const a = world.volley.tx + (Math.random() * 120 - 60);
      const b = world.volley.ty + (Math.random() * 120 - 60);
      world.projectiles.push(makeProjectile(a, b - 260, Math.PI / 2, 520, world.volley.dmg, 'hero', { r: 5, life: 0.6, color: '#7fe08a' }));
    }
    if (world.volley.t <= 0) world.volley = null;
  }

  stepEnemies(world, dt);
  stepProjectiles(world, dt);
  stepParticles(world, dt);
  stepPickups(world, dt);
  stepSlams(world, dt);

  // Room cleared?
  if (room && !room.cleared && room.spawned && room.type !== 'entrance' && room.type !== 'treasure') {
    const alive = world.enemies.some((e) => e.hp > 0 && roomAt(world.dungeon, e.x, e.y) === room);
    if (!alive) roomCleared(world, room);
  }

  // Exit portal.
  if (exitOpen(world)) {
    const ex = world.dungeon.exit;
    if (dist(h.x, h.y, ex.x, ex.y) < 46) {
      if (world.vault >= 9) { endRun(world, true); return; }
      openShop(world);
      return;
    }
  }

  // Level-up choices.
  if (world.pendingLevels > 0 && world.state === 'play') {
    world.boonChoices = world.rng.shuffle(BOONS.slice()).slice(0, 3);
    world.state = 'levelup';
  }

  // Burn over time (from the Ember Core relic / nova): a burn kill still
  // pays out XP, gold and drops like any other kill.
  for (const e of world.enemies) {
    if (e.burnT > 0 && e.hp > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (e.hp <= 0) killEnemy(world, e);
    }
  }
  world.enemies = world.enemies.filter((e) => e.hp > 0);
  updateCamera(world);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  for (const t of world.toast) t.t -= dt;
  world.toast = world.toast.filter((t) => t.t > 0);
}

function heroAttack(world) {
  const h = world.hero;
  h.attackCd = 1 / h.rate;
  const dmg = heroDamage(h);
  const a = h.aimAngle ?? 0;
  if (h.def.id === 'vanguard') {
    // Wide sword arc: everything in range and in front takes the hit.
    let hitAny = false;
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(h.x, h.y, e.x, e.y);
      if (d > h.range + e.r) continue;
      let da = Math.atan2(e.y - h.y, e.x - h.x) - a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 1.1) { damageEnemy(world, e, dmg, { from: 'hero' }); hitAny = true; }
    }
    world.sfx && world.sfx(hitAny ? 'slash' : 'swing');
    burst(world, h.x + Math.cos(a) * 50, h.y + Math.sin(a) * 50, h.def.color, 5, 90);
  } else if (h.def.id === 'embermage') {
    world.projectiles.push(makeProjectile(h.x + Math.cos(a) * 20, h.y + Math.sin(a) * 20, a, 340, dmg, 'hero', { r: 9, life: 1.4, color: '#ff9a4d', explode: true }));
    world.sfx && world.sfx('fire');
  } else {
    world.projectiles.push(makeProjectile(h.x + Math.cos(a) * 20, h.y + Math.sin(a) * 20, a, 620, dmg, 'hero', { r: 5, life: 0.9, color: '#7fe08a', pierce: 1 }));
    world.sfx && world.sfx('bow');
  }
}

function heroSpecial(world) {
  const h = world.hero;
  h.specialCd = h.specialCdMax;
  const a = h.aimAngle ?? 0;
  if (h.def.special.id === 'bash') {
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      if (dist(h.x, h.y, e.x, e.y) < 150 + e.r) {
        damageEnemy(world, e, heroDamage(h) * 0.8, { from: 'hero' });
        e.stagger = 1.2;
      }
    }
    burst(world, h.x, h.y, '#ffd76a', 20, 240);
    world.shake = Math.max(world.shake, 8);
    world.sfx && world.sfx('bash');
  } else if (h.def.special.id === 'nova') {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      world.projectiles.push(makeProjectile(h.x, h.y, ang, 300, heroDamage(h) * 0.9, 'hero', { r: 7, life: 0.7, color: '#ff6a4d', burn: 6 }));
    }
    burst(world, h.x, h.y, '#ff9a4d', 24, 260);
    world.sfx && world.sfx('nova');
  } else {
    const wx = world.cam.x + world.mouse.x;
    const wy = world.cam.y + world.mouse.y;
    world.volley = { tx: wx, ty: wy, left: 9, next: 0, t: 1.0, dmg: heroDamage(h) * 1.1 };
    world.sfx && world.sfx('volley');
  }
}

export function usePotion(world) {
  const h = world.hero;
  if (h.potions <= 0 || h.hp >= h.maxHp) return;
  h.potions -= 1;
  h.hp = Math.min(h.maxHp, h.hp + 60);
  burst(world, h.x, h.y, '#7fe08a', 10, 100);
  world.floaters.push({ x: h.x, y: h.y - 24, text: '+60', color: '#7fe08a', t: 0.9 });
  world.sfx && world.sfx('potion');
}

function tryInteract(world) {
  const h = world.hero;
  for (const room of world.dungeon.rooms) {
    if (!room.chest || room.chestOpened) continue;
    const c = roomCenter(room.gx, room.gy);
    if (dist(h.x, h.y, c.x, c.y) < 70) {
      room.chestOpened = true;
      world.stats.chests += 1;
      const loot = rollLoot(world.rng, world.vault, world.rng.pick(['weapon', 'armor', 'trinket']));
      equipIfBetter(world, loot);
      const gold = Math.round((30 + world.vault * 10) * h.goldMul);
      h.gold += gold;
      if (world.rng.chance(0.4)) {
        const relic = rollRelic(world.rng);
        h.relics.push(relic);
        world.stats.relics += 1;
        world.toast.push({ text: `Relic found: ${relic.name} — ${relic.desc}`, t: 3 });
      }
      world.toast.push({ text: `Chest: +${gold} gold, ${loot.name} (${loot.rarity})`, t: 3 });
      burst(world, c.x, c.y, '#ffd76a', 18, 180);
      world.sfx && world.sfx('chest');
      return;
    }
  }
}

export function equipIfBetter(world, loot) {
  const h = world.hero;
  if (loot.slot === 'weapon') {
    if (lootScore(loot) > lootScore(h.weapon)) {
      world.toast.push({ text: `New weapon: ${loot.name} (${loot.rarity})`, t: 2.5 });
      h.weapon = loot;
    } else {
      h.gold += 15 + world.vault * 3;
    }
    return;
  }
  if (loot.slot === 'armor') {
    if (!h.armorItem || lootScore(loot) > lootScore(h.armorItem)) {
      removeArmorItem(h, h.armorItem);
      h.armorItem = loot;
      applyArmorItem(h, loot);
      world.toast.push({ text: `New armor: ${loot.name} (${loot.rarity})`, t: 2.5 });
    } else h.gold += 12 + world.vault * 3;
    return;
  }
  if (!h.trinket || lootScore(loot) > lootScore(h.trinket)) {
    if (h.trinket) { h.crit -= h.trinket.crit || 0; h.goldMul /= h.trinket.goldMul || 1; }
    h.trinket = loot;
    h.crit += loot.crit || 0;
    h.goldMul *= loot.goldMul || 1;
    world.toast.push({ text: `New trinket: ${loot.name} (${loot.rarity})`, t: 2.5 });
  } else h.gold += 12 + world.vault * 3;
}

function stepPickups(world, dt) {
  const h = world.hero;
  const magnet = heroHasRelic(h, 'magnet') ? 170 : 90;
  for (const p of world.pickups) {
    p.t += dt;
    const d = dist(h.x, h.y, p.x, p.y);
    if (d < magnet) {
      const a = angleTo(p.x, p.y, h.x, h.y);
      p.x += Math.cos(a) * 320 * dt;
      p.y += Math.sin(a) * 320 * dt;
    }
    if (d < h.r + 14) {
      if (p.kind === 'gold') { h.gold += Math.round(p.v * h.goldMul); }
      else if (p.kind === 'potion') { if (h.potions < h.potionsMax) { h.potions += 1; world.floaters.push({ x: h.x, y: h.y - 24, text: '+1 potion', color: '#7fe08a', t: 0.8 }); } else h.gold += 10; }
      else if (p.kind === 'loot') { equipIfBetter(world, rollLoot(world.rng, world.vault, world.rng.pick(['weapon', 'armor', 'trinket']))); }
      p.dead = true;
      world.sfx && world.sfx('coin');
    }
  }
  world.pickups = world.pickups.filter((p) => !p.dead);
}

function stepSlams(world, dt) {
  for (const s of world.slams) {
    s.t -= dt;
    if (s.t <= 0 && !s.done) {
      s.done = true;
      const h = world.hero;
      if (dist(h.x, h.y, s.x, s.y) < s.r + h.r) damageHero(world, s.dmg);
      burst(world, s.x, s.y, '#ff6a4d', 16, 200);
      world.shake = Math.max(world.shake, 6);
    }
  }
  world.slams = world.slams.filter((s) => !s.done || s.t > -0.3);
}

function stepEnemies(world, dt) {
  const h = world.hero;
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.shootCd -= dt;
    e.stagger = Math.max(0, (e.stagger || 0) - dt);
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    if (e.stagger > 0) continue;
    const d = dist(e.x, e.y, h.x, h.y);
    const spd = e.speed * (e.slowT > 0 ? 0.5 : 1);
    const a = angleTo(e.x, e.y, h.x, h.y);
    const kind = e.def.kind;

    if (e.boss) { stepBoss(world, e, dt, d, a); }
    else if (kind === 'charge') {
      e.stateT -= dt;
      if (e.state === 'idle') { moveToward(e, h, spd, dt); if (d < 240) { e.state = 'telegraph'; e.stateT = 0.6; } }
      else if (e.state === 'telegraph') { e.tx = h.x; e.ty = h.y; if (e.stateT <= 0) { e.state = 'charge'; e.stateT = 0.45; e.angle = angleTo(e.x, e.y, e.tx, e.ty); } }
      else if (e.state === 'charge') { e.x += Math.cos(e.angle) * 420 * dt; e.y += Math.sin(e.angle) * 420 * dt; if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.9; } }
      else { if (e.stateT <= 0) e.state = 'idle'; }
    } else if (kind === 'ranged') {
      if (d > 280) moveToward(e, h, spd, dt);
      else if (d < 170) { e.x -= Math.cos(a) * spd * dt; e.y -= Math.sin(a) * spd * dt; }
      if (e.shootCd <= 0 && d < 420) {
        e.shootCd = 2.2;
        world.projectiles.push(makeProjectile(e.x, e.y, a, 230, e.dmg, 'enemy', { r: 6, life: 2, color: '#7fe08a' }));
      }
    } else if (kind === 'summon') {
      if (d > 260) moveToward(e, h, spd, dt);
      e.summonCd -= dt;
      if (e.summonCd <= 0) {
        e.summonCd = 6;
        const alive = world.enemies.filter((x) => x.type === 'wisp' && x.hp > 0).length;
        if (alive < 4) {
          const w = makeEnemy('wisp', e.x + 30, e.y, world.vault, false);
          world.enemies.push(w);
          burst(world, e.x, e.y, '#c78bff', 8, 100);
        }
      }
    } else if (kind === 'phase') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.stateT = 3.5 + Math.random() * 2;
        const na = Math.random() * Math.PI * 2;
        e.x = h.x + Math.cos(na) * 130;
        e.y = h.y + Math.sin(na) * 130;
        burst(world, e.x, e.y, '#8a6fd3', 10, 120);
      }
      moveToward(e, h, spd, dt);
    } else if (kind === 'swoop') {
      e.stateT -= dt;
      if (e.state === 'idle') {
        const orbit = a + Math.PI / 2;
        e.x += Math.cos(orbit) * spd * 0.7 * dt + Math.cos(a) * spd * 0.25 * dt;
        e.y += Math.sin(orbit) * spd * 0.7 * dt + Math.sin(a) * spd * 0.25 * dt;
        if (e.stateT <= 0) { e.state = 'swoop'; e.stateT = 0.5; e.angle = a; }
      } else {
        e.x += Math.cos(e.angle) * 380 * dt;
        e.y += Math.sin(e.angle) * 380 * dt;
        if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 1.6 + Math.random(); }
      }
    } else if (kind === 'drift') {
      const wob = Math.sin(world.time * 2 + e.x * 0.01) * 0.8;
      e.x += (Math.cos(a) + Math.cos(a + Math.PI / 2) * wob * 0.5) * spd * dt;
      e.y += (Math.sin(a) + Math.sin(a + Math.PI / 2) * wob * 0.5) * spd * dt;
    } else if (kind === 'swarm') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.stateT = 0.4 + Math.random() * 0.5; e.angle = a + (Math.random() - 0.5) * 1.6; }
      e.x += Math.cos(e.angle) * spd * dt;
      e.y += Math.sin(e.angle) * spd * dt;
    } else if (kind === 'frost') {
      moveToward(e, h, spd, dt);
    } else {
      moveToward(e, h, spd, dt);
    }

    pushOutOfWalls(e, world.dungeon.walls);
    e.x = clamp(e.x, WALL + e.r, world.dungeon.w - WALL - e.r);
    e.y = clamp(e.y, WALL + e.r, world.dungeon.h - WALL - e.r);

    // Touch damage.
    if (d < e.r + h.r + 2 && e.hitCd <= 0) {
      e.hitCd = 0.9;
      damageHero(world, e.dmg);
      if (kind === 'frost') h.slowT = 1.2;
      if (heroHasRelic(h, 'thorns')) damageEnemy(world, e, 6, { from: 'hero' });
      // Knock the enemy back a little so it does not stick.
      e.x += Math.cos(a + Math.PI) * 0; // no-op, kept for clarity
    }
  }
}

function moveToward(e, h, spd, dt) {
  const a = angleTo(e.x, e.y, h.x, h.y);
  e.angle = a;
  e.x += Math.cos(a) * spd * dt;
  e.y += Math.sin(a) * spd * dt;
}

function stepBoss(world, b, dt, d, a) {
  const h = world.hero;
  // Phase 2: below half HP the boss speeds up and adds an attack.
  if (b.phase === 1 && b.hp < b.maxHp / 2) {
    b.phase = 2;
    b.speed *= 1.25;
    world.toast.push({ text: `${b.def.name} is enraged!`, t: 2.5 });
    burst(world, b.x, b.y, b.def.color, 26, 260);
  }
  b.attackT -= dt;
  b.summonCd -= dt;
  const spd = b.speed * (b.phase === 2 ? 1.15 : 1);
  if (b.state === 'telegraph') {
    b.stateT -= dt;
    if (b.stateT <= 0) {
      if (b.pendingAttack === 'slam') {
        world.slams.push({ x: b.tx, y: b.ty, r: 110, dmg: b.dmg + 8, t: 0.15, done: false });
        b.state = 'idle';
      } else if (b.pendingAttack === 'charge') {
        b.state = 'charge'; b.stateT = 0.5; b.angle = angleTo(b.x, b.y, b.tx, b.ty);
      }
    }
    return;
  }
  if (b.state === 'charge') {
    b.x += Math.cos(b.angle) * 430 * dt;
    b.y += Math.sin(b.angle) * 430 * dt;
    b.stateT -= dt;
    if (b.stateT <= 0) b.state = 'idle';
    return;
  }
  // Chase slowly, then attack on a timer.
  if (d > 130) moveToward(b, h, spd, dt);
  if (b.attackT <= 0) {
    b.attackT = b.phase === 2 ? 2.2 : 3.0;
    const atk = b.def.attacks[Math.floor(Math.random() * b.def.attacks.length)];
    if (atk === 'radial') {
      const n = b.phase === 2 ? 16 : 12;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        world.projectiles.push(makeProjectile(b.x, b.y, ang, 200, b.dmg, 'enemy', { r: 7, life: 2.5, color: b.def.color }));
      }
      world.sfx && world.sfx('boss');
    } else if (atk === 'summon') {
      for (let i = 0; i < 3; i++) {
        const type = b.def.id === 'tidewarden' ? 'wisp' : b.def.id === 'embermatriarch' ? 'imp' : 'shade';
        const w = makeEnemy(type, b.x + (i - 1) * 50, b.y + 40, world.vault, false);
        world.enemies.push(w);
      }
      burst(world, b.x, b.y, b.def.color, 14, 160);
    } else if (atk === 'slam') {
      b.state = 'telegraph'; b.stateT = 0.8; b.pendingAttack = 'slam';
      b.tx = h.x; b.ty = h.y;
      world.slams.push({ x: h.x, y: h.y, r: 110, dmg: 0, t: 0.95, done: false, warn: true });
    } else if (atk === 'charge') {
      b.state = 'telegraph'; b.stateT = 0.6; b.pendingAttack = 'charge';
      b.tx = h.x; b.ty = h.y;
    }
  }
}

export function applyBoon(world, boon) {
  boon.apply(world.hero);
  world.pendingLevels -= 1;
  world.toast.push({ text: `Level ${world.hero.level}: ${boon.name} — ${boon.desc}`, t: 2.5 });
  if (world.pendingLevels <= 0) world.state = 'play';
  else world.boonChoices = world.rng.shuffle(BOONS.slice()).slice(0, 3);
}

export function openShop(world) {
  const stock = world.rng.shuffle(SHOP_STOCK.slice()).slice(0, 4);
  world.shopStock = stock.map((s) => ({ ...s, sold: false }));
  world.state = 'shop';
  world.sfx && world.sfx('shop');
}

export function buyShopItem(world, item) {
  const h = world.hero;
  if (item.sold || h.gold < item.price) return;
  h.gold -= item.price;
  item.sold = true;
  if (item.id === 'potion') { h.potions = Math.min(h.potionsMax, h.potions + 2); }
  else if (item.id === 'weapon') { h.weapon.dmg += Math.round(4 + world.vault); }
  else if (item.id === 'armor') { h.armor += 1; h.maxHp += 15; h.hp = Math.min(h.maxHp, h.hp + 15); }
  else if (item.id === 'relic') { const r = rollRelic(world.rng); h.relics.push(r); world.stats.relics += 1; }
  else if (item.id === 'shard') { world.save.shards += 8; writeSave(world.save); }
  world.sfx && world.sfx('coin');
}

export function continueFromShop(world) {
  loadVault(world, world.vault + 1);
  world.state = 'play';
}

export function endRun(world, won) {
  const h = world.hero;
  const timeSec = Math.round((Date.now() - world.runStart) / 1000);
  const shards = shardsForRun(world.vault - (won ? 0 : 1), h.kills, won);
  const result = { won, vaultsCleared: won ? 9 : Math.max(0, world.vault - 1), kills: h.kills, time: timeSec, shards, damage: h.damageDealt };
  recordRun(world.save, result);
  world.runResult = result;
  world.state = won ? 'campaign' : 'defeat';
  world.sfx && world.sfx(won ? 'win' : 'lose');
}

export function updateCamera(world) {
  const h = world.hero;
  if (!h || !world.dungeon) return;
  const d = world.dungeon;
  const cx = clamp(h.x - VIEW_W / 2, 0, Math.max(0, d.w - VIEW_W));
  const cy = clamp(h.y - VIEW_H / 2, 0, Math.max(0, d.h - VIEW_H));
  world.cam.x = cx;
  world.cam.y = cy;
}

export function vaultName(world) {
  const def = VAULTS[world.vault - 1];
  return def ? `Vault ${world.vault} · ${def.name}` : '';
}
