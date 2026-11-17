// Every enemy the deep throws at you: 12 kinds with their own behaviour,
// plus the 3 bosses that end each realm. Stats scale with the vault.
import { enemyScale } from './config.js';

export const ENEMIES = {
  shambler: { name: 'Shambler', hp: 34, speed: 62, dmg: 10, r: 15, color: '#8a94a8', xp: 6, gold: 4, kind: 'chase', desc: 'Slow, relentless, always coming.' },
  wisp: { name: 'Wisp', hp: 20, speed: 108, dmg: 8, r: 11, color: '#6fd3e7', xp: 7, gold: 5, kind: 'drift', desc: 'Drifts toward you in lazy arcs.' },
  bat: { name: 'Cave Bat', hp: 14, speed: 165, dmg: 6, r: 10, color: '#c78bff', xp: 5, gold: 3, kind: 'swarm', desc: 'Fast, erratic, comes in packs.' },
  spitter: { name: 'Spitter', hp: 26, speed: 58, dmg: 9, r: 13, color: '#7fe08a', xp: 9, gold: 6, kind: 'ranged', desc: 'Keeps its distance and spits.' },
  beetle: { name: 'Iron Beetle', hp: 85, speed: 42, dmg: 14, r: 18, color: '#b8c4d8', xp: 12, gold: 8, kind: 'armored', desc: 'A walking wall. Hit it twice.' },
  charger: { name: 'Charger', hp: 40, speed: 70, dmg: 16, r: 14, color: '#ff9a4d', xp: 10, gold: 6, kind: 'charge', desc: 'Telegraphs, then charges hard.' },
  splitter: { name: 'Splitter', hp: 44, speed: 74, dmg: 9, r: 14, color: '#ffd76a', xp: 10, gold: 6, kind: 'split', desc: 'Dies into two mites.' },
  mite: { name: 'Mite', hp: 10, speed: 150, dmg: 5, r: 8, color: '#ffe9a8', xp: 2, gold: 1, kind: 'swarm', desc: 'Small, fast, everywhere.' },
  imp: { name: 'Cinder Imp', hp: 30, speed: 120, dmg: 9, r: 12, color: '#ff6a4d', xp: 9, gold: 6, kind: 'chase', desc: 'Quick and spiteful.' },
  drake: { name: 'Ash Drake', hp: 48, speed: 128, dmg: 13, r: 15, color: '#ff9a4d', xp: 13, gold: 9, kind: 'swoop', desc: 'Circles, then swoops through you.' },
  frost: { name: 'Frost Wight', hp: 38, speed: 66, dmg: 11, r: 14, color: '#a8d8ff', xp: 11, gold: 7, kind: 'frost', desc: 'Its touch slows your steps.' },
  cultist: { name: 'Gloom Cultist', hp: 32, speed: 60, dmg: 10, r: 13, color: '#c78bff', xp: 13, gold: 8, kind: 'summon', desc: 'Calls wisps to its side.' },
  shade: { name: 'Shade', hp: 52, speed: 96, dmg: 14, r: 14, color: '#8a6fd3', xp: 15, gold: 10, kind: 'phase', desc: 'Blinks across the room.' },
  brute: { name: 'Stone Brute', hp: 150, speed: 46, dmg: 22, r: 22, color: '#9a8a7a', xp: 20, gold: 14, kind: 'brute', desc: 'Big, slow, and impossible to ignore.' },
};

export const BOSSES = {
  tidewarden: {
    name: 'Tide Warden', title: 'Keeper of the Drowned Gate', hp: 620, speed: 52, dmg: 18, r: 30,
    color: '#6fd3e7', xp: 120, gold: 120,
    attacks: ['radial', 'summon', 'charge'],
    desc: 'Three waves of shots, then a rush. Break its guard between volleys.',
  },
  embermatriarch: {
    name: 'Ember Matriarch', title: 'Mother of the Cinder Brood', hp: 900, speed: 58, dmg: 20, r: 32,
    color: '#ff9a4d', xp: 180, gold: 180,
    attacks: ['radial', 'summon', 'slam'],
    desc: 'Hatches drakes, slams the floor, and burns the ground beneath you.',
  },
  hollowking: {
    name: 'The Hollow King', title: 'He Who Sits the Last Throne', hp: 1300, speed: 64, dmg: 24, r: 34,
    color: '#c78bff', xp: 300, gold: 300,
    attacks: ['radial', 'summon', 'slam', 'charge'],
    desc: 'Every trick the deep knows, in one crown. Two phases; the second is worse.',
  },
};

export function makeEnemy(type, x, y, vault, elite) {
  const def = ENEMIES[type];
  const s = enemyScale(vault) * (elite ? 1.9 : 1);
  return {
    type, def, x, y, r: def.r * (elite ? 1.35 : 1), elite: !!elite,
    maxHp: Math.round(def.hp * s), hp: Math.round(def.hp * s),
    speed: def.speed * (elite ? 0.9 : 1), dmg: Math.round(def.dmg * (1 + (vault - 1) * 0.12)),
    xp: def.xp, gold: def.gold, angle: 0, hitCd: 0, shootCd: 1 + Math.random() * 2,
    state: 'idle', stateT: 0, tx: x, ty: y, slowT: 0, flash: 0, stagger: 0,
    boss: false, phase: 1, attackT: 2, summonCd: 6,
  };
}

export function makeBoss(bossId, x, y, vault) {
  const def = BOSSES[bossId];
  const s = enemyScale(vault);
  return {
    type: bossId, def, x, y, r: def.r, elite: false, boss: true,
    maxHp: Math.round(def.hp * s), hp: Math.round(def.hp * s),
    speed: def.speed, dmg: def.dmg, xp: def.xp, gold: def.gold,
    angle: 0, hitCd: 0, shootCd: 2, state: 'idle', stateT: 0, tx: x, ty: y,
    slowT: 0, flash: 0, stagger: 0, phase: 1, attackT: 2.5, summonCd: 5,
  };
}

// How many enemies a vault throws at you, split across its combat rooms.
export function vaultEnemyCount(vault) { return 14 + vault * 4; }
