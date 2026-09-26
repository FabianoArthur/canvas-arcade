import type { Action, InputFrame } from '../../engine/input';
import { pilotFrame } from '../pilot';
import type { Cell, SnakeState } from './logic';

const MOVES: { action: Action; d: Cell }[] = [
  { action: 'up', d: { x: 0, y: -1 } },
  { action: 'down', d: { x: 0, y: 1 } },
  { action: 'left', d: { x: -1, y: 0 } },
  { action: 'right', d: { x: 1, y: 0 } },
];

/** BFS distances from `start` over free cells. */
function distances(s: SnakeState, blocked: Set<number>, start: Cell): Map<number, number> {
  const dist = new Map<number, number>([[start.y * s.cols + start.x, 0]]);
  const queue: Cell[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i] as Cell;
    const base = dist.get(c.y * s.cols + c.x) ?? 0;
    for (const { d } of MOVES) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      const key = n.y * s.cols + n.x;
      if (n.x < 0 || n.y < 0 || n.x >= s.cols || n.y >= s.rows) continue;
      if (blocked.has(key) || dist.has(key)) continue;
      dist.set(key, base + 1);
      queue.push(n);
    }
  }
  return dist;
}

/**
 * Demo-mode player: head for the food by the shortest path, but only take a
 * move that leaves enough open space to fit the body — otherwise pick the
 * roomiest move. Not perfect, but it plays a convincing game.
 */
export function snakePilot(): (s: SnakeState) => InputFrame {
  return (s) => {
    // Decide only on the step that will move, with nothing already queued.
    if (s.queue.length > 0 || s.sinceMove + 1 < s.interval) return pilotFrame();
    const head = s.body[0];
    if (!head) return pilotFrame();
    const blocked = new Set(s.body.slice(0, -1).map((c) => c.y * s.cols + c.x));
    const foodKey = s.food.y * s.cols + s.food.x;

    let best: { action: Action; room: number; food: number } | null = null;
    for (const { action, d } of MOVES) {
      if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
      const n = { x: head.x + d.x, y: head.y + d.y };
      const key = n.y * s.cols + n.x;
      if (n.x < 0 || n.y < 0 || n.x >= s.cols || n.y >= s.rows || blocked.has(key)) continue;
      const reach = distances(s, blocked, n);
      const room = reach.size;
      const food = reach.get(foodKey) ?? Infinity;
      const safe = room >= s.body.length + 2;
      const better =
        !best ||
        (safe && best.room < s.body.length + 2) ||
        (safe === best.room >= s.body.length + 2 &&
          (safe ? food < best.food || (food === best.food && room > best.room) : room > best.room));
      if (better) best = { action, room, food };
    }
    if (!best) return pilotFrame();
    const current = MOVES.find((m) => m.d.x === s.dir.x && m.d.y === s.dir.y)?.action;
    return best.action === current ? pilotFrame() : pilotFrame([best.action]);
  };
}
