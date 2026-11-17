// Persistent save: shards, the skill tree, and best-run records. One key,
// one JSON object, written on every change that matters.
import { SAVE_KEY } from './config.js';

export function blankSave() {
  return {
    shards: 0, skills: {},
    bestVault: 0, bestKills: 0, bestTime: 0,
    runs: 0, wins: 0, totalKills: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blankSave();
    const s = JSON.parse(raw);
    return { ...blankSave(), ...s, skills: { ...(s.skills || {}) } };
  } catch {
    return blankSave();
  }
}

export function writeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or blocked */ }
}

export function recordRun(save, result) {
  save.runs += 1;
  save.totalKills += result.kills;
  if (result.vaultsCleared > save.bestVault) save.bestVault = result.vaultsCleared;
  if (result.kills > save.bestKills) save.bestKills = result.kills;
  if (result.won) {
    save.wins += 1;
    if (!save.bestTime || result.time < save.bestTime) save.bestTime = result.time;
  }
  save.shards += result.shards;
  writeSave(save);
}
