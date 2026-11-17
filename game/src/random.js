// Seeded random stream (mulberry32) plus small helpers. Every run and every
// screenshot scene builds from one of these, so a seed replays exactly.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
    chance(p) { return this.next() < p; },
    range(min, max) { return min + this.next() * (max - min); },
    shuffle(arr) {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// Deterministic id for a run, from the wall clock once per run.
export function runId() { return Math.floor(Date.now() / 1000).toString(36).toUpperCase(); }
