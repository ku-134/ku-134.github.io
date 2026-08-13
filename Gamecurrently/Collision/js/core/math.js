export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
export const normAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// 从 (x,y) 沿 dir 发射射线，求与矩形边界的交点
export function rayHitRect(x, y, dir, w, h) {
  const dx = Math.cos(dir), dy = Math.sin(dir);
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (w - x) / dx); else if (dx < 0) t = Math.min(t, -x / dx);
  if (dy > 0) t = Math.min(t, (h - y) / dy); else if (dy < 0) t = Math.min(t, -y / dy);
  t = Math.max(t, 0);
  return { x: x + dx * t, y: y + dy * t };
}
