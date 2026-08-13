// 轻量粒子系统：碰撞火花、变身、命中、拖尾
export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, { count = 6, color = '#fff', speed = 80, life = 0.5, size = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life, max: life,
        size: size * (0.6 + Math.random() * 0.8),
        color
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(g) {
    for (const p of this.list) {
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
