// Procedural vaults: a grid of rooms joined by a spanning tree, so every
// vault is a new dungeon but always fully connected. Rooms get a job —
// combat, treasure, elite, entrance, exit — and the boss vaults end in a
// throne room. Walls are plain rectangles; doors are gaps in shared walls.
import { ROOM_W, ROOM_H, WALL, DOOR, GRID_COLS, GRID_ROWS, VAULTS, REALMS } from './config.js';
import { vaultEnemyCount } from './enemies.js';

export function roomRect(gx, gy) {
  return { x: gx * ROOM_W, y: gy * ROOM_H, w: ROOM_W, h: ROOM_H };
}
export function roomCenter(gx, gy) {
  return { x: gx * ROOM_W + ROOM_W / 2, y: gy * ROOM_H + ROOM_H / 2 };
}
export function roomAt(dungeon, x, y) {
  const gx = Math.floor(x / ROOM_W);
  const gy = Math.floor(y / ROOM_H);
  if (gx < 0 || gy < 0 || gx >= GRID_COLS || gy >= GRID_ROWS) return null;
  return dungeon.rooms[gy * GRID_COLS + gx];
}

function spanningTree(rng) {
  // Randomised DFS over the grid; every room reachable, no loops needed.
  const visited = new Set(['0,1']);
  const stack = [[0, 1]];
  const edges = new Set();
  const key = (x, y) => `${x},${y}`;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [cx + dx, cy + dy])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < GRID_COLS && ny < GRID_ROWS && !visited.has(key(nx, ny)));
    if (!nbs.length) { stack.pop(); continue; }
    const [nx, ny] = rng.pick(nbs);
    visited.add(key(nx, ny));
    edges.add(`${key(cx, cy)}>${key(nx, ny)}`);
    stack.push([nx, ny]);
  }
  return edges;
}

function buildWalls(edges) {
  const walls = [];
  const connected = (x1, y1, x2, y2) =>
    edges.has(`${x1},${y1}>${x2},${y2}`) || edges.has(`${x2},${y2}>${x1},${y1}`);
  const half = DOOR / 2;
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const rx = gx * ROOM_W, ry = gy * ROOM_H;
      const cx = rx + ROOM_W / 2, cy = ry + ROOM_H / 2;
      // North wall (two segments, gap in the middle when connected up).
      if (gy === 0) walls.push({ x: rx, y: ry, w: ROOM_W, h: WALL });
      else if (!connected(gx, gy, gx, gy - 1)) walls.push({ x: rx, y: ry, w: ROOM_W, h: WALL });
      else {
        walls.push({ x: rx, y: ry, w: cx - half - rx, h: WALL });
        walls.push({ x: cx + half, y: ry, w: rx + ROOM_W - (cx + half), h: WALL });
      }
      // South wall.
      if (gy === GRID_ROWS - 1) walls.push({ x: rx, y: ry + ROOM_H - WALL, w: ROOM_W, h: WALL });
      else if (!connected(gx, gy, gx, gy + 1)) walls.push({ x: rx, y: ry + ROOM_H - WALL, w: ROOM_W, h: WALL });
      else {
        walls.push({ x: rx, y: ry + ROOM_H - WALL, w: cx - half - rx, h: WALL });
        walls.push({ x: cx + half, y: ry + ROOM_H - WALL, w: rx + ROOM_W - (cx + half), h: WALL });
      }
      // West wall.
      if (gx === 0) walls.push({ x: rx, y: ry, w: WALL, h: ROOM_H });
      else if (!connected(gx, gy, gx - 1, gy)) walls.push({ x: rx, y: ry, w: WALL, h: ROOM_H });
      else {
        walls.push({ x: rx, y: ry, w: WALL, h: cy - half - ry });
        walls.push({ x: rx, y: cy + half, w: WALL, h: ry + ROOM_H - (cy + half) });
      }
      // East wall.
      if (gx === GRID_COLS - 1) walls.push({ x: rx + ROOM_W - WALL, y: ry, w: WALL, h: ROOM_H });
      else if (!connected(gx, gy, gx + 1, gy)) walls.push({ x: rx + ROOM_W - WALL, y: ry, w: WALL, h: ROOM_H });
      else {
        walls.push({ x: rx + ROOM_W - WALL, y: ry, w: WALL, h: cy - half - ry });
        walls.push({ x: rx + ROOM_W - WALL, y: cy + half, w: WALL, h: ry + ROOM_H - (cy + half) });
      }
    }
  }
  return walls;
}

export function generateVault(vaultNum, rng) {
  const def = VAULTS[vaultNum - 1];
  const realm = REALMS[def.realm];
  const edges = spanningTree(rng);
  const rooms = [];
  // Assign jobs: entrance (0,1), exit (3,1), one treasure, one elite, rest combat.
  const jobs = {};
  jobs['0,1'] = 'entrance';
  jobs['3,1'] = def.boss ? 'boss' : 'exit';
  const middles = [];
  for (let gy = 0; gy < GRID_ROWS; gy++) for (let gx = 0; gx < GRID_COLS; gx++) {
    if (!jobs[`${gx},${gy}`]) middles.push([gx, gy]);
  }
  const shuffled = rng.shuffle(middles);
  jobs[`${shuffled[0][0]},${shuffled[0][1]}`] = 'treasure';
  jobs[`${shuffled[1][0]},${shuffled[1][1]}`] = 'elite';
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const type = jobs[`${gx},${gy}`] || 'combat';
      const c = roomCenter(gx, gy);
      const pillars = [];
      if (type === 'combat' || type === 'elite' || type === 'boss') {
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          pillars.push({
            x: c.x + rng.range(-160, 120), y: c.y + rng.range(-110, 70),
            w: rng.int(36, 56), h: rng.int(36, 56),
          });
        }
      }
      rooms.push({
        gx, gy, type, cleared: type === 'entrance', visited: type === 'entrance',
        pillars, torches: [0, 1, 2, 3].map(() => rng.next() < 0.5),
        chest: type === 'treasure' || (type === 'combat' && rng.chance(0.3)),
        chestOpened: false, spawned: false,
      });
    }
  }
  const walls = buildWalls(edges);
  const start = roomCenter(0, 1);
  const exitRoom = rooms.find((r) => r.type === 'boss' || r.type === 'exit');
  const exit = roomCenter(exitRoom.gx, exitRoom.gy);
  return {
    vault: vaultNum, def, realm, rooms, walls, edges,
    start, exit, exitRoom,
    w: GRID_COLS * ROOM_W, h: GRID_ROWS * ROOM_H,
    enemies: [], boss: null, cleared: false,
  };
}

// Spawn the enemies of one room, at random open spots inside it.
export function spawnRoomEnemies(dungeon, room, rng) {
  const out = [];
  const vault = dungeon.vault;
  const def = dungeon.def;
  if (room.type === 'entrance' || room.type === 'treasure') return out;
  let count;
  if (room.type === 'boss') count = 3;
  else if (room.type === 'elite') count = 5;
  else count = Math.max(2, Math.round(vaultEnemyCount(vault) / 9));
  const pool = def.enemies.slice();
  const c = roomCenter(room.gx, room.gy);
  for (let i = 0; i < count; i++) {
    const type = rng.pick(pool);
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(40, 150);
    out.push({ type, x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, elite: room.type === 'elite' && i === 0 });
  }
  if (room.type === 'boss') {
    out.push({ type: def.boss, x: c.x, y: c.y - 60, boss: true });
  }
  return out;
}
