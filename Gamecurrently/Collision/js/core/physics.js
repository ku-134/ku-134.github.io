import CONFIG from '../config.js';

// 位移积分
export function move(ball, dt) {
  ball.x += Math.cos(ball.angle) * ball.speed * dt;
  ball.y += Math.sin(ball.angle) * ball.speed * dt;
}

function fireCollision(ball, other, ctx, t) {
  if (t - ball.lastCollide < CONFIG.COLLIDE_COOLDOWN) return;
  ball.lastCollide = t;
  ctx.events.emit('collision', { ball, other, t });
  ctx.effects.emitCollision(ball, other, ctx);
}

// 边界反弹，返回是否碰撞
export function collideWalls(ball, ctx, t) {
  const { w, h } = CONFIG.FIELD;
  const r = ball.radiusScaled;
  let hit = false;
  if (ball.x < r) { ball.x = r; ball.setAngle(Math.PI - ball.angle); hit = true; }
  else if (ball.x > w - r) { ball.x = w - r; ball.setAngle(Math.PI - ball.angle); hit = true; }
  if (ball.y < r) { ball.y = r; ball.setAngle(-ball.angle); hit = true; }
  else if (ball.y > h - r) { ball.y = h - r; ball.setAngle(-ball.angle); hit = true; }
  if (hit) fireCollision(ball, null, ctx, t);
  return hit;
}

// 球与球：分离 + 弹性反弹（同质量交换法向速度），返回是否碰撞
export function collideBalls(a, b, ctx, t) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const minD = a.radiusScaled + b.radiusScaled;
  if (d >= minD) return false;
  const nx = dx / d, ny = dy / d;
  const overlap = minD - d;
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
  b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  const avn = a.vx * nx + a.vy * ny;
  const bvn = b.vx * nx + b.vy * ny;
  if (avn - bvn > 0) {
    a.setAngle(Math.atan2(a.vy - (avn - bvn) * ny, a.vx - (avn - bvn) * nx));
    b.setAngle(Math.atan2(b.vy + (avn - bvn) * ny, b.vx + (avn - bvn) * nx));
  }
  fireCollision(a, b, ctx, t);
  fireCollision(b, a, ctx, t);
  return true;
}
