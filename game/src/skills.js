// The meta skill tree: shards earned in every run (win or lose) buy
// permanent upgrades on the title screen. This is what makes the tenth run
// stronger than the first, and what a new player keeps after a defeat.
export const SKILL_TREE = [
  { id: 'hp', name: 'Deep Blood', desc: '+12 max HP per tier', max: 3, cost: [10, 18, 30], icon: '♥' },
  { id: 'dmg', name: 'Sharp Edge', desc: '+6% damage per tier', max: 3, cost: [12, 22, 36], icon: '⚔' },
  { id: 'gold', name: 'Greed', desc: '+15% gold per tier', max: 3, cost: [8, 15, 26], icon: '◆' },
  { id: 'potion', name: 'Alchemist', desc: '+1 potion per tier', max: 2, cost: [15, 28], icon: '⚗' },
  { id: 'dash', name: 'Wind Step', desc: 'Dash cooldown −15% per tier', max: 2, cost: [14, 26], icon: '»' },
  { id: 'crit', name: 'Deadly Eye', desc: '+5% crit per tier', max: 3, cost: [10, 18, 30], icon: '◎' },
  { id: 'xp', name: 'Quick Mind', desc: '+12% XP per tier', max: 3, cost: [9, 16, 28], icon: '✦' },
  { id: 'relic', name: 'Relic Hunter', desc: 'Start each run with a random relic', max: 1, cost: [40], icon: '⬡' },
];

export function skillBonus(skills) {
  const b = { hpBonus: 0, dmgBonus: 0, goldBonus: 0, potionBonus: 0, dashMul: 1, critBonus: 0, xpMul: 1, startRelic: false };
  const t = (id) => (skills && skills[id]) || 0;
  b.hpBonus = t('hp') * 12;
  b.dmgBonus = t('dmg') * 0.06;
  b.goldBonus = t('gold') * 10;
  b.potionBonus = t('potion');
  b.dashMul = Math.pow(0.85, t('dash'));
  b.critBonus = t('crit') * 0.05;
  b.xpMul = 1 + t('xp') * 0.12;
  b.startRelic = t('relic') > 0;
  return b;
}

export function skillCost(node, tier) { return node.cost[tier] || 999; }
export function canBuy(save, node) {
  const tier = (save.skills && save.skills[node.id]) || 0;
  return tier < node.max && save.shards >= skillCost(node, tier);
}
