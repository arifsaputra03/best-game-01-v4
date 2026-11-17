// Combat: projectiles, damage numbers, particles, pickups, and the circle-vs-
// rectangle collision that keeps everything inside the dungeon's walls.
import { clamp } from './random.js';

export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function pushOutOfWalls(ent, walls) {
  for (const w of walls) {
    if (!circleHitsRect(ent.x, ent.y, ent.r, w)) continue;
    const nx = clamp(ent.x, w.x, w.x + w.w);
    const ny = clamp(ent.y, w.y, w.y + w.h);
    let dx = ent.x - nx, dy = ent.y - ny;
    let d = Math.hypot(dx, dy);
    if (d === 0) { // centre inside the wall: push out along the smallest side
      const left = ent.x - w.x, right = w.x + w.w - ent.x;
      const top = ent.y - w.y, bottom = w.y + w.h - ent.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) ent.x = w.x - ent.r;
      else if (m === right) ent.x = w.x + w.w + ent.r;
      else if (m === top) ent.y = w.y - ent.r;
      else ent.y = w.y + w.h + ent.r;
      continue;
    }
    dx /= d; dy /= d;
    ent.x = nx + dx * ent.r;
    ent.y = ny + dy * ent.r;
  }
}

export function pointInWalls(x, y, walls) {
  return walls.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}

export function makeProjectile(x, y, angle, speed, dmg, from, opts) {
  return {
    x, y, angle, speed, dmg, from,
    r: (opts && opts.r) || 6, life: (opts && opts.life) || 1.6,
    color: (opts && opts.color) || '#ffd76a', pierce: (opts && opts.pierce) || 0,
    explode: !!(opts && opts.explode), slow: (opts && opts.slow) || 0, burn: (opts && opts.burn) || 0,
    dead: false, trail: [],
  };
}

export function stepProjectiles(world, dt) {
  const { projectiles, hero, enemies } = world;
  const walls = world.dungeon.walls;
  for (const p of projectiles) {
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    p.life -= dt;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
    if (p.life <= 0) { p.dead = true; continue; }
    if (pointInWalls(p.x, p.y, walls)) {
      if (p.explode) explode(world, p.x, p.y, p.dmg * 0.6, 70, p.from);
      p.dead = true; continue;
    }
    if (p.from === 'hero') {
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < e.r + p.r) {
          damageEnemy(world, e, p.dmg, p);
          if (p.explode) explode(world, p.x, p.y, p.dmg * 0.6, 70, 'hero');
          if (p.pierce > 0) { p.pierce -= 1; }
          else { p.dead = true; }
          break;
        }
      }
    } else if (p.from === 'enemy') {
      if (hero.iframes <= 0 && hero.dashTime <= 0) {
        const d = Math.hypot(hero.x - p.x, hero.y - p.y);
        if (d < hero.r + p.r) { damageHero(world, p.dmg); p.dead = true; }
      }
    }
  }
  world.projectiles = projectiles.filter((p) => !p.dead);
}

export function explode(world, x, y, dmg, radius, from) {
  burst(world, x, y, '#ff9a4d', 14, 160);
  world.shake = Math.max(world.shake || 0, 5);
  if (from === 'hero') {
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - x, e.y - y) < radius + e.r) damageEnemy(world, e, dmg, null);
    }
  } else if (from === 'enemy') {
    const h = world.hero;
    if (Math.hypot(h.x - x, h.y - y) < radius + h.r) damageHero(world, dmg);
  }
}

export function damageEnemy(world, e, dmg, source) {
  if (e.hp <= 0) return;
  let final = Math.max(1, Math.round(dmg));
  const hero = world.hero;
  if (source && source.from === 'hero') {
    if (Math.random() < hero.crit) { final = Math.round(final * 2); world.floaters.push({ x: e.x, y: e.y - 20, text: `${final}!`, color: '#ffd76a', t: 0.8 }); }
  }
  e.hp -= final;
  e.flash = 0.12;
  hero.damageDealt += final;
  world.floaters.push({ x: e.x + (Math.random() * 20 - 10), y: e.y - 14, text: `${final}`, color: '#ffffff', t: 0.7 });
  if (e.def.kind === 'armored' && Math.random() < 0.4) burst(world, e.x, e.y, '#b8c4d8', 4, 60);
  if (source && source.burn) { e.burnT = 2; e.burnDps = source.burn; }
  if (source && source.slow) e.slowT = Math.max(e.slowT, source.slow);
  if (e.hp <= 0) killEnemy(world, e);
}

