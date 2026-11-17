// Loot, equipment and relics. Kills drop gold and sometimes gear; chests
// always drop something worth opening; relics are the run's build-defining
// passives. Rarity multiplies the numbers and colours the name.
import { RARITIES } from './config.js';

const WEAPON_NAMES = ['Gloomblade', 'Emberbrand', 'Thornedge', 'Tidecaller', 'Ashfang', 'Veilpiercer', 'Kingsfall', 'Dawnreaper'];
const ARMOR_NAMES = ['Drowned Mail', 'Cinder Plate', 'Veilweave', 'Brutehide', 'Warden\'s Guard', 'Hollow Shell'];
const TRINKET_NAMES = ['Coin of Greed', 'Ember Charm', 'Wisp Lantern', 'Frost Sigil', 'Bloodstone', 'King\'s Tooth'];

export const RELICS = [
  { id: 'vampiric', name: 'Vampiric Fang', desc: 'Heal 2 HP on every kill', color: '#ff6a6a' },
  { id: 'thorns', name: 'Thornmail', desc: 'Attackers take 6 damage back', color: '#7fe08a' },
  { id: 'swift', name: 'Wind Sigil', desc: 'Move speed +10%', color: '#6fd3e7' },
  { id: 'greed', name: 'Greed Idol', desc: 'Gold find +35%', color: '#ffd76a' },
  { id: 'bulwark', name: 'Bulwark Stone', desc: 'Armor +2', color: '#b8c4d8' },
  { id: 'ember', name: 'Ember Core', desc: 'Attacks burn: +4 damage over 2s', color: '#ff9a4d' },
  { id: 'secondwind', name: 'Second Wind', desc: 'Once per vault, survive a fatal hit at 1 HP', color: '#c78bff' },
  { id: 'magnet', name: 'Lodestone', desc: 'Pickups fly to you from farther away', color: '#a8d8ff' },
];

export function rollRarity(rng) {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let roll = rng.next() * total;
  for (const r of RARITIES) { roll -= r.weight; if (roll <= 0) return r; }
  return RARITIES[0];
}

export function rollLoot(rng, vault, slot) {
  const rarity = rollRarity(rng);
  const base = 3 + vault * 2;
  if (slot === 'weapon') {
    return { slot: 'weapon', name: rng.pick(WEAPON_NAMES), rarity: rarity.id, color: rarity.color, dmg: Math.round(base * rarity.mult), tier: 1 + Math.floor(rng.next() * 2) };
  }
  if (slot === 'armor') {
    return { slot: 'armor', name: rng.pick(ARMOR_NAMES), rarity: rarity.id, color: rarity.color, armor: 1 + Math.floor(rng.next() * 2), hp: Math.round(10 * rarity.mult) };
  }
  return { slot: 'trinket', name: rng.pick(TRINKET_NAMES), rarity: rarity.id, color: rarity.color, crit: 0.05 + rng.next() * 0.08, goldMul: 1 + rng.next() * 0.25 };
}

export function rollRelic(rng) { return rng.pick(RELICS); }

export function applyArmorItem(hero, item) {
  if (!item) return;
  hero.armor += item.armor || 0;
  hero.maxHp += item.hp || 0;
  hero.hp = Math.min(hero.maxHp, hero.hp + (item.hp || 0));
}
export function removeArmorItem(hero, item) {
  if (!item) return;
  hero.armor -= item.armor || 0;
  hero.maxHp -= item.hp || 0;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

// Compare a drop with what the hero wears; the better one wins by score.
export function lootScore(item) {
  if (item.slot === 'weapon') return item.dmg + item.tier * 4;
  if (item.slot === 'armor') return item.armor * 8 + item.hp * 0.3;
  return (item.crit || 0) * 100 + (item.goldMul - 1) * 40;
}
