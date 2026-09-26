import type { InputFrame } from '../../engine/input';
import { pilotFrame } from '../pilot';
import { WIDTH, type BreakoutState } from './logic';

/** Where the ball will cross the paddle's row, folding in side-wall bounces. */
function predictX(s: BreakoutState): number {
  const { ball, paddle } = s;
  if (ball.vy <= 0) return ball.x;
  const t = (paddle.y - ball.r - ball.y) / ball.vy;
  const span = WIDTH - 2 * ball.r;
  let x = ball.x - ball.r + ball.vx * t;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  return (x > span ? 2 * span - x : x) + ball.r;
}

/**
 * Demo-mode player: meet the ball where it will land, hitting it slightly
 * off-centre toward the remaining bricks so rallies keep making progress.
 */
export function breakoutPilot(): (s: BreakoutState) => InputFrame {
  let steps = 0;
  return (s) => {
    steps += 1;
    if (s.stuck) return steps % 30 === 0 ? pilotFrame(['action']) : pilotFrame();
    const alive = s.bricks.filter((b) => b.alive);
    const centroid = alive.reduce((sum, b) => sum + b.x + b.w / 2, 0) / Math.max(1, alive.length);
    const landing = predictX(s);
    const aim = Math.max(-1, Math.min(1, (centroid - landing) / (WIDTH / 2)));
    const target = landing - aim * s.paddle.w * 0.35;
    const delta = target - s.paddle.x;
    if (Math.abs(delta) < 4) return pilotFrame();
    return pilotFrame([], [delta < 0 ? 'left' : 'right']);
  };
}
