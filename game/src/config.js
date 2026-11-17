// Balance and world constants for GLOAMDEEP. One place for every number the
// designers tune: hero stats, enemy scaling, loot rates, shop prices.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const ROOM_W = 560;
export const ROOM_H = 420;
export const WALL = 26;          // wall thickness around every room
export const DOOR = 84;          // door gap in a shared wall
export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const SAVE_KEY = 'gloamdeep-save-v1';

export const REALMS = [
  { name: 'Sunken Halls', floor: 'I', tint: '#2e4a5e', floorTint: '#24384a', accent: '#6fd3e7', hazard: 'none' },
  { name: 'Ember Warrens', floor: 'II', tint: '#5e2e22', floorTint: '#472219', accent: '#ff9a4d', hazard: 'lava' },
  { name: 'Gloom Throne', floor: 'III', tint: '#3a2a55', floorTint: '#2b1f40', accent: '#c78bff', hazard: 'gloom' },
];

export const VAULTS = [
  { n: 1, name: 'Drowned Gate', realm: 0, enemies: ['shambler', 'wisp', 'bat'], elite: 'beetle', boss: null },
  { n: 2, name: 'Tide Gallery', realm: 0, enemies: ['shambler', 'wisp', 'bat', 'spitter'], elite: 'beetle', boss: null },
  { n: 3, name: 'Warden\'s Deep', realm: 0, enemies: ['shambler', 'spitter', 'bat', 'charger'], elite: 'brute', boss: 'tidewarden' },
  { n: 4, name: 'Cinder Steps', realm: 1, enemies: ['imp', 'bat', 'spitter', 'charger'], elite: 'drake', boss: null },
  { n: 5, name: 'Ashen Market', realm: 1, enemies: ['imp', 'drake', 'frost', 'beetle'], elite: 'cultist', boss: null },
  { n: 6, name: 'Matriarch\'s Nest', realm: 1, enemies: ['imp', 'drake', 'cultist', 'splitter'], elite: 'brute', boss: 'embermatriarch' },
  { n: 7, name: 'Veil Corridor', realm: 2, enemies: ['shade', 'frost', 'splitter', 'spitter'], elite: 'cultist', boss: null },
  { n: 8, name: 'Hollow Choir', realm: 2, enemies: ['shade', 'drake', 'cultist', 'brute'], elite: 'shade', boss: null },
  { n: 9, name: 'The Hollow Throne', realm: 2, enemies: ['shade', 'brute', 'cultist', 'splitter'], elite: 'brute', boss: 'hollowking' },
];

// Enemy power grows with vault number; the hero's gear is expected to grow too.
export function enemyScale(vault) { return 1 + (vault - 1) * 0.22; }
export function xpForLevel(level) { return 20 + (level - 1) * 14 + Math.floor((level - 1) * (level - 1) * 2.5); }
export function vaultGoldReward(vault) { return 40 + vault * 18; }
export function shardsForRun(vaultsCleared, kills, won) {
  return Math.floor(vaultsCleared * 6 + kills * 0.15 + (won ? 30 : 0));
}

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#cfd6e4', mult: 1.0, weight: 52 },
  { id: 'fine', name: 'Fine', color: '#6fd3e7', mult: 1.25, weight: 28 },
  { id: 'rare', name: 'Rare', color: '#c78bff', mult: 1.6, weight: 14 },
  { id: 'mythic', name: 'Mythic', color: '#ffb84d', mult: 2.1, weight: 6 },
];

export const SHOP_STOCK = [
  { id: 'potion', name: 'Ember Flask', desc: 'Heal 60 HP now', price: 45 },
  { id: 'weapon', name: 'Whetstone', desc: 'Weapon damage +12%', price: 90 },
  { id: 'armor', name: 'Runed Plate', desc: 'Armor +1, max HP +15', price: 110 },
  { id: 'relic', name: 'Sealed Relic', desc: 'A random relic', price: 130 },
  { id: 'shard', name: 'Shard Cache', desc: '+8 shards for the skill tree', price: 70 },
];

export const BOONS = [
  { id: 'dmg', name: 'Sharpened Edge', desc: 'Damage +15%', apply: (h) => { h.dmgMul *= 1.15; } },
  { id: 'hp', name: 'Deep Vitality', desc: 'Max HP +25, heal 25', apply: (h) => { h.maxHp += 25; h.hp = Math.min(h.maxHp, h.hp + 25); } },
  { id: 'speed', name: 'Swift Boots', desc: 'Move speed +12%', apply: (h) => { h.speedMul *= 1.12; } },
  { id: 'crit', name: 'Hunter\'s Eye', desc: 'Crit chance +10%', apply: (h) => { h.crit += 0.10; } },
  { id: 'dash', name: 'Wind Step', desc: 'Dash cooldown −25%', apply: (h) => { h.dashCdMax *= 0.75; } },
  { id: 'special', name: 'Quickened Soul', desc: 'Special cooldown −25%', apply: (h) => { h.specialCdMax *= 0.75; } },
  { id: 'gold', name: 'Gilded Touch', desc: 'Gold find +30%', apply: (h) => { h.goldMul *= 1.3; } },
  { id: 'armor', name: 'Iron Skin', desc: 'Armor +1', apply: (h) => { h.armor += 1; } },
  { id: 'regen', name: 'Ember Heart', desc: 'Regenerate 1 HP / second', apply: (h) => { h.regen += 1; } },
  { id: 'potion', name: 'Alchemist\'s Belt', desc: '+1 potion, heal a potion now', apply: (h) => { h.potionsMax += 1; h.potions += 1; } },
];
