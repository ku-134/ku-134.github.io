import CONFIG from '../config.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { rayHitRect } from '../core/math.js';

// Canvas 渲染：只管画，不感知职业逻辑
// autoResize=false 用于首页背景（全屏拉伸做氛围）
export class Renderer {
  constructor(canvas, { autoResize = true } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.camera = new Camera();
    this.particles = new Particles();
    this.aimLines = [];
    this.lineFx = [];
    this.autoResize = autoResize;
    if (autoResize) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    } else {
      canvas.width = CONFIG.FIELD.w; canvas.height = CONFIG.FIELD.h;
      this.dpr = 1; this.cssScale = 1;
    }
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = CONFIG.FIELD;
    const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
    this.cssScale = scale; this.dpr = dpr;
    this.canvas.style.width = (w * scale) + 'px';
    this.canvas.style.height = (h * scale) + 'px';
    this.canvas.width = Math.round(w * scale * dpr);
    this.canvas.height = Math.round(h * scale * dpr);
  }
  setAim(inst, on) {
    this.aimLines = this.aimLines.filter(a => a.inst !== inst);
    if (on) {
      const hit = rayHitRect(inst.owner.x, inst.owner.y, inst.aimDir, CONFIG.FIELD.w, CONFIG.FIELD.h);
      this.aimLines.push({ inst, hit });
    }
  }
  addLineFx(ball, hit) { this.lineFx.push({ ball, hit, t: 0 }); }
  update(dt) {
    this.particles.update(dt);
    for (let i = this.lineFx.length - 1; i >= 0; i--) {
      const fx = this.lineFx[i];
      fx.t += dt;
      if (fx.t > 0.3) this.lineFx.splice(i, 1);
    }
  }
  render(balls, t) {
    const g = this.g;
    const { w, h } = CONFIG.FIELD;
    g.setTransform(this.dpr * this.cssScale, 0, 0, this.dpr * this.cssScale, 0, 0);
    g.fillStyle = '#0a0f1e';
    g.fillRect(-24, -24, w + 48, h + 48);
    g.save();
    this.camera.update(t);
    this.camera.apply(g);
    this.drawField(g, w, h);
    for (const a of this.aimLines) this.drawAim(g, a);
    for (const fx of this.lineFx) this.drawLineFx(g, fx);
    for (const b of balls) this.drawBall(g, b);
    this.particles.draw(g);
    g.restore();
  }
  drawField(g, w, h) {
    g.strokeStyle = 'rgba(126,240,200,0.6)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(126,240,200,0.12)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  }
  drawAim(g, a) {
    g.save();
    g.setLineDash([8, 8]);
    g.strokeStyle = a.inst.def.color;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(a.inst.owner.x, a.inst.owner.y); g.lineTo(a.hit.x, a.hit.y); g.stroke();
    g.setLineDash([]);
    g.fillStyle = a.inst.def.color;
    g.beginPath(); g.arc(a.hit.x, a.hit.y, 6, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  drawLineFx(g, fx) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - fx.t / 0.3);
    g.strokeStyle = fx.ball.color;
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(fx.ball.x, fx.ball.y); g.lineTo(fx.hit.x, fx.hit.y); g.stroke();
    g.fillStyle = '#ffd93d';
    g.beginPath(); g.arc(fx.hit.x, fx.hit.y, 8, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  drawBall(g, b) {
    const r = b.radiusScaled;
    if (b.dashing) {
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = b.color;
      for (let i = 1; i <= 3; i++) {
        g.beginPath();
        g.arc(b.x - Math.cos(b.angle) * r * i * 0.8, b.y - Math.sin(b.angle) * r * i * 0.8, r * (1 - i * 0.2), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    g.save();
    const grad = g.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.2, b.x, b.y, r);
    grad.addColorStop(0, '#ffffff' + '88');
    grad.addColorStop(0.35, b.color);
    grad.addColorStop(1, b.color);
    g.fillStyle = grad;
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
    const giant = b.effects.has('giant_form');
    g.lineWidth = giant ? 4 : 2;
    g.strokeStyle = giant ? '#ffd93d' : 'rgba(255,255,255,0.5)';
    if (giant && Math.random() < 0.3) g.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke();
    const ex = b.x + Math.cos(b.angle) * r * 0.35;
    const ey = b.y + Math.sin(b.angle) * r * 0.35;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(ex, ey, r * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.arc(ex + Math.cos(b.angle) * r * 0.12, ey + Math.sin(b.angle) * r * 0.12, r * 0.15, 0, Math.PI * 2); g.fill();
    if (b.flash > 0) {
      g.globalAlpha = Math.min(1, b.flash);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }
}