export function killEnemy(world, e) {
  const hero = world.hero;
  hero.kills += 1;
  hero.xp += Math.round(e.xp * (world.xpMul || 1));
  burst(world, e.x, e.y, e.def.color, e.boss ? 30 : 12, e.boss ? 260 : 140);
  world.floaters.push({ x: e.x, y: e.y - 26, text: `+${e.xp} XP`, color: '#7fe08a', t: 0.9 });
  const gold = Math.round(e.gold * hero.goldMul);
  for (let i = 0; i < Math.min(3, Math.ceil(gold / 4)); i++) {
    world.pickups.push({ kind: 'gold', x: e.x + (Math.random() * 30 - 15), y: e.y + (Math.random() * 30 - 15), v: Math.ceil(gold / 3), t: 0 });
  }
  if (Math.random() < 0.06) world.pickups.push({ kind: 'potion', x: e.x, y: e.y, v: 1, t: 0 });
  if (Math.random() < 0.10 && !e.boss) world.pickups.push({ kind: 'loot', x: e.x + 14, y: e.y, v: 0, t: 0 });
  if (e.def.kind === 'split') {
    for (let i = 0; i < 2; i++) {
      const m = { type: 'mite', def: null, x: e.x + (i ? 14 : -14), y: e.y, r: 8, hp: 10, maxHp: 10, speed: 150, dmg: 5, xp: 2, gold: 1, angle: 0, hitCd: 0, shootCd: 0, state: 'idle', stateT: 0, tx: e.x, ty: e.y, slowT: 0, flash: 0, stagger: 0, boss: false, phase: 1, attackT: 0, summonCd: 0, elite: false };
      m.def = world.enemyDefs.mite;
      world.enemies.push(m);
    }
  }
  if (e.boss) world.bossDown = true;
  if (hero.relics.some((r) => r.id === 'vampiric')) {
    hero.hp = Math.min(hero.maxHp, hero.hp + 2);
  }
  checkLevelUp(world);
}

export function damageHero(world, dmg) {
  const hero = world.hero;
  if (hero.iframes > 0 || hero.dashTime > 0 || hero.dead) return;
  let final = Math.max(1, Math.round(dmg) - hero.armor);
  hero.hp -= final;
  hero.iframes = 0.7;
  world.shake = Math.max(world.shake || 0, 7);
  burst(world, hero.x, hero.y, '#ff6a6a', 8, 120);
  world.floaters.push({ x: hero.x, y: hero.y - 24, text: `-${final}`, color: '#ff6a6a', t: 0.8 });
  if (hero.hp <= 0) {
    const sw = hero.relics.find((r) => r.id === 'secondwind');
    if (sw && !world.secondWindUsed) {
      world.secondWindUsed = true;
      hero.hp = 1; hero.iframes = 2;
      world.floaters.push({ x: hero.x, y: hero.y - 40, text: 'SECOND WIND!', color: '#c78bff', t: 1.4 });
      return;
    }
    hero.hp = 0; hero.dead = true;
  }
}

export function checkLevelUp(world) {
  const hero = world.hero;
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level += 1;
    hero.xpNext = 20 + (hero.level - 1) * 14 + Math.floor((hero.level - 1) * (hero.level - 1) * 2.5);
    world.pendingLevels += 1;
  }
}

export function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.4 + Math.random() * 0.3, max: 0.7, color, r: 2 + Math.random() * 3 });
  }
}

export function stepParticles(world, dt) {
  for (const p of world.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.t -= dt;
  }
  world.particles = world.particles.filter((p) => p.t > 0);
  for (const f of world.floaters) { f.y -= 34 * dt; f.t -= dt; }
  world.floaters = world.floaters.filter((f) => f.t > 0);
}
