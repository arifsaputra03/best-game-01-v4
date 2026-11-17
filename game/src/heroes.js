// The three heroes. Each has its own weapon, special ability, and feel —
// the choice on the title screen changes how every vault plays.
export const HEROES = [
  {
    id: 'vanguard', name: 'Vanguard', title: 'Blade of the Deep',
    desc: 'A heavy sword, wide arcs, and a shield-bash that staggers crowds.',
    color: '#ffd76a', dark: '#8a6a1f',
    hp: 120, speed: 205, damage: 26, range: 92, rate: 2.1, armor: 2, crit: 0.05,
    special: { id: 'bash', name: 'Shield Bash', desc: 'Stagger every enemy near you', cd: 7 },
    weapon: 'Gloomblade',
  },
  {
    id: 'embermage', name: 'Embermage', title: 'Voice of the Coals',
    desc: 'Slow fireballs that explode, and a nova that burns everything close.',
    color: '#ff9a4d', dark: '#8a4a1f',
    hp: 85, speed: 195, damage: 30, range: 340, rate: 1.5, armor: 0, crit: 0.10,
    special: { id: 'nova', name: 'Ember Nova', desc: 'A ring of fire around you', cd: 9 },
    weapon: 'Coalheart Staff',
  },
  {
    id: 'thornbow', name: 'Thornbow', title: 'Last Arrow of the Veil',
    desc: 'Fast arrows, long reach, and a volley that rains down on a spot.',
    color: '#7fe08a', dark: '#2a6a34',
    hp: 95, speed: 225, damage: 17, range: 420, rate: 3.4, armor: 1, crit: 0.18,
    special: { id: 'volley', name: 'Thorn Volley', desc: 'Arrows rain on the cursor', cd: 8 },
    weapon: 'Veilbow',
  },
];

export function makeHero(heroId, meta) {
  const def = HEROES.find((h) => h.id === heroId) || HEROES[0];
  const m = meta || {};
  const h = {
    def, x: 0, y: 0, r: 16, angle: 0,
    maxHp: def.hp + (m.hpBonus || 0), hp: def.hp + (m.hpBonus || 0),
    speed: def.speed, dmgMul: 1 + (m.dmgBonus || 0), speedMul: 1,
    damage: def.damage, range: def.range, rate: def.rate, armor: def.armor,
    crit: def.crit, regen: 0, goldMul: 1, dashCdMax: 1.6, specialCdMax: def.special.cd,
    level: 1, xp: 0, xpNext: 20, gold: 40 + (m.goldBonus || 0), shards: 0,
    potions: 2 + (m.potionBonus || 0), potionsMax: 2 + (m.potionBonus || 0),
    dashCd: 0, specialCd: 0, attackCd: 0, iframes: 0, dashTime: 0,
    weapon: { name: def.weapon, rarity: 'common', dmg: 0, tier: 1 },
    armorItem: null, trinket: null, relics: [],
    kills: 0, damageDealt: 0, vaultsCleared: 0, chestsOpened: 0,
    dashing: false, dead: false,
  };
  return h;
}

export function heroDamage(h) {
  return Math.round((h.damage + h.weapon.dmg + (h.weapon.tier - 1) * 4) * h.dmgMul);
}
export function heroHasRelic(h, id) { return h.relics.some((r) => r.id === id); }
