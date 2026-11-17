// Deterministic screenshot scenes: ?shot=<scene>&seed=<n> builds a fixed
// world state and lets the render draw exactly that frame. No wall clock,
// no input, same layout every run.
import { makeRng } from './random.js';
import { newWorld, startRun, loadVault } from './world.js';
import { makeEnemy, makeBoss } from './enemies.js';
import { rollLoot, rollRelic } from './items.js';
import { roomCenter } from './dungeon.js';

export function buildShot(world, scene, seed) {
  const rng = makeRng(seed || 1);
  world.rng = rng;
  world.sfx = null;

  if (scene === 'start') {
    // Title screen: a rich skill tree and a mid-tier hero picked.
    world.state = 'title';
    world.titleSel = 1;
    world.save.shards = 46;
    world.save.skills = { hp: 2, dmg: 1, gold: 1, xp: 1 };
    world.save.bestVault = 6;
    world.save.bestKills = 214;
    world.save.wins = 1;
    world.save.runs = 12;
    return 'start';
  }

  if (scene === 'play' || scene === 'boss') {
    const vault = scene === 'boss' ? 9 : 5;
    startRun(world, scene === 'boss' ? 'vanguard' : 'embermage');
    // Rebuild the vault from the scene seed so the layout is fixed.
    world.rng = makeRng(seed || 1);
    loadVault(world, vault);
    const h = world.hero;
    h.level = scene === 'boss' ? 9 : 6;
    h.xp = 40; h.xpNext = 96;
    h.gold = scene === 'boss' ? 342 : 218;
    h.hp = Math.round(h.maxHp * 0.72);
    h.potions = 3; h.potionsMax = 3;
    h.weapon = { name: 'Emberbrand', rarity: 'rare', color: '#c78bff', dmg: 14, tier: 3 };
    h.armorItem = { name: 'Cinder Plate', rarity: 'fine', color: '#6fd3e7', armor: 2, hp: 22 };
    h.trinket = { name: 'Ember Charm', rarity: 'rare', color: '#c78bff', crit: 0.09, goldMul: 1.2 };
    h.relics = [rollRelic(rng), rollRelic(rng)];
    h.kills = scene === 'boss' ? 187 : 96;
    world.time = scene === 'boss' ? 1243 : 642;
    // Place the hero in the middle of the map, mid-fight.
    const mid = world.dungeon.rooms[5];
    const c = roomCenter(mid.gx, mid.gy);
    h.x = c.x; h.y = c.y + 40;
    h.aimAngle = -0.5;
    // A crowd of enemies around the hero, from this vault's pool.
    const pool = world.dungeon.def.enemies;
    const spots = [
      [-120, -70, 0], [90, -110, 1], [150, 40, 2], [-160, 60, 3],
      [60, 120, 0], [-60, -140, 4], [180, -60, 1], [-190, -20, 2],
    ];
    world.enemies = [];
    spots.forEach(([dx, dy, pi], i) => {
      const type = pool[pi % pool.length];
      const e = makeEnemy(type, c.x + dx, c.y + dy, vault, i === 2);
      e.hp = Math.round(e.maxHp * (0.4 + (i % 4) * 0.15));
      world.enemies.push(e);
    });
    if (scene === 'boss') {
      const boss = makeBoss(world.dungeon.def.boss, c.x, c.y - 130, vault);
      boss.hp = Math.round(boss.maxHp * 0.62);
      boss.phase = 2;
      world.enemies.push(boss);
      // A few adds around the boss.
      world.enemies.push(makeEnemy('shade', c.x - 120, c.y - 90, vault, false));
      world.enemies.push(makeEnemy('cultist', c.x + 130, c.y - 100, vault, false));
      world.toast.push({ text: 'The Hollow King is enraged!', t: 3 });
    } else {
      world.projectiles.push({
        x: h.x + 90, y: h.y - 60, angle: -0.5, speed: 340, dmg: 30, from: 'hero',
        r: 9, life: 1.0, color: '#ff9a4d', pierce: 0, explode: true, slow: 0, burn: 0,
        dead: false, trail: [{ x: h.x + 40, y: h.y - 30 }, { x: h.x + 65, y: h.y - 45 }],
      });
    }
    world.objective = scene === 'boss' ? 'Slay The Hollow King' : 'Clear every room (4 to go)';
    // Mark rooms cleared so the HUD's room counter matches the objective:
    // 6 of 10 cleared in the play scene (4 to go), 9 of 10 in the boss scene.
    const toClear = scene === 'boss' ? 8 : 5;
    let cleared = 0;
    for (const room of world.dungeon.rooms) {
      if (cleared >= toClear) break;
      if (room.type === 'combat' || room.type === 'elite') { room.cleared = true; cleared += 1; }
    }
    world.roomsCleared = cleared + 1;
    world.state = 'play';
    return scene;
  }

  if (scene === 'win') {
    startRun(world, 'thornbow');
    world.rng = makeRng(seed || 1);
    loadVault(world, 9);
    world.runResult = {
      won: true, vaultsCleared: 9, kills: 342, time: 2145, shards: 96, damage: 48210,
    };
    world.save.bestVault = 9;
    world.save.bestKills = 342;
    world.save.wins = 2;
    world.save.runs = 14;
    world.save.shards = 96;
    world.hero.kills = 342;
    // The HUD behind the panel should read like the end of the same run.
    world.hero.level = 12; world.hero.xp = 60; world.hero.xpNext = 170;
    world.hero.gold = 1240; world.hero.hp = world.hero.maxHp;
    world.time = 2145;
    world.state = 'campaign';
    return 'win';
  }
  return 'start';
}
